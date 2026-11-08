# comprehensive test suite verifying 3D neural fusion visuals, reciprocal portal continuity,
# 2D floorplan CAD reflection, zero Egyptian prompt leakage, and massive trace logger output

import json
import math
from pathlib import Path
import pytest
import torch

from backend.app.services.connected_synthesizer import compute_inter_room_bearing
from backend.app.services.infinite_world_field import InfiniteWorldField
from backend.app.services.gemini_generator import synthesize_prompt_world_graph
from backend.app.services.local_diffusion import (
    compute_jopano_seam_metrics,
    jopano_poisson_cross_face_blend,
    _build_6face_multi_text_prompts,
)


def test_reciprocal_bearing_angular_mathematics():
    """
    Mathematical proof of reciprocal panoramic portal continuity:
    When traveling from Room A (xa, za) to Room B (xb, zb), the forward azimuth
    departure bearing and the arrival vista back-bearing must differ by exactly pi radians (180 deg).
    """
    test_vectors = [
        ("north", 0.0, 0.0, 0.0, -220.0),
        ("south", 0.0, 0.0, 0.0, 220.0),
        ("east", 0.0, 0.0, 220.0, 0.0),
        ("west", 0.0, 0.0, -220.0, 0.0),
        ("northeast", 0.0, 0.0, 220.0, -220.0),
        ("northwest", 0.0, 0.0, -220.0, -220.0),
        ("southeast", 0.0, 0.0, 220.0, 220.0),
        ("southwest", 0.0, 0.0, -220.0, 220.0),
    ]

    for label, x1, z1, x2, z2 in test_vectors:
        dx, dz, theta_fwd, theta_back, u_fwd, u_back = compute_inter_room_bearing(x1, z1, x2, z2)
        fwd_deg = (math.degrees(theta_fwd) + 360.0) % 360.0
        back_deg = (math.degrees(theta_back) + 360.0) % 360.0

        # 1. Bearings must be valid angles in [0, 360)
        assert 0.0 <= fwd_deg < 360.0, f"Forward deg out of bounds for {label}: {fwd_deg}"
        assert 0.0 <= back_deg < 360.0, f"Back deg out of bounds for {label}: {back_deg}"

        # 2. Equirectangular UV coordinates must lie in [0.0, 1.0)
        assert 0.0 <= u_fwd <= 1.0, f"Forward U out of bounds for {label}: {u_fwd}"
        assert 0.0 <= u_back <= 1.0, f"Back U out of bounds for {label}: {u_back}"

        # 3. Reciprocal bearing difference must be exactly 180 degrees
        angular_diff = abs(fwd_deg - back_deg)
        angular_diff_wrapped = min(angular_diff, 360.0 - angular_diff)
        assert abs(angular_diff_wrapped - 180.0) < 1e-4, (
            f"Reciprocal bearing failed for {label}: fwd={fwd_deg}, back={back_deg}, diff={angular_diff_wrapped}"
        )


def test_zero_egyptian_leakage_in_arbitrary_prompts():
    """
    Verify absolute elimination of hardcoded Egyptian strings across arbitrary non-Egyptian themes.
    Every sector name, description, and NPC role must reflect the user's prompt.
    """
    egyptian_tokens = [
        "giza", "pyramid", "sphinx", "khufu", "pharaoh", "hypostyle",
        "tariq", "seneb", "khaemwaset", "neferu", "merer", "mastaba",
    ]

    diverse_prompts = [
        ("Times Square Street Level Immersion", [(0, 0), (220, 0), (0, -220), (220, -220), (-220, 0)]),
        ("Tokyo Shibuya Neon Crossing", [(0, 0), (0, 220), (-220, 0), (220, 220)]),
        ("Mount Everest High Altitude Glacier", [(0, 0), (0, -220), (220, 0), (-220, 220)]),
        ("Abyssal Deep Ocean Hydrothermal Vent", [(0, 0), (0, -220), (220, 0), (0, 220)]),
        ("Mars Jezero Crater Rover Traverse", [(0, 0), (220, 0), (-220, -220), (0, 440)]),
    ]

    for prompt, coords in diverse_prompts:
        field = InfiniteWorldField(prompt)
        assert field.archetype != "desert", f"Prompt '{prompt}' misclassified as desert!"

        for x, z in coords:
            sample = field.sample_field(x, z)
            combined_text = (
                f"{sample['name']} {sample['description']} "
                f"{sample['npc_title']} {sample['npc_role']} {sample['dominant_feature']}"
            ).lower()

            for token in egyptian_tokens:
                assert token not in combined_text, (
                    f"Egyptian token '{token}' leaked into prompt '{prompt}' at ({x}, {z}): {sample}"
                )


