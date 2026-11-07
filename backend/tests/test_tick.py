# unit tests for autonomous npc roaming and world tick evaluation
import copy
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.schemas import WorldGraph


def test_tick_with_mock_world():
    # test tick endpoint execution with preloaded mock graph
    with TestClient(app) as client:
        resp = client.post("/world/tick", json={"world_id": "mock_world", "current_room_id": "room_cyber_lab_01"})
        assert resp.status_code == 200
        data = resp.json()

        assert "moved_npcs" in data
        assert "quest_updates" in data
        assert isinstance(data["moved_npcs"], list)
        assert len(data["moved_npcs"]) > 0

        # verify first roaming decision properties
        roam = data["moved_npcs"][0]
        assert "npc_id" in roam
        assert "origin_room_id" in roam
        assert "destination_room_id" in roam
        assert roam["origin_room_id"] != roam["destination_room_id"]


def test_tick_without_request_body():
    # test tick endpoint accepts empty payload
    with TestClient(app) as client:
        resp = client.post("/world/tick")
        assert resp.status_code == 200
        data = resp.json()
        assert "moved_npcs" in data
        assert "quest_updates" in data


def test_tick_empty_app_state(monkeypatch):
    # test tick fallback when app state mock_world is none
    with TestClient(app) as client:
        client.app.state.mock_world = None
        resp = client.post("/world/tick")
        assert resp.status_code == 200
        data = resp.json()
        assert data["moved_npcs"] == []
        assert data["quest_updates"] == []
