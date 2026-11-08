# generator for bright, architecturally rich 360 equirectangular panoramas and depth maps
import math
from pathlib import Path
import random
import numpy as np
from PIL import Image, ImageDraw


def create_desert_oasis(w=2048, h=1024):
    # bright sunlit giza necropolis and desert oasis sanctuary
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    random.seed(77)
    horizon_y = h // 2

    # 1. bright cerulean to golden horizon daytime sky
    for y in range(horizon_y):
        ratio = y / horizon_y
        r = int(75 + 175 * (ratio ** 1.1))
        g = int(165 + 75 * ratio)
        b = int(235 - 55 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # blazing golden sun with concentric solar halo
    sx, sy = w // 2, horizon_y - 190
    for rad, col in [(170, (255, 235, 165)), (120, (255, 245, 195)), (75, (255, 255, 235))]:
        draw.ellipse([sx - rad, sy - rad, sx + rad, sy + rad], fill=col)

    # high cirrus clouds
    for cx in range(120, w, 340):
        cy = random.randint(70, 190)
        draw.ellipse([cx - 110, cy - 18, cx + 110, cy + 18], fill=(255, 250, 240))

    # 2. three monumental pyramids of giza along the horizon
    pyramids = [
        (w // 2 - 420, 270, 320),
        (w // 2, 340, 410),
        (w // 2 + 440, 240, 290),
    ]
    for px, ph, pw in pyramids:
        apex = (px, horizon_y - ph)
        left_base = (px - pw, horizon_y)
        center_base = (px + 30, horizon_y)
        right_base = (px + pw, horizon_y)
        # sunlit limestone face
        draw.polygon([apex, left_base, center_base], fill=(242, 206, 138), outline=(195, 155, 88))
        # warm shadowed face
        draw.polygon([apex, center_base, right_base], fill=(198, 154, 86), outline=(165, 125, 65))
        # golden capstone (pyramidion)
        cap_h = ph // 7
        cap_w = pw // 7
        draw.polygon(
            [apex, (px - cap_w, horizon_y - ph + cap_h), (px + cap_w, horizon_y - ph + cap_h)],
            fill=(255, 225, 95),
            outline=(212, 175, 55),
        )
        # horizontal limestone masonry courses
        for cy in range(horizon_y - ph + cap_h, horizon_y, 16):
            prog = (cy - (horizon_y - ph)) / ph
            lw = int(pw * prog)
            draw.line([(px - lw, cy), (px + lw, cy)], fill=(180, 140, 75), width=1)

    # 3. monumental sandstone colonnades and obelisks on left and right wings
    for ox in [180, 360, w - 360, w - 180]:
        oh = 280
        draw.polygon(
            [(ox - 18, horizon_y), (ox - 10, horizon_y - oh), (ox, horizon_y - oh - 28), (ox + 10, horizon_y - oh), (ox + 18, horizon_y)],
            fill=(235, 195, 125),
            outline=(165, 125, 65),
            width=2,
        )
        # hieroglyphic band markings
        for hy in range(horizon_y - oh + 25, horizon_y - 20, 28):
            draw.rectangle([ox - 7, hy, ox + 7, hy + 12], fill=(175, 125, 55))

    # 4. sunlit golden desert dunes & carved limestone processional courtyard floor
    for y in range(horizon_y, h):
        ratio = (y - horizon_y) / (h - horizon_y)
        r = int(238 - 28 * ratio)
        g = int(196 - 32 * ratio)
        b = int(122 - 30 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # perspective limestone courtyard paving slabs
    for x in range(0, w, 128):
        spread = (x - w // 2) * 2.5
        draw.line([(x, horizon_y), (int(w // 2 + spread), h)], fill=(185, 145, 85), width=2)

    for y in range(horizon_y + 16, h, 34):
        draw.line([(0, y), (w, y)], fill=(195, 155, 92), width=2)

    # central royal processional causeway bordered with gold and lapis lazuli trim
    for y in range(horizon_y, h):
        prog = (y - horizon_y) / (h - horizon_y)
        cw = int(90 + prog * 480)
        draw.line([(w // 2 - cw // 2, y), (w // 2 + cw // 2, y)], fill=(246, 222, 168))
        draw.line([(w // 2 - cw // 2, y), (w // 2 - cw // 2 + 8, y)], fill=(212, 175, 55))
        draw.line([(w // 2 + cw // 2 - 8, y), (w // 2 + cw // 2, y)], fill=(212, 175, 55))

    # sacred turquoise reflection pool in foreground
    draw.ellipse(
        [w // 2 - 260, horizon_y + 150, w // 2 + 260, horizon_y + 310],
        fill=(45, 185, 205),
        outline=(212, 175, 55),
        width=6,
    )

    return img


def create_medieval_tavern(w=2048, h=1024):
    # brightly illuminated classical guildhall and royal library tavern
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    random.seed(101)
    horizon_y = h // 2

    # 1. warm sunlit limestone & timber upper walls
    for y in range(horizon_y):
        ratio = y / horizon_y
        r = int(165 + 45 * ratio)
        g = int(130 + 38 * ratio)
        b = int(92 + 28 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # vaulted oak ceiling beams and golden coffers
    for x in range(0, w, 128):
        draw.rectangle([x, 0, x + 22, horizon_y], fill=(95, 58, 32), outline=(65, 38, 18), width=2)
    draw.rectangle([0, 85, w, 118], fill=(85, 50, 26), outline=(212, 175, 55), width=2)

    # tall arched stained-glass clerestory windows streaming golden daylight
    for wx in range(190, w - 120, 256):
        if abs(wx - w // 2) < 180:
            continue
        draw.rectangle([wx - 48, 145, wx + 48, horizon_y - 30], fill=(255, 232, 165), outline=(95, 58, 32), width=6)
        draw.chord([wx - 48, 98, wx + 48, 195], start=180, end=360, fill=(255, 240, 185), outline=(95, 58, 32), width=6)
        # window mullions
        draw.line([(wx, 105), (wx, horizon_y - 30)], fill=(95, 58, 32), width=3)
        draw.line([(wx - 48, 240), (wx + 48, 240)], fill=(95, 58, 32), width=3)

    # 2. grand carved stone hearth at center with blazing golden fire
    fx = w // 2 - 170
    draw.rectangle([fx, horizon_y - 240, fx + 340, horizon_y + 20], fill=(185, 168, 145), outline=(120, 102, 82), width=6)
    draw.ellipse([fx + 45, horizon_y - 165, fx + 295, horizon_y + 20], fill=(55, 32, 18))
    for rad in range(95, 12, -12):
        draw.ellipse(
            [fx + 170 - rad, horizon_y - 70 - rad // 2, fx + 170 + rad, horizon_y + 15],
            fill=(255, min(255, int(140 + rad * 1.2)), 45),
        )

    # wrought-brass chandeliers with warm glowing candles
    for cx in [w // 4, 3 * w // 4]:
        draw.line([(cx, 90), (cx, 220)], fill=(185, 145, 65), width=4)
        draw.ellipse([cx - 65, 215, cx + 65, 242], fill=(212, 175, 55), outline=(140, 105, 35), width=3)
        for cdx in [-50, -25, 0, 25, 50]:
            draw.ellipse([cx + cdx - 10, 192, cx + cdx + 10, 218], fill=(255, 240, 150))

    # 3. warm honey-oak parquet & crimson runner floor
    for y in range(horizon_y, h):
        ratio = (y - horizon_y) / (h - horizon_y)
        r = int(172 - 32 * ratio)
        g = int(118 - 24 * ratio)
        b = int(68 - 16 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # perspective oak plank lines
    for x in range(0, w, 96):
        spread = (x - w // 2) * 2.3
        draw.line([(x, horizon_y), (int(w // 2 + spread), h)], fill=(115, 72, 38), width=2)

    for y in range(horizon_y + 22, h, 36):
        draw.line([(0, y), (w, y)], fill=(125, 80, 42), width=2)

    # ornate crimson and gold woven hall carpet
    for y in range(horizon_y + 30, h):
        prog = (y - horizon_y) / (h - horizon_y)
        rw = int(110 + prog * 460)
        draw.line([(w // 2 - rw // 2, y), (w // 2 + rw // 2, y)], fill=(155, 38, 42))
        draw.line([(w // 2 - rw // 2, y), (w // 2 - rw // 2 + 10, y)], fill=(218, 178, 72))
        draw.line([(w // 2 + rw // 2 - 10, y), (w // 2 + rw // 2, y)], fill=(218, 178, 72))

    return img


def create_space_station(w=2048, h=1024):
    # bright celestial observatory dome in high orbit
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    random.seed(2026)
    horizon_y = h // 2

    # 1. luminous sapphire-and-gold orbital sky dome
    for y in range(horizon_y):
        ratio = y / horizon_y
        r = int(32 + 95 * ratio)
        g = int(58 + 125 * ratio)
        b = int(125 + 115 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # starfield & golden nebula ribbon
    for _ in range(500):
        sx = random.randint(0, w)
        sy = random.randint(15, horizon_y - 30)
        draw.ellipse([sx - 1, sy - 1, sx + 1, sy + 1], fill=(255, 250, 235))

    # giant illuminated planet & rings in central viewport
    ex, ey, er = w // 2, horizon_y // 2 + 10, 165
    draw.arc([ex - 290, ey - 55, ex + 290, ey + 65], start=0, end=360, fill=(235, 210, 155), width=8)
    draw.ellipse([ex - er, ey - er, ex + er, ey + er], fill=(65, 155, 235), outline=(215, 242, 255), width=5)
    draw.ellipse([ex - 95, ey - 75, ex + 45, ey + 45], fill=(95, 195, 135))
    draw.ellipse([ex - 35, ey - 15, ex + 110, ey + 85], fill=(245, 230, 185))

    # white-and-brass architectural observation ribs
    for vx in range(128, w, 256):
        draw.rectangle([vx - 8, 0, vx + 8, horizon_y], fill=(225, 232, 242), outline=(185, 155, 85), width=2)
    draw.rectangle([0, horizon_y - 18, w, horizon_y + 6], fill=(215, 222, 235), outline=(185, 155, 85), width=3)

    # 2. bright alabaster & brushed-silver promenade floor
    for y in range(horizon_y, h):
        ratio = (y - horizon_y) / (h - horizon_y)
        c = int(218 - 35 * ratio)
        draw.line([(0, y), (w, y)], fill=(c, c + 4, min(255, c + 12)))

    # perspective brass and cyan architectural floor inlays
    for x in range(64, w, 128):
        spread = (x - w // 2) * 2.3
        col = (195, 155, 65) if (x // 128) % 2 == 0 else (75, 165, 225)
        draw.line([(x, horizon_y), (int(w // 2 + spread), h)], fill=col, width=3)

    for y in range(horizon_y + 20, h, 36):
        draw.line([(0, y), (w, y)], fill=(175, 188, 205), width=2)

    return img


def create_enchanted_forest(w=2048, h=1024):
    # sunlit classical botanical sanctuary and marble grove
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    random.seed(999)
    horizon_y = h // 2

    # 1. bright golden-emerald sunlit sky through forest canopy
    for y in range(horizon_y):
        ratio = y / horizon_y
        r = int(115 + 110 * ratio)
        g = int(195 + 48 * ratio)
        b = int(165 + 45 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # golden sunbeams radiating down from canopy
    for bx in range(200, w, 280):
        draw.polygon(
            [(bx - 25, 0), (bx + 25, 0), (bx + 110, horizon_y), (bx - 110, horizon_y)],
            fill=(235, 250, 195),
        )

    # ancient colonnade arches and grand trees
    for tx in range(90, w, 220):
        # tree trunk & classical marble column
        draw.rectangle([tx - 22, horizon_y - 240, tx + 22, horizon_y + 40], fill=(125, 95, 68), outline=(85, 62, 42), width=2)
        # lush emerald-and-gold foliage crown
        draw.ellipse([tx - 135, horizon_y - 380, tx + 135, horizon_y - 160], fill=(55, 145, 85), outline=(95, 185, 115), width=3)
        draw.ellipse([tx - 95, horizon_y - 340, tx + 95, horizon_y - 190], fill=(85, 175, 105))

    # 2. sunlit emerald meadow and white travertine stone walkway
    for y in range(horizon_y, h):
        ratio = (y - horizon_y) / (h - horizon_y)
        r = int(115 - 25 * ratio)
        g = int(175 - 35 * ratio)
        b = int(95 - 25 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # perspective garden grid lines
    for x in range(0, w, 128):
        spread = (x - w // 2) * 2.3
        draw.line([(x, horizon_y), (int(w // 2 + spread), h)], fill=(85, 140, 72), width=2)

    # wide white-marble and gold garden promenade
    for y in range(horizon_y, h):
        prog = (y - horizon_y) / (h - horizon_y)
        pw = int(95 + prog * 460)
        draw.line([(w // 2 - pw // 2, y), (w // 2 + pw // 2, y)], fill=(232, 226, 208))

    for y in range(horizon_y + 18, h, 32):
        prog = (y - horizon_y) / (h - horizon_y)
        pw = int(95 + prog * 460)
        draw.line([(w // 2 - pw // 2, y), (w // 2 + pw // 2, y)], fill=(185, 175, 152), width=2)

    return img


def create_cyberpunk_panorama(w=2048, h=1024):
    # luminous neo-metropolis sunset boulevard with grand architecture
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    random.seed(42)
    horizon_y = h // 2

    # 1. vibrant twilight-amber-violet sky (bright and atmospheric, never pitch black)
    for y in range(horizon_y):
        ratio = y / horizon_y
        r = int(65 + 175 * ratio)
        g = int(75 + 85 * ratio)
        b = int(155 + 45 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # illuminated skyline towers in warm bronze, slate, and glass
    building_count = 32
    bw = w // building_count
    for i in range(building_count):
        bx = i * bw
        bh = random.randint(220, 430)
        b_col = (52, 64, 92) if i % 2 == 0 else (68, 58, 88)
        draw.rectangle([bx, horizon_y - bh, bx + bw - 4, horizon_y], fill=b_col, outline=(145, 165, 205), width=2)

        for wy in range(horizon_y - bh + 16, horizon_y - 14, 16):
            for wx in range(bx + 6, bx + bw - 10, 12):
                if random.random() > 0.25:
                    win_col = (255, 235, 165) if random.random() > 0.4 else (135, 235, 255)
                    draw.rectangle([wx, wy, wx + 7, wy + 10], fill=win_col)

    # architectural signage plaques
    signs = [
        ("GRAND METROPOLIS ARCADE", 140, 250, (255, 225, 130), (45, 52, 78)),
        ("AETHERIUM CONSERVATORY", 640, 275, (145, 240, 255), (38, 58, 78)),
        ("CHRONICLE ARCHIVES", 1140, 245, (255, 215, 145), (58, 45, 68)),
        ("CENTRAL PLAZA", 1620, 270, (165, 245, 215), (38, 62, 58)),
    ]
    for text, sx, sy, col, bg_col in signs:
        draw.rectangle([sx - 12, sy - 10, sx + 260, sy + 42], fill=bg_col, outline=col, width=3)
        draw.text((sx + 8, sy + 10), text, fill=col)

    # 2. well-lit stone & brass boulevard floor
    for y in range(horizon_y, h):
        ratio = (y - horizon_y) / (h - horizon_y)
        r = int(118 - 22 * ratio)
        g = int(124 - 22 * ratio)
        b = int(148 - 24 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # perspective avenue lines
    for x in range(0, w, 128):
        spread = (x - w // 2) * 2.5
        draw.line([(x, horizon_y), (int(w // 2 + spread), h)], fill=(215, 190, 125), width=2)

    for y in range(horizon_y + 18, h, 30):
        draw.line([(0, y), (w, y)], fill=(155, 165, 190), width=1)

    # central grand promenade
    for y in range(horizon_y, h):
        prog = (y - horizon_y) / (h - horizon_y)
        pw = int(90 + prog * 460)
        draw.line([(w // 2 - pw // 2, y), (w // 2 + pw // 2, y)], fill=(175, 178, 195))

    return img


def create_depth_map(w=2048, h=1024):
    # smooth 8-bit radial depth displacement map
    depth = Image.new("L", (w, h))
    horizon_y = h // 2
    for y in range(h):
        if y < horizon_y:
            val = int(30 + (y / horizon_y) * 70)
        else:
            ratio = (y - horizon_y) / (h - horizon_y)
            val = int(110 + ratio * 120)
        depth.paste(val, [0, y, w, y + 1])
    return depth


def main():
    base_dir = Path("frontend/public/cached_worlds")

    room_mappings = {
        "cyber_lab_01": create_cyberpunk_panorama,
        "cyber_lab_02": create_cyberpunk_panorama,
        "cyber_lab_03": create_cyberpunk_panorama,
        "neon_alley_01": create_cyberpunk_panorama,
        "neon_alley_02": create_cyberpunk_panorama,
        "neon_alley_03": create_cyberpunk_panorama,
        "ruins_01": create_desert_oasis,
        "ruins_02": create_desert_oasis,
        "ruins_03": create_desert_oasis,
        "cavern_01": create_enchanted_forest,
        "cavern_02": create_enchanted_forest,
        "cavern_03": create_enchanted_forest,
        "spire_01": create_space_station,
        "spire_02": create_space_station,
        "spire_03": create_space_station,
        "cyberpunk_alley": create_cyberpunk_panorama,
        "medieval_tavern": create_medieval_tavern,
        "space_station": create_space_station,
        "desert_oasis": create_desert_oasis,
        "enchanted_forest": create_enchanted_forest,
    }

    depth_img = create_depth_map(2048, 1024)

    for room_id, gen_fn in room_mappings.items():
        room_dir = base_dir / room_id
        room_dir.mkdir(parents=True, exist_ok=True)
        pano = gen_fn(2048, 1024)
        pano_path = room_dir / "panorama.webp"
        pano.save(pano_path, "WEBP", quality=92)
        depth_path = room_dir / "depth.png"
        depth_img.save(depth_path, "PNG")
        print(f"Generated luminous panorama: {pano_path} ({pano_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
