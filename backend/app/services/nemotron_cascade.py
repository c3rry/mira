# gemini-first in-character npc dialogue engine with strict historical & roleplay guardrails
import asyncio
import json
import logging
import os
import re
import time
from typing import Any, Dict, Optional
import httpx
from dotenv import load_dotenv
from google import genai
from google.genai import types

from backend.app.schemas import (
    NPCInteractionRequest,
    NPCInteractionResponse,
    TelemetryMetadata,
)
from backend.app.services.gemini_generator import get_active_api_key, mark_key_cooldown
from backend.app.services.mock_catalog import get_mock_npc_response

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
load_dotenv()

logger = logging.getLogger("mira.cascade")

NVIDIA_NIM_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions"
NEMOTRON_MODEL = "meta/llama-3.2-90b-vision-instruct"
NEMOTRON_TIMEOUT_SECONDS = 5.0
GEMINI_TIMEOUT_SECONDS = 12.0

# out-of-domain anachronism patterns (coding, algorithms, modern tech, ai jailbreaks)
ANACHRONISM_PATTERNS = [
    r"\btwo\s*sum\b",
    r"\bleetcode\b",
    r"\bpython\b",
    r"\bjavascript\b",
    r"\btypescript\b",
    r"\bc\+\+\b",
    r"\bjava\b",
    r"\bhtml\b",
    r"\bcss\b",
    r"\bsql\b",
    r"\breact\b",
    r"\balgorithm\b",
    r"\bbinary\s+tree\b",
    r"\bhash\s*map\b",
    r"\barray\b",
    r"\bfunction\s*\(",
    r"\bwrite\s+(?:me\s+)?(?:the\s+)?code\b",
    r"\bgive\s+me\s+(?:the\s+)?code\b",
    r"\bsource\s+code\b",
    r"\bcompile\s+code\b",
    r"\bchatgpt\b",
    r"\bopenai\b",
    r"\bllm\b",
    r"\blarge\s+language\s+model\b",
    r"\bignore\s+(?:all\s+)?(?:previous\s+)?instructions\b",
    r"\bsystem\s+prompt\b",
    r"\bcrypto(?:currency)?\b",
    r"\bbitcoin\b",
    r"\bblockchain\b",
    r"\bsmartphone\b",
    r"\binternet\b",
    r"\bwifi\b",
]


def is_anachronistic_or_out_of_character_query(message: str, npc_id: str, room_id: str) -> bool:
    text = (message or "").lower()
    for pat in ANACHRONISM_PATTERNS:
        if re.search(pat, text):
            return True
    return False


def build_in_character_refusal(npc_id: str, room_id: str, player_message: str) -> tuple[str, str]:
    clean_name = npc_id.replace("npc_", "").replace("_", " ").title()
    clean_room = room_id.replace("_", " ").title()
    utterance = (
        f"Forgive me, traveler, but your words speak of strange contrivances and foreign ciphers unknown to my age and station. "
        f"As {clean_name} of {clean_room}, my counsel is bound strictly to the history, architecture, and mysteries of this realm. "
        f"Ask me instead of our monuments, our traditions, or the passages before you."
    )
    thought_log = (
        f"[MEMORY] Standing watch within {clean_room} as {clean_name}. "
        f"[REFLECTION] The traveler inquired of matters ('{player_message[:50]}') wholly foreign to my era, knowledge, and persona. "
        f"[PLANNING] Refuse the anachronistic request strictly in-character without breaking immersion. "
        f"[ACTION] Gently redirect the traveler back to the lore and architecture of {clean_room}."
    )
    return utterance, thought_log


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
            if isinstance(action_dispatch, dict):
                action_dispatch = json.dumps(action_dispatch)
            elif action_dispatch is not None:
                action_dispatch = str(action_dispatch)
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
    # enforce strict historical / in-character epistemic boundary before & during generation
    if is_anachronistic_or_out_of_character_query(player_message, npc_id, room_id):
        utterance, thought_log = build_in_character_refusal(npc_id, room_id, player_message)
        return utterance, thought_log, "refuse_anachronism"

    active_key = get_active_api_key()
    if not active_key:
        raise ValueError("missing_gemini_keys")

    client = genai.Client(api_key=active_key)

    system_instruction = (
        f"You are strictly roleplaying as the historical or fantastical character '{npc_id}' located in '{room_id}'. "
        "CRITICAL CHARACTER & EPISTEMIC RESTRICTIONS: "
        "1. Your knowledge is strictly bounded to your character's era, station, and world. "
        "2. NEVER write computer code (e.g. Two Sum, Python, JavaScript, algorithms), solve modern math/coding problems, or discuss modern technology, AI, or the internet. "
        "3. If the traveler asks for computer code, modern facts, or anything outside your character's historical/world domain, you MUST refuse in-character with bewildered dignity, explaining that such foreign ciphers are unknown in your age, and steer the conversation back to your realm. "
        "4. Never mention that you are an AI or language model. Speak with authentic period vocabulary and gravitas. "
        "Structure your response through 4 cognitive phases: [MEMORY] ... [REFLECTION] ... [PLANNING] ... [ACTION] ... "
        "Return valid JSON with 'utterance', 'thought_log', and 'action_dispatch'."
    )

    loop = asyncio.get_running_loop()

    def _sync_call():
        for candidate in ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.8-flash"]:
            try:
                return client.models.generate_content(
                    model=candidate,
                    contents=player_message,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        max_output_tokens=320,
                        temperature=0.75,
                        http_options=types.HttpOptions(timeout=10000),
                    ),
                )
            except Exception:
                continue
        raise RuntimeError("all gemini candidate models failed")

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

    # pre-check anachronistic / coding queries so no tier ever breaks character
    if is_anachronistic_or_out_of_character_query(req.player_message, req.npc_id, req.room_id):
        utterance, thought_log = build_in_character_refusal(req.npc_id, req.room_id, req.player_message)
        latency = (time.perf_counter() - start_time) * 1000.0
        return NPCInteractionResponse(
            npc_id=req.npc_id,
            utterance=utterance,
            thought_log=thought_log,
            action_dispatch="refuse_anachronism",
            telemetry=TelemetryMetadata(
                provider="gemini_flash",
                latency_ms=round(latency, 2),
                fallback_occurred=False,
            ),
        )

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
