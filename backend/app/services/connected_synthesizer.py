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

    w, h = 2048, 1024
    horizon_y = h // 2

    # Extract parent state
    from_x = from_room.worldX if (from_room and from_room.worldX is not None) else 0.0
    from_z = from_room.worldZ if (from_room and from_room.worldZ is not None) else 0.0
    from_name = from_room.name if from_room else "Parent Sanctuary"
    from_pal = getattr(from_room, "visual_palette", None)

    # Derive RGB colors
    sky_rgb = hex_to_rgb(getattr(from_pal, "sky_tone", None), (30, 41, 59))
    floor_rgb = hex_to_rgb(getattr(from_pal, "floor_tone", None), (15, 23, 42))
    dominant_rgb = hex_to_rgb(getattr(from_pal, "dominant_color", None), (217, 119, 6))
    accent_rgb = hex_to_rgb(getattr(from_pal, "accent_color", None), (251, 191, 36))

    # Calculate exact bearings and UVs
    _, _, theta_fwd, theta_back, u_fwd, u_back = compute_inter_room_bearing(
        from_x, from_z, target_x, target_z
    )

    portal_cx = int(round(u_back * w)) % w
    forward_cx = int(round(u_fwd * w)) % w

    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)

    # 1. Sky Dome (Preserves celestial alignment with parent room)
    for y in range(horizon_y):
        t = y / float(horizon_y)
        r = int(sky_rgb[0] * (0.6 + 0.4 * t))
        g = int(sky_rgb[1] * (0.6 + 0.4 * t))
        b = int(sky_rgb[2] * (0.7 + 0.3 * t))
        draw.line([(0, y), (w, y)], fill=(min(255, r), min(255, g), min(255, b)))

    # Sun / Celestial body at consistent global azimuth (-0.35 rad)
    sun_x = int(((-0.35 / (2.0 * math.pi) + 0.5) % 1.0) * w)
    sun_y = horizon_y - 180
    is_space = "space" in biome_type or "space" in (world_prompt or "").lower()
    if is_space:
        # Starfield & glowing celestial nebula ribbon
        for sx_i in range(0, w, 48):
            sy_i = (sx_i * 7 + 13) % (horizon_y - 30)
            draw.ellipse([sx_i - 1, sy_i - 1, sx_i + 1, sy_i + 1], fill=(240, 248, 255))
        # Blue/violet planet on horizon
        draw.ellipse([sun_x - 160, sun_y - 160, sun_x + 160, sun_y + 160], fill=(59, 130, 246), outline=(147, 197, 253))
    else:
        # Golden solar disc with atmospheric halo
        for rad, col in [(130, (255, 240, 190)), (75, (255, 248, 215)), (38, (255, 255, 245))]:
            draw.ellipse([sun_x - rad, sun_y - rad, sun_x + rad, sun_y + rad], fill=col)

    # 2. Floor / Ground Surface (Continuous from parent room)
    for y in range(horizon_y, h):
        t = (y - horizon_y) / float(h - horizon_y)
        r = int(floor_rgb[0] * (1.12 - 0.22 * t))
        g = int(floor_rgb[1] * (1.12 - 0.22 * t))
        b = int(floor_rgb[2] * (1.12 - 0.22 * t))
        draw.line([(0, y), (w, y)], fill=(min(255, r), min(255, g), min(255, b)))

    # Perspective radial paving lines converging at horizon
    grid_col = (
        min(255, int(dominant_rgb[0] * 0.75)),
        min(255, int(dominant_rgb[1] * 0.75)),
        min(255, int(dominant_rgb[2] * 0.75)),
    )
    for angle_deg in range(0, 360, 12):
        rad_ang = math.radians(angle_deg)
        fx = int(((rad_ang / (2.0 * math.pi) + 0.5) % 1.0) * w)
        draw.line(
            [(fx, horizon_y), (int(fx + math.sin(rad_ang) * 450), h)],
            fill=grid_col,
            width=2,
        )

    # 3. Reciprocal Portal Archway (Facing back toward from_room at portal_cx)
    p_half_w = 95
    p_top_y = horizon_y - 250
    p_bot_y = horizon_y + 130

    # Directional light spill pouring forward onto the new room's floor
    spill_h = 170
    for dy in range(spill_h):
        prog = dy / float(spill_h)
        sw = int(p_half_w * (1.0 + 1.9 * prog))
        sy = p_bot_y + dy
        if sy < h:
            for dx_p in range(-sw, sw + 1):
                px = (portal_cx + dx_p) % w
                alpha = (1.0 - prog) * 0.52 * (1.0 - abs(dx_p) / float(sw))
                cur = img.getpixel((px, sy))
                blended = (
                    min(255, int(cur[0] * (1.0 - alpha) + dominant_rgb[0] * alpha)),
                    min(255, int(cur[1] * (1.0 - alpha) + dominant_rgb[1] * alpha)),
                    min(255, int(cur[2] * (1.0 - alpha) + dominant_rgb[2] * alpha)),
                )
                img.putpixel((px, sy), blended)

    # Portal opening interior (showing the lit chamber of from_room)
    for dx_p in range(-p_half_w + 24, p_half_w - 23):
        px = (portal_cx + dx_p) % w
        for py in range(p_top_y + 24, p_bot_y):
            if py < horizon_y:
                ratio = (py - p_top_y) / float(horizon_y - p_top_y)
                pr = int(dominant_rgb[0] * 0.85 + 35.0 * ratio)
                pg = int(dominant_rgb[1] * 0.85 + 25.0 * ratio)
                pb = int(dominant_rgb[2] * 0.85 + 15.0 * ratio)
            else:
                ratio = (py - horizon_y) / float(p_bot_y - horizon_y)
                pr = int(floor_rgb[0] * (1.25 - 0.25 * ratio))
                pg = int(floor_rgb[1] * (1.25 - 0.25 * ratio))
                pb = int(floor_rgb[2] * (1.25 - 0.25 * ratio))
            img.putpixel((px, py), (min(255, pr), min(255, pg), min(255, pb)))

    # Monumental Archway Pylons & Lintel
    frame_col = (
        min(255, int(dominant_rgb[0] * 1.15)),
        min(255, int(dominant_rgb[1] * 1.15)),
        min(255, int(dominant_rgb[2] * 1.15)),
    )
    gold_col = (
        min(255, int(accent_rgb[0] * 1.15)),
        min(255, int(accent_rgb[1] * 1.15)),
        min(255, int(accent_rgb[2] * 1.15)),
    )
    shadow_col = (
        max(0, int(dominant_rgb[0] * 0.45)),
        max(0, int(dominant_rgb[1] * 0.45)),
        max(0, int(dominant_rgb[2] * 0.45)),
    )

    # Left pylon
    for dx_p in range(-p_half_w, -p_half_w + 25):
        px = (portal_cx + dx_p) % w
        for py in range(p_top_y, p_bot_y + 16):
            col = frame_col if py % 26 > 3 else shadow_col
            img.putpixel((px, py), col)

    # Right pylon
    for dx_p in range(p_half_w - 24, p_half_w + 1):
        px = (portal_cx + dx_p) % w
        for py in range(p_top_y, p_bot_y + 16):
            col = frame_col if py % 26 > 3 else shadow_col
            img.putpixel((px, py), col)

    # Overhead Lintel & Cornice
    for dx_p in range(-p_half_w - 14, p_half_w + 15):
        px = (portal_cx + dx_p) % w
        for py in range(p_top_y - 30, p_top_y + 25):
            is_border = (py <= p_top_y - 26 or py >= p_top_y + 20)
            img.putpixel((px, py), gold_col if is_border else frame_col)

    # 4. Unique Forward Landmarks of New Room (at forward_cx)
    # Flanking colonnade arcade
    for col_dx in [-360, -200, 200, 360]:
        cx_c = (forward_cx + col_dx) % w
        col_w = 28
        col_top = horizon_y - 290
        col_bot = horizon_y + 75
        for dx_c in range(-col_w // 2, col_w // 2):
            px = (cx_c + dx_c) % w
            for py in range(col_top, col_bot):
                flute = (dx_c % 6 < 4)
                cr = int(dominant_rgb[0] * (1.08 if flute else 0.82))
                cg = int(dominant_rgb[1] * (1.08 if flute else 0.82))
                cb = int(dominant_rgb[2] * (1.08 if flute else 0.82))
                img.putpixel((px, py), (min(255, cr), min(255, cg), min(255, cb)))

    # Central Monument / Pylon at forward_cx
    pylon_w = 150
    pylon_h = 370
    for dx_c in range(-pylon_w, pylon_w):
        px = (forward_cx + dx_c) % w
        prog_x = abs(dx_c) / float(pylon_w)
        cur_h = int(pylon_h * (1.0 - 0.28 * prog_x))
        for py in range(horizon_y - cur_h, horizon_y + 45):
            is_rim = (abs(dx_c) >= pylon_w - 5 or py <= horizon_y - cur_h + 6)
            pr = int(accent_rgb[0] if is_rim else dominant_rgb[0] * 1.12)
            pg = int(accent_rgb[1] if is_rim else dominant_rgb[1] * 1.12)
            pb = int(accent_rgb[2] if is_rim else dominant_rgb[2] * 1.12)
            img.putpixel((px, py), (min(255, pr), min(255, pg), min(255, pb)))

    # 5. Seamless Seam Blending
    rgb_arr = np.array(img, dtype=np.float32)
    rgb_arr = blend_horizontal_seam_fast(rgb_arr, blend_width=32)
    final_img = Image.fromarray(np.clip(rgb_arr, 0, 255).astype(np.uint8))
    final_img.save(pano_file, "WEBP", quality=90)

    # 6. Generate Metric Depth Map (Portal frame near ~210, floor ramp, monuments ~115, sky ~15)
    depth_arr = np.zeros((h, w), dtype=np.float32)
    y_coords = np.linspace(0.0, 1.0, horizon_y, dtype=np.float32)[:, None]
    depth_arr[:horizon_y, :] = 12.0 + 20.0 * y_coords

    y_floor = np.linspace(0.0, 1.0, h - horizon_y, dtype=np.float32)[:, None]
    depth_arr[horizon_y:, :] = 45.0 + 95.0 * (y_floor ** 1.3)

    # Portal Frame Depth
    for dx_p in range(-p_half_w - 14, p_half_w + 15):
        px = (portal_cx + dx_p) % w
        is_pylon = abs(dx_p) >= p_half_w - 26 or abs(dx_p) <= p_half_w + 14
        if is_pylon:
            depth_arr[p_top_y - 30:p_bot_y + 16, px] = 210.0

    # Forward Monument Depth
    for dx_c in range(-pylon_w - 20, pylon_w + 20):
        px = (forward_cx + dx_c) % w
        depth_arr[horizon_y - 330:horizon_y + 45, px] = np.maximum(
            depth_arr[horizon_y - 330:horizon_y + 45, px], 115.0
        )

    depth_arr = blend_horizontal_seam_fast(depth_arr, blend_width=32)
    depth_u8 = np.clip(depth_arr, 0, 255).astype(np.uint8)
    depth_img = Image.fromarray(depth_u8, mode="L").filter(ImageFilter.GaussianBlur(radius=2.5))
    depth_img.save(depth_file, "PNG")

    logger.info(f"Synthesized connected room assets for {new_room_name}: {pano_file} & {depth_file}")
    return pano_url, depth_url
