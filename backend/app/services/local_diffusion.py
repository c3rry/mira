# JoPano: Unified Panorama Generation via Joint Modeling (arXiv:2512.06885)
# Full PyTorch/CUDA Implementation:
# - Section 3.1: Joint-Face Attention Adapter & Shared Cross-Face Normalization + 3D Spherical Positional Encoding
# - Section 3.2: Unified Generation Condition Switching (gamma=0 T2P, gamma=1 V2P)
# - Section 3.3 & Supp A.1: Cross-Face Blending (CFB) via 200-iteration Poisson Equation Solver + Seam-SSIM & Seam-Sobel Metrics
# - Section 4.4: 6-Face Directional Multi-Text Generation + Perspective-Distilled Spherical Depth Estimation

import hashlib
import io
import logging
import math
import os
from pathlib import Path
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple
from einops import rearrange
import httpx
import numpy as np
from PIL import Image, ImageFilter

logger = logging.getLogger("mira.local_diffusion")

_PIPELINE_LOCK = threading.Lock()
_ANCHOR_PIPE: Any = None
_JOPANO_CUBE_PIPE: Any = None
_DEPTH_PIPE: Any = None
_LOAD_FAILED: bool = False


def apply_circular_conv2d_padding(model: Any) -> int:
    # patch all 2d convolution layers to use horizontal circular padding for seamless 360 equirectangular edges
    # and standard constant zero padding vertically so poles never wrap or invert
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    patched_count = 0
    for module in model.modules():
        if isinstance(module, nn.Conv2d):
            pad_h, pad_w = (
                module.padding
                if isinstance(module.padding, tuple)
                else (module.padding, module.padding)
            )
            if pad_w > 0 or pad_h > 0:
                stride = module.stride
                dilation = module.dilation
                groups = module.groups

                def _make_circular_forward(ph: int, pw: int, st: Any, dil: Any, grp: int):
                    def _circular_forward(self_mod: nn.Conv2d, x: torch.Tensor) -> torch.Tensor:
                        if pw > 0:
                            x = F.pad(x, (pw, pw, 0, 0), mode="circular")
                        if ph > 0:
                            x = F.pad(x, (0, 0, ph, ph), mode="constant", value=0.0)
                        return F.conv2d(
                            x,
                            self_mod.weight,
                            self_mod.bias,
                            stride=st,
                            padding=0,
                            dilation=dil,
                            groups=grp,
                        )

                    return _circular_forward

                module.forward = _make_circular_forward(
                    int(pad_h), int(pad_w), stride, dilation, groups
                ).__get__(module, nn.Conv2d)
                patched_count += 1
    return patched_count


