# generator for vibrant 360 equirectangular panoramas and depth maps
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def create_cyberpunk_panorama(w=2048, h=1024):
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)

    # 1. sky gradient (dark violet to neon navy)
    for y in range(h // 2):
        ratio = y / (h / 2)
        r = int(15 + 25 * ratio)
        g = int(5 + 15 * ratio)
        b = int(35 + 45 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # 2. floor gradient (wet reflective dark asphalt)
    for y in range(h // 2, h):
        ratio = (y - h / 2) / (h / 2)
        r = int(25 - 15 * ratio)
        g = int(30 - 15 * ratio)
        b = int(45 - 20 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # 3. skyscraper skyline silhouettes and window lights
    np.random.seed(42)
    building_count = 32
    bw = w // building_count
    for i in range(building_count):
        bx = i * bw
        bh = np.random.randint(250, 480)
        draw.rectangle([bx, h // 2 - bh, bx + bw - 4, h // 2], fill=(12, 14, 24))
        # glowing windows
        for wy in range(h // 2 - bh + 20, h // 2 - 20, 18):
            for wx in range(bx + 4, bx + bw - 8, 12):
                if np.random.rand() > 0.45:
                    win_color = (0, 240, 255) if np.random.rand() > 0.4 else (255, 0, 128)
                    draw.rectangle([wx, wy, wx + 6, wy + 10], fill=win_color)

    # 4. giant holographic signs
    neon_signs = [
        ("MIRA-NET 3D", 150, 280, (0, 255, 255)),
        ("CYBER-LAB 01", 600, 320, (255, 0, 180)),
        ("SYNAPSE CO.", 1100, 260, (0, 255, 128)),
        ("NEO-SECTOR 7", 1600, 310, (255, 200, 0)),
    ]
    for text, sx, sy, col in neon_signs:
        draw.rectangle([sx - 15, sy - 15, sx + 220, sy + 55], outline=col, width=3)
        draw.text((sx, sy), text, fill=col)

    # 5. perspective neon road grid on floor
    horizon_y = h // 2
    for x in range(0, w, 128):
        draw.line([(x, horizon_y), (x + (x - w // 2) * 2, h)], fill=(0, 180, 255), width=2)
    for y in range(horizon_y + 10, h, 35):
        alpha = int(40 + (y - horizon_y) / (h - horizon_y) * 200)
        draw.line([(0, y), (w, y)], fill=(255, 0, 150), width=1)

    return img


def create_medieval_tavern(w=2048, h=1024):
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)

    # 1. warm stone wall background
    for y in range(h // 2):
        ratio = y / (h / 2)
        draw.line([(0, y), (w, y)], fill=(int(40 + 20 * ratio), int(25 + 15 * ratio), int(15 + 10 * ratio)))

    # 2. wooden floorboards
    for y in range(h // 2, h):
        ratio = (y - h / 2) / (h / 2)
        draw.line([(0, y), (w, y)], fill=(int(65 - 25 * ratio), int(40 - 15 * ratio), int(22 - 10 * ratio)))

    # 3. ceiling timber beams
    for x in range(0, w, 160):
        draw.rectangle([x, 0, x + 30, h // 2 - 80], fill=(30, 18, 10))
    draw.rectangle([0, 120, w, 150], fill=(25, 15, 8))

    # 4. roaring stone fireplace at center
    fx = w // 2 - 150
    draw.rectangle([fx, h // 2 - 200, fx + 300, h // 2 + 50], fill=(50, 48, 45), outline=(90, 85, 80), width=8)
    draw.ellipse([fx + 40, h // 2 - 130, fx + 260, h // 2 + 30], fill=(20, 10, 5))
    # burning fire
    for r in range(80, 10, -10):
        draw.ellipse([fx + 150 - r, h // 2 - 50 - r // 2, fx + 150 + r, h // 2 + 20], fill=(255, int(120 + r * 1.5), 20))

    # 5. hanging chandeliers
    for cx in [w // 4, 3 * w // 4]:
        draw.line([(cx, 150), (cx, 260)], fill=(80, 80, 80), width=3)
        draw.ellipse([cx - 50, 260, cx + 50, 280], fill=(40, 40, 40))
        for cdx in [-40, -15, 15, 40]:
            draw.ellipse([cx + cdx - 6, 240, cx + cdx + 6, 260], fill=(255, 200, 80))

    # 6. wooden tavern tables
    for tx in [w // 8, 3 * w // 8, 5 * w // 8, 7 * w // 8]:
        draw.rectangle([tx - 60, h // 2 + 40, tx + 60, h // 2 + 70], fill=(85, 52, 28), outline=(50, 30, 15), width=3)
        draw.rectangle([tx - 40, h // 2 + 70, tx - 30, h // 2 + 150], fill=(60, 35, 18))
        draw.rectangle([tx + 30, h // 2 + 70, tx + 40, h // 2 + 150], fill=(60, 35, 18))

    return img


def create_space_station(w=2048, h=1024):
    img = Image.new("RGB", (w, h), color=(5, 5, 12))
    draw = ImageDraw.Draw(img)

    # 1. stars in cosmic viewport
    np.random.seed(1337)
    for _ in range(600):
        sx = np.random.randint(0, w)
        sy = np.random.randint(40, h // 2 - 20)
        draw.point((sx, sy), fill=(np.random.randint(180, 255), np.random.randint(200, 255), 255))

    # 2. magnificent earth planet visible through viewport
    ex, ey, er = w // 2, h // 4 + 40, 160
    draw.ellipse([ex - er, ey - er, ex + er, ey + er], fill=(15, 65, 180), outline=(100, 200, 255), width=3)
    # continents
    draw.ellipse([ex - 90, ey - 70, ex + 30, ey + 40], fill=(40, 150, 80))
    draw.ellipse([ex - 20, ey - 20, ex + 100, ey + 80], fill=(35, 130, 70))
    # clouds
    draw.ellipse([ex - 120, ey - 40, ex + 40, ey - 10], fill=(220, 235, 255))
    draw.ellipse([ex - 60, ey + 30, ex + 110, ey + 60], fill=(220, 235, 255))

    # 3. station curved bay window frame
    draw.arc([100, 50, w - 100, h // 2 + 80], start=0, end=360, fill=(180, 190, 210), width=14)
    for vx in range(200, w, 250):
        draw.line([(vx, 60), (vx, h // 2)], fill=(120, 130, 150), width=8)

    # 4. high-tech metallic floor with cyan conduits
    for y in range(h // 2, h):
        ratio = (y - h // 2) / (h // 2)
        c = int(35 + 40 * ratio)
        draw.line([(0, y), (w, y)], fill=(c, c + 5, c + 15))

    # glowing conduit floor rails
    for x in range(100, w, 200):
        draw.line([(x, h // 2), (x + (x - w // 2), h)], fill=(0, 220, 255), width=3)

    return img


def create_desert_oasis(w=2048, h=1024):
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)

    # 1. dramatic sunset sky gradient
    for y in range(h // 2):
        ratio = y / (h / 2)
        r = int(120 + 135 * ratio)
        g = int(40 + 110 * ratio)
        b = int(130 - 90 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # 2. huge golden sun
    sx, sy, sr = w // 2 - 200, h // 2 - 60, 100
    draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(255, 240, 160))

    # 3. distant mountains
    pts = [(0, h // 2 - 30)]
    for x in range(0, w + 100, 80):
        pts.append((x, h // 2 - 40 - int(30 * math.sin(x * 0.015))))
    pts.append((w, h // 2))
    pts.append((0, h // 2))
    draw.polygon(pts, fill=(140, 70, 50))

    # 4. golden sand dunes
    for y in range(h // 2, h):
        ratio = (y - h // 2) / (h // 2)
        r = int(220 - 40 * ratio)
        g = int(160 - 45 * ratio)
        b = int(75 - 30 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # 5. turquoise spring water oasis pool
    draw.ellipse([w // 2 - 300, h // 2 + 100, w // 2 + 300, h // 2 + 320], fill=(30, 160, 180), outline=(80, 210, 225), width=4)

    # 6. date palm tree silhouettes
    for px in [w // 2 - 350, w // 2 + 330, w // 2 - 180]:
        # trunk
        draw.line([(px, h // 2 + 120), (px + 15, h // 2 - 60)], fill=(80, 45, 20), width=9)
        # fronds
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            fx = px + 15 + int(60 * math.cos(rad))
            fy = h // 2 - 60 + int(40 * math.sin(rad))
            draw.line([(px + 15, h // 2 - 60), (fx, fy)], fill=(40, 80, 30), width=4)

    return img


def create_enchanted_forest(w=2048, h=1024):
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)

    # 1. mystical twilight canopy
    for y in range(h // 2):
        ratio = y / (h / 2)
        r = int(10 + 20 * ratio)
        g = int(25 + 40 * ratio)
        b = int(40 + 50 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # 2. mossy forest floor
    for y in range(h // 2, h):
        ratio = (y - h // 2) / (h / 2)
        r = int(15 + 10 * ratio)
        g = int(50 - 20 * ratio)
        b = int(30 - 15 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # 3. twisting ancient trees
    for tx in range(80, w, 220):
        draw.polygon([(tx - 25, h // 2 + 180), (tx - 12, h // 2 - 180), (tx + 12, h // 2 - 180), (tx + 25, h // 2 + 180)], fill=(35, 28, 22))
        # canopy branches
        draw.ellipse([tx - 120, h // 2 - 320, tx + 120, h // 2 - 140], fill=(15, 60, 45))

    # 4. glowing bioluminescent mushrooms
    np.random.seed(999)
    for _ in range(40):
        mx = np.random.randint(60, w - 60)
        my = np.random.randint(h // 2 + 60, h - 80)
        col = (0, 240, 220) if np.random.rand() > 0.5 else (200, 80, 255)
        draw.ellipse([mx - 14, my - 12, mx + 14, my + 4], fill=col)
        draw.line([(mx, my), (mx, my + 18)], fill=(240, 240, 240), width=3)

    return img


def create_depth_map(w=2048, h=1024):
    # generate a valid 8-bit grayscale depth displacement texture (compatible with all browsers)
    # top pole (sky) = 30 (far away)
    # horizon = 120 (mid distance)
    # floor level = 220 (near walkable floor)
    depth = Image.new("L", (w, h))
    for y in range(h):
        if y < h // 2:
            # sky gradient: 30 at zenith to 120 at horizon
            val = int(30 + (y / (h / 2)) * 90)
        else:
            # floor gradient: 120 at horizon to 240 at bottom nadir
            val = int(120 + ((y - h / 2) / (h / 2)) * 120)
        depth.paste(val, [0, y, w, y + 1])
    return depth


def main():
    base_dir = Path("frontend/public/cached_worlds")
    
    # mapping of room ids and biome folders to procedural generators
    room_mappings = {
        # mock world 15 rooms
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
        # fallback biomes
        "cyberpunk_alley": create_cyberpunk_panorama,
        "medieval_tavern": create_medieval_tavern,
        "space_station": create_space_station,
        "desert_oasis": create_desert_oasis,
        "enchanted_forest": create_enchanted_forest,
    }

    print("Generating rich 360 equirectangular panoramas and depth maps for all rooms...")
    depth_img = create_depth_map(2048, 1024)

    for room_id, gen_fn in room_mappings.items():
        room_dir = base_dir / room_id
        room_dir.mkdir(parents=True, exist_ok=True)

        pano = gen_fn(2048, 1024)
        pano_path = room_dir / "panorama.webp"
        pano.save(pano_path, "WEBP", quality=90)
        print(f"Saved rich panorama: {pano_path} ({pano_path.stat().st_size} bytes)")

        depth_path = room_dir / "depth.png"
        depth_img.save(depth_path, "PNG")
        print(f"Saved depth map: {depth_path} ({depth_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
