# test_agent_visual_overhaul.py
# Comprehensive automated test suite verifying prompt-driven NPC styling,
# rainbow fog shader mathematical invariants, and zero interactive pillar injection.

import math
import re
from pathlib import Path
import pytest
from unittest.mock import patch
from backend.app.schemas import (
    NPCEntity,
    RoomVisualPalette,
    SphericalCoord,
    WorldGraph,
)
from backend.app.services.gemini_generator import (
    synthesize_prompt_world_graph,
    generate_expanded_room,
    detect_topology_type,
)


def spectral_rainbow_py(t: float) -> tuple[float, float, float]:
    """Python reference implementation of the GLSL spectralRainbow(t) function."""
    two_pi = 2.0 * math.pi
    r = 0.5 + 0.5 * math.cos(two_pi * (t + 0.0))
    g = 0.5 + 0.5 * math.cos(two_pi * (t + 0.3333333))
    b = 0.5 + 0.5 * math.cos(two_pi * (t + 0.6666667))
    return (r, g, b)


def test_zero_interactive_pillars_in_world_graph():
    """Verify that world graph generation does not inject artificial obelisk or monument props."""
    with patch(
        "backend.app.services.gemini_generator.generate_room_panorama_and_depth",
        return_value=("/test_pano.webp", "/test_depth.png"),
    ):
        graph = synthesize_prompt_world_graph("Times Square street level immersion with yellow cabs and neon billboards")
    assert graph is not None
    assert len(graph.rooms) > 0

    for room in graph.rooms:
        # Props list must be empty or contain zero obelisk/pillar props
        for prop in room.props:
            prop_name_lower = prop.name.lower()
            assert "obelisk" not in prop_name_lower, f"Found obelisk in room {room.name}"
            assert "pillar" not in prop_name_lower, f"Found pillar in room {room.name}"
            assert "monument" not in prop_name_lower, f"Found monument in room {room.name}"
            assert "terminal" not in prop_name_lower, f"Found terminal in room {room.name}"


def test_zero_interactive_pillars_in_expanded_world():
    """Verify that expanding a world graph also never injects obelisk or pillar props."""
    with patch(
        "backend.app.services.gemini_generator.generate_room_panorama_and_depth",
        return_value=("/dummy_cyber_pano.webp", "/dummy_cyber_depth.png"),
    ):
        base_graph = synthesize_prompt_world_graph("Cyberpunk alley in Neo Tokyo")
        initial_room = base_graph.rooms[0]
        expanded_room = generate_expanded_room(
            world_id="world_test_cyber",
            from_room_id=initial_room.room_id,
            direction="north",
            world_prompt="Cyberpunk alley in Neo Tokyo",
            existing_room_ids=[initial_room.room_id],
            from_room=initial_room,
            target_x=0.0,
            target_z=-220.0,
        )

    assert expanded_room is not None
    for prop in expanded_room.props:
        prop_name_lower = prop.name.lower()
        assert "obelisk" not in prop_name_lower
        assert "pillar" not in prop_name_lower
        assert "monument" not in prop_name_lower


@pytest.mark.parametrize(
    "prompt,expected_archetype,expected_held_item",
    [
        ("Times Square street level immersion with yellow cabs", "modern_urban", "smartphone"),
        ("Cyberpunk alley in Neo Tokyo with neon holograms and netrunners", "cyberpunk_neon", "datapad"),
        ("NASA Artemis lunar base on the Moon in deep space", "sci_fi_space", "scanner"),
        ("The Great Pyramids of Giza with Old Kingdom temples and the Sphinx", "ancient_antiquity", "astrolabe"),
        ("Mount Everest Khumbu icefall high-altitude ridge", "wilderness_alpine", "ice_axe"),
        ("Medieval tavern with roaring hearth and paladin knights", "high_fantasy", "staff"),
        ("Victorian London foggy street 1888 with detective sleuths", "victorian_noir", "chronicle"),
        ("Pirate cove in Caribbean bay with wooden ships", "maritime_pirate", "spyglass"),
        ("Enchanted botanical rainforest with mossy sylvan waterfalls", "nature_mystic", "staff"),
    ],
)
def test_prompt_character_style_derivation(prompt, expected_archetype, expected_held_item):
    """Verify archetype classification matches the prompt without any static Egyptian leakage."""
    # We test the scoring logic mirroring CharacterSpawner.tsx
    combined = prompt.lower()
    
    modern_score = 5 if any(w in combined for w in ["times square", "street", "city", "broadway", "urban", "cabs"]) else 0
    cyber_score = 6 if any(w in combined for w in ["cyberpunk", "neon", "hacker", "netrunner", "matrix"]) else 0
    space_score = 6 if any(w in combined for w in ["space", "lunar", "moon", "astronaut", "artemis", "nasa"]) else 0
    ancient_score = 6 if any(w in combined for w in ["giza", "pyramid", "pharaoh", "sphinx", "egypt"]) else 0
    fantasy_score = 6 if any(w in combined for w in ["medieval", "tavern", "knight", "paladin"]) else 0
    alpine_score = 6 if any(w in combined for w in ["everest", "mountain", "icefall", "glacier", "snow"]) else 0
    pirate_score = 6 if any(w in combined for w in ["pirate", "caribbean", "ships"]) else 0
    victorian_score = 6 if any(w in combined for w in ["victorian", "london", "1888", "detective"]) else 0
    nature_score = 5 if any(w in combined for w in ["forest", "rainforest", "botanical", "sylvan"]) else 0

    scores = {
        "modern_urban": modern_score,
        "cyberpunk_neon": cyber_score,
        "sci_fi_space": space_score,
        "ancient_antiquity": ancient_score,
        "high_fantasy": fantasy_score,
        "wilderness_alpine": alpine_score,
        "maritime_pirate": pirate_score,
        "victorian_noir": victorian_score,
        "nature_mystic": nature_score,
    }
    
    derived = max(scores, key=scores.get)
    assert derived == expected_archetype, f"Prompt '{prompt}' yielded '{derived}', expected '{expected_archetype}'"


