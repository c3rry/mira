# 3-tier resilient ai inference cascade with nvidia nim, gemini flash, and static mock
import asyncio
import json
import logging
import os
import re
import time
from typing import Any, Dict, Optional
import httpx
from google import genai
from google.genai import types

from backend.app.schemas import (
    NPCInteractionRequest,
    NPCInteractionResponse,
    TelemetryMetadata,
)
from backend.app.services.gemini_generator import get_active_api_key, mark_key_cooldown
from backend.app.services.mock_catalog import get_mock_npc_response

logger = logging.getLogger("mira.cascade")

NVIDIA_NIM_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions"
NEMOTRON_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct"
NEMOTRON_TIMEOUT_SECONDS = 4.5
GEMINI_TIMEOUT_SECONDS = 1.2


def extract_thought_and_utterance(raw_text: str) -> tuple[str, str, Optional[str]]:
    # parse json or extract thought traces from structured text
    utterance = ""
    thought_log = ""
    action_dispatch = None

    # attempt json parsing
    try:
        # find json block if wrapped in markdown
        cleaned = raw_text.strip()
        if "```json" in cleaned:
            cleaned = cleaned.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```")[1].split("```")[0].strip()

        data = json.loads(cleaned)
        if isinstance(data, dict):
            utterance = data.get("utterance", "")
            thought_log = data.get("thought_log", "")
            action_dispatch = data.get("action_dispatch")
            if utterance and thought_log:
                return utterance, thought_log, action_dispatch
    except Exception:
        pass

    # fallback regex extraction for 4-phase cognitive trace
    thought_pattern = r"(\[MEMORY\].*?\[ACTION\].*?)(?:\n|$)"
    match = re.search(thought_pattern, raw_text, re.DOTALL)
    if match:
        thought_log = match.group(1).strip()
        utterance = raw_text.replace(match.group(1), "").strip()
    else:
        # fallback structured partitioning
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        if len(lines) > 1 and any(tag in lines[0] for tag in ["[MEMORY]", "[THOUGHT]", "Thought:"]):
            thought_log = lines[0]
            utterance = " ".join(lines[1:])
        else:
            utterance = raw_text
            thought_log = "[MEMORY] Interaction observed. [REFLECTION] Player presence acknowledged. [PLANNING] Engage dialog. [ACTION] Respond verbally."

    return utterance, thought_log, action_dispatch


async def call_nemotron_tier(
    player_message: str,
    npc_id: str,
    room_id: str,
    timeout_budget: float = NEMOTRON_TIMEOUT_SECONDS,
) -> tuple[str, str, Optional[str]]:
    # tier 1: nvidia nim nemotron 70b inference with async circuit breaker
    api_key = os.getenv("NVIDIA_API_KEY", "").strip()
    if not api_key:
        raise ValueError("missing_nvidia_api_key")

    system_prompt = (
        f"You are the autonomous RPG NPC '{npc_id}' situated in room '{room_id}'. "
        "Formulate your response using a 4-phase cognitive thought architecture: "
        "[MEMORY] What you recall about this room and past events. "
        "[REFLECTION] Internal assessment of the player's message and intentions. "
        "[PLANNING] Your tactical or narrative next step. "
        "[ACTION] Your immediate action or speech delivery. "
        "Output strictly valid JSON with keys: 'utterance' (string spoken aloud), 'thought_log' (the 4-phase trace string), and 'action_dispatch' (optional string or null)."
    )

    payload = {
        "model": NEMOTRON_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": player_message},
        ],
        "temperature": 0.6,
        "max_tokens": 256,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=timeout_budget) as client:
        resp = await client.post(NVIDIA_NIM_ENDPOINT, json=payload, headers=headers)
        if resp.status_code == 429:
            raise RuntimeError("rate_limit_429")
        if resp.status_code != 200:
            raise RuntimeError(f"nim_http_{resp.status_code}")

        res_data = resp.json()
        raw_content = res_data["choices"][0]["message"]["content"]
        return extract_thought_and_utterance(raw_content)


async def call_gemini_tier(
    player_message: str,
    npc_id: str,
    room_id: str,
    timeout_budget: float = GEMINI_TIMEOUT_SECONDS,
) -> tuple[str, str, Optional[str]]:
    # tier 2: google gemini 3.8 flash fallback
    active_key = get_active_api_key()
    if not active_key:
        raise ValueError("missing_gemini_keys")

    client = genai.Client(api_key=active_key)

    system_instruction = (
        f"You are the autonomous RPG NPC '{npc_id}' located in room '{room_id}'. "
        "Structure your response through 4 cognitive phases: "
        "[MEMORY] ... [REFLECTION] ... [PLANNING] ... [ACTION] ... "
        "Return valid JSON with 'utterance', 'thought_log', and 'action_dispatch'."
    )

    loop = asyncio.get_running_loop()

    def _sync_call():
        return client.models.generate_content(
            model="gemini-2.5-flash",
            contents=player_message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                max_output_tokens=256,
                temperature=0.6,
            ),
        )

    try:
        response = await asyncio.wait_for(
            loop.run_in_executor(None, _sync_call),
            timeout=timeout_budget,
        )
        if not response or not response.text:
            raise ValueError("empty_gemini_response")
        return extract_thought_and_utterance(response.text)
    except Exception as exc:
        mark_key_cooldown(active_key, cooldown_seconds=30.0)
        raise exc