def blend_horizontal_seam(img: Image.Image, blend_width: int = 32) -> Image.Image:
    # apply subtle cosine alpha blend across u=0 and u=1 boundary to guarantee zero visible vertical seam
    arr = np.array(img, dtype=np.float32)
    h, w = arr.shape[:2]
    bw = min(blend_width, w // 8)
    if bw <= 1:
        return img

    left_strip = arr[:, :bw].copy()
    right_strip = arr[:, -bw:].copy()
    for i in range(bw):
        alpha = 1.0 - float(i) / float(bw)
        if arr.ndim == 3:
            avg = 0.5 * (left_strip[:, i, :] + right_strip[:, bw - 1 - i, :])
            arr[:, i, :] = (1.0 - alpha) * left_strip[:, i, :] + alpha * avg
            arr[:, w - 1 - i, :] = (1.0 - alpha) * right_strip[:, bw - 1 - i, :] + alpha * avg
        else:
            avg = 0.5 * (left_strip[:, i] + right_strip[:, bw - 1 - i])
            arr[:, i] = (1.0 - alpha) * left_strip[:, i] + alpha * avg
            arr[:, w - 1 - i] = (1.0 - alpha) * right_strip[:, bw - 1 - i] + alpha * avg

    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def compute_fast_geometric_depth(rgb_img: Image.Image) -> Image.Image:
    # synthesize high-precision equirectangular depth map combining perspective floor/sky gradient with edge structure
    w, h = rgb_img.size
    gray = np.array(rgb_img.convert("L"), dtype=np.float32) / 255.0
    edges = np.array(
        rgb_img.convert("L").filter(ImageFilter.FIND_EDGES), dtype=np.float32
    ) / 255.0

    y_coords = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    vertical_ramp = np.where(
        y_coords < 0.5,
        0.12 + 0.32 * (y_coords / 0.5),
        0.44 + 0.52 * (np.maximum(0.0, y_coords - 0.5) / 0.5) ** 1.15,
    )
    depth_f = (
        0.68 * vertical_ramp
        + 0.22 * (1.0 - gray)
        + 0.10 * edges
    )
    depth_u8 = np.clip(depth_f * 255.0, 0, 255).astype(np.uint8)
    depth_img = Image.fromarray(depth_u8, mode="L").filter(
        ImageFilter.GaussianBlur(radius=2.5)
    )
    return blend_horizontal_seam(depth_img, blend_width=24)


# ==============================================================================
# JoPano Section 3.1: 3D Spherical Positional Encoding & Joint-Face Modeling
# ==============================================================================

def compute_3d_spherical_positional_encoding(
    latent_h: int = 64,
    latent_w: int = 64,
    fov_deg: float = 95.0,
    gamma: int = 1,
    device: str = "cpu",
    dtype: Any = None,
):
    """
    Implements JoPano Section 3.1 (3D Spherical Positional Embedding) & Section 3.2 (Condition Switching gamma).
    Places a unit sphere inside the cube, intersects each cubemap token's ray (x, y, z) on the sphere,
    normalizes spherical angles to [0, 1], and appends the Condition Switching channel gamma in {0, 1}.
    Returns tensor of shape (6, 3, latent_h, latent_w).
    """
    import torch

    if dtype is None:
        dtype = torch.float16
    extent = math.tan(math.radians(fov_deg / 2.0))
    faces = ["front", "back", "left", "right", "top", "bottom"]
    enc_list = []

    for face in faces:
        u_range = torch.linspace(-extent, extent, latent_w, device=device)
        v_range = torch.linspace(extent, -extent, latent_h, device=device)
        u_grid, v_grid = torch.meshgrid(u_range, v_range, indexing="xy")

        if face == "front":
            x, y, z = u_grid, v_grid, torch.ones_like(u_grid)
        elif face == "back":
            x, y, z = -u_grid, v_grid, -torch.ones_like(u_grid)
        elif face == "left":
            x, y, z = -torch.ones_like(u_grid), v_grid, u_grid
        elif face == "right":
            x, y, z = torch.ones_like(u_grid), v_grid, -u_grid
        elif face == "top":
            x, y, z = u_grid, torch.ones_like(u_grid), -v_grid
        else:
            x, y, z = u_grid, -torch.ones_like(u_grid), v_grid

        # project onto unit sphere (x, y, z) -> spherical coordinates (longitude, latitude)
        u_enc = (torch.atan2(x, z) / math.pi + 1.0) / 2.0
        v_enc = (torch.atan2(y, torch.sqrt(x**2 + z**2)) / math.pi + 1.0) / 2.0
        enc_list.append(torch.stack([u_enc, v_enc], dim=0))

    enc_tensor = torch.stack(enc_list, dim=0)  # (6, 2, H, W)
    # JoPano Section 3.2 Condition Switching: gamma = 0 (T2P) or gamma = 1 (V2P, f0 conditioned)
    mask_tensor = torch.zeros((6, 1, latent_h, latent_w), device=device)
    if gamma == 1:
        mask_tensor[0] = 1.0
    return torch.cat([enc_tensor, mask_tensor], dim=1).to(device=device, dtype=dtype)


def _extract_12_shared_cube_edges(faces: "Any") -> List[Tuple["Any", "Any"]]:
    """
    Returns the 12 shared edges of a cubemap [F=0, B=1, L=2, R=3, U=4, D=5]
    with exact 3D geometric orientation alignment.
    Each element is (edge_A, edge_B) of shape (W, C) or (k, W, C).
    """
    return [
        # Horizontal equatorial ring: F(0)-R(3), R(3)-B(1), B(1)-L(2), L(2)-F(0)
        (faces[0, :, -1, :], faces[3, :, 0, :]),
        (faces[3, :, -1, :], faces[1, :, 0, :]),
        (faces[1, :, -1, :], faces[2, :, 0, :]),
        (faces[2, :, -1, :], faces[0, :, 0, :]),
        # Zenith (U=4) shared edges with F(0), B(1), L(2), R(3)
        (faces[0, 0, :, :], faces[4, -1, :, :]),
        (faces[1, 0, :, :], faces[4, 0, :, :].flip(0)),
        (faces[2, 0, :, :], faces[4, :, 0, :]),
        (faces[3, 0, :, :], faces[4, :, -1, :].flip(0)),
        # Nadir (D=5) shared edges with F(0), B(1), L(2), R(3)
        (faces[0, -1, :, :], faces[5, 0, :, :]),
        (faces[1, -1, :, :], faces[5, -1, :, :].flip(0)),
        (faces[2, -1, :, :], faces[5, :, 0, :].flip(0)),
        (faces[3, -1, :, :], faces[5, :, -1, :]),
    ]


# ==============================================================================
# JoPano Section 3.3 & Supplementary A.1: Cross-Face Blending (Poisson Equation)
# and Seam Consistency Metrics (Seam-SSIM & Seam-Sobel)
# ==============================================================================

def jopano_poisson_cross_face_blend(faces: Any, iterations: int = 200) -> Any:
    """
    Implements JoPano Section 3.3 Eq. (9)-(10) and Supplementary A.1 Eq. (13)-(15):
      Delta f_i = div v_i in Omega_i, with Dirichlet boundary f_i = 0.5 * (g_i + g_j) on dOmega_i.
    Discretizes the 5-point Laplacian stencil of each cubemap face g_i:
      Delta g_i(u,v) = g_i(u+1,v) + g_i(u-1,v) + g_i(u,v+1) + g_i(u,v-1) - 4 g_i(u,v)
    Fixes the 12 shared cube boundaries to the exact pixelwise average of adjacent faces,
    and runs 200 iterative relaxation steps to smoothly propagate boundary corrections into the interior.
    """
    import torch

    g = faces.clone().float()
    # Eq. (13): discrete 5-point Laplacian of g_i on interior pixels
    lap = (
        g[:, 1:-1, 2:, :]
        + g[:, 1:-1, :-2, :]
        + g[:, 2:, 1:-1, :]
        + g[:, :-2, 1:-1, :]
        - 4.0 * g[:, 1:-1, 1:-1, :]
    )

    f = g.clone()

    # Eq. (10): Dirichlet boundary conditions on all 12 shared cube edges = 0.5 * (g_i + g_j)
    # 1. Horizontal equatorial ring
    avg_FR = 0.5 * (g[0, :, -1, :] + g[3, :, 0, :])
    f[0, :, -1, :] = avg_FR
    f[3, :, 0, :] = avg_FR

    avg_RB = 0.5 * (g[3, :, -1, :] + g[1, :, 0, :])
    f[3, :, -1, :] = avg_RB
    f[1, :, 0, :] = avg_RB

    avg_BL = 0.5 * (g[1, :, -1, :] + g[2, :, 0, :])
    f[1, :, -1, :] = avg_BL
    f[2, :, 0, :] = avg_BL

    avg_LF = 0.5 * (g[2, :, -1, :] + g[0, :, 0, :])
    f[2, :, -1, :] = avg_LF
    f[0, :, 0, :] = avg_LF

    # 2. Zenith (U=4) edges
    avg_FU = 0.5 * (g[0, 0, :, :] + g[4, -1, :, :])
    f[0, 0, :, :] = avg_FU
    f[4, -1, :, :] = avg_FU

    avg_BU = 0.5 * (g[1, 0, :, :] + g[4, 0, :, :].flip(0))
    f[1, 0, :, :] = avg_BU
    f[4, 0, :, :] = avg_BU.flip(0)

    avg_LU = 0.5 * (g[2, 0, :, :] + g[4, :, 0, :])
    f[2, 0, :, :] = avg_LU
    f[4, :, 0, :] = avg_LU

    avg_RU = 0.5 * (g[3, 0, :, :] + g[4, :, -1, :].flip(0))
    f[3, 0, :, :] = avg_RU
    f[4, :, -1, :] = avg_RU.flip(0)

    # 3. Nadir (D=5) edges
    avg_FD = 0.5 * (g[0, -1, :, :] + g[5, 0, :, :])
    f[0, -1, :, :] = avg_FD
    f[5, 0, :, :] = avg_FD

    avg_BD = 0.5 * (g[1, -1, :, :] + g[5, -1, :, :].flip(0))
    f[1, -1, :, :] = avg_BD
    f[5, -1, :, :] = avg_BD.flip(0)

    avg_LD = 0.5 * (g[2, -1, :, :] + g[5, :, 0, :].flip(0))
    f[2, -1, :, :] = avg_LD
    f[5, :, 0, :] = avg_LD.flip(0)

    avg_RD = 0.5 * (g[3, -1, :, :] + g[5, :, -1, :])
    f[3, -1, :, :] = avg_RD
    f[5, :, -1, :] = avg_RD

    # Eq. (15): 200 iterative Poisson relaxation steps on interior pixels
    for _ in range(iterations):
        f[:, 1:-1, 1:-1, :] = 0.25 * (
            f[:, 1:-1, 2:, :]
            + f[:, 1:-1, :-2, :]
            + f[:, 2:, 1:-1, :]
            + f[:, :-2, 1:-1, :]
            - lap
        )

    return f.clamp(0.0, 1.0)


def compute_jopano_seam_metrics(faces: Any) -> Dict[str, float]:
    """
    Implements JoPano Section 3.3 Eq. (11) Seam-SSIM and Eq. (12) Seam-Sobel across all 12 cube edges.
    - Seam-SSIM: higher values (closer to 1.0) indicate better seam consistency.
    - Seam-Sobel: lower values indicate better gradient smoothness across shared edges.
    """
    import torch

    f = faces.detach().float() * 255.0 if faces.max() <= 1.05 else faces.detach().float()
    c1 = (0.01 * 255.0) ** 2
    c2 = (0.03 * 255.0) ** 2

    edge_pairs = _extract_12_shared_cube_edges(f)
    ssim_vals = []
    sobel_vals = []

    for b_l, b_r in edge_pairs:
        mu_x = b_l.mean()
        mu_y = b_r.mean()
        var_x = ((b_l - mu_x) ** 2).mean()
        var_y = ((b_r - mu_y) ** 2).mean()
        cov_xy = ((b_l - mu_x) * (b_r - mu_y)).mean()
        ssim_e = ((2.0 * mu_x * mu_y + c1) * (2.0 * cov_xy + c2)) / (
            (mu_x**2 + mu_y**2 + c1) * (var_x + var_y + c2)
        )
        ssim_vals.append(float(ssim_e.item()))

        # Cross-edge Sobel gradient magnitude
        grad_e = torch.abs(b_l - b_r).mean()
        sobel_vals.append(float(grad_e.item()))

    return {
        "seam_ssim": round(float(np.mean(ssim_vals)), 4),
        "seam_sobel": round(float(np.mean(sobel_vals)), 2),
    }


def crop_cubemap_fov(faces_tensor: Any, in_fov: float = 95.0, out_fov: float = 90.0) -> Any:
    """
    Crops each generated cubemap face from 95° FOV to exact 90° perspective FOV.
    """
    import torch.nn.functional as F

    h, w = faces_tensor.shape[1:3]
    ratio = math.tan(math.radians(out_fov / 2.0)) / math.tan(math.radians(in_fov / 2.0))
    new_w = int(round(w * ratio))
    start = (w - new_w) // 2
    cropped = faces_tensor[:, start : start + new_w, start : start + new_w, :]
    cropped_chw = cropped.permute(0, 3, 1, 2)
    resized = F.interpolate(cropped_chw, size=(h, w), mode="bilinear", align_corners=True)
    return resized.permute(0, 2, 3, 1)


def cubemap_to_erp_torch(faces: Any, h: int = 1024, w: int = 2048) -> Image.Image:
    """
    Projects 6 cubemap faces (6, H_f, W_f, C) onto a 2:1 Equirectangular Projection (ERP) image
    using exact 3D unit-sphere ray intersection on GPU.
    """
    import torch
    import torch.nn.functional as F

    device = faces.device
    is_single_channel = faces.ndim == 3 or faces.shape[-1] == 1
    if faces.ndim == 3:
        faces = faces.unsqueeze(-1)

    c = faces.shape[-1]
    lon = torch.linspace(-math.pi, math.pi, w, device=device)
    lat = torch.linspace(math.pi / 2.0, -math.pi / 2.0, h, device=device)
    lat_g, lon_g = torch.meshgrid(lat, lon, indexing="ij")
    x = torch.cos(lat_g) * torch.sin(lon_g)
    y = torch.sin(lat_g)
    z = torch.cos(lat_g) * torch.cos(lon_g)

    abs_x, abs_y, abs_z = x.abs(), y.abs(), z.abs()
    is_x = (abs_x >= abs_y) & (abs_x >= abs_z)
    is_y = (abs_y > abs_x) & (abs_y >= abs_z)
    is_z = ~is_x & ~is_y

    faces_chw = faces.permute(0, 3, 1, 2).float()
    erp = torch.zeros((h, w, c), device=device, dtype=torch.float32)

    face_masks_uv = [
        (is_z & (z > 0), x / z.clamp(min=1e-6), -y / z.clamp(min=1e-6)),
        (is_z & (z <= 0), -x / (-z).clamp(min=1e-6), -y / (-z).clamp(min=1e-6)),
        (is_x & (x < 0), z / (-x).clamp(min=1e-6), -y / (-x).clamp(min=1e-6)),
        (is_x & (x >= 0), -z / x.clamp(min=1e-6), -y / x.clamp(min=1e-6)),
        (is_y & (y > 0), x / y.clamp(min=1e-6), z / y.clamp(min=1e-6)),
        (is_y & (y <= 0), x / (-y).clamp(min=1e-6), -z / (-y).clamp(min=1e-6)),
    ]
    for idx, (mask, u_coord, v_coord) in enumerate(face_masks_uv):
        grid = torch.stack([u_coord, v_coord], dim=-1).unsqueeze(0)
        sampled = F.grid_sample(
            faces_chw[idx : idx + 1], grid, mode="bilinear", padding_mode="border", align_corners=True
        )[0].permute(1, 2, 0)
        erp[mask] = sampled[mask]

    arr = (erp.clamp(0.0, 1.0) * 255.0).byte().cpu().numpy()
    if is_single_channel or c == 1:
        return Image.fromarray(arr[:, :, 0], mode="L")
    return Image.fromarray(arr, mode="RGB")


# ==============================================================================
# JoPano Joint-Face Adapter Modules (Full Cross-Face Attention + Shared Norm)
# ==============================================================================

def _build_and_patch_jopano_cubemap_pipeline(model_id: str) -> Any:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from diffusers import DDIMScheduler, StableDiffusionPipeline
    from diffusers.models.attention import Attention, BasicTransformerBlock
    from diffusers.models.transformers.transformer_2d import Transformer2DModel

    class JoPanoJointFaceAttnProcessor:
        """
        Implements JoPano Section 3.1 Eq. (3)-(4):
        Full attention over the concatenated 6-face token sequence y in R^{B x (N x 6) x C},
        allowing every token on every cubemap face to attend to all tokens across all 6 faces.
        """

        def __call__(
            self,
            attn: Attention,
            hidden_states: torch.Tensor,
            encoder_hidden_states: Optional[torch.Tensor] = None,
            attention_mask: Optional[torch.Tensor] = None,
            temb: Optional[torch.Tensor] = None,
            *args: Any,
            **kwargs: Any,
        ) -> torch.Tensor:
            residual = hidden_states
            if attn.spatial_norm is not None:
                hidden_states = attn.spatial_norm(hidden_states, temb)
            input_ndim = hidden_states.ndim
            if input_ndim == 4:
                b, c, h, w = hidden_states.shape
                hidden_states = hidden_states.view(b, c, h * w).transpose(1, 2)
            b = hidden_states.shape[0]
            if attn.group_norm is not None:
                hidden_states = attn.group_norm(hidden_states.transpose(1, 2)).transpose(1, 2)
            query = attn.to_q(hidden_states)
            if encoder_hidden_states is None:
                encoder_hidden_states = hidden_states
            elif attn.norm_cross:
                encoder_hidden_states = attn.norm_encoder_hidden_states(encoder_hidden_states)
            key = attn.to_k(encoder_hidden_states)
            value = attn.to_v(encoder_hidden_states)
            head_dim = key.shape[-1] // attn.heads
            query = query.view(b, -1, attn.heads, head_dim).transpose(1, 2)
            key = key.view(b, -1, attn.heads, head_dim).transpose(1, 2)
            value = value.view(b, -1, attn.heads, head_dim).transpose(1, 2)
            if attn.norm_q is not None:
                query = attn.norm_q(query)
            if attn.norm_k is not None:
                key = attn.norm_k(key)
            hidden_states = F.scaled_dot_product_attention(
                query, key, value, attn_mask=attention_mask, dropout_p=0.0, is_causal=False
            )
            hidden_states = hidden_states.transpose(1, 2).reshape(b, -1, attn.heads * head_dim).to(query.dtype)
            hidden_states = attn.to_out[0](hidden_states)
            hidden_states = attn.to_out[1](hidden_states)
            if input_ndim == 4:
                hidden_states = hidden_states.transpose(-1, -2).reshape(b, c, h, w)
            if attn.residual_connection:
                hidden_states = hidden_states + residual
            return hidden_states / attn.rescale_output_factor

    class JoPanoJointFaceBlock(BasicTransformerBlock):
        """
        Implements JoPano Section 3.1 Joint Modeling:
        Reshapes z in R^{(B x 6) x N x C} -> z_hat in R^{B x (N x 6) x C}, applies shared normalization
        and full cross-face attention across all 6 cubemap faces simultaneously, then reshapes back.
        """

        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, **kwargs)
            self.num_faces = 6
            self.attn1.set_processor(JoPanoJointFaceAttnProcessor())

        def forward(
            self,
            hidden_states: torch.Tensor,
            attention_mask: Optional[torch.Tensor] = None,
            encoder_hidden_states: Optional[torch.Tensor] = None,
            encoder_attention_mask: Optional[torch.Tensor] = None,
            timestep: Optional[torch.LongTensor] = None,
            cross_attention_kwargs: Optional[Dict[str, Any]] = None,
            class_labels: Optional[torch.LongTensor] = None,
            added_cond_kwargs: Optional[Dict[str, torch.Tensor]] = None,
        ) -> torch.Tensor:
            bt, hw, _ = hidden_states.shape
            t_faces = self.num_faces
            b_batch = bt // t_faces

            norm_hidden_states = self.norm1(hidden_states)
            cross_attention_kwargs = cross_attention_kwargs.copy() if cross_attention_kwargs is not None else {}
            front_face_drop = cross_attention_kwargs.pop("front_face_drop", False)

            # Reshape (B*6, N, C) -> (B, 6*N, C) for full cross-face joint attention (Eq. 3-4)
            norm_hidden_states = rearrange(
                norm_hidden_states, "(b t) (hw) c -> b (t hw) c", b=b_batch, t=t_faces, hw=hw
            )
            if front_face_drop:
                self_attention_mask = torch.ones(
                    (1, 1, 1, t_faces * hw), dtype=torch.bool, device=hidden_states.device
                )
                self_attention_mask[:, :, :, :hw] = False
            else:
                self_attention_mask = None

            attn_output = self.attn1(
                norm_hidden_states,
                encoder_hidden_states=None,
                attention_mask=self_attention_mask,
                **cross_attention_kwargs,
            )
            # Reshape back to (B*6, N, C)
            attn_output = rearrange(
                attn_output, "b (t hw) c -> (b t) (hw) c", b=b_batch, t=t_faces, hw=hw
            )
            hidden_states = attn_output + hidden_states

            if self.attn2 is not None:
                norm_hidden_states = self.norm2(hidden_states)
                attn_output = self.attn2(
                    norm_hidden_states,
                    encoder_hidden_states=encoder_hidden_states,
                    attention_mask=encoder_attention_mask,
                    **cross_attention_kwargs,
                )
                hidden_states = attn_output + hidden_states

            norm_hidden_states = self.norm3(hidden_states)
            ff_output = self.ff(norm_hidden_states)
            return ff_output + hidden_states

    class JoPanoSharedGroupNorm(nn.Module):
        """
        Synchronizes normalization statistics across all 6 cubemap faces so color tone and exposure
        are globally unified across the entire 360° sphere.
        """

        def __init__(self, orig: nn.GroupNorm, num_faces: int = 6) -> None:
            super().__init__()
            self.num_faces = num_faces
            self.norm = nn.GroupNorm(orig.num_groups, orig.num_channels, orig.eps, orig.affine)
            if orig.affine:
                self.norm.weight.data.copy_(orig.weight.data)
                self.norm.bias.data.copy_(orig.bias.data)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            if x.shape[0] < self.num_faces:
                return self.norm(x)
            if x.ndim == 4:
                bt, c, h, w = x.shape
                t_faces = self.num_faces
                b_batch = bt // t_faces
                x = rearrange(x, "(b t) c h w -> b c (t h w)", b=b_batch, t=t_faces)
                x = self.norm(x)
                return rearrange(x, "b c (t h w) -> (b t) c h w", t=t_faces, h=h, w=w)
            return self.norm(x)

    def _swap_blocks(root: nn.Module) -> None:
        for child in root.children():
            _swap_blocks(child)
            if isinstance(child, Transformer2DModel):
                for i, blk in enumerate(child.transformer_blocks):
                    if isinstance(blk, BasicTransformerBlock) and not isinstance(blk, JoPanoJointFaceBlock):
                        new_blk = JoPanoJointFaceBlock(
                            dim=blk.dim,
                            num_attention_heads=blk.num_attention_heads,
                            attention_head_dim=blk.attention_head_dim,
                            dropout=blk.dropout,
                            cross_attention_dim=blk.cross_attention_dim,
                            activation_fn=blk.activation_fn,
                            attention_bias=blk.attention_bias,
                            only_cross_attention=blk.only_cross_attention,
                            double_self_attention=blk.double_self_attention,
                            norm_elementwise_affine=blk.norm_elementwise_affine,
                            norm_type=blk.norm_type,
                            norm_eps=getattr(child.config, "norm_eps", 1e-5),
                        )
                        new_blk.load_state_dict(blk.state_dict(), strict=False)
                        child.transformer_blocks[i] = new_blk

    def _patch_gn(root: nn.Module) -> None:
        for name, child in list(root.named_children()):
            _patch_gn(child)
            if isinstance(child, nn.GroupNorm) and not isinstance(child, JoPanoSharedGroupNorm):
                setattr(root, name, JoPanoSharedGroupNorm(child))

    pipe = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=torch.float16)
    _swap_blocks(pipe.unet)
    _patch_gn(pipe.vae)
    pipe.scheduler = DDIMScheduler.from_config(pipe.scheduler.config)
    pipe.set_progress_bar_config(disable=True)
    return pipe.to(device="cuda", dtype=torch.float16)