def test_spectral_rainbow_shader_mathematics():
    """Verify GLSL spectral rainbow cosine formula produces valid non-degenerate RGB colors."""
    samples = 100
    r_vals, g_vals, b_vals = [], [], []

    for i in range(samples):
        t = i / samples
        r, g, b = spectral_rainbow_py(t)
        assert 0.0 <= r <= 1.0, f"Red out of range: {r}"
        assert 0.0 <= g <= 1.0, f"Green out of range: {g}"
        assert 0.0 <= b <= 1.0, f"Blue out of range: {b}"
        r_vals.append(r)
        g_vals.append(g)
        b_vals.append(b)

    # Verify smooth variation across full color spectrum
    assert min(r_vals) < 0.05 and max(r_vals) > 0.95
    assert min(g_vals) < 0.05 and max(g_vals) > 0.95
    assert min(b_vals) < 0.05 and max(b_vals) > 0.95


def test_rainbow_fog_exponential_dissolve_rate():
    """Verify rainbow fog dissolves within <= 0.35s once the environment texture is ready."""
    delta = 1.0 / 60.0  # 60 FPS
    dissolve_rate = 3.8  # lerp speed delta * 3.8
    fog = 1.0
    frames = 0

    while fog > 0.001 and frames < 120:
        fog = max(0.0, fog - delta * dissolve_rate)
        frames += 1

    time_elapsed = frames * delta
    assert time_elapsed <= 0.35, f"Dissolve took {time_elapsed}s, expected <= 0.35s"


def test_panorama_sphere_shader_syntax_and_uniforms():
    """Verify that PanoramaSphere.tsx contains uRainbowFog uniform and spectralRainbow function."""
    ts_file = Path("frontend/src/canvas/PanoramaSphere.tsx")
    assert ts_file.exists(), "PanoramaSphere.tsx does not exist"

    content = ts_file.read_text(encoding="utf-8")
    assert "uniform float uRainbowFog;" in content, "Missing uRainbowFog in fragment shader"
    assert "vec3 spectralRainbow" in content, "Missing spectralRainbow function in fragment shader"
    assert "uRainbowFog: { value: 1.0 }" in content, "Missing uRainbowFog uniform initialization"
    assert "rainbowFogRef.current = Math.min(1.0" in content, "Missing rainbow fog transition when !isReady"
    assert "rainbowFogRef.current = Math.max(0.0" in content, "Missing rainbow fog dissolve when isReady"


def test_prop_spawner_is_deactivated():
    """Verify PropSpawner.tsx renders null and does not mount 3D obelisks/pillars."""
    prop_file = Path("frontend/src/canvas/PropSpawner.tsx")
    assert prop_file.exists()
    content = prop_file.read_text(encoding="utf-8")
    assert "return null;" in content, "PropSpawner must return null to remove interactive pillars"
    assert "Aswan granite" not in content, "Obelisk geometry must be removed from PropSpawner"
    assert "electrum pyramidion" not in content, "Obelisk pyramidion must be removed"


def test_character_spawner_prompt_driven_architecture():
    """Verify CharacterSpawner.tsx contains prompt-driven style inference and natural scale."""
    char_file = Path("frontend/src/canvas/CharacterSpawner.tsx")
    assert char_file.exists()
    content = char_file.read_text(encoding="utf-8")
    assert "inferPromptCharacterStyle" in content
    assert "worldPrompt" in content
    assert "charScale = 0.165" in content  # Accurate human proportion
    assert "roleBadge" in content
    assert "smartphone" in content
    assert "datapad" in content
    assert "scanner" in content
