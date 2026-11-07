# automated unit tests for 3-tier nemotron cascade and circuit breakers
import asyncio
import time
from unittest.mock import AsyncMock, patch
import pytest
from httpx import Response
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas import NPCInteractionRequest
from backend.app.services.nemotron_cascade import (
    execute_npc_cascade,
    extract_thought_and_utterance,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_extract_thought_and_utterance_json():
    # verify json structured output parsing
    raw_json = '{"utterance": "Greetings traveler.", "thought_log": "[MEMORY] Met at gate. [REFLECTION] Harmless. [PLANNING] Greet. [ACTION] Speak.", "action_dispatch": "wave"}'
    utt, thought, act = extract_thought_and_utterance(raw_json)
    assert utt == "Greetings traveler."
    assert "[MEMORY]" in thought
    assert act == "wave"


def test_extract_thought_and_utterance_markdown_json():
    # verify markdown codeblock json parsing
    raw_md = '```json\n{"utterance": "Access granted.", "thought_log": "[MEMORY] Cipher key found. [REFLECTION] Valid credentials. [PLANNING] Open door. [ACTION] Unlock.", "action_dispatch": null}\n```'
    utt, thought, act = extract_thought_and_utterance(raw_md)
    assert utt == "Access granted."
    assert "[PLANNING]" in thought
    assert act is None


def test_extract_thought_and_utterance_text_fallback():
    # verify regex fallback extraction of 4-phase thought log
    raw_text = "[MEMORY] Cryo chamber leaking. [REFLECTION] Player is alert. [PLANNING] Inspect. [ACTION] Check seal.\nBe careful, the coolant is venting."
    utt, thought, _ = extract_thought_and_utterance(raw_text)
    assert "[MEMORY]" in thought
    assert "[ACTION]" in thought
    assert "Be careful" in utt


@pytest.mark.asyncio
async def test_offline_mock_override():
    # verify god mode sub-1ms tier 3 simulated override
    req = NPCInteractionRequest(
        npc_id="npc_cipher",
        player_message="Show me the terminal keys.",
        room_id="room_cyber_lab_01",
        simulate_provider="offline_mock",
    )
    t0 = time.perf_counter()
    res = await execute_npc_cascade(req)
    latency = (time.perf_counter() - t0) * 1000.0

    assert latency < 50.0
    assert res.telemetry.provider == "offline_mock"
    assert res.telemetry.fallback_occurred is True
    assert res.telemetry.fallback_reason == "simulated_override"
    assert len(res.utterance) > 0
    assert "[MEMORY]" in res.thought_log


@pytest.mark.asyncio
async def test_circuit_breaker_timeout():
    # verify simulated timeout (>4.5s) trips circuit breaker immediately to fallback
    req = NPCInteractionRequest(
        npc_id="npc_cipher",
        player_message="Decrypt this datapad.",
        room_id="room_cyber_lab_01",
    )

    # mock nemotron tier to simulate timeout exceeding circuit breaker
    async def mock_timeout(*args, **kwargs):
        raise asyncio.TimeoutError()

    with patch("backend.app.services.nemotron_cascade.call_nemotron_tier", side_effect=mock_timeout):
        t0 = time.perf_counter()
        res = await execute_npc_cascade(req)
        total_time = time.perf_counter() - t0

        # ensure circuit breaker tripped without blocking execution
        assert total_time < 5.5
        assert res.telemetry.provider in ["gemini_flash", "offline_mock"]
        assert res.telemetry.fallback_occurred is True
        assert res.telemetry.fallback_reason == "timeout_4_5s"
        assert len(res.utterance) > 0


@pytest.mark.asyncio
async def test_rate_limit_fallback():
    # verify http 429 rate limit triggers immediate failover
    req = NPCInteractionRequest(
        npc_id="npc_cipher",
        player_message="Status report.",
        room_id="room_cyber_lab_01",
    )

    async def mock_rate_limit(*args, **kwargs):
        raise RuntimeError("rate_limit_429")

    with patch("backend.app.services.nemotron_cascade.call_nemotron_tier", side_effect=mock_rate_limit):
        res = await execute_npc_cascade(req)
        assert res.telemetry.fallback_occurred is True
        assert res.telemetry.provider in ["gemini_flash", "offline_mock"]
        assert res.telemetry.fallback_reason == "rate_limit_429"


@pytest.mark.asyncio
async def test_nemotron_tier_successful():
    # verify tier 1 returns nemotron_70b telemetry when upstream responds
    req = NPCInteractionRequest(
        npc_id="npc_cipher",
        player_message="What are you doing here?",
        room_id="room_cyber_lab_01",
    )

    mock_tuple = (
        "I'm decrypting the cryogenic archives.",
        "[MEMORY] Terminal rebooted. [REFLECTION] Inquirer is curious. [PLANNING] Explain purpose. [ACTION] Speak.",
        None,
    )

    with patch("backend.app.services.nemotron_cascade.call_nemotron_tier", new=AsyncMock(return_value=mock_tuple)):
        res = await execute_npc_cascade(req)
        assert res.telemetry.provider == "nemotron_70b"
        assert res.telemetry.fallback_occurred is False
        assert res.utterance == "I'm decrypting the cryogenic archives."
        assert "[PLANNING]" in res.thought_log


def test_npc_endpoint_http(client):
    # verify post /npc/interact api endpoint end-to-end
    payload = {
        "npc_id": "npc_cipher",
        "player_message": "Hello Cipher.",
        "room_id": "room_cyber_lab_01",
        "simulate_provider": "offline_mock",
    }
    response = client.post("/npc/interact", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["npc_id"] == "npc_cipher"
    assert data["telemetry"]["provider"] == "offline_mock"
    assert "utterance" in data
    assert "thought_log" in data
