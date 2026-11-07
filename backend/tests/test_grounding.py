# unit tests for vision grounding coordinate conversions and fallback triggers
import math
from unittest.mock import MagicMock, patch

import pytest
from backend.app.schemas import SphericalCoord, VisionBoundingBox
from backend.vision.grounding import (
    DEFAULT_SPHERE_RADIUS,
    box_to_spherical,
    detect_and_ground_image,
    get_heuristic_fallback_zones,
    spherical_to_cartesian,
    uv_to_spherical,
)


def test_uv_to_spherical_equator_and_poles():
    # equator center uv (0.5, 0.5) should map to theta=0 and phi=pi/2
    center = uv_to_spherical(0.5, 0.5, r=500.0)
    assert center.r == 500.0
    assert abs(center.theta) < 1e-6
    assert abs(center.phi - (math.pi / 2.0)) < 1e-6

    # left edge u=0.0 maps to theta=-pi
    left = uv_to_spherical(0.0, 0.5, r=500.0)
    assert abs(left.theta - (-math.pi)) < 1e-6

    # right edge u=1.0 maps to theta=pi
    right = uv_to_spherical(1.0, 0.5, r=500.0)
    assert abs(right.theta - math.pi) < 1e-6

    # floor level v=0.75 maps to phi=0.75*pi
    floor = uv_to_spherical(0.5, 0.75, r=500.0)
    assert abs(floor.phi - (0.75 * math.pi)) < 1e-6


def test_spherical_to_cartesian_known_vectors():
    # along positive z axis (theta=0, phi=pi/2)
    front = SphericalCoord(r=500.0, theta=0.0, phi=math.pi / 2.0)
    cart_front = spherical_to_cartesian(front)
    assert cart_front["x"] == 0.0
    assert cart_front["y"] == 0.0
    assert cart_front["z"] == 500.0

    # along positive x axis (theta=pi/2, phi=pi/2)
    side = SphericalCoord(r=500.0, theta=math.pi / 2.0, phi=math.pi / 2.0)
    cart_side = spherical_to_cartesian(side)
    assert cart_side["x"] == 500.0
    assert cart_side["y"] == 0.0
    assert cart_side["z"] == 0.0


def test_box_to_spherical_normalization():
    # test [0, 1000] integer scale box
    box_1000 = VisionBoundingBox(ymin=700.0, xmin=400.0, ymax=800.0, xmax=600.0)
    u1, v1, sph1 = box_to_spherical(box_1000, r=500.0)
    assert u1 == 0.5
    assert v1 == 0.75
    assert abs(sph1.theta) < 1e-6
    assert abs(sph1.phi - (0.75 * math.pi)) < 1e-6

    # test [0, 1] float scale box
    box_float = VisionBoundingBox(ymin=0.7, xmin=0.4, ymax=0.8, xmax=0.6)
    u2, v2, sph2 = box_to_spherical(box_float, r=500.0)
    assert u2 == 0.5
    assert v2 == 0.75
    assert abs(sph2.theta) < 1e-6
    assert abs(sph2.phi - (0.75 * math.pi)) < 1e-6


def test_heuristic_fallback_zones():
    zones = get_heuristic_fallback_zones(r=500.0)
    assert len(zones) >= 3

    for z in zones:
        assert "label" in z
        assert "box" in z
        assert "spherical" in z
        assert "cartesian" in z
        assert z["source"] == "heuristic_fallback"

        sph = z["spherical"]
        assert sph.r == 500.0
        assert -math.pi <= sph.theta <= math.pi
        assert 0.0 <= sph.phi <= math.pi

        cart = z["cartesian"]
        # spherical radius identity check x^2 + y^2 + z^2 ~= r^2
        dist_sq = cart["x"] ** 2 + cart["y"] ** 2 + cart["z"] ** 2
        assert abs(math.sqrt(dist_sq) - 500.0) < 1.0


def test_detect_and_ground_image_force_fallback():
    # forced fallback returns heuristic zones
    zones = detect_and_ground_image("shared/test_panorama.webp", force_fallback=True)
    assert len(zones) >= 3
    assert zones[0]["source"] == "heuristic_fallback"


def test_detect_and_ground_image_no_key(monkeypatch):
    # when no api keys configured, immediately engages fallback
    monkeypatch.setattr("backend.vision.grounding.get_active_api_key", lambda: None)
    zones = detect_and_ground_image("shared/test_panorama.webp")
    assert len(zones) >= 3
    assert zones[0]["source"] == "heuristic_fallback"


def test_detect_and_ground_image_api_success(monkeypatch, tmp_path):
    # mock active key
    monkeypatch.setattr("backend.vision.grounding.get_active_api_key", lambda: "fake_gemini_key")

    # create dummy image file
    from PIL import Image

    dummy_img_path = tmp_path / "test_pano.webp"
    Image.new("RGB", (100, 50), color="blue").save(dummy_img_path)

    # mock genai client and structured json response
    mock_response = MagicMock()
    mock_response.text = (
        '{"objects": [{"label": "walkable_deck", "box_2d": [750, 450, 850, 550]}]}'
    )

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch("google.genai.Client", return_value=mock_client):
        results = detect_and_ground_image(str(dummy_img_path), r=500.0)
        assert len(results) == 1
        assert results[0]["label"] == "walkable_deck"
        assert results[0]["source"] == "gemini_vision"
        assert results[0]["u"] == 0.5
        assert results[0]["v"] == 0.8
        assert results[0]["spherical"].r == 500.0


def test_vision_ground_endpoint():
    # test vision endpoint with fastapi testclient
    from fastapi.testclient import TestClient
    from backend.app.main import app

    with TestClient(app) as client:
        resp = client.post("/vision/ground", json={"force_fallback": True, "radius": 500.0})
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["total_count"] >= 3
        assert payload["radius"] == 500.0
        assert len(payload["anchors"]) >= 3
        assert payload["anchors"][0]["source"] == "heuristic_fallback"

