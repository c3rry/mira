# Tests for dynamic environmental fog, bounded priority rendering queue, and minimap visual markers
import re
import math
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.schemas import (
    RoomVisualPalette,
    WorldExpandRequest,
)
from backend.app.services.gemini_generator import (
    generate_room_visual_palette,
    generate_expanded_room,
)

client = TestClient(app)


class TestEnvironmentalPalette:
    """Verifies that environmental visual palettes are valid and reflect room tones."""

    def test_palette_hex_format(self):
        hex_pattern = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
        biomes = [
            ("The Great Pyramids", "The Great Pyramids of Giza at sunset", "desert_oasis"),
            ("Neo Tokyo Skyline", "Cyberpunk neon metropolis with rain slicked streets", "cyberpunk_city"),
            ("Mount Everest Camp", "Glaciated snowy peaks and frozen seracs", "alpine_tundra"),
            ("Subterranean Catacombs", "Dark subterranean limestone vault", "underground_cavern"),
        ]
        for name, prompt, biome in biomes:
            pal = generate_room_visual_palette(name, prompt, biome)
            assert hex_pattern.match(pal.dominant_color), f"Invalid dominant: {pal.dominant_color}"
            assert hex_pattern.match(pal.accent_color), f"Invalid accent: {pal.accent_color}"
            assert hex_pattern.match(pal.sky_tone), f"Invalid sky: {pal.sky_tone}"
            assert hex_pattern.match(pal.floor_tone), f"Invalid floor: {pal.floor_tone}"

    def test_palette_thematic_tones(self):
        # Desert should have warm/golden dominant tones
        desert_pal = generate_room_visual_palette("Giza Plateau", "Great Pyramids", "desert_oasis")
        assert desert_pal.dominant_color.lower() in ["#d97706", "#f59e0b", "#b45309", "#ca8a04", "#eab308"]

        # Cyberpunk should have distinctive neon/cyan accents
        cyber_pal = generate_room_visual_palette("Times Square Plaza", "Cyberpunk neon street", "cyberpunk_city")
        assert cyber_pal.accent_color.lower() in ["#06b6d4", "#38bdf8", "#0ea5e9", "#ec4899", "#f43f5e", "#a855f7"]


class TestBoundedPriorityExplorationMath:
    """Tests the math and algorithms governing exploration path priority and bounded range."""

    MAX_BOUNDED_RANGE = 450.0

    def compute_priority_score(self, curr_pos, heading_dir, room_pos, is_direct_adj):
        dx = room_pos[0] - curr_pos[0]
        dz = room_pos[1] - curr_pos[1]
        dist = math.hypot(dx, dz)
        if dist > self.MAX_BOUNDED_RANGE:
            return None  # Excluded outside bounded range

        hlen = math.hypot(heading_dir[0], heading_dir[1]) or 1.0
        hx = heading_dir[0] / hlen
        hz = heading_dir[1] / hlen

        nx = dx / dist if dist > 0.001 else 0.0
        nz = dz / dist if dist > 0.001 else 0.0
        dot = nx * hx + nz * hz

        score = dist - (1000.0 if is_direct_adj else 0.0) - (dot * 300.0)
        return score

    def test_forward_room_prioritized_over_backward_room(self):
        curr_pos = (0.0, 0.0)
        heading_north = (0.0, -1.0)  # Moving North (-Z)

        north_room = (0.0, -220.0)
        south_room = (0.0, 220.0)

        north_score = self.compute_priority_score(curr_pos, heading_north, north_room, is_direct_adj=True)
        south_score = self.compute_priority_score(curr_pos, heading_north, south_room, is_direct_adj=True)

        assert north_score is not None
        assert south_score is not None
        # Lower score = higher priority
        assert north_score < south_score, f"North {north_score} should be < South {south_score}"

    def test_adjacent_prioritized_over_two_hop(self):
        curr_pos = (0.0, 0.0)
        heading = (0.0, -1.0)

        one_hop_north = (0.0, -220.0)
        two_hop_north = (0.0, -440.0)

        one_hop_score = self.compute_priority_score(curr_pos, heading, one_hop_north, is_direct_adj=True)
        two_hop_score = self.compute_priority_score(curr_pos, heading, two_hop_north, is_direct_adj=False)

        assert one_hop_score < two_hop_score

    def test_strictly_bounded_range_exclusion(self):
        curr_pos = (0.0, 0.0)
        heading = (0.0, -1.0)

        # 3 hops North is 660 units -> strictly > 450.0
        three_hop_north = (0.0, -660.0)
        score = self.compute_priority_score(curr_pos, heading, three_hop_north, is_direct_adj=False)
        assert score is None, "Rooms > 450 units must be strictly excluded from priority rendering"

        # Diagonal 2-hop (440, 440) -> 622 units -> strictly > 450.0
        diag_two_hop = (440.0, 440.0)
        score_diag = self.compute_priority_score(curr_pos, heading, diag_two_hop, is_direct_adj=False)
        assert score_diag is None


class TestShaderContractVerification:
    """Verifies that the Three.js shader code conforms to the dynamic environmental requirements."""

    def test_panorama_sphere_shader_has_dynamic_environmental_fog(self):
        with open("frontend/src/canvas/PanoramaSphere.tsx", "r", encoding="utf-8") as f:
            code = f.read()

        # Must have dynamic time uniform
        assert "uniform float uTime;" in code
        assert "fogSpeed = uTime" in code

        # Must have environmental uniforms reflecting room palette
        assert "uniform vec3 uEnvSky;" in code
        assert "uniform vec3 uEnvDominant;" in code
        assert "uniform vec3 uEnvAccent;" in code
        assert "uniform vec3 uEnvFloor;" in code

        # Must synchronize with visualPalette
        assert "u.uEnvSky.value.set(visualPalette.sky_tone)" in code
        assert "u.uEnvDominant.value.set(visualPalette.dominant_color)" in code
        assert "u.uEnvAccent.value.set(visualPalette.accent_color)" in code
        assert "u.uEnvFloor.value.set(visualPalette.floor_tone)" in code

        # Must pass visualPalette in props
        assert "visualPalette?: RoomVisualPalette;" in code
        assert "visualPalette," in code


class TestMinimapVisualMarkersContract:
    """Verifies that MinimapTopology implements green/red visual markers and legend."""

    def test_minimap_has_green_and_red_indicators(self):
        with open("frontend/src/components/minimap/MinimapTopology.tsx", "r", encoding="utf-8") as f:
            code = f.read()

        # Must extract renderedRoomIds
        assert "renderedRoomIds" in code

        # Must have green (#22c55e) and red (#ef4444) color indicators
        assert "#22c55e" in code
        assert "#ef4444" in code

        # Must check rendered status for rooms
        assert "isRendered = Boolean(renderedRoomIds?.[rId])" in code

        # Must include Rendered / Queued legend in footer
        assert "Rendered" in code
        assert "Queued" in code


class TestWorldStoreExplorationQueue:
    """Verifies that useWorldStore enforces the bounded rendering queue."""

    def test_store_has_bounded_queue_actions(self):
        with open("frontend/src/store/useWorldStore.ts", "r", encoding="utf-8") as f:
            code = f.read()

        assert "renderedRoomIds: Record<string, boolean>;" in code
        assert "scheduleBoundedPriorityRendering: () => void;" in code
        assert "markRoomRendered: (roomId: string, rendered?: boolean) => void;" in code
        assert "MAX_BOUNDED_RANGE = 450.0" in code
