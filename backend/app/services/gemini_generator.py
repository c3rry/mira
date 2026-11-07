# gemini generator service with tri-account key rotation and in-memory cooldown
import json
import logging
import os
import time
from typing import Dict, List, Optional
from google import genai
from google.genai import types
from backend.app.schemas import WorldGraph

logger = logging.getLogger("mira.gemini")

# in-memory key lockout tracker
quota_cooldown_until: Dict[str, float] = {}
key_rotation_index: int = 0


def get_configured_keys() -> List[str]:
    # collect configured api keys from environment
    candidates = [
        os.getenv("GEMINI_API_KEY_PRIMARY"),
        os.getenv("GEMINI_API_KEY_SECONDARY"),
        os.getenv("GEMINI_API_KEY_TERTIARY"),
        os.getenv("GEMINI_API_KEY"),
    ]
    return [k.strip() for k in candidates if k and k.strip()]


def get_active_api_key() -> Optional[str]:
    global key_rotation_index
    keys = get_configured_keys()
    if not keys:
        return None

    now = time.time()
    # cycle through keys to find one not in cooldown
    for _ in range(len(keys)):
        candidate = keys[key_rotation_index % len(keys)]
        key_rotation_index += 1
        if quota_cooldown_until.get(candidate, 0.0) <= now:
            return candidate

    return None


def mark_key_cooldown(key: str, cooldown_seconds: float = 60.0) -> None:
    # lock out key for specified duration
    quota_cooldown_until[key] = time.time() + cooldown_seconds
    logger.warning(f"Key {key[:8]}... locked for {cooldown_seconds}s")


async def generate_world_graph(
    prompt: str, biome_hint: Optional[str] = None
) -> WorldGraph:
    # acquire active api key
    api_key = get_active_api_key()
    if not api_key:
        raise RuntimeError("No available Gemini API key (missing or in quota cooldown)")

    client = genai.Client(api_key=api_key)

    system_instruction = (
        "You are an expert game master AI for the Mira 3D RPG engine. "
        "Generate a structured WorldGraph topology conforming to the required schema. "
        "Create at least 3 connected rooms with adjacent room ids, entities, and quests."
    )

    full_prompt = f"Create an RPG world graph for prompt: {prompt}"
    if biome_hint:
        full_prompt += f" with biome theme: {biome_hint}"

    try:
        # request structured json response using flash model
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=full_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=WorldGraph,
                temperature=0.7,
            ),
        )

        if not response.text:
            raise ValueError("Empty response text from Gemini API")

        raw_json = json.loads(response.text)
        return WorldGraph.model_validate(raw_json)

    except Exception as exc:
        err_str = str(exc)
        # check for quota or rate limit violations to trigger cooldown
        if "429" in err_str or "quota" in err_str.lower() or "exhausted" in err_str.lower():
            mark_key_cooldown(api_key, cooldown_seconds=60.0)
        raise