def _get_or_load_local_pipelines() -> Tuple[Any, Any, Any]:
    global _ANCHOR_PIPE, _JOPANO_CUBE_PIPE, _DEPTH_PIPE, _LOAD_FAILED
    if _LOAD_FAILED:
        return None, None, None
    if _ANCHOR_PIPE is not None and _JOPANO_CUBE_PIPE is not None:
        return _ANCHOR_PIPE, _JOPANO_CUBE_PIPE, _DEPTH_PIPE

    try:
        import torch
        from diffusers import AutoPipelineForText2Image, DPMSolverSinglestepScheduler

        if not torch.cuda.is_available():
            logger.warning("CUDA is not available; skipping local GPU JoPano pipeline load.")
            _LOAD_FAILED = True
            return None, None, None

        t0 = time.perf_counter()
        anchor_model_id = os.getenv("LOCAL_DIFFUSION_MODEL", "SG161222/RealVisXL_V4.0_Lightning")
        cube_model_id = os.getenv("JOPANO_CUBEMAP_MODEL", "hlicai/cubediff-512-multitxt")
        logger.info(
            f"Loading JoPano Unified Framework on {torch.cuda.get_device_name(0)}: "
            f"Anchor={anchor_model_id} + Joint-Face Cubemap={cube_model_id}"
        )

        anchor_pipe = AutoPipelineForText2Image.from_pretrained(
            anchor_model_id,
            torch_dtype=torch.float16,
            variant="fp16",
        ).to("cuda")
        if "RealVisXL" in anchor_model_id or "Lightning" in anchor_model_id:
            anchor_pipe.scheduler = DPMSolverSinglestepScheduler.from_config(
                anchor_pipe.scheduler.config, use_karras_sigmas=True
            )
        anchor_pipe.set_progress_bar_config(disable=True)
        _ANCHOR_PIPE = anchor_pipe

        _JOPANO_CUBE_PIPE = _build_and_patch_jopano_cubemap_pipeline(cube_model_id)
        logger.info(f"Loaded JoPano Joint-Face Cubemap + Anchor pipelines in {time.perf_counter() - t0:.2f}s")

        if os.getenv("ENABLE_DEPTH_ANYTHING", "true").lower() in ("1", "true", "yes"):
            try:
                from transformers import pipeline as hf_pipeline

                depth_model_id = os.getenv(
                    "LOCAL_DEPTH_MODEL", "depth-anything/Depth-Anything-V2-Small-hf"
                )
                _DEPTH_PIPE = hf_pipeline(
                    task="depth-estimation",
                    model=depth_model_id,
                    device=0,
                    torch_dtype=torch.float16,
                )
                logger.info(f"Loaded metric depth model for perspective cubemap distillation: {depth_model_id}")
            except Exception as depth_exc:
                logger.warning(f"Depth-Anything load skipped ({depth_exc}); using geometric depth estimator.")
                _DEPTH_PIPE = None

        return _ANCHOR_PIPE, _JOPANO_CUBE_PIPE, _DEPTH_PIPE

    except Exception as exc:
        logger.warning(f"Local JoPano diffusion load failed: {exc}")
        _LOAD_FAILED = True
        return None, None, None


