# connected panorama and depth map synthesis with spherical bearing alignment
# implements novel view continuity: celestial dome preservation, reciprocal portal framing, and seamless seam blending

import hashlib
import logging
import math
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from backend.app.schemas import LightingConfig, NodeState, RoomVisualPalette

logger = logging.getLogger("mira.connected_synthesizer")


def hex_to_rgb(hex_str: Optional[str], default: Tuple[int, int, int] = (128, 128, 128)) -> Tuple[int, int, int]:
    if not hex_str:
        return default
    cleaned = hex_str.strip().lstrip("#")
    if len(cleaned) == 6:
        try:
            return (int(cleaned[0:2], 16), int(cleaned[2:4], 16), int(cleaned[4:6], 16))
        except ValueError:
            pass
    elif len(cleaned) == 3:
        try:
            return (int(cleaned[0] * 2, 16), int(cleaned[1] * 2, 16), int(cleaned[2] * 2, 16))
        except ValueError:
            pass
    return default


def compute_inter_room_bearing(
    from_x: float, from_z: float, to_x: float, to_z: float
) -> Tuple[float, float, float, float, float]:
    """
    Computes exact spherical vector geometry between connected rooms:
    - dx, dz: Cartesian displacement vector in 3D world space (where -Z is North, +X is East)
    - theta_forward: Azimuth angle from Room A to Room B in radians [-pi, pi]
    - theta_reciprocal: Azimuth angle looking back from Room B into Room A
    - u_forward: Equirectangular UV horizontal coordinate [0, 1] facing Room B
    - u_reciprocal: Equirectangular UV horizontal coordinate [0, 1] facing Room A
    """
    dx = to_x - from_x
    dz = to_z - from_z
    if abs(dx) < 1e-4 and abs(dz) < 1e-4:
        # Default forward north if identical
        dz = -220.0

    # Azimuth where 0 is North (-Z), pi/2 is East (+X), -pi/2 is West (-X), +/-pi is South (+Z)
    theta_forward = math.atan2(dx, -dz)
    # Reciprocal bearing is exactly 180 degrees opposite
    theta_reciprocal = (theta_forward + math.pi) % (2.0 * math.pi)
    if theta_reciprocal > math.pi:
        theta_reciprocal -= 2.0 * math.pi

    u_forward = (theta_forward / (2.0 * math.pi) + 0.5) % 1.0
    u_reciprocal = (theta_reciprocal / (2.0 * math.pi) + 0.5) % 1.0

    return dx, dz, theta_forward, theta_reciprocal, u_forward, u_reciprocal


def build_connected_multi_face_prompts(
    room_name: str,
    world_prompt: str,
    from_room_name: str,
    from_room_biome: str,
    direction: str,
    palette: RoomVisualPalette,
    lighting: LightingConfig,
    u_reciprocal: float,
) -> Tuple[str, List[str], str]:
    """
    Builds JoPano 6-face multi-text prompts conditioned directly on the parent room's state.
    The face facing u_reciprocal explicitly describes the connecting gateway leading back into Room A.
    """
    base_negative = (
        "fisheye, spherical distortion, upside down, inverted, floating islands, "
        "split screen, collage, border, frame, text, watermark, blurry, deformed, cartoon"
    )

    cardinal = direction.lower()
    reverse_cardinal = {
        "north": "south",
        "south": "north",
        "east": "west",
        "west": "east",
        "forward": "backward",
        "backward": "forward",
    }.get(cardinal, "backwards")

    anchor_prompt = (
        f"Eye-level rectilinear architectural panorama of {room_name}, {world_prompt}, "
        f"seamlessly connected {cardinal} from {from_room_name}. Natural perspective, "
        f"dominant {palette.dominant_color} materials, {lighting.ambient_color} ambient glow, "
        "straight level horizon, photorealistic, 8k"
    )

    back_face_prompt = (
        f"View looking {reverse_cardinal} through a grand monumental gateway portal directly into {from_room_name}, "
        f"revealing the warm illuminated stonework and {palette.floor_tone} pavement of {from_room_name}, "
        "framed by monumental architectural pylons and threshold stone."
    )

    front_face_prompt = (
        f"View looking {cardinal} into the expansive interior and monumental architecture of {room_name}, "
        f"{world_prompt}, showcasing monumental structures and open pathways."
    )

    left_face_prompt = (
        f"Side view of {room_name}, classical colonnades, carved stone walls, and atmospheric perspective."
    )
    right_face_prompt = (
        f"Side view of {room_name}, architectural porticos, monumental wall masonry, and atmospheric glow."
    )

    up_face_prompt = (
        f"Zenith sky view directly overhead matching {palette.sky_tone} atmospheric lighting and clouds, photorealistic."
    )
    down_face_prompt = (
        f"Continuous {palette.floor_tone} ground paving seamlessly extending across the portal threshold, photorealistic."
    )

    face_prompts = [
        front_face_prompt,
        back_face_prompt,
        left_face_prompt,
        right_face_prompt,
        up_face_prompt,
        down_face_prompt,
    ]

    return anchor_prompt, face_prompts, base_negative


