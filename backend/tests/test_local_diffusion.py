# unit tests for JoPano unified joint-face cubemap panorama framework, Poisson CFB, and seam metrics
from PIL import Image
import numpy as np
import torch
import torch.nn as nn
from backend.app.services.local_diffusion import (
    apply_circular_conv2d_padding,
    blend_horizontal_seam,
    compute_3d_spherical_positional_encoding,
    compute_fast_geometric_depth,
    compute_jopano_seam_metrics,
    cubemap_to_erp_torch,
    jopano_poisson_cross_face_blend,
)


def test_apply_circular_conv2d_padding():
    # verify conv2d layers are patched to wrap horizontally across left/right edges
    model = nn.Sequential(nn.Conv2d(3, 4, kernel_size=3, padding=1))
    patched = apply_circular_conv2d_padding(model)
    assert patched == 1

    x = torch.randn(1, 3, 16, 32)
    out = model(x)
    assert out.shape == (1, 4, 16, 32)


def test_blend_horizontal_seam_continuity():
    # create test image with sharp contrast between left (0) and right (255) edges
    arr = np.zeros((64, 128, 3), dtype=np.uint8)
    arr[:, :64, :] = 20
    arr[:, 64:, :] = 230
    img = Image.fromarray(arr)

    blended = blend_horizontal_seam(img, blend_width=16)
    out = np.array(blended, dtype=np.int32)

    # verify left-most column and right-most column match closely for seamless 360 wrap
    diff = np.abs(out[:, 0, :] - out[:, -1, :]).mean()
    assert diff < 15.0


def test_compute_fast_geometric_depth_dimensions_and_range():
    # verify depth map matches input dimensions and produces valid 8-bit grayscale range
    rgb = Image.new("RGB", (256, 128), color=(140, 120, 90))
    depth = compute_fast_geometric_depth(rgb)
    assert depth.size == (256, 128)
    assert depth.mode == "L"
    arr = np.array(depth)
    assert arr.min() >= 0
    assert arr.max() <= 255
    # lower half (floor) should have higher displacement values than upper half (sky)
    assert arr[96:, :].mean() > arr[:32, :].mean()


def test_jopano_3d_spherical_positional_encoding_and_condition_switching():
    # verify JoPano Section 3.1 3D spherical positional encoding and Section 3.2 gamma switch
    enc_v2p = compute_3d_spherical_positional_encoding(32, 32, fov_deg=95.0, gamma=1, device="cpu", dtype=torch.float32)
    assert enc_v2p.shape == (6, 3, 32, 32)
    # spherical coordinates normalized in [0, 1]
    assert enc_v2p[:, :2].min() >= 0.0
    assert enc_v2p[:, :2].max() <= 1.0
    # gamma=1 sets face 0 condition mask to 1.0 and remaining 5 faces to 0.0
    assert torch.all(enc_v2p[0, 2] == 1.0)
    assert torch.all(enc_v2p[1:, 2] == 0.0)

    enc_t2p = compute_3d_spherical_positional_encoding(32, 32, fov_deg=95.0, gamma=0, device="cpu", dtype=torch.float32)
    assert torch.all(enc_t2p[:, 2] == 0.0)


def test_jopano_poisson_cross_face_blend_improves_seam_metrics():
    # create 6 synthetic cubemap faces with step discontinuities across shared boundaries
    torch.manual_seed(7)
    faces = torch.zeros((6, 32, 32, 3), dtype=torch.float32)
    for i in range(6):
        faces[i] = 0.15 * (i + 1) + 0.03 * torch.rand((32, 32, 3))

    metrics_before = compute_jopano_seam_metrics(faces)
    blended = jopano_poisson_cross_face_blend(faces, iterations=200)
    metrics_after = compute_jopano_seam_metrics(blended)

    assert blended.shape == (6, 32, 32, 3)
    # Poisson Dirichlet boundary conditions force shared edges to match, raising Seam-SSIM and lowering Seam-Sobel
    assert metrics_after["seam_ssim"] > metrics_before["seam_ssim"]
    assert metrics_after["seam_sobel"] < metrics_before["seam_sobel"]

    erp = cubemap_to_erp_torch(blended, h=64, w=128)
    assert erp.size == (128, 64)