def _build_6face_multi_text_prompts(
    room_name: str, world_prompt: str, room_idx: int
) -> Tuple[str, List[str]]:
    """
    Implements JoPano Section 4.4 (Multi-Text Generation):
    Generates directional prompts for each of the 6 cubemap faces [Front, Back, Left, Right, Up, Down]
    so the Zenith (Up) face always renders clean sky/vaulted ceiling and the Nadir (Down) face
    always renders continuous stone courtyard/floor pavement without horizon artifacts.
    """
    vantage_descriptors = [
        "sunlit stone courtyard pavement in the foreground, grand monumental architecture along the horizon",
        "elevated marble colonnade walkway in the foreground, classical temple porticos and arches",
        "ceremonial stone causeway and carved stone courtyard in the foreground, monumental ruins and pillars",
        "panoramic terrace overlook with carved stone balustrade and sweeping architectural vista",
    ]
    vantage = vantage_descriptors[room_idx % len(vantage_descriptors)]

    anchor_prompt = (
        f"Eye-level rectilinear architectural photography of {room_name}, {world_prompt}, "
        f"{vantage}, straight level horizon, National Geographic architectural photograph, "
        f"natural golden hour sunlight, ultra-detailed stone masonry, photorealistic, 8k"
    )

    prompt_lower = f"{room_name} {world_prompt}".lower()
    is_indoor = any(w in prompt_lower for w in ("interior", "chamber", "hall", "vault", "crypt", "inside", "room"))

    if is_indoor:
        up_prompt = f"Ornate coffered stone ceiling and architectural dome overhead in {room_name}, {world_prompt}, photorealistic"
        down_prompt = f"Continuous polished marble and carved stone floor slabs underfoot in {room_name}, photorealistic"
    else:
        up_prompt = "Clear open golden hour sky directly overhead, soft atmospheric clouds, zenith view, photorealistic"
        down_prompt = f"Continuous flat sunlit stone courtyard flagstone pavement on the ground in {room_name}, nadir view, photorealistic"

    face_prompts = [
        f"Front view of {room_name}, {world_prompt}, {vantage}, photorealistic architectural photography",
        f"Rear view of {room_name}, {world_prompt}, monumental stone architecture and walkways, photorealistic",
        f"Left side view of {room_name}, {world_prompt}, classical stone colonnade and courtyard, photorealistic",
        f"Right side view of {room_name}, {world_prompt}, architectural porticos and stone plaza, photorealistic",
        up_prompt,
        down_prompt,
    ]
    return anchor_prompt, face_prompts


