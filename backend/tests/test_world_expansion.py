# test suite for connected room expansion, spherical bearing math, and reciprocal panorama synthesis
import math
import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.schemas import (
    LightingConfig,
    NodeState,
    RoomVisualPalette,
    WorldExpandRequest,
    WorldExpandResponse,
)
from backend.app.services.connected_synthesizer import (
    compute_inter_room_bearing,
    synthesize_connected_room_assets,
    build_connected_multi_face_prompts,
)
from backend.app.services.gemini_generator import generate_expanded_room


def test_compute_inter_room_bearing_cardinals():
    # North (-Z)
    dx, dz, th_fwd, th_back, u_fwd, u_back = compute_inter_room_bearing(0, 0, 0, -220)
    assert abs(dx - 0.0) < 1e-4
    assert abs(dz - (-220.0)) < 1e-4
    assert abs(th_fwd - 0.0) < 1e-4
    assert abs(abs(th_back) - math.pi) < 1e-4
    assert abs(u_fwd - 0.5) < 1e-4
    assert abs(u_back - 0.0) < 1e-4 or abs(u_back - 1.0) < 1e-4

    # East (+X)
    dx, dz, th_fwd, th_back, u_fwd, u_back = compute_inter_room_bearing(0, 0, 220, 0)
    assert abs(th_fwd - math.pi / 2) < 1e-4
    assert abs(th_back - (-math.pi / 2)) < 1e-4
    assert abs(u_fwd - 0.75) < 1e-4
    assert abs(u_back - 0.25) < 1e-4

    # South (+Z)
    dx, dz, th_fwd, th_back, u_fwd, u_back = compute_inter_room_bearing(0, 0, 0, 220)
    assert abs(abs(th_fwd) - math.pi) < 1e-4
    assert abs(th_back - 0.0) < 1e-4
    assert abs(u_fwd - 1.0) < 1e-4 or abs(u_fwd - 0.0) < 1e-4
    assert abs(u_back - 0.5) < 1e-4

    # West (-X)
    dx, dz, th_fwd, th_back, u_fwd, u_back = compute_inter_room_bearing(0, 0, -220, 0)
    assert abs(th_fwd - (-math.pi / 2)) < 1e-4
    assert abs(th_back - math.pi / 2) < 1e-4
    assert abs(u_fwd - 0.25) < 1e-4
    assert abs(u_back - 0.75) < 1e-4


def test_connected_multi_face_prompts():
    palette = RoomVisualPalette(
        dominant_color="#d97706",
        accent_color="#fbbf24",
        sky_tone="#fed7aa",
        floor_tone="#78350f",
    )
    lighting = LightingConfig(ambient_color="#ffffff", ambient_intensity=1.0)

    anchor, faces, neg = build_connected_multi_face_prompts(
        room_name="Giza North Colonnade",
        world_prompt="The Necropolis of Giza",
        from_room_name="Giza Forecourt",
        from_room_biome="desert_oasis",
        direction="north",
        palette=palette,
        lighting=lighting,
        u_reciprocal=0.0,
    )

    assert "Giza Forecourt" in anchor
    assert len(faces) == 6
    # Back face must explicitly describe the gateway looking back to parent room
    assert "Giza Forecourt" in faces[1]
    assert "#78350f" in faces[1] or "pavement" in faces[1]


def test_synthesize_connected_room_assets_creates_disk_files(tmp_path):
    palette = RoomVisualPalette(
        dominant_color="#d97706",
        accent_color="#fbbf24",
        sky_tone="#fed7aa",
        floor_tone="#78350f",
    )
    from_node = NodeState(
        room_id="room_parent_01",
        name="Great Sanctuary Forecourt",
        biome_type="desert_oasis",
        panorama_url="/cached_worlds/desert_oasis/panorama.webp",
        depth_url="/cached_worlds/desert_oasis/depth.png",
        worldX=0.0,
        worldZ=0.0,
        visual_palette=palette,
    )

    pano_url, depth_url = synthesize_connected_room_assets(
        world_id="test_expansion_world",
        new_room_id="room_north_annex_01",
        new_room_name="North Annex Sanctuary",
        from_room=from_node,
        direction="north",
        target_x=0.0,
        target_z=-220.0,
        biome_type="desert_oasis",
        world_prompt="The Necropolis of Giza",
        force_regenerate=True,
    )

    assert pano_url.startswith("/generated_worlds/test_expansion_world/room_north_annex_01")
    assert depth_url.startswith("/generated_worlds/test_expansion_world/room_north_annex_01")

    # Verify physical file existence and non-zero size
    project_root = Path(__file__).resolve().parents[2]
    pano_disk = project_root / "frontend" / "public" / pano_url.lstrip("/")
    depth_disk = project_root / "frontend" / "public" / depth_url.lstrip("/")

    assert pano_disk.exists(), f"Panorama file missing at {pano_disk}"
    assert pano_disk.stat().st_size > 10000, "Panorama file too small"
    assert depth_disk.exists(), f"Depth file missing at {depth_disk}"
    assert depth_disk.stat().st_size > 2000, "Depth file too small"


def test_world_expand_endpoint():
    client = TestClient(app)
    req = {
        "world_id": "world_expansion_test",
        "from_room_id": "giza_forecourt",
        "direction": "north",
        "world_prompt": "The Necropolis of Giza",
        "existing_room_ids": ["giza_forecourt"],
        "topology_type": "nature_open",
        "from_room_name": "Giza Forecourt",
        "from_room_biome": "desert_oasis",
        "from_room_x": 0.0,
        "from_room_z": 0.0,
        "from_room_palette": {
            "dominant_color": "#d97706",
            "accent_color": "#fbbf24",
            "sky_tone": "#fed7aa",
            "floor_tone": "#78350f",
        },
        "target_x": 0.0,
        "target_z": -220.0,
    }

    response = client.post("/world/expand", json=req)
    assert response.status_code == 200
    data = response.json()

    assert "new_room" in data
    new_room = data["new_room"]
    assert new_room["worldX"] == 0.0
    assert new_room["worldZ"] == -220.0
    assert "giza_forecourt" in new_room["adjacent_room_ids"]
    assert new_room["panorama_url"].startswith("/generated_worlds/")
    assert new_room["depth_url"].startswith("/generated_worlds/")
    assert len(new_room["npcs"]) > 0
    assert "Giza Forecourt" in new_room["npcs"][0]["thought_log"][0]