async def execute_npc_cascade(req: NPCInteractionRequest) -> NPCInteractionResponse:
    start_time = time.perf_counter()

    # god mode simulation override handling
    if req.simulate_provider == "offline_mock":
        mock_data = get_mock_npc_response(req.npc_id, req.player_message)
        latency = (time.perf_counter() - start_time) * 1000.0
        return NPCInteractionResponse(
            npc_id=req.npc_id,
            utterance=mock_data["utterance"],
            thought_log=mock_data["thought_log"],
            action_dispatch=mock_data.get("action_dispatch"),
            telemetry=TelemetryMetadata(
                provider="offline_mock",
                latency_ms=round(latency, 2),
                fallback_occurred=True,
                fallback_reason="simulated_override",
            ),
        )

    if req.simulate_provider == "gemini_flash":
        try:
            utterance, thought, action = await call_gemini_tier(
                req.player_message, req.npc_id, req.room_id
            )
            latency = (time.perf_counter() - start_time) * 1000.0
            return NPCInteractionResponse(
                npc_id=req.npc_id,
                utterance=utterance,
                thought_log=thought,
                action_dispatch=action,
                telemetry=TelemetryMetadata(
                    provider="gemini_flash",
                    latency_ms=round(latency, 2),
                    fallback_occurred=True,
                    fallback_reason="simulated_override",
                ),
            )
        except Exception as exc:
            logger.warning(f"Simulated Gemini tier error: {exc}")
            # drop to tier 3
            mock_data = get_mock_npc_response(req.npc_id, req.player_message)
            latency = (time.perf_counter() - start_time) * 1000.0
            return NPCInteractionResponse(
                npc_id=req.npc_id,
                utterance=mock_data["utterance"],
                thought_log=mock_data["thought_log"],
                action_dispatch=mock_data.get("action_dispatch"),
                telemetry=TelemetryMetadata(
                    provider="offline_mock",
                    latency_ms=round(latency, 2),
                    fallback_occurred=True,
                    fallback_reason=str(exc),
                ),
            )

    # 1. attempt tier 1: nvidia nim nemotron 70b
    try:
        utterance, thought, action = await call_nemotron_tier(
            req.player_message, req.npc_id, req.room_id
        )
        latency = (time.perf_counter() - start_time) * 1000.0
        return NPCInteractionResponse(
            npc_id=req.npc_id,
            utterance=utterance,
            thought_log=thought,
            action_dispatch=action,
            telemetry=TelemetryMetadata(
                provider="nemotron_70b",
                latency_ms=round(latency, 2),
                fallback_occurred=False,
            ),
        )
    except asyncio.TimeoutError:
        fallback_reason = "timeout_4_5s"
        logger.warning("Tier 1 Nemotron timed out at 4.5s; tripping circuit breaker to Tier 2")
    except Exception as exc:
        fallback_reason = str(exc)
        logger.warning(f"Tier 1 Nemotron failed ({exc}); tripping circuit breaker to Tier 2")

    # 2. attempt tier 2: google gemini 3.8 flash fallback
    try:
        utterance, thought, action = await call_gemini_tier(
            req.player_message, req.npc_id, req.room_id
        )
        latency = (time.perf_counter() - start_time) * 1000.0
        return NPCInteractionResponse(
            npc_id=req.npc_id,
            utterance=utterance,
            thought_log=thought,
            action_dispatch=action,
            telemetry=TelemetryMetadata(
                provider="gemini_flash",
                latency_ms=round(latency, 2),
                fallback_occurred=True,
                fallback_reason=fallback_reason,
            ),
        )
    except Exception as gemini_exc:
        logger.warning(f"Tier 2 Gemini failed ({gemini_exc}); falling back to Tier 3 Static Catalog")

    # 3. guaranteed sub-1ms tier 3: deterministic in-memory mock catalog
    mock_data = get_mock_npc_response(req.npc_id, req.player_message)
    latency = (time.perf_counter() - start_time) * 1000.0
    return NPCInteractionResponse(
        npc_id=req.npc_id,
        utterance=mock_data["utterance"],
        thought_log=mock_data["thought_log"],
        action_dispatch=mock_data.get("action_dispatch"),
        telemetry=TelemetryMetadata(
            provider="offline_mock",
            latency_ms=round(latency, 2),
            fallback_occurred=True,
            fallback_reason=fallback_reason,
        ),
    )
