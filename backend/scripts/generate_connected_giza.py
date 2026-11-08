# generator for 4 seamlessly interconnected rooms of the Necropolis of Giza
# ensures shared global sun, level horizon at y=512, consistent floor palette, and reciprocal portal alignments

import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 2048, 1024
HORIZON_Y = H // 2
SUN_AZIMUTH = -0.35  # radians
SUN_X = int(((-0.35 / (2.0 * math.pi) + 0.5) % 1.0) * W)
SUN_Y = HORIZON_Y - 185

PALETTE = {
    "sky_top": (29, 78, 216),
    "sky_mid": (96, 165, 250),
    "sky_horizon": (253, 224, 71),
    "sun_halo": (255, 248, 215),
    "sand_top": (234, 182, 100),
    "sand_bot": (161, 98, 7),
    "stone_sun": (243, 208, 136),
    "stone_shadow": (200, 150, 72),
    "gold_trim": (250, 204, 21),
    "pavement_line": (180, 130, 60),
}


def blend_horizontal_seam(arr: np.ndarray, blend_width: int = 32) -> np.ndarray:
    w = arr.shape[1]
    is_3d = arr.ndim == 3
    left_strip = arr[:, :blend_width, :].copy() if is_3d else arr[:, :blend_width].copy()
    right_strip = arr[:, w - blend_width:, :].copy() if is_3d else arr[:, w - blend_width:].copy()

    for i in range(blend_width):
        alpha = float(i) / float(blend_width)
        w_l = (1.0 - alpha) * 0.5 + 0.5
        w_r = 1.0 - w_l
        if is_3d:
            arr[:, i, :] = left_strip[:, i, :] * w_l + right_strip[:, i, :] * w_r
            arr[:, w - 1 - i, :] = right_strip[:, blend_width - 1 - i, :] * w_l + left_strip[:, blend_width - 1 - i, :] * w_r
        else:
            arr[:, i] = left_strip[:, i] * w_l + right_strip[:, i] * w_r
            arr[:, w - 1 - i] = right_strip[:, blend_width - 1 - i] * w_l + left_strip[:, blend_width - 1 - i] * w_r
    return arr


def draw_sky_and_sun(draw: ImageDraw.Draw):
    for y in range(HORIZON_Y):
        t = y / float(HORIZON_Y)
        if t < 0.6:
            st = t / 0.6
            r = int(PALETTE["sky_top"][0] * (1 - st) + PALETTE["sky_mid"][0] * st)
            g = int(PALETTE["sky_top"][1] * (1 - st) + PALETTE["sky_mid"][1] * st)
            b = int(PALETTE["sky_top"][2] * (1 - st) + PALETTE["sky_mid"][2] * st)
        else:
            st = (t - 0.6) / 0.4
            r = int(PALETTE["sky_mid"][0] * (1 - st) + PALETTE["sky_horizon"][0] * st)
            g = int(PALETTE["sky_mid"][1] * (1 - st) + PALETTE["sky_horizon"][1] * st)
            b = int(PALETTE["sky_mid"][2] * (1 - st) + PALETTE["sky_horizon"][2] * st)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Sun with concentric atmospheric halos
    for rad, col in [(140, (255, 240, 190)), (85, (255, 248, 215)), (42, (255, 255, 245))]:
        draw.ellipse([SUN_X - rad, SUN_Y - rad, SUN_X + rad, SUN_Y + rad], fill=col)