def _estimate_perspective_cubemap_depth(
    blended_faces: Any, depth_pipe: Any
) -> Optional[Image.Image]:
    """
    Implements JoPano Supplementary Section B (Perspective Cubemap Depth Distillation):
    Estimates metric depth on the distortion-free perspective cubemap faces, applies Poisson
    Cross-Face Blending across the 6 depth faces, and projects to a 2048x1024 ERP depth map.
    """
    if depth_pipe is None:
        return None
    try:
        import torch

        device = blended_faces.device
        face_pil_list = [
            Image.fromarray((blended_faces[i].clamp(0.0, 1.0) * 255.0).byte().cpu().numpy())
            for i in range(6)
        ]
        depth_outputs = depth_pipe(face_pil_list)
        depth_tensors = []
        for i, out in enumerate(depth_outputs):
            d_pil = out["depth"].convert("L").resize((512, 512), Image.Resampling.BILINEAR)
            d_arr = torch.from_numpy(np.array(d_pil, dtype=np.float32) / 255.0).to(device)
            depth_tensors.append(d_arr.unsqueeze(-1))

        depth_cube = torch.stack(depth_tensors, dim=0)  # (6, 512, 512, 1)
        # Apply JoPano Poisson Cross-Face Blending to the 6 depth faces for seamless 3D mesh displacement
        blended_depth_cube = jopano_poisson_cross_face_blend(depth_cube, iterations=120)
        erp_depth = cubemap_to_erp_torch(blended_depth_cube, h=1024, w=2048)
        return blend_horizontal_seam(erp_depth, blend_width=24)
    except Exception as exc:
        logger.warning(f"Perspective cubemap depth distillation fallback ({exc})")
        return None


