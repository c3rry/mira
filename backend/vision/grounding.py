# vision grounding pipeline for 360 equirectangular panoramas
import argparse
import json
import logging
import math
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from PIL import Image

from backend.app.schemas import SphericalCoord, VisionBoundingBox
from backend.app.services.gemini_generator import get_active_api_key, mark_key_cooldown

logger = logging.getLogger("mira.vision")

DEFAULT_SPHERE_RADIUS = 500.0


def uv_to_spherical(u: float, v: float, r: float = DEFAULT_SPHERE_RADIUS) -> SphericalCoord:
    # map normalized horizontal uv [0, 1] to azimuth theta [-pi, pi]
    theta = (u - 0.5) * 2.0 * math.pi
    # map normalized vertical uv [0, 1] to polar inclination phi [0, pi]
    phi = v * math.pi
    # clamp polar angle slightly away from exact singularity poles
    phi = max(0.05, min(math.pi - 0.05, phi))
    return SphericalCoord(r=r, theta=theta, phi=phi)


def spherical_to_cartesian(coord: SphericalCoord) -> Dict[str, float]:
    # convert spherical coordinates to 3d cartesian vector (y-up coordinate system)
    x = coord.r * math.sin(coord.phi) * math.sin(coord.theta)
    y = coord.r * math.cos(coord.phi)
    z = coord.r * math.sin(coord.phi) * math.cos(coord.theta)
    return {"x": round(x, 3), "y": round(y, 3), "z": round(z, 3)}


def box_to_spherical(
    box: VisionBoundingBox, r: float = DEFAULT_SPHERE_RADIUS
) -> tuple[float, float, SphericalCoord]:
    # determine coordinate scale (1000 for standard gemini boxes, 1.0 for unit floats)
    scale = 1000.0 if any(val > 1.0 for val in [box.ymin, box.xmin, box.ymax, box.xmax]) else 1.0
    u = ((box.xmin + box.xmax) / 2.0) / scale
    v = ((box.ymin + box.ymax) / 2.0) / scale
    # clamp uv coordinates to unit interval
    u = max(0.0, min(1.0, u))
    v = max(0.0, min(1.0, v))
    spherical = uv_to_spherical(u, v, r=r)
    return u, v, spherical


def get_heuristic_fallback_zones(r: float = DEFAULT_SPHERE_RADIUS) -> List[Dict[str, Any]]:
    # 15-minute de-scoping fallback returning deterministic polar zones for floor and doorways
    # uses documented polar anchors: theta in [-60 deg, 0 deg, 60 deg], phi = 0.75 pi (~135 deg)
    zones = [
        {
            "label": "floor_center",
            "box": VisionBoundingBox(ymin=700, xmin=450, ymax=850, xmax=550, label="floor_center"),
            "u": 0.5,
            "v": 0.75,
            "spherical": SphericalCoord(r=r, theta=0.0, phi=0.75 * math.pi),
            "source": "heuristic_fallback",
        },
        {
            "label": "floor_left",
            "box": VisionBoundingBox(ymin=700, xmin=200, ymax=850, xmax=350, label="floor_left"),
            "u": 0.333,
            "v": 0.75,
            "spherical": SphericalCoord(r=r, theta=-math.pi / 3.0, phi=0.75 * math.pi),
            "source": "heuristic_fallback",
        },
        {
            "label": "floor_right",
            "box": VisionBoundingBox(ymin=700, xmin=650, ymax=850, xmax=800, label="floor_right"),
            "u": 0.667,
            "v": 0.75,
            "spherical": SphericalCoord(r=r, theta=math.pi / 3.0, phi=0.75 * math.pi),
            "source": "heuristic_fallback",
        },
        {
            "label": "doorway_portal",
            "box": VisionBoundingBox(ymin=350, xmin=580, ymax=650, xmax=680, label="doorway_portal"),
            "u": 0.625,
            "v": 0.50,
            "spherical": SphericalCoord(r=r, theta=0.25 * math.pi, phi=0.50 * math.pi),
            "source": "heuristic_fallback",
        },
    ]

    for item in zones:
        item["cartesian"] = spherical_to_cartesian(item["spherical"])
        # serialize spherical model for json convenience
        item["spherical_dict"] = item["spherical"].model_dump()
        item["box_dict"] = item["box"].model_dump()

    return zones