def draw_courtyard_floor(draw: ImageDraw.Draw, img: Image.Image):
    for y in range(HORIZON_Y, H):
        t = (y - HORIZON_Y) / float(H - HORIZON_Y)
        r = int(PALETTE["sand_top"][0] * (1 - t) + PALETTE["sand_bot"][0] * t)
        g = int(PALETTE["sand_top"][1] * (1 - t) + PALETTE["sand_bot"][1] * t)
        b = int(PALETTE["sand_top"][2] * (1 - t) + PALETTE["sand_bot"][2] * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Perspective courtyard paving lines
    for x in range(0, W, 128):
        spread = (x - W // 2) * 2.5
        draw.line([(x, HORIZON_Y), (int(W // 2 + spread), H)], fill=PALETTE["pavement_line"], width=2)

    for y in range(HORIZON_Y + 16, H, 36):
        draw.line([(0, y), (W, y)], fill=PALETTE["pavement_line"], width=2)


def draw_portal(draw: ImageDraw.Draw, img: Image.Image, center_u: float, label: str, leads_to_sun: bool = False):
    cx = int(round(center_u * W)) % W
    half_w = 90
    top_y = HORIZON_Y - 240
    bot_y = HORIZON_Y + 115

    # Ground light spill
    spill_h = 160
    for dy in range(spill_h):
        prog = dy / float(spill_h)
        sw = int(half_w * (1.0 + 1.8 * prog))
        sy = bot_y + dy
        if sy < H:
            for dx in range(-sw, sw + 1):
                px = (cx + dx) % W
                alpha = (1.0 - prog) * 0.45 * (1.0 - abs(dx) / float(sw))
                cur = img.getpixel((px, sy))
                blended = (
                    min(255, int(cur[0] * (1.0 - alpha) + 250 * alpha)),
                    min(255, int(cur[1] * (1.0 - alpha) + 204 * alpha)),
                    min(255, int(cur[2] * (1.0 - alpha) + 21 * alpha)),
                )
                img.putpixel((px, sy), blended)

    # Portal opening interior
    interior_col = (255, 235, 175) if leads_to_sun else (210, 165, 95)
    for dx in range(-half_w + 20, half_w - 19):
        px = (cx + dx) % W
        for py in range(top_y + 20, bot_y):
            img.putpixel((px, py), interior_col)

    # Monumental Stone Pylons
    for dx in range(-half_w, -half_w + 22):
        px = (cx + dx) % W
        for py in range(top_y, bot_y + 12):
            img.putpixel((px, py), PALETTE["stone_sun"] if py % 24 > 3 else PALETTE["stone_shadow"])

    for dx in range(half_w - 21, half_w + 1):
        px = (cx + dx) % W
        for py in range(top_y, bot_y + 12):
            img.putpixel((px, py), PALETTE["stone_sun"] if py % 24 > 3 else PALETTE["stone_shadow"])

    # Lintel and gold pediment
    for dx in range(-half_w - 12, half_w + 13):
        px = (cx + dx) % W
        for py in range(top_y - 28, top_y + 22):
            border = (py <= top_y - 24 or py >= top_y + 18)
            img.putpixel((px, py), PALETTE["gold_trim"] if border else PALETTE["stone_sun"])

    # Plaque label
    plaque_w = 190
    plaque_h = 24
    for dx in range(-plaque_w // 2, plaque_w // 2):
        px = (cx + dx) % W
        for py in range(top_y - 56, top_y - 56 + plaque_h):
            border = (abs(dx) >= plaque_w // 2 - 2 or py <= top_y - 54 or py >= top_y - 56 + plaque_h - 2)
            img.putpixel((px, py), PALETTE["gold_trim"] if border else (15, 23, 42))


def generate_giza_forecourt():
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)
    draw_sky_and_sun(draw)

    # Pyramids of Giza
    pyramids = [
        (W // 2 - 420, 260, 310),
        (W // 2, 335, 400),
        (W // 2 + 430, 230, 280),
    ]
    for px, ph, pw in pyramids:
        apex = (px, HORIZON_Y - ph)
        left_base = (px - pw, HORIZON_Y)
        center_base = (px + 25, HORIZON_Y)
        right_base = (px + pw, HORIZON_Y)
        draw.polygon([apex, left_base, center_base], fill=PALETTE["stone_sun"], outline=PALETTE["stone_shadow"])
        draw.polygon([apex, center_base, right_base], fill=PALETTE["stone_shadow"], outline=PALETTE["stone_shadow"])
        cap_h = ph // 7
        cap_w = pw // 7
        draw.polygon([apex, (px - cap_w, HORIZON_Y - ph + cap_h), (px + cap_w, HORIZON_Y - ph + cap_h)], fill=PALETTE["gold_trim"])

    # Flanking colonnades
    for ox in [160, 320, W - 320, W - 160]:
        oh = 260
        draw.polygon([(ox - 16, HORIZON_Y), (ox - 10, HORIZON_Y - oh), (ox + 10, HORIZON_Y - oh), (ox + 16, HORIZON_Y)], fill=PALETTE["stone_sun"], outline=PALETTE["stone_shadow"])

    draw_courtyard_floor(draw, img)

    # Three portals leading to adjacent rooms:
    # 1. East (u = 0.75) -> Sanctuary of the Great Sphinx
    draw_portal(draw, img, 0.75, "SPHINX CAUSEWAY")
    # 2. South (u = 0.0 / 1.0) -> Court of the Solar Barque
    draw_portal(draw, img, 0.0, "SOLAR BARQUE")
    # 3. North (u = 0.5) -> Grand Gallery of Khufu
    draw_portal(draw, img, 0.5, "KHUFU GALLERY")

    # Seamless seam blend
    arr = blend_horizontal_seam(np.array(img, dtype=np.float32), 32)
    final_rgb = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    # Metric depth map
    depth_arr = np.zeros((H, W), dtype=np.float32)
    depth_arr[:HORIZON_Y, :] = np.linspace(15, 35, HORIZON_Y)[:, None]
    depth_arr[HORIZON_Y:, :] = 45.0 + 95.0 * (np.linspace(0, 1, H - HORIZON_Y)[:, None] ** 1.3)
    # Pyramids depth
    for px, ph, pw in pyramids:
        depth_arr[HORIZON_Y - ph:HORIZON_Y, max(0, px - pw):min(W, px + pw)] = np.maximum(
            depth_arr[HORIZON_Y - ph:HORIZON_Y, max(0, px - pw):min(W, px + pw)], 65.0
        )
    depth_arr = blend_horizontal_seam(depth_arr, 32)
    depth_img = Image.fromarray(np.clip(depth_arr, 0, 255).astype(np.uint8), mode="L").filter(ImageFilter.GaussianBlur(2.0))

    return final_rgb, depth_img


def generate_sphinx_causeway():
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)
    draw_sky_and_sun(draw)

    # Distant Khafre Pyramid on Left (West horizon)
    px = 340
    ph = 230
    pw = 280
    draw.polygon([(px, HORIZON_Y - ph), (px - pw, HORIZON_Y), (px + 20, HORIZON_Y)], fill=PALETTE["stone_sun"])
    draw.polygon([(px, HORIZON_Y - ph), (px + 20, HORIZON_Y), (px + pw, HORIZON_Y)], fill=PALETTE["stone_shadow"])

    # Great Sphinx Monolith in Center-Right (East, u = 0.75 -> px = 1536)
    sx = int(0.75 * W)
    # Recumbent lion body
    draw.rectangle([sx - 280, HORIZON_Y - 120, sx + 280, HORIZON_Y], fill=PALETTE["stone_sun"], outline=PALETTE["stone_shadow"])
    draw.rectangle([sx - 340, HORIZON_Y - 55, sx - 200, HORIZON_Y], fill=PALETTE["stone_shadow"])
    draw.rectangle([sx + 200, HORIZON_Y - 55, sx + 340, HORIZON_Y], fill=PALETTE["stone_shadow"])
    # Head of Sphinx with Nemes Headdress
    draw.polygon([(sx, HORIZON_Y - 310), (sx - 110, HORIZON_Y - 120), (sx + 110, HORIZON_Y - 120)], fill=PALETTE["stone_sun"], outline=(30, 58, 138), width=3)
    # Dream Stela between paws
    draw.rectangle([sx - 36, HORIZON_Y - 100, sx + 36, HORIZON_Y], fill=(185, 28, 28), outline=PALETTE["gold_trim"], width=3)

    draw_courtyard_floor(draw, img)

    # Sacred turquoise reflection basin in foreground
    draw.ellipse([sx - 240, HORIZON_Y + 140, sx + 240, HORIZON_Y + 300], fill=(45, 185, 205), outline=PALETTE["gold_trim"], width=5)

    # Reciprocal Portal leading back WEST (u = 0.25) to Great Pyramid Forecourt
    draw_portal(draw, img, 0.25, "FORECOURT", leads_to_sun=True)

    arr = blend_horizontal_seam(np.array(img, dtype=np.float32), 32)
    final_rgb = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    depth_arr = np.zeros((H, W), dtype=np.float32)
    depth_arr[:HORIZON_Y, :] = np.linspace(15, 35, HORIZON_Y)[:, None]
    depth_arr[HORIZON_Y:, :] = 45.0 + 95.0 * (np.linspace(0, 1, H - HORIZON_Y)[:, None] ** 1.3)
    depth_arr[HORIZON_Y - 280:HORIZON_Y, sx - 240:sx + 240] = np.maximum(
        depth_arr[HORIZON_Y - 280:HORIZON_Y, sx - 240:sx + 240], 125.0
    )
    depth_arr = blend_horizontal_seam(depth_arr, 32)
    depth_img = Image.fromarray(np.clip(depth_arr, 0, 255).astype(np.uint8), mode="L").filter(ImageFilter.GaussianBlur(2.0))

    return final_rgb, depth_img


def generate_solar_barque():
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)

    # Star ceiling with gold rosettes & dusk gradient
    for y in range(HORIZON_Y):
        t = y / float(HORIZON_Y)
        r = int(15 * (1 - t) + PALETTE["sand_top"][0] * 0.7 * t)
        g = int(23 * (1 - t) + PALETTE["sand_top"][1] * 0.7 * t)
        b = int(42 * (1 - t) + PALETTE["sand_top"][2] * 0.7 * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Golden celestial stars across zenith ceiling
    for sx in range(40, W, 80):
        sy = (sx * 13 + 37) % (HORIZON_Y - 110)
        draw.ellipse([sx - 3, sy - 3, sx + 3, sy + 3], fill=PALETTE["gold_trim"])

    # Sacred Lebanon Cedarwood Solar Barque in South (u = 0.0 / 1.0)
    # Hull
    for bx in [0, W]:
        draw.ellipse([bx - 360, HORIZON_Y - 140, bx + 360, HORIZON_Y + 60], fill=(146, 64, 14), outline=PALETTE["gold_trim"], width=4)
        # Golden Naos Cabin on deck
        draw.rectangle([bx - 110, HORIZON_Y - 180, bx + 110, HORIZON_Y - 50], fill=(217, 119, 6), outline=PALETTE["gold_trim"], width=3)
        # Ceremonial oars
        for ox in range(bx - 220, bx + 221, 44):
            draw.line([(ox, HORIZON_Y - 60), (ox - 26, HORIZON_Y + 50)], fill=PALETTE["gold_trim"], width=3)

    draw_courtyard_floor(draw, img)

    # Reciprocal Portal leading back NORTH (u = 0.5) to Great Pyramid Forecourt
    draw_portal(draw, img, 0.5, "FORECOURT", leads_to_sun=True)

    arr = blend_horizontal_seam(np.array(img, dtype=np.float32), 32)
    final_rgb = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    depth_arr = np.zeros((H, W), dtype=np.float32)
    depth_arr[:HORIZON_Y, :] = np.linspace(15, 35, HORIZON_Y)[:, None]
    depth_arr[HORIZON_Y:, :] = 45.0 + 95.0 * (np.linspace(0, 1, H - HORIZON_Y)[:, None] ** 1.3)
    depth_arr[HORIZON_Y - 180:HORIZON_Y + 40, :260] = np.maximum(depth_arr[HORIZON_Y - 180:HORIZON_Y + 40, :260], 140.0)
    depth_arr[HORIZON_Y - 180:HORIZON_Y + 40, W - 260:] = np.maximum(depth_arr[HORIZON_Y - 180:HORIZON_Y + 40, W - 260:], 140.0)
    depth_arr = blend_horizontal_seam(depth_arr, 32)
    depth_img = Image.fromarray(np.clip(depth_arr, 0, 255).astype(np.uint8), mode="L").filter(ImageFilter.GaussianBlur(2.0))

    return final_rgb, depth_img


def generate_khufu_gallery():
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)

    # Ascending red granite corbelled vault (North, u = 0.5)
    for y in range(HORIZON_Y):
        t = y / float(HORIZON_Y)
        r = int(41 * (1 - t) + 154 * t)
        g = int(24 * (1 - t) + 91 * t)
        b = int(17 * (1 - t) + 45 * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Stepped corbelled vault masonry layers
    for step in range(7):
        inset = step * 44
        y_top = step * 34
        draw.rectangle([inset, y_top, W - inset, HORIZON_Y], outline=(217, 119, 6), width=3)

    # Glowing bronze oil torches
    for tx in range(120, W, 220):
        for rad, col in [(70, (255, 235, 120)), (40, (255, 245, 180)), (18, (255, 255, 245))]:
            draw.ellipse([tx - rad, HORIZON_Y - 90 - rad, tx + rad, HORIZON_Y - 90 + rad], fill=col)
        draw.rectangle([tx - 6, HORIZON_Y - 90, tx + 6, HORIZON_Y], fill=(120, 53, 15))

    draw_courtyard_floor(draw, img)

    # Reciprocal Portal leading back SOUTH (u = 0.0 / 1.0) to Great Pyramid Forecourt
    draw_portal(draw, img, 0.0, "FORECOURT", leads_to_sun=True)

    arr = blend_horizontal_seam(np.array(img, dtype=np.float32), 32)
    final_rgb = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    depth_arr = np.zeros((H, W), dtype=np.float32)
    depth_arr[:HORIZON_Y, :] = np.linspace(15, 35, HORIZON_Y)[:, None]
    depth_arr[HORIZON_Y:, :] = 45.0 + 95.0 * (np.linspace(0, 1, H - HORIZON_Y)[:, None] ** 1.3)
    depth_arr = blend_horizontal_seam(depth_arr, 32)
    depth_img = Image.fromarray(np.clip(depth_arr, 0, 255).astype(np.uint8), mode="L").filter(ImageFilter.GaussianBlur(2.0))

    return final_rgb, depth_img


def main():
    out_dir = Path("frontend/public/generated_worlds/archive_giza_necropolis")
    out_dir.mkdir(parents=True, exist_ok=True)

    print("Generating Giza Forecourt...")
    rgb, depth = generate_giza_forecourt()
    rgb.save(out_dir / "giza_forecourt_panorama.webp", "WEBP", quality=92)
    depth.save(out_dir / "giza_forecourt_depth.png", "PNG")

    print("Generating Sphinx Causeway...")
    rgb, depth = generate_sphinx_causeway()
    rgb.save(out_dir / "sphinx_causeway_panorama.webp", "WEBP", quality=92)
    depth.save(out_dir / "sphinx_causeway_depth.png", "PNG")

    print("Generating Solar Barque...")
    rgb, depth = generate_solar_barque()
    rgb.save(out_dir / "solar_barque_panorama.webp", "WEBP", quality=92)
    depth.save(out_dir / "solar_barque_depth.png", "PNG")

    print("Generating Khufu Gallery...")
    rgb, depth = generate_khufu_gallery()
    rgb.save(out_dir / "khufu_gallery_panorama.webp", "WEBP", quality=92)
    depth.save(out_dir / "khufu_gallery_depth.png", "PNG")

    print("All 4 seamlessly connected Giza rooms generated successfully!")


if __name__ == "__main__":
    main()