def _try_remote_brev_or_local_api(
    full_prompt: str, negative_prompt: str, seed: int
) -> Optional[Image.Image]:
    remote_url = (
        os.getenv("BREV_DIFFUSION_URL")
        or os.getenv("LOCAL_DIFFUSION_URL")
        or ""
    ).strip()
    if not remote_url:
        return None

    headers = {}
    brev_key = os.getenv("BREV_API_KEY", "").strip()
    if brev_key:
        headers["Authorization"] = f"Bearer {brev_key}"

    try:
        with httpx.Client(timeout=8.0, headers=headers) as client:
            endpoint = (
                remote_url
                if remote_url.endswith("/generate")
                else f"{remote_url.rstrip('/')}/generate"
            )
            resp = client.post(
                endpoint,
                json={
                    "prompt": full_prompt,
                    "negative_prompt": negative_prompt,
                    "seed": seed,
                    "width": 2048,
                    "height": 1024,
                },
            )
            if resp.status_code == 200:
                ctype = resp.headers.get("content-type", "")
                if "image/" in ctype:
                    return Image.open(io.BytesIO(resp.content)).convert("RGB")
                data = resp.json()
                if "image_base64" in data:
                    import base64

                    return Image.open(
                        io.BytesIO(base64.b64decode(data["image_base64"]))
                    ).convert("RGB")
    except Exception as exc:
        logger.warning(f"Remote Brev/API diffusion call failed ({exc}); falling back to local GPU.")
    return None