def detect_and_ground_image(
    image_path_or_bytes: Union[str, Path, bytes, Image.Image],
    r: float = DEFAULT_SPHERE_RADIUS,
    force_fallback: bool = False,
) -> List[Dict[str, Any]]:
    # multimodal vision detection with automatic 15-minute de-scoping fallback
    if force_fallback:
        return get_heuristic_fallback_zones(r=r)

    api_key = get_active_api_key()
    if not api_key:
        logger.info("No active Gemini API key found, activating heuristic fallback zones")
        return get_heuristic_fallback_zones(r=r)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        # resolve input image
        pil_img: Optional[Image.Image] = None
        if isinstance(image_path_or_bytes, Image.Image):
            pil_img = image_path_or_bytes
        elif isinstance(image_path_or_bytes, (str, Path)):
            path = Path(image_path_or_bytes)
            if not path.exists():
                logger.warning(f"Image path {path} does not exist, using fallback")
                return get_heuristic_fallback_zones(r=r)
            pil_img = Image.open(path)
        elif isinstance(image_path_or_bytes, bytes):
            import io
            pil_img = Image.open(io.BytesIO(image_path_or_bytes))

        if pil_img is None:
            return get_heuristic_fallback_zones(r=r)

        prompt = (
            "Detect key walkable floor positions, doorways, and points of interest in this 360 panorama. "
            "Return a JSON list of objects, each with 'label' (string) and 'box_2d' ([ymin, xmin, ymax, xmax] normalized 0-1000)."
        )

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[pil_img, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )

        if not response.text:
            return get_heuristic_fallback_zones(r=r)

        raw_data = json.loads(response.text)
        if isinstance(raw_data, dict):
            # unpack possible top-level wrappers like {"objects": [...]} or {"items": [...]}
            for key in ["objects", "detections", "items", "boxes"]:
                if key in raw_data and isinstance(raw_data[key], list):
                    raw_data = raw_data[key]
                    break

        if not isinstance(raw_data, list) or len(raw_data) == 0:
            return get_heuristic_fallback_zones(r=r)

        results: List[Dict[str, Any]] = []
        for entry in raw_data:
            label = entry.get("label", "grounded_object")
            box_coords = entry.get("box_2d") or entry.get("box") or [700, 450, 850, 550]
            if len(box_coords) != 4:
                continue

            box = VisionBoundingBox(
                ymin=float(box_coords[0]),
                xmin=float(box_coords[1]),
                ymax=float(box_coords[2]),
                xmax=float(box_coords[3]),
                label=label,
            )
            u, v, spherical = box_to_spherical(box, r=r)
            cartesian = spherical_to_cartesian(spherical)

            results.append(
                {
                    "label": label,
                    "box": box,
                    "u": round(u, 4),
                    "v": round(v, 4),
                    "spherical": spherical,
                    "cartesian": cartesian,
                    "spherical_dict": spherical.model_dump(),
                    "box_dict": box.model_dump(),
                    "source": "gemini_vision",
                }
            )

        return results if results else get_heuristic_fallback_zones(r=r)

    except Exception as exc:
        err_str = str(exc)
        logger.warning(f"Vision grounding error: {err_str}. Activating 15-minute fallback valve.")
        if "429" in err_str or "quota" in err_str.lower():
            mark_key_cooldown(api_key, cooldown_seconds=60.0)
        return get_heuristic_fallback_zones(r=r)


def main():
    parser = argparse.ArgumentParser(description="Gemini Vision Grounding Pipeline")
    parser.add_argument("--image", default="shared/test_panorama.webp", help="Path to 360 panorama image")
    parser.add_argument("--radius", type=float, default=500.0, help="Sphere radius in units")
    parser.add_argument("--force-fallback", action="store_true", help="Force heuristic polar fallback zones")
    args = parser.parse_args()

    print(f"=== Mira Vision Grounding Pipeline ===")
    print(f"Image: {args.image}")
    print(f"Sphere radius: {args.radius}")

    anchors = detect_and_ground_image(
        image_path_or_bytes=args.image,
        r=args.radius,
        force_fallback=args.force_fallback,
    )

    print(f"\nGrounded {len(anchors)} spatial anchors:")
    for i, a in enumerate(anchors, 1):
        sph = a["spherical"]
        cart = a["cartesian"]
        box = a["box"]
        print(f"[{i}] {a['label']} ({a['source']})")
        print(f"    box: ymin={box.ymin}, xmin={box.xmin}, ymax={box.ymax}, xmax={box.xmax}")
        print(f"    uv: ({a['u']}, {a['v']})")
        print(f"    spherical: r={sph.r:.1f}, theta={sph.theta:.4f} rad ({math.degrees(sph.theta):.1f}°), phi={sph.phi:.4f} rad ({math.degrees(sph.phi):.1f}°)")
        print(f"    cartesian: x={cart['x']}, y={cart['y']}, z={cart['z']}")


if __name__ == "__main__":
    main()