def test_6face_multi_text_prompts_continuity():
    """
    Verify that _build_6face_multi_text_prompts correctly conditions the back face
    to reference the parent room name and maintain connecting vista continuity.
    """
    anchor_p, face_prompts, neg_p = _build_6face_multi_text_prompts(
        room_name="Broadway Junction",
        world_prompt="Times Square Street Level Immersion",
        room_idx=1,
        from_room_name="Neon Avenue",
        direction="east",
        ambient_color="#38bdf8",
        fog_color="#0f172a",
    )

    # 1. Must produce exactly 6 face prompts [Front, Back, Left, Right, Up, Down]
    assert len(face_prompts) == 6

    # 2. Front face (index 0) describes the current room vista
    assert "Broadway Junction" in face_prompts[0]

    # 3. Back face (index 1) MUST reference the parent room ("Neon Avenue") for reciprocal connection
    assert "Neon Avenue" in face_prompts[1] or "Neon" in face_prompts[1]

    # 4. Negative prompt must explicitly forbid desert/pyramids/cartoon
    assert "pyramids" in neg_p.lower()
    assert "cartoon" in neg_p.lower()
    assert "sphinx" in neg_p.lower()


def test_floorplan_2d_to_3d_spatial_reflection():
    """
    Verify that 2D floorplan CAD topology aligns 1:1 with 3D room coordinates,
    with zero node overlaps (distance >= 65 units) and symmetric adjacency edges.
    """
    world = synthesize_prompt_world_graph("Times Square Street Level Immersion", "metropolis")
    assert len(world.rooms) == 4

    # 1. Check all coordinates exist and are non-overlapping
    coords = []
    for r in world.rooms:
        assert r.worldX is not None and r.worldZ is not None
        coords.append((r.worldX, r.worldZ))

    for i in range(len(coords)):
        for j in range(i + 1, len(coords)):
            x1, z1 = coords[i]
            x2, z2 = coords[j]
            dist = math.hypot(x2 - x1, z2 - z1)
            assert dist >= 65.0, (
                f"Floorplan nodes overlap! Room {i} ({x1}, {z1}) and Room {j} ({x2}, {z2}) distance = {dist:.2f}"
            )

    # 2. Check symmetric adjacency in the 2D CAD graph
    room_map = {r.room_id: r for r in world.rooms}
    for r in world.rooms:
        for adj_id in r.adjacent_room_ids:
            assert adj_id in room_map, f"Adjacency references non-existent room: {adj_id}"
            neighbor = room_map[adj_id]
            assert r.room_id in neighbor.adjacent_room_ids, (
                f"Adjacency is asymmetric: {r.room_id} -> {adj_id}, but {adj_id} does not link back!"
            )


def test_poisson_cross_face_blend_enhancement():
    """
    Verify JoPano Poisson Cross-Face Blending Dirichlet boundary conditions:
    CFB must strictly increase Seam-SSIM and reduce Seam-Sobel gradient discontinuities.
    """
    torch.manual_seed(7)
    # create 6 synthetic cubemap faces with sharp step discontinuities across shared edges
    faces = torch.zeros((6, 32, 32, 3), dtype=torch.float32)
    for i in range(6):
        faces[i] = 0.15 * (i + 1) + 0.03 * torch.rand((32, 32, 3))

    metrics_before = compute_jopano_seam_metrics(faces)
    blended = jopano_poisson_cross_face_blend(faces, iterations=200)
    metrics_after = compute_jopano_seam_metrics(blended)

    # Seam-SSIM must rise (closer to 1.0)
    assert metrics_after["seam_ssim"] > metrics_before["seam_ssim"]
    # Seam-Sobel edge gradient discontinuity must drop
    assert metrics_after["seam_sobel"] < metrics_before["seam_sobel"]


def test_massive_trace_log_integrity():
    """
    Verify that backend/logs/mira_fusion_trace.log is actively written with valid JSONL records
    capturing prompt decomposition, diffusion latency, and CFB seam metrics.
    """
    trace_path = Path(__file__).resolve().parents[1] / "logs" / "mira_fusion_trace.log"
    assert trace_path.exists(), f"Trace log file does not exist at {trace_path}"
    assert trace_path.stat().st_size > 0, "Trace log file is empty!"

    categories_found = set()
    with open(trace_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            assert "timestamp" in entry
            assert "category" in entry
            categories_found.add(entry["category"])

    expected_categories = {
        "WORLD_COMPILATION_START",
        "THEME_AND_TOPOLOGY_CLASSIFICATION",
        "ROOM_SPATIAL_GEOMETRY_PLAN",
        "JOPANO_6FACE_MULTI_TEXT_PROMPTS",
        "JOPANO_POISSON_CFB_METRICS",
        "DIFFUSION_INFERENCE_COMPLETE",
        "FUSION_ASSETS_SAVED_TO_DISK",
        "MINIMAP_2D_TOPOLOGICAL_ALIGNMENT",
    }

    missing = expected_categories - categories_found
    assert not missing, f"Trace log is missing mandatory categories: {missing}"