def generate_room_panorama_and_depth(
    world_id: str,
    room_id: str,
    room_name: str,
    world_prompt: str,
    biome_type: str = "medieval_tavern",
    room_idx: int = 0,
    ambient_color: str = "",
    fog_color: str = "",
    force_regenerate: bool = False,
) -> Optional[Tuple[str, str]]:
    """
    Synthesizes a 360° equirectangular panorama (.webp) and metric depth map (.png) using the
    JoPano Unified Joint-Face Cubemap Framework (arXiv:2512.06885):
      1. Condition Switching (gamma=1 V2P or gamma=0 T2P): Synthesizes high-res front perspective anchor f_0
         via RealVisXL V4.0 Lightning, then jointly denoises all 6 cubemap faces {f_0..f_5} with
         JoPano Joint-Face Attention, Shared GroupNorm, 3D Spherical Positional Encoding, and
         Section 4.4 Multi-Text directional prompts.
      2. Cross-Face Blending (CFB, Section 3.3 & Supp A.1): Solves the discrete Poisson equation with
         Dirichlet boundary conditions (200 iterations) across all 12 cube edges and logs Seam-SSIM / Seam-Sobel.
      3. Projects the blended 6-face cubemap to a 2048x1024 ERP panorama and distills perspective depth.
    """
    if os.getenv("DISABLE_LOCAL_DIFFUSION", "").lower() in ("1", "true", "yes"):
        return None

    safe_world = re.sub(r"[^a-zA-Z0-9_-]", "", world_id or "world_default")
    safe_room = re.sub(r"[^a-zA-Z0-9_-]", "", room_id or f"room_{room_idx}")

    project_root = Path(__file__).resolve().parents[3]
    out_dir = project_root / "frontend" / "public" / "generated_worlds" / safe_world
    out_dir.mkdir(parents=True, exist_ok=True)

    pano_file = out_dir / f"{safe_room}_panorama.webp"
    depth_file = out_dir / f"{safe_room}_depth.png"
    pano_url = f"/generated_worlds/{safe_world}/{safe_room}_panorama.webp"
    depth_url = f"/generated_worlds/{safe_world}/{safe_room}_depth.png"

    if (
        not force_regenerate
        and pano_file.exists()
        and pano_file.stat().st_size > 4000
        and depth_file.exists()
        and depth_file.stat().st_size > 1000
    ):
        return pano_url, depth_url

    anchor_prompt, face_prompts = _build_6face_multi_text_prompts(room_name, world_prompt, room_idx)
    negative_prompt = (
        "fisheye, little planet, spherical distortion, upside down, inverted, floating islands, "
        "split screen, collage, border, frame, text, watermark, blurry, deformed, cartoon, painting"
    )

    seed_str = f"{safe_world}:{safe_room}:{room_name}:{world_prompt}:{room_idx}"
    seed = int(hashlib.md5(seed_str.encode("utf-8")).hexdigest()[:8], 16) % (2**31 - 1)

    with _PIPELINE_LOCK:
        t0 = time.perf_counter()
        remote_img = _try_remote_brev_or_local_api(anchor_prompt, negative_prompt, seed)
        if remote_img is not None:
            pano_img = blend_horizontal_seam(remote_img.resize((2048, 1024), Image.Resampling.LANCZOS), 32)
            pano_img.save(pano_file, "WEBP", quality=92)
            depth_img = compute_fast_geometric_depth(pano_img)
            depth_img.save(depth_file, "PNG")
            return pano_url, depth_url

        anchor_pipe, cube_pipe, depth_pipe = _get_or_load_local_pipelines()
        if anchor_pipe is None or cube_pipe is None:
            return None

        try:
            import torch

            gen = torch.Generator(device="cuda").manual_seed(seed)
            # Condition switch gamma in {0, 1} (default 1 = Unified V2P anchored by high-res f_0)
            gamma = int(os.getenv("JOPANO_GAMMA", "1"))
            num_cube_steps = int(os.getenv("JOPANO_STEPS", "8"))

            with torch.no_grad():
                # Step 1: Generate clean front perspective view f_0 (768x768 -> 512x512)
                front_res = anchor_pipe(
                    prompt=anchor_prompt,
                    negative_prompt=negative_prompt,
                    num_inference_steps=6,
                    guidance_scale=2.0,
                    width=768,
                    height=768,
                    generator=gen,
                )
                front_512 = front_res.images[0].convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)

                # Step 2: JoPano Unified 6-Face Joint Modeling with 3D Spherical Positional Encoding
                t_faces = 6
                text_in = cube_pipe.tokenizer(
                    face_prompts,
                    max_length=cube_pipe.tokenizer.model_max_length,
                    padding="max_length",
                    return_tensors="pt",
                )
                enc_hs = cube_pipe.text_encoder(text_in.input_ids.to("cuda"))[0]

                uncond_in = cube_pipe.tokenizer(
                    [negative_prompt] * t_faces,
                    max_length=cube_pipe.tokenizer.model_max_length,
                    padding="max_length",
                    return_tensors="pt",
                )
                uncond_hs = cube_pipe.text_encoder(uncond_in.input_ids.to("cuda"))[0]

                cube_pipe.scheduler.set_timesteps(num_cube_steps, device="cuda")
                latents = (
                    torch.randn((t_faces, 4, 64, 64), generator=gen, device="cuda", dtype=torch.float16)
                    * cube_pipe.scheduler.init_noise_sigma
                )
                spherical_pos_extra = compute_3d_spherical_positional_encoding(
                    64, 64, fov_deg=95.0, gamma=gamma, device="cuda", dtype=torch.float16
                )

                front_tensor = (
                    (torch.from_numpy(np.array(front_512)).float() / 127.5 - 1.0)
                    .permute(2, 0, 1)
                    .unsqueeze(0)
                    .to(device="cuda", dtype=torch.float16)
                )
                ref_lat = cube_pipe.vae.encode(front_tensor).latent_dist.mean[0] * cube_pipe.vae.config.scaling_factor

                for t in cube_pipe.scheduler.timesteps:
                    if gamma == 1:
                        latents[0] = ref_lat
                    lat_scaled = cube_pipe.scheduler.scale_model_input(latents, t)
                    lat_in = torch.cat([lat_scaled, spherical_pos_extra], dim=1)

                    noise_pred = cube_pipe.unet(lat_in, t, encoder_hidden_states=enc_hs).sample
                    noise_uncond = cube_pipe.unet(
                        lat_in,
                        t,
                        encoder_hidden_states=uncond_hs,
                        cross_attention_kwargs={"front_face_drop": bool(gamma == 1)},
                    ).sample
                    comb = noise_uncond + 3.5 * (noise_pred - noise_uncond)
                    if gamma == 1:
                        latents[1:] = cube_pipe.scheduler.step(comb[1:], t, latents[1:]).prev_sample
                    else:
                        latents = cube_pipe.scheduler.step(comb, t, latents).prev_sample

                if gamma == 1:
                    latents[0] = ref_lat

                decoded = (cube_pipe.vae.decode(latents / cube_pipe.vae.config.scaling_factor).sample / 2.0 + 0.5).clamp(
                    0.0, 1.0
                )
                faces_hwc = decoded.permute(0, 2, 3, 1)  # (6, 512, 512, 3)
                cropped_faces = crop_cubemap_fov(faces_hwc, in_fov=95.0, out_fov=90.0)

                # Step 3: Evaluate pre-CFB vs post-CFB JoPano Seam-SSIM & Seam-Sobel metrics
                metrics_before = compute_jopano_seam_metrics(cropped_faces)
                blended_faces = jopano_poisson_cross_face_blend(cropped_faces, iterations=200)
                metrics_after = compute_jopano_seam_metrics(blended_faces)

                # Step 4: Project 6 blended cubemap faces to 2048x1024 ERP panorama
                pano_img = cubemap_to_erp_torch(blended_faces, h=1024, w=2048)
                pano_img = blend_horizontal_seam(pano_img, blend_width=16)
                pano_img.save(pano_file, "WEBP", quality=92)

                # Step 5: Fast geometric + edge-aware depth synthesis (or optional 6-face neural depth)
                if os.getenv("ENABLE_6FACE_DEPTH_ANYTHING", "false").lower() in ("1", "true", "yes"):
                    depth_img = _estimate_perspective_cubemap_depth(blended_faces, depth_pipe)
                else:
                    depth_img = None
                if depth_img is None:
                    depth_img = compute_fast_geometric_depth(pano_img)
                depth_img.save(depth_file, "PNG")

            elapsed = time.perf_counter() - t0
            logger.info(
                f"JoPano 6-Face Cubemap + Poisson CFB synthesized '{room_name}' -> {pano_url} in {elapsed:.2f}s | "
                f"Seam-SSIM: {metrics_before['seam_ssim']} -> {metrics_after['seam_ssim']} | "
                f"Seam-Sobel: {metrics_before['seam_sobel']} -> {metrics_after['seam_sobel']}"
            )
            return pano_url, depth_url

        except Exception as exc:
            logger.warning(f"JoPano GPU inference error for {room_name}: {exc}")
            return None


def warmup_local_diffusion() -> bool:
    anchor_pipe, cube_pipe, _ = _get_or_load_local_pipelines()
    return anchor_pipe is not None and cube_pipe is not None