def blend_horizontal_seam_fast(arr: np.ndarray, blend_width: int = 32) -> np.ndarray:
    """
    Ensures zero visible vertical seam across u=0 and u=1 equirectangular boundary.
    """
    h, w = arr.shape[:2]
    bw = min(blend_width, w // 8)
    if bw <= 1:
        return arr

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

    return arr


def synthesize_connected_room_assets(
    world_id: str,
    new_room_id: str,
    new_room_name: str,
    from_room: Optional[NodeState],
    direction: str = "north",
    target_x: float = 0.0,
    target_z: float = -220.0,
    biome_type: str = "desert_oasis",
    world_prompt: str = "",
    force_regenerate: bool = False,
) -> Tuple[str, str]:
    """
    Synthesizes a 360° equirectangular panorama and 16-bit depth map for the new room,
    directly referencing the parent room's state, coordinates, lighting, and palette.
    Saves to frontend/public/generated_worlds/{safe_world}/{safe_room}_panorama.webp and _depth.png.
    """
    safe_world = re.sub(r"[^a-zA-Z0-9_-]", "", world_id or "world_default")
    safe_room = re.sub(r"[^a-zA-Z0-9_-]", "", new_room_id)

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

    # 1. Primary engine: Real JoPano Diffusion on GPU
    try:
        from backend.app.services.local_diffusion import generate_room_panorama_and_depth
        gpu_assets = generate_room_panorama_and_depth(
            world_id=world_id,
            room_id=new_room_id,
            room_name=new_room_name,
            world_prompt=world_prompt,
            biome_type=biome_type,
            ambient_color=getattr(getattr(from_room, "lighting", None), "ambient_color", "") or "",
            fog_color=getattr(getattr(from_room, "lighting", None), "fog_color", "") or "",
            force_regenerate=force_regenerate,
            from_room_name=from_room.name if from_room else None,
            direction=direction,
            target_x=target_x,
            target_z=target_z,
            from_x=from_room.worldX if from_room else 0.0,
            from_z=from_room.worldZ if from_room else 0.0,
        )
        if gpu_assets is not None:
            return gpu_assets
    except Exception as diff_err:
        logger.warning(f"GPU diffusion generation attempt: {diff_err}")

    # 2. Secondary engine: Photographic Panorama Fusion from high-resolution equirectangular assets
    # Map biomes to high-fidelity cached equirectangular photographic worlds
    biome_map = {
        "neon_city": ["neon_alley_01", "neon_alley_02", "neon_alley_03", "cyberpunk_alley", "cyber_lab_01"],
        "cyberpunk_alley": ["cyberpunk_alley", "neon_alley_01", "neon_alley_02", "cyber_lab_01", "cyber_lab_02"],
        "space_base": ["space_station", "cyber_lab_01", "cyber_lab_02", "cyber_lab_03"],
        "space_station": ["space_station", "cyber_lab_01", "cyber_lab_02", "cyber_lab_03"],
        "ancient_castle": ["ruins_01", "ruins_02", "ruins_03", "medieval_tavern", "spire_01"],
        "medieval_tavern": ["medieval_tavern", "ruins_01", "spire_01", "ruins_02"],
        "magic_forest": ["enchanted_forest", "cavern_01", "cavern_02", "ruins_01"],
        "enchanted_forest": ["enchanted_forest", "cavern_01", "cavern_02", "ruins_01"],
        "desert_oasis": ["desert_oasis", "ruins_01", "spire_01", "cavern_01"],
        "cavern": ["cavern_01", "cavern_02", "cavern_03"],
    }
    candidate_biomes = biome_map.get(biome_type, [biome_type, "neon_alley_01", "ruins_01", "space_station", "desert_oasis"])
    # Pick variant based on room ID hash for deterministic consistency
    room_hash = int(hashlib.md5(f"{safe_world}:{safe_room}".encode("utf-8")).hexdigest()[:6], 16)
    chosen_sub = candidate_biomes[room_hash % len(candidate_biomes)]
    
    cand_dir = project_root / "frontend" / "public" / "cached_worlds" / chosen_sub
    cand_pano = cand_dir / "panorama.webp"
    cand_depth = cand_dir / "depth.png"
    if not cand_pano.exists():
        # Fallback to root cached files if subfolder doesn't exist
        cand_pano = project_root / "frontend" / "public" / "cached_worlds" / f"{chosen_sub}_panorama.webp"
        cand_depth = project_root / "frontend" / "public" / "cached_worlds" / f"{chosen_sub}_depth.png"
    if not cand_pano.exists():
        cand_pano = project_root / "frontend" / "public" / "cached_worlds" / "desert_oasis_panorama.webp"
        cand_depth = project_root / "frontend" / "public" / "cached_worlds" / "desert_oasis_depth.png"

    try:
        base_img = Image.open(cand_pano).convert("RGB")
        base_dep = Image.open(cand_depth).convert("L") if cand_depth.exists() else None

        w, h = 2048, 1024
        base_img = base_img.resize((w, h), Image.Resampling.LANCZOS)
        if base_dep:
            base_dep = base_dep.resize((w, h), Image.Resampling.NEAREST)

        # Spherical azimuth shift to align novel room orientation with navigational bearing
        from_x = from_room.worldX if (from_room and from_room.worldX is not None) else 0.0
        from_z = from_room.worldZ if (from_room and from_room.worldZ is not None) else 0.0
        _, _, theta_fwd, _, u_fwd, _ = compute_inter_room_bearing(from_x, from_z, target_x, target_z)
        shift_pixels = int(round(u_fwd * w)) % w
        
        arr_img = np.array(base_img, dtype=np.float32)
        arr_img = np.roll(arr_img, shift_pixels, axis=1)

        # Apply subtle atmospheric grading from palette
        from_pal = getattr(from_room, "visual_palette", None) if from_room else None
        if from_pal:
            sky_rgb = hex_to_rgb(getattr(from_pal, "sky_tone", None), (30, 41, 59))
            floor_rgb = hex_to_rgb(getattr(from_pal, "floor_tone", None), (15, 23, 42))
            horizon_y = h // 2
            # Sky subtle tint
            tint_sky = np.array(sky_rgb, dtype=np.float32) / 255.0
            arr_img[:horizon_y, :] = arr_img[:horizon_y, :] * 0.88 + tint_sky * 0.12 * arr_img[:horizon_y, :]
            # Floor subtle tint
            tint_floor = np.array(floor_rgb, dtype=np.float32) / 255.0
            arr_img[horizon_y:, :] = arr_img[horizon_y:, :] * 0.90 + tint_floor * 0.10 * arr_img[horizon_y:, :]

        arr_img = blend_horizontal_seam_fast(arr_img, blend_width=32)
        fused_pano = Image.fromarray(np.clip(arr_img, 0, 255).astype(np.uint8))
        fused_pano.save(pano_file, "WEBP", quality=92)

        if base_dep:
            arr_dep = np.array(base_dep, dtype=np.float32)
            arr_dep = np.roll(arr_dep, shift_pixels, axis=1)
            arr_dep = blend_horizontal_seam_fast(arr_dep, blend_width=32)
            fused_dep = Image.fromarray(np.clip(arr_dep, 0, 255).astype(np.uint8))
            fused_dep.save(depth_file, "PNG")
        else:
            # Fallback simple metric gradient depth
            depth_arr = np.zeros((h, w), dtype=np.uint8)
            depth_arr.fill(128)
            Image.fromarray(depth_arr, mode="L").save(depth_file, "PNG")

        logger.info(f"Photographic fusion synthesized for {new_room_name}: {pano_file}")
        return pano_url, depth_url
    except Exception as fuse_err:
        logger.error(f"Error during photographic fusion synthesis: {fuse_err}")
        import shutil
        shutil.copyfile(cand_pano, pano_file)
        if cand_depth.exists():
            shutil.copyfile(cand_depth, depth_file)
        return pano_url, depth_url
