# automated validation suite for canonical schemas and shared mock world
import json
import os
import pytest
from backend.app.schemas import (
    LightingConfig,
    NPCEntity,
    NPCInteractionRequest,
    NPCInteractionResponse,
    NPCRoamDecision,
    NodeState,
    PropEntity,
    QuestObjective,
    SphericalCoord,
    TelemetryMetadata,
    VisionBoundingBox,
    WorldCompileRequest,
    WorldGraph,
    WorldTickRequest,
    WorldTickResponse,
)


def test_spherical_coord_defaults():
    # test default radius and coordinate assignments
    coord = SphericalCoord(theta=0.5, phi=1.2)
    assert coord.r == 500.0
    assert coord.theta == 0.5
    assert coord.phi == 1.2


def test_telemetry_metadata_literals():
    # test valid provider literals and fallback defaults
    t1 = TelemetryMetadata(provider="nemotron_70b", latency_ms=1240.5)
    assert t1.provider == "nemotron_70b"
    assert not t1.fallback_occurred

    t2 = TelemetryMetadata(
        provider="gemini_flash",
        latency_ms=450.0,
        fallback_occurred=True,
        fallback_reason="timeout_4_5s",
    )
    assert t2.provider == "gemini_flash"
    assert t2.fallback_occurred
    assert t2.fallback_reason == "timeout_4_5s"

    t3 = TelemetryMetadata(provider="offline_mock", latency_ms=0.5)
    assert t3.provider == "offline_mock"


def test_telemetry_metadata_invalid_literal():
    # test schema rejection on invalid provider literal
    with pytest.raises(Exception):
        TelemetryMetadata(provider="unsupported_model", latency_ms=100.0)


def test_npc_interaction_contract():
    # test request and response serialization
    req = NPCInteractionRequest(
        npc_id="npc_cipher",
        player_message="Who are you?",
        room_id="room_cyber_lab_01",
        simulate_provider="nemotron_70b",
    )
    assert req.npc_id == "npc_cipher"
    assert req.simulate_provider == "nemotron_70b"

    resp = NPCInteractionResponse(
        npc_id="npc_cipher",
        utterance="Step away from the terminal.",
        thought_log="[MEMORY] Unknown player. [ACTION] Deny access.",
        action_dispatch=None,
        telemetry=TelemetryMetadata(provider="nemotron_70b", latency_ms=850.0),
    )
    assert resp.utterance == "Step away from the terminal."
    assert "[MEMORY]" in resp.thought_log


def test_mock_world_schema_validation():
    # test that shared mock world adheres 100% to worldgraph schema
    mock_world_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "shared", "mock_world.json"
    )
    assert os.path.exists(mock_world_path), f"missing mock world at {mock_world_path}"

    with open(mock_world_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    world = WorldGraph.model_validate(data)
    assert world.world_id == "mira_offline_world_01"
    assert world.initial_room_id == "room_cyber_lab_01"
    assert len(world.rooms) == 15, "mock world must contain exactly 15 pre-baked rooms"
    assert len(world.quests) >= 2, "mock world must contain quest objectives"

    # assert room topology and npc consistency
    room_ids = {r.room_id for r in world.rooms}
    for room in world.rooms:
        assert room.room_id in room_ids
        assert room.panorama_url.startswith("/cached_worlds/")
        assert room.depth_url.startswith("/cached_worlds/")
        for adj_id in room.adjacent_room_ids:
            assert adj_id in room_ids, f"invalid adjacency {adj_id} in {room.room_id}"

    # assert npc entities have valid thought logs
    cipher = next((npc for r in world.rooms for npc in r.npcs if npc.npc_id == "npc_cipher"), None)
    assert cipher is not None
    assert len(cipher.thought_log) >= 2
    assert cipher.hp == 100
