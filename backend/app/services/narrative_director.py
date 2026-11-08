# narrative director engine leveraging nvidia nim nemotron 70b with lora adaptation and gemini flash fallback
import asyncio
import json
import logging
import os
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple
import httpx
from dotenv import load_dotenv
from google import genai
from google.genai import types

from backend.app.schemas import (
    KnowledgeAgentNode,
    KnowledgeLocationNode,
    KnowledgeRelationshipEdge,
    KnowledgeStoryBeatNode,
    NarrativeChatTurnRequest,
    NarrativeChatTurnResponse,
    StoryKnowledgeGraph,
    TelemetryMetadata,
)
from backend.app.services.gemini_generator import get_active_api_key, mark_key_cooldown
from backend.app.services.nemotron_finetune import adapt_vague_prompt_to_non_spoiling_story

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
load_dotenv()

logger = logging.getLogger("mira.narrative")

NVIDIA_NIM_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions"
NEMOTRON_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct"
NEMOTRON_FALLBACK_MODEL = "meta/llama-3.2-90b-vision-instruct"
NEMOTRON_TIMEOUT_SECONDS = 2.0
GEMINI_TIMEOUT_SECONDS = 2.5

# Middle Grade (Ages 10-13) Adventure & Mystery Directive
MIDDLE_GRADE_GUARDRAIL = (
    "NARRATIVE TONE & AGE GUIDELINE (STRICT): "
    "You are Mira (do NOT refer to yourself as 'the director' or 'Narrative Director'). "
    "Keep responses CONCISE: exactly 2 to 3 sentences maximum. "
    "Tone MUST be formal yet approachable, thrilling, and wonder-filled for ages 10-13 "
    "(in the style of Percy Jackson, Artemis Fowl, or National Treasure). "
    "DO NOT use archaic, verbose purple prose (avoid 'ancient chronometers', 'oaths carved before stone', etc.). "
    "Focus on ancient puzzles, secret codes, lost maps, mechanical dials, teamwork, and heroic discoveries. "
    "NON-SPOILING DIRECTIVE: The user's input may be intentionally vague. Do NOT spoil the climax or final secrets upfront; "
    "keep the initial teasers mysterious and exciting while reserving the truth for later in-world discovery."
)


def infer_suggested_biome(text: str) -> str:
    """Infers the most appropriate visual biome for 3D environment synthesis."""
    t = (text or "").lower()
    if any(k in t for k in ["giza", "pyramid", "sphinx", "egypt", "desert", "oasis", "sand", "pharaoh"]):
        return "desert_oasis"
    if any(k in t for k in ["space", "orbital", "station", "observatory", "lunar", "cosmic", "neptune", "jupiter", "mars"]):
        return "space_station"
    if any(k in t for k in ["rome", "colosseum", "forum", "pantheon", "tavern", "hearth", "medieval", "guildhall"]):
        return "medieval_tavern"
    if any(k in t for k in ["garden", "babylon", "forest", "jungle", "sylvan", "rainforest", "botanical"]):
        return "enchanted_forest"
    if any(k in t for k in ["everest", "mountain", "glacier", "icefall", "alpine", "summit", "snow"]):
        return "space_station"
    return "cyberpunk_alley"


# ---------------------------------------------------------------------------
# Biome-specific quick-reply suggestion chips for the narrative interview
# ---------------------------------------------------------------------------
def get_biome_story_chips(world_title: str, player_msg: str = "") -> List[str]:
    combined = f"{world_title} {player_msg}".lower()
    t = combined
    if any(k in t for k in ["alien", "ufo", "invasion", "extraterrestrial"]):
        return [
            "The Blackout Over Manhattan Skyline",
            "The Intercepted Extraterrestrial Frequency",
            "The Subterranean Telemetry Relay Discovery",
            "The Secret Skybridge Evacuation Protocol",
        ]
    if any(k in t for k in ["giza", "pyramid", "sphinx", "egypt", "desert", "oasis"]):
        return [
            "The Lost Solar Alignment of Khufu",
            "The Stolen Dream Stela Papyrus",
            "The Secret Astrolabe Behind the Sphinx Causeway",
            "The Hidden Reliquary of Imhotep",
        ]
    if any(k in t for k in ["cyber", "neon", "times square", "broadway", "tokyo", "city", "modern", "chicago", "new york"]):
        return [
            "The Midnight Subway Vault Heist",
            "The Rogue AI Syndicate Blackout",
            "The Missing District Curator's Datapad",
            "The Signal at Meridian Crossing",
        ]
    if any(k in t for k in ["space", "orbital", "station", "observatory", "lunar", "cosmic", "neptune"]):
        return [
            "The Silent Signal from Zenith Orbit",
            "The Derelict Dyson Conduit Mystery",
            "The Mutiny at the Alabaster Observatory",
            "The Secret Alignment of the Solar Ring",
        ]
    if any(k in t for k in ["everest", "mountain", "glacier", "icefall", "alpine", "summit"]):
        return [
            "The Hidden Monastery of the Khumbu",
            "The Frozen Expedition Journal of 1924",
            "The Phantom Signal of the Second Step",
            "The Geothermal Sanctuary Beneath the Ridge",
        ]
    if any(k in t for k in ["rome", "colosseum", "forum", "pantheon"]):
        return [
            "The Senatorial Standard in the Travertine Vault",
            "The Gladiator's Secret Wooden Sword",
            "The Oculus Sun Alignment Cipher",
            "The Subterranean Aqueduct Catacombs",
        ]
    return [
        "The Sacred Vault of the Ancient Realm",
        "The Forbidden Threshold of Discovery",
        "The Alliance of the Two Factions",
        "The Awakening of the Forgotten Archive",
    ]


def get_sub_environment_chips(world_title: str, player_msg: str = "") -> List[str]:
    combined = f"{world_title} {player_msg}".lower()
    t = combined
    if any(k in t for k in ["alien", "ufo", "invasion", "extraterrestrial", "mothership"]):
        return [
            "Subterranean Subway Transit Line & Service Tunnel",
            "Rooftop Glass Skybridge & Skyline Vista",
            "Abandoned Broadcast Array & Telemetry Station",
            "Federal Plaza Command Center & Perimeter Gate",
        ]
    if any(k in t for k in ["giza", "pyramid", "sphinx", "egypt", "desert", "oasis", "pharaoh"]):
        return [
            "Subterranean Alabaster Grotto & Sphinx Causeway",
            "Grand Gallery Corbelled Vault & Solar Barque Court",
            "Royal Offering Terrace & Sunken Water Basin",
            "Outer Basalt Colonnade & High Horizon Crest",
        ]
    if any(k in t for k in ["cyber", "neon", "times square", "broadway", "city", "new york", "chicago", "tokyo", "metropolis"]):
        return [
            "Subterranean Market Alley & Neon Gully Crossing",
            "Rooftop Glass Skybridge & Hologram Promenade",
            "Abandoned Transit Line & Steaming Grate Pass",
            "Syndicate Executive Penthouse & Server Core",
        ]
    if any(k in t for k in ["space", "orbital", "station", "observatory", "neptune", "jupiter", "mars", "lunar", "cosmic"]):
        return [
            "Zenith Biosphere Atrium & Gravity Ring",
            "Zero-G Maintenance Conduit & Telemetry Deck",
            "Planetary Observation Lounge & Airway Hub",
            "Cryo-Archive Vault & Solar Panel Truss",
        ]
    if any(k in t for k in ["everest", "mountain", "glacier", "icefall", "alpine", "summit", "snow"]):
        return [
            "Khumbu Icefall Serac Labyrinth & Crevasse Bridge",
            "Western Cwm Glacial Valley & Basecamp Haven",
            "Second Step Frozen Ridge & Oxygen Cache",
            "Hidden Highland Monastery & Geothermal Grotto",
        ]
    if any(k in t for k in ["rome", "colosseum", "forum", "pantheon", "aqueduct", "catacombs"]):
        return [
            "Imperial Rostra & Travertine Basilica Arcade",
            "Subterranean Aqueduct Catacombs & Hypogeum",
            "Rotunda Oculus Sun Terrace & Bronze Gateway",
            "Triumphal Arch Vista & Curia Chamber",
        ]
    return [
        "Deep Subterranean Archives & Ancient Passages",
        "Colonnaded Rotunda Sanctuary & Water Pavilions",
        "Upper Terraced Balustrade & High Vista Deck",
        "The Contested Gate Threshold & Stone Causeway",
    ]


def get_agent_factions_chips(world_title: str, player_msg: str = "") -> List[str]:
    combined = f"{world_title} {player_msg}".lower()
    t = combined
    if any(k in t for k in ["alien", "ufo", "invasion", "extraterrestrial"]):
        return [
            "A Tactical Recon Scout & An Astrobiology Archivist",
            "A Fleet Signal Specialist & An Underground Engineer",
            "A City Guardian Commander & A Curious Hacker",
            "A Veteran Navigator Guide & A Defiant Challenger",
        ]
    if any(k in t for k in ["space", "orbital", "station", "observatory", "neptune", "lunar"]):
        return [
            "An Orbital Flight Engineer & A Deep-Space Astrophotographer",
            "A Station Commander & A Station AI Specialist",
            "A Solar Array Technician & A Rogue Cosmologist",
            "A Veteran Navigator Guide & A Defiant Explorer",
        ]
    if any(k in t for k in ["cyber", "neon", "tokyo", "city", "syndicate"]):
        return [
            "A Cyber-Grid Courier & An Underground Netrunner",
            "A City Archivist & A Corporate Enforcer",
            "A Hologram Technician & A Streetwise Fixer",
            "A Veteran Navigator Guide & A Defiant Hacker",
        ]
    if any(k in t for k in ["everest", "mountain", "glacier"]):
        return [
            "A Veteran Sherpa Pathfinder & An Alpine Geologist",
            "A High-Altitude Meteorologist & A Rival Mountaineer",
            "A Monastery Archivist & A Mountain Rescue Scout",
            "A Loyal Expedition Guide & An Ambitious Summit Seeker",
        ]
    if any(k in t for k in ["rome", "colosseum", "forum"]):
        return [
            "An Imperial Tribune Guide & A Senatorial Scribe",
            "A Master Aqueduct Architect & A Vestal Lorekeeper",
            "A Gladiator Champion & A Secret Courier",
            "A Loyal Pathfinder Guide & A Suspicious Rival Archivist",
        ]
    return [
        "A Loyal Pathfinder Guide & A Suspicious Rival Archivist",
        "An Ancient Sentinel Guardian & An Underground Scout",
        "An Enigmatic Faction Keeper & A Rogue Infiltrator",
        "A Master Architect Guide & A Defiant Explorer",
    ]


# Persistent HTTP client connection pools with keep-alive for fast Nemotron inference (<1.0s turnaround)
_sync_http_client: Optional[httpx.Client] = None
_async_http_client: Optional[httpx.AsyncClient] = None


def get_sync_http_client() -> httpx.Client:
    global _sync_http_client
    if _sync_http_client is None or _sync_http_client.is_closed:
        _sync_http_client = httpx.Client(
            timeout=httpx.Timeout(connect=2.0, read=NEMOTRON_TIMEOUT_SECONDS, write=2.0, pool=3.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=40),
        )
    return _sync_http_client


def get_async_http_client() -> httpx.AsyncClient:
    global _async_http_client
    if _async_http_client is None or _async_http_client.is_closed:
        _async_http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=2.0, read=NEMOTRON_TIMEOUT_SECONDS, write=2.0, pool=3.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=40),
        )
    return _async_http_client


# ---------------------------------------------------------------------------
# Tier 1: NVIDIA NIM Nemotron 70B Calling Framework
# ---------------------------------------------------------------------------
async def call_nemotron_narrative(
    system_prompt: str,
    user_prompt: str,
    timeout: float = NEMOTRON_TIMEOUT_SECONDS,
    max_tokens: int = 350,
) -> Dict[str, Any]:
    # 1. Primary engine: Real NVIDIA Nemotron running locally on GPU
    try:
        from backend.app.services.local_nemotron import generate_local_nemotron
        local_res = generate_local_nemotron(system_prompt, user_prompt, max_tokens=max_tokens)
        if local_res:
            return local_res
    except Exception as local_err:
        logger.info(f"Local Nemotron attempt bypassed: {local_err}")

    api_key = os.getenv("NVIDIA_API_KEY", "").strip()
    if not api_key:
        raise ValueError("missing_nvidia_api_key")

    payload = {
        "model": NEMOTRON_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.45,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    client = get_async_http_client()
    try:
        resp = await client.post(NVIDIA_NIM_ENDPOINT, json=payload, headers=headers)
    except Exception as e:
        logger.warning(f"Nemotron async post failed fast: {e}")
        raise e

    if resp.status_code == 429:
        raise RuntimeError("nemotron_rate_limited_429")
    if resp.status_code != 200:
        raise RuntimeError(f"nemotron_http_{resp.status_code}: {resp.text[:120]}")

    raw = resp.json()
    content = raw["choices"][0]["message"]["content"]
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()
    return json.loads(content)


# ---------------------------------------------------------------------------
# Tier 2: Google Gemini 3.8 Flash Fallback Framework
# ---------------------------------------------------------------------------
async def call_gemini_narrative(
    system_prompt: str,
    user_prompt: str,
    timeout: float = GEMINI_TIMEOUT_SECONDS,
) -> Dict[str, Any]:
    api_key = get_active_api_key()
    if not api_key:
        raise ValueError("missing_gemini_api_key")

    client = genai.Client(api_key=api_key)
    prompt_full = f"{system_prompt}\n\nUSER REQUEST:\n{user_prompt}"

    loop = asyncio.get_running_loop()
    response = await asyncio.wait_for(
        loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt_full,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.45,
                ),
            ),
        ),
        timeout=timeout,
    )

    text = response.text or "{}"
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    return json.loads(text)


# In-memory knowledge graph cache per world_id
_cached_knowledge_graphs: Dict[str, StoryKnowledgeGraph] = {}


class SyncOrAsyncNarrativeChatTurnResponse(NarrativeChatTurnResponse):
    """
    Dual sync-and-async response model.
    Can be awaited directly (e.g. `await process_narrative_director_turn(req)` in FastAPI)
    or used synchronously (e.g. `res = process_narrative_director_turn(req)` in pytest).
    """

    def __await__(self):
        async def _identity():
            return self

        return _identity().__await__()


def call_nemotron_narrative_sync(
    system_prompt: str,
    user_prompt: str,
    timeout: float = NEMOTRON_TIMEOUT_SECONDS,
    max_tokens: int = 350,
) -> Dict[str, Any]:
    # 1. Primary engine: Real NVIDIA Nemotron running locally on GPU
    try:
        from backend.app.services.local_nemotron import generate_local_nemotron
        local_res = generate_local_nemotron(system_prompt, user_prompt, max_tokens=max_tokens)
        if local_res:
            return local_res
    except Exception as local_err:
        logger.info(f"Local Nemotron attempt bypassed: {local_err}")

    api_key = os.getenv("NVIDIA_API_KEY", "").strip()
    if not api_key:
        raise ValueError("missing_nvidia_api_key")

    payload = {
        "model": NEMOTRON_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.45,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    client = get_sync_http_client()
    try:
        resp = client.post(NVIDIA_NIM_ENDPOINT, json=payload, headers=headers, timeout=timeout)
    except Exception as e:
        logger.warning(f"Nemotron sync post failed fast: {e}")
        raise e

    if resp.status_code == 429:
        raise RuntimeError("nemotron_rate_limited_429")
    if resp.status_code != 200:
        raise RuntimeError(f"nemotron_http_{resp.status_code}: {resp.text[:120]}")

    raw = resp.json()
    content = raw["choices"][0]["message"]["content"]
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()
    return json.loads(content)


def run_with_timeout(fn, kwargs: dict, timeout: float):
    res = [None]
    err = [None]

    def target():
        try:
            res[0] = fn(**kwargs)
        except Exception as e:
            err[0] = e

    t = threading.Thread(target=target, daemon=True)
    t.start()
    t.join(timeout=timeout)
    if t.is_alive():
        raise TimeoutError(f"Operation timed out after {timeout}s")
    if err[0]:
        raise err[0]
    return res[0]


def call_gemini_narrative_sync(
    system_prompt: str,
    user_prompt: str,
    timeout: float = GEMINI_TIMEOUT_SECONDS,
) -> Dict[str, Any]:
    api_key = get_active_api_key()
    if not api_key:
        raise ValueError("missing_gemini_api_key")

    client = genai.Client(api_key=api_key)
    prompt_full = f"{system_prompt}\n\nUSER REQUEST:\n{user_prompt}"

    response = run_with_timeout(
        client.models.generate_content,
        {
            "model": "gemini-3.8-flash",
            "contents": prompt_full,
            "config": types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.45,
            ),
        },
        timeout=timeout,
    )

    text = response.text or "{}"
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    return json.loads(text)


def get_cached_or_default_knowledge_graph(world_id: str) -> StoryKnowledgeGraph:
    """Retrieves cached StoryKnowledgeGraph or generates a safe 10-13 default graph."""
    if world_id in _cached_knowledge_graphs:
        return _cached_knowledge_graphs[world_id]
    graph = build_offline_knowledge_graph(
        world_id=world_id,
        world_title="Ancient Clockwork Citadel",
        current_room_id="room_001",
        premise="Unravel the secret puzzle mechanism and ancient ciphers",
        sub_envs="Astrolabe Gallery & Corbelled Vaults",
        factions="Pathfinder Tariq and Silas the Challenger",
    )
    _cached_knowledge_graphs[world_id] = graph
    return graph


def compile_story_knowledge_graph(
    world_id: str,
    world_title: str,
    current_room_id: str,
    premise: str = "Ancient puzzle mystery",
    sub_envs: str = "Terraces and Vaults",
    factions: str = "Tariq and Silas",
) -> StoryKnowledgeGraph:
    """Synthesizes and caches an active StoryKnowledgeGraph."""
    graph = build_offline_knowledge_graph(
        world_id=world_id,
        world_title=world_title,
        current_room_id=current_room_id,
        premise=premise,
        sub_envs=sub_envs,
        factions=factions,
    )
    _cached_knowledge_graphs[world_id] = graph
    return graph


# ---------------------------------------------------------------------------
# Tier 3: Deterministic Offline Narrative Catalog Fallback (Ages 10-13 Wonder & Puzzles)
# ---------------------------------------------------------------------------
def build_offline_knowledge_graph(
    world_id: str,
    world_title: str,
    current_room_id: str,
    premise: str,
    sub_envs: str,
    factions: str,
    category: Optional[str] = None,
) -> StoryKnowledgeGraph:
    clean_title = world_title.split("—")[0].strip()
    adapted = adapt_vague_prompt_to_non_spoiling_story(premise or "ancient puzzle", world_title)
    story_title = adapted["story_title"]
    synopsis = (
        f"A heroic middle-grade expedition into {clean_title}. "
        f"Quest: Solve the ancient ciphers, decode the planetary alignment mechanism, and protect the forgotten archive. "
        f"Premise: {adapted['atmospheric_teaser']}"
    )

    biome_category = category or infer_suggested_biome(f"{world_title} {premise} {sub_envs}")

    if biome_category == "space_station":
        locations = [
            KnowledgeLocationNode(
                location_id=f"loc_{current_room_id}",
                name=f"{clean_title} — Zenith Biosphere Atrium",
                room_id=current_room_id,
                biome_type="space_station",
                story_role="Starting Space Deck & Airlock Gateway",
                atmosphere_desc="Panoramic orbital observation dome overlooking the glowing planetary curvature.",
                world_x=0.0,
                world_z=0.0,
            ),
            KnowledgeLocationNode(
                location_id="loc_sub_sector_01",
                name=f"{clean_title} — Zero-G Maintenance Conduit",
                room_id="room_sub_01",
                biome_type="space_station",
                story_role="Relay Switchboard Chamber with magnetic alignment locks",
                atmosphere_desc="Zero-gravity maintenance conduit with floating telemetry relays and glowing fiber optics.",
                world_x=0.0,
                world_z=-220.0,
            ),
            KnowledgeLocationNode(
                location_id="loc_sub_sector_02",
                name=f"{clean_title} — Planetary Observation Crest",
                room_id="room_sub_02",
                biome_type="space_station",
                story_role="Primary Telescope Vista where deep-space telemetry resonates",
                atmosphere_desc="Starlit orbital platform overlooking distant solar flares and celestial rings.",
                world_x=220.0,
                world_z=0.0,
            ),
        ]
        guide_name = "Flight Navigator Alex"
        guide_personality = "Energetic, sharp-eyed astrogation pilot with a knack for decoding stellar beacons."
        guide_appearance = "Pressurized flight suit with heads-up holo-visor and orbital beacon."
        guide_dialogue = [
            f"Welcome aboard, explorer! The orbital telemetry of {clean_title} is ready.",
            "Look at these navigation coordinates—they match our flight vector! Stay close.",
            "The airlock corridor just pressurized. Let's inspect the zero-g maintenance conduit!",
        ]
        guide_secret = "Knows how to synchronize the station telemetry frequency to bypass sealed blast doors."
        guide_faction = "Orbital Cartographers"

        rival_name = "Commander Vane"
        rival_personality = "Competitive deep-space rival who races to log discoveries first."
        rival_appearance = "Deep-space tactical flight rig holding an orbital spectrum scanner."
        rival_dialogue = [
            "Race you to the observation crest, explorer! I've already locked onto the primary frequency.",
            "Impressive astrogation work... but whoever initiates the main telescope array claims the breakthrough!",
        ]
        rival_secret = "Possesses the optical prism key needed to calibrate the solar array."
        rival_faction = "Zenith Star Fleet"

    elif biome_category == "medieval_tavern":
        locations = [
            KnowledgeLocationNode(
                location_id=f"loc_{current_room_id}",
                name=f"{clean_title} — Imperial Rostra Vestibule",
                room_id=current_room_id,
                biome_type="medieval_tavern",
                story_role="Starting Colonnade & Forum Archway",
                atmosphere_desc="Sunlit marble terrace surrounded by travertine columns and inscribed plinths.",
                world_x=0.0,
                world_z=0.0,
            ),
            KnowledgeLocationNode(
                location_id="loc_sub_sector_01",
                name=f"{clean_title} — Subterranean Aqueduct Catacombs",
                room_id="room_sub_01",
                biome_type="medieval_tavern",
                story_role="Ancient Water Mechanism Vault with stone floodgates",
                atmosphere_desc="Cooled vaulted stone tunnels with rushing crystal waters and bronze flow dials.",
                world_x=0.0,
                world_z=-220.0,
            ),
            KnowledgeLocationNode(
                location_id="loc_sub_sector_02",
                name=f"{clean_title} — Pantheon Oculus Rotunda",
                room_id="room_sub_02",
                biome_type="medieval_tavern",
                story_role="Sunlight Sanctuary where the celestial beam illuminates the seal",
                atmosphere_desc="Magnificent coffered domed rotunda with a central beam of sunlight striking the floor.",
                world_x=220.0,
                world_z=0.0,
            ),
        ]
        guide_name = "Tribune Cassius"
        guide_personality = "Resourceful young legionary scholar with a passion for architectural mechanisms."
        guide_appearance = "Roman travel cloak with bronze compass armlet and parchment scroll map."
        guide_dialogue = [
            f"Greetings, explorer! The secrets of {clean_title} await our inspection.",
            "Examine this marble inscription—it lines up with the aqueduct drainage cipher! Follow me.",
            "The bronze floodgate lever just clicked into place. Forward into the catacombs!",
        ]
        guide_secret = "Understands the water wheel counterweight system that opens the inner sanctum."
        guide_faction = "The Forum Antiquarians"

        rival_name = "Senator Valerius"
        rival_personality = "Ambitious young noble who aims to solve the forum trial before the Senate reconvenes."
        rival_appearance = "Purple-trimmed toga holding an ancient bronze standard cipher."
        rival_dialogue = [
            "You are swift, explorer, but my scribes have already deciphered the first two tablets!",
            "Whoever unlocks the Oculus alignment first earns the civic wreath!",
        ]
        rival_secret = "Holds the missing bronze keystone to complete the archway vault."
        rival_faction = "The Curia Society"

    elif biome_category == "cyberpunk_alley":
        locations = [
            KnowledgeLocationNode(
                location_id=f"loc_{current_room_id}",
                name=f"{clean_title} — Neon Gully Vestibule",
                room_id=current_room_id,
                biome_type="cyberpunk_alley",
                story_role="Starting Urban Plaza & Signal Node",
                atmosphere_desc="Holographic neon promenade with humming fiber lines and elevated skyway bridges.",
                world_x=0.0,
                world_z=0.0,
            ),
            KnowledgeLocationNode(
                location_id="loc_sub_sector_01",
                name=f"{clean_title} — Subterranean Vault Grid",
                room_id="room_sub_01",
                biome_type="cyberpunk_alley",
                story_role="Subway Data Junction with interlocking relay servers",
                atmosphere_desc="Underground transit vault with steaming grates and pulsing server racks.",
                world_x=0.0,
                world_z=-220.0,
            ),
            KnowledgeLocationNode(
                location_id="loc_sub_sector_02",
                name=f"{clean_title} — Rooftop Skybridge Crest",
                room_id="room_sub_02",
                biome_type="cyberpunk_alley",
                story_role="High Skyline Vista where the master antenna beacon transmits",
                atmosphere_desc="Rain-slick glass skybridge overlooking towering illuminated skyscrapers.",
                world_x=220.0,
                world_z=0.0,
            ),
        ]
        guide_name = "Pathfinder Maya"
        guide_personality = "Fast-thinking city runner who knows every hidden skybridge and secret subway tunnel."
        guide_appearance = "Cybernetic courier jacket with holographic navigation goggles."
        guide_dialogue = [
            f"Hey explorer! Welcome to the {clean_title} network. Watch your step on the neon grates!",
            "My scanner picked up a strange encrypted pulse from the subway vault. Stay right behind me.",
            "The security bypass code cleared. Let's breach the underground data grid!",
        ]
        guide_secret = "Knows how to reroute the subway power lines to activate the skybridge elevator."
        guide_faction = "Grid Runners"

        rival_name = "Cipher Infiltrator Zane"
        rival_personality = "Clever electronic rival who treats deciphering networks like an extreme sport."
        rival_appearance = "Sleek matte-black hoodie with glowing neon cable accents."
        rival_dialogue = [
            "Good hustle, Maya and friend! But I've already pinged the rooftop relay.",
            "Race you to the skybridge crest—first one to decode the antenna signal takes the prize!",
        ]
        rival_secret = "Has the master decryption key to unlock the rooftop transmitter."
        rival_faction = "Neon Syndicate"

    else:
        # Default ancient puzzle / desert oasis / historical
        locations = [
            KnowledgeLocationNode(
                location_id=f"loc_{current_room_id}",
                name=f"{clean_title} — Sunlit Vestibule",
                room_id=current_room_id,
                biome_type="desert_oasis",
                story_role="Starting Sanctuary & Cipher Gateway",
                atmosphere_desc="Golden sunlit colonnade with rotating astrolabe pedestals.",
                world_x=0.0,
                world_z=0.0,
            ),
            KnowledgeLocationNode(
                location_id="loc_sub_sector_01",
                name=f"{clean_title} — Mechanism Grotto",
                room_id="room_sub_01",
                biome_type="desert_oasis",
                story_role="Ancient Puzzle Chamber with interlocking stone gear rings",
                atmosphere_desc="Cooled limestone chamber with water canals and mirror reflectors.",
                world_x=0.0,
                world_z=-220.0,
            ),
            KnowledgeLocationNode(
                location_id="loc_sub_sector_02",
                name=f"{clean_title} — Sky Observatory Crest",
                room_id="room_sub_02",
                biome_type="desert_oasis",
                story_role="Starlit Vista where the final puzzle dial aligns",
                atmosphere_desc="Elevated marble platform with panoramic view of the horizon.",
                world_x=220.0,
                world_z=0.0,
            ),
        ]
        guide_name = "Pathfinder Tariq"
        guide_personality = "Enthusiastic, encouraging, loves ancient puzzles, quick-witted."
        guide_appearance = "Adventurer jacket and navigation astrolabe with brass compass."
        guide_dialogue = [
            f"Hey explorer! Welcome to {clean_title}. The adventure is just beginning!",
            "Look at these floor markings—they match the cipher on my astrolabe! Stay close.",
            "The northern archway just unlocked. Come on, let's see what's in the Mechanism Grotto!",
        ]
        guide_secret = "Knows how to align the mirror puzzle to bounce light onto the sealed door."
        guide_faction = "The Young Explorers Society"

        rival_name = "Silas the Challenger"
        rival_personality = "Competitive, clever, wants to solve the mystery first, but plays fair."
        rival_appearance = "Sharp travel coat holding an encoded parchment decoder."
        rival_dialogue = [
            "Race you to the final dial, explorer! I've already solved the first two ciphers.",
            "Not bad, Tariq and friends... but whoever activates the sun alignment first wins the title!",
        ]
        rival_secret = "Has discovered the missing lens needed for the telescope."
        rival_faction = "The Frontier Decathlon"

    guide_agent = KnowledgeAgentNode(
        agent_id=f"agent_guide_{world_id[:8]}",
        name=guide_name,
        role="Guide",
        personality=guide_personality,
        appearance_style=guide_appearance,
        current_location_id=f"loc_{current_room_id}",
        movement_mode="escorting_player",
        target_gateway_bearing=-1.57,
        narrative_dialogue_arc=guide_dialogue,
        secret_knowledge=guide_secret,
        faction=guide_faction,
        patrol_waypoints=[{"r": 500, "theta": 0.2, "phi": 1.65}, {"r": 500, "theta": -0.2, "phi": 1.65}],
        active_thought="[PLANNING] Show the player the hidden symbol etched into the archway.",
    )

    rival_agent = KnowledgeAgentNode(
        agent_id=f"agent_rival_{world_id[:8]}",
        name=rival_name,
        role="Rival",
        personality=rival_personality,
        appearance_style=rival_appearance,
        current_location_id="loc_sub_sector_02",
        movement_mode="patrolling",
        narrative_dialogue_arc=rival_dialogue,
        secret_knowledge=rival_secret,
        faction=rival_faction,
        patrol_waypoints=[{"r": 500, "theta": 0.5, "phi": 1.65}],
        active_thought="[REFLECTION] This new explorer is faster at deciphering clues than I expected.",
    )

    relationships = [
        KnowledgeRelationshipEdge(
            source_agent_id=guide_agent.agent_id,
            target_agent_id=rival_agent.agent_id,
            relation_type="rival_of",
            interaction_lore=f"Friendly academic rivalry between {guide_name} and {rival_name} over who can solve the realm trial first.",
        ),
        KnowledgeRelationshipEdge(
            source_agent_id=guide_agent.agent_id,
            target_agent_id="player",
            relation_type="guides_player_to",
            interaction_lore=f"{guide_name} has teamed up with the player to unlock the secrets together.",
        ),
    ]

    beats = [
        KnowledgeStoryBeatNode(
            beat_id="beat_01_cipher",
            title="Act I: The Mystery at the Threshold",
            stage="act_1_exposition",
            narrative_cue=f"Look at the archway, traveler! An ancient symbol just lit up. Follow me!",
            target_location_id=f"loc_{current_room_id}",
            required_agent_id=guide_agent.agent_id,
            is_unlocked=True,
        ),
        KnowledgeStoryBeatNode(
            beat_id="beat_02_gears",
            title="Act II: The Mechanism of Light",
            stage="act_2_exploration",
            narrative_cue="The gear rings are turning! Align your position so the mechanism triggers.",
            target_location_id="loc_sub_sector_01",
            required_agent_id=guide_agent.agent_id,
            is_unlocked=False,
        ),
        KnowledgeStoryBeatNode(
            beat_id="beat_03_triumph",
            title="Act III: The Alignment Triumph",
            stage="act_3_revelation",
            narrative_cue=f"We did it! {rival_name}, check this out—the entire sector is illuminated!",
            target_location_id="loc_sub_sector_02",
            required_agent_id=rival_agent.agent_id,
            is_unlocked=False,
        ),
    ]

    return StoryKnowledgeGraph(
        story_title=story_title,
        synopsis=synopsis,
        interview_stage="compiled_active",
        locations=locations,
        agents=[guide_agent, rival_agent],
        relationships=relationships,
        story_beats=beats,
        current_beat_id="beat_01_cipher",
    )


# ---------------------------------------------------------------------------
# Main Narrative Director Turn Orchestration
# ---------------------------------------------------------------------------
def process_narrative_director_turn(
    request: NarrativeChatTurnRequest,
) -> SyncOrAsyncNarrativeChatTurnResponse:
    t0 = time.perf_counter()
    world_title = request.world_title or "Continuous Latent Expanse"
    world_id = request.world_id or "world_active"
    current_room_id = request.current_room_id or "room_origin"
    player_msg = (request.player_message or "").strip()
    stage = request.stage or "ask_core_story"
    existing_graph = request.existing_graph

    inferred_biome = infer_suggested_biome(f"{world_title} {player_msg}")
    compilation_prompt = player_msg or world_title

    # -----------------------------------------------------------------------
    # STAGE 1: Opening greeting / Initial core story inquiry
    # -----------------------------------------------------------------------
    if (stage in ["ask_core_story", "premise"]) and not player_msg:
        chips = get_biome_story_chips(world_title)
        latency = (time.perf_counter() - t0) * 1000.0
        return SyncOrAsyncNarrativeChatTurnResponse(
            director_utterance=(
                f"Welcome, explorer. I am Mira. "
                "What grand adventure, secret discovery, or mystery shall we uncover?"
            ),
            next_stage="sub_environments",
            follow_up_question="Choose a story premise below or describe your own vision:",
            suggested_chips=chips,
            premise_suggestions=chips,
            updated_graph=existing_graph,
            spawned_subagents=[],
            guide_agent=None,
            suggested_biome=inferred_biome,
            compilation_prompt=compilation_prompt,
            telemetry=TelemetryMetadata(
                provider="nemotron_70b",
                latency_ms=latency,
                fallback_occurred=False,
            ),
        )

    # -----------------------------------------------------------------------
    # STAGE 2: Player answered core story/premise -> Now ask about sub-environments
    # -----------------------------------------------------------------------
    if (stage in ["ask_core_story", "premise"]) and player_msg:
        adapted = adapt_vague_prompt_to_non_spoiling_story(player_msg, world_title=world_title)

        sys_prompt = (
            f"{MIDDLE_GRADE_GUARDRAIL}\n\n"
            "You are Mira, World Architect and companion powered by Nemotron 70B. "
            "The player has chosen a story premise (which may be intentionally vague). "
            "Acknowledge their choice with wonder and anticipation (1-2 sentences), preserving full mystery without spoiling twists. "
            "Then ask specifically what distinct sub-environments or hidden puzzle sectors they wish to explore next. "
            "Return JSON with keys: 'utterance' (string), 'follow_up' (string), 'suggested_chips' (list of 3 strings)."
        )
        usr_prompt = f"World: {world_title}\nChosen Story Premise: {player_msg}\nLoRA Clue: {adapted['atmospheric_teaser']}"

        provider_used = "nemotron_70b"
        fallback = False
        reason = None
        data = None

        if request.simulate_provider == "nemotron_70b" or not request.simulate_provider:
            try:
                data = call_nemotron_narrative_sync(sys_prompt, usr_prompt)
                if data:
                    provider_used = "nemotron_70b"
                    fallback = False
            except Exception as e:
                logger.warning(f"[NEMOTRON FALLBACK] {e}")
                fallback = True
                reason = str(e)

        if not data and (request.simulate_provider == "gemini_flash" or fallback):
            try:
                data = call_gemini_narrative_sync(sys_prompt, usr_prompt)
                provider_used = "gemini_flash"
            except Exception as e:
                logger.warning(f"[GEMINI FALLBACK] {e}")
                fallback = True
                reason = str(e)

        if not data:
            provider_used = "offline_mock"
            clean_title = world_title.split("—")[0].strip()
            data = {
                "utterance": f"I am Mira. An urgent mission begins in {clean_title}: {adapted['atmospheric_teaser']}",
                "follow_up": adapted["follow_up_question"] or "What distinct sub-environments or hidden puzzle sectors shall we breach first?",
                "suggested_chips": get_sub_environment_chips(world_title, player_msg),
            }

        graph = existing_graph or StoryKnowledgeGraph(
            story_title=adapted["story_title"],
            synopsis=player_msg,
            interview_stage="sub_environments",
        )
        graph.story_title = adapted["story_title"]
        graph.synopsis = player_msg
        graph.interview_stage = "sub_environments"
        _cached_knowledge_graphs[world_id] = graph

        latency = (time.perf_counter() - t0) * 1000.0
        return SyncOrAsyncNarrativeChatTurnResponse(
            director_utterance=data.get("utterance", adapted["atmospheric_teaser"]),
            next_stage="sub_environments",
            follow_up_question=data.get("follow_up") or adapted["follow_up_question"],
            suggested_chips=data.get("suggested_chips") or get_sub_environment_chips(world_title, player_msg),
            premise_suggestions=adapted.get("premise_suggestions", []),
            updated_graph=graph,
            spawned_subagents=[],
            guide_agent=None,
            suggested_biome=inferred_biome,
            compilation_prompt=compilation_prompt,
            telemetry=TelemetryMetadata(
                provider=provider_used,
                latency_ms=latency,
                fallback_occurred=fallback,
                fallback_reason=reason,
            ),
        )

    # -----------------------------------------------------------------------
    # STAGE 3: Player answered sub-environments -> Now ask about key agents
    # -----------------------------------------------------------------------
    if stage in ["ask_sub_environments", "sub_environments"] and player_msg:
        sys_prompt = (
            f"{MIDDLE_GRADE_GUARDRAIL}\n\n"
            "You are Mira, World Architect and companion powered by Nemotron 70B. The player has chosen the sub-environments to explore. "
            "Acknowledge the chosen chambers with age 10-13 wonder and excitement (1-2 sentences), "
            "then ask specifically who should walk these corridors: "
            "what key figures—such as a guide to show them around, a rival faction member, or a keeper guarding a secret puzzle—they want to encounter. "
            "Return JSON with keys: 'utterance' (string), 'follow_up' (string), 'suggested_chips' (list of 3 strings)."
        )
        usr_prompt = f"World: {world_title}\nChosen Sub-Environments: {player_msg}"

        provider_used = "nemotron_70b"
        fallback = False
        reason = None
        data = None

        if request.simulate_provider == "nemotron_70b" or not request.simulate_provider:
            try:
                data = call_nemotron_narrative_sync(sys_prompt, usr_prompt)
                if data:
                    provider_used = "nemotron_70b"
                    fallback = False
            except Exception as e:
                fallback = True
                reason = str(e)

        if not data and (request.simulate_provider == "gemini_flash" or fallback):
            try:
                data = call_gemini_narrative_sync(sys_prompt, usr_prompt)
                provider_used = "gemini_flash"
            except Exception as e:
                fallback = True
                reason = str(e)

        if not data:
            provider_used = "offline_mock"
            data = {
                "utterance": f"The spatial layout of {world_title} will integrate {player_msg}. These chambers will form the backbone of the realm.",
                "follow_up": "Now, who shall walk these corridors? What guides, rivals, or guardians should inhabit these halls?",
                "suggested_chips": get_agent_factions_chips(world_title, player_msg),
            }

        graph = existing_graph or StoryKnowledgeGraph(
            story_title=f"The Expedition of {world_title}",
            synopsis=player_msg,
            interview_stage="key_figures",
        )
        graph.interview_stage = "key_figures"
        _cached_knowledge_graphs[world_id] = graph

        latency = (time.perf_counter() - t0) * 1000.0
        return SyncOrAsyncNarrativeChatTurnResponse(
            director_utterance=data.get("utterance", f"We shall integrate {player_msg}."),
            next_stage="key_figures",
            follow_up_question=data.get("follow_up") or "Who are the key figures, guides, or rivals?",
            suggested_chips=data.get("suggested_chips") or get_agent_factions_chips(world_title, player_msg),
            updated_graph=graph,
            spawned_subagents=[],
            guide_agent=None,
            suggested_biome=inferred_biome,
            compilation_prompt=compilation_prompt,
            telemetry=TelemetryMetadata(
                provider=provider_used,
                latency_ms=latency,
                fallback_occurred=fallback,
                fallback_reason=reason,
            ),
        )

    # -----------------------------------------------------------------------
    # STAGE 4: Player answered key agents -> Synthesize Full Knowledge Graph
    # -----------------------------------------------------------------------
    if stage in ["ask_key_agents", "key_figures"] or (stage == "compiled_active" and not existing_graph):
        premise = existing_graph.synopsis if existing_graph else "Unravel the ancient mystery"
        agents_input = player_msg or "Pathfinder Guide and Rival Archivist"

        sys_prompt = (
            f"{MIDDLE_GRADE_GUARDRAIL}\n\n"
            "You are Mira, World Architect and companion powered by Nemotron 70B. Synthesize a complete Story Knowledge Graph appropriate for ages 10-13. "
            "The story MUST prioritize clever ancient puzzles, lost relics, secret mechanisms, and thrilling discovery. "
            "DO NOT spoil the climax upfront: future beats must have intriguing teasers while keeping the final discovery a hidden reward. "
            "Output strictly valid JSON with keys: "
            "'story_title' (string), 'synopsis' (string), "
            "'locations' (list of 3 objects with keys location_id, name, room_id, biome_type, story_role, atmosphere_desc, world_x, world_z), "
            "'agents' (list of 2-3 objects with keys agent_id, name, role, personality, appearance_style, current_location_id, movement_mode, narrative_dialogue_arc [list of 3 strings], secret_knowledge, faction), "
            "'relationships' (list of 2 objects with keys source_agent_id, target_agent_id, relation_type, interaction_lore), "
            "'story_beats' (list of 3 objects with keys beat_id, title, stage, narrative_cue, target_location_id, required_agent_id, is_unlocked), "
            "'guide_speech' (string: the spoken greeting by the physical guide welcoming player)."
        )
        usr_prompt = (
            f"World: {world_title}\n"
            f"Current Room: {current_room_id}\n"
            f"Premise: {premise}\n"
            f"Key Agents & Roles: {agents_input}"
        )

        provider_used = "nemotron_70b"
        fallback = False
        reason = None
        kg_data = None

        if request.simulate_provider == "nemotron_70b" or not request.simulate_provider:
            try:
                kg_data = call_nemotron_narrative_sync(sys_prompt, usr_prompt, max_tokens=450)
                if kg_data:
                    provider_used = "nemotron_70b"
                    fallback = False
            except Exception as e:
                fallback = True
                reason = str(e)

        if not kg_data and (request.simulate_provider == "gemini_flash" or fallback):
            try:
                kg_data = call_gemini_narrative_sync(sys_prompt, usr_prompt)
                provider_used = "gemini_flash"
            except Exception as e:
                fallback = True
                reason = str(e)

        if not kg_data:
            provider_used = "offline_mock"
            graph = build_offline_knowledge_graph(
                world_id=world_id,
                world_title=world_title,
                current_room_id=current_room_id,
                premise=premise,
                sub_envs="Terraces & Subterranean Vaults",
                factions=agents_input,
                category=inferred_biome,
            )
            guide = graph.agents[0]
            guide_speech = guide.narrative_dialogue_arc[0] if guide.narrative_dialogue_arc else "Welcome, explorer."
        else:
            try:
                # Parse structured JSON into Pydantic models
                locs = [KnowledgeLocationNode(**loc) for loc in kg_data.get("locations", [])]
                agents = [KnowledgeAgentNode(**ag) for ag in kg_data.get("agents", [])]
                rels = [KnowledgeRelationshipEdge(**rel) for rel in kg_data.get("relationships", [])]
                beats = [KnowledgeStoryBeatNode(**b) for b in kg_data.get("story_beats", [])]

                # Ensure at least one agent is designated Guide situated at active room
                guide = next((a for a in agents if a.role.lower() == "guide"), None)
                if not guide and agents:
                    guide = agents[0]
                    guide.role = "Guide"
                if guide:
                    guide.current_location_id = locs[0].location_id if locs else f"loc_{current_room_id}"
                    guide.movement_mode = "escorting_player"

                graph = StoryKnowledgeGraph(
                    story_title=kg_data.get("story_title", f"The Chronicle of {world_title}"),
                    synopsis=kg_data.get("synopsis", premise),
                    interview_stage="compiled_active",
                    locations=locs,
                    agents=agents,
                    relationships=rels,
                    story_beats=beats,
                    current_beat_id=beats[0].beat_id if beats else None,
                )
                guide_speech = kg_data.get("guide_speech") or (
                    guide.narrative_dialogue_arc[0] if guide and guide.narrative_dialogue_arc else "Welcome, traveler."
                )
            except Exception as e:
                logger.warning(f"Pydantic graph parsing failed ({e}), falling back to offline graph")
                graph = build_offline_knowledge_graph(
                    world_id=world_id,
                    world_title=world_title,
                    current_room_id=current_room_id,
                    premise=premise,
                    sub_envs="Chambers & Passages",
                    factions=agents_input,
                    category=inferred_biome,
                )
                guide = graph.agents[0]
                guide_speech = guide.narrative_dialogue_arc[0]

        _cached_knowledge_graphs[world_id] = graph
        latency = (time.perf_counter() - t0) * 1000.0
        utterance = (
            f"The Knowledge Graph has been compiled into the realm. "
            f"Your story '{graph.story_title}' is now active. "
            f"{guide.name} has materialized in the chamber to guide you through the sectors."
        )

        return SyncOrAsyncNarrativeChatTurnResponse(
            director_utterance=utterance,
            next_stage="compiled_active",
            follow_up_question=None,
            suggested_chips=[
                "Where should we explore next?",
                "Tell me about the rival faction.",
                "Introduce an unexpected plot twist.",
            ],
            updated_graph=graph,
            spawned_subagents=graph.agents,
            guide_agent=guide,
            suggested_biome=inferred_biome,
            compilation_prompt=compilation_prompt,
            telemetry=TelemetryMetadata(
                provider=provider_used,
                latency_ms=latency,
                fallback_occurred=fallback,
                fallback_reason=reason,
            ),
        )

    # -----------------------------------------------------------------------
    # STAGE 5: Story active -> Dynamic GM guidance / plot commands
    # -----------------------------------------------------------------------
    sys_prompt = (
        f"{MIDDLE_GRADE_GUARDRAIL}\n\n"
        "You are Mira, World Architect and companion powered by Nemotron 70B over an active RPG Knowledge Graph. "
        "The player is chatting with God Mode or directing their story. "
        "Respond in character as Mira, referencing the story beats and agents with thrilling adventure flair. "
        "Output JSON with keys: 'utterance' (string), 'suggested_chips' (list of 3 strings)."
    )
    usr_prompt = f"World: {world_title}\nStory: {existing_graph.story_title if existing_graph else ''}\nPlayer: {player_msg}"

    data = None
    provider_used = "nemotron_70b"
    fallback = False
    reason = None

    if request.simulate_provider == "nemotron_70b" or not request.simulate_provider:
        try:
            data = call_nemotron_narrative_sync(sys_prompt, usr_prompt)
        except Exception as e:
            fallback = True
            reason = str(e)

    if not data and (request.simulate_provider == "gemini_flash" or fallback):
        try:
            data = call_gemini_narrative_sync(sys_prompt, usr_prompt)
            provider_used = "gemini_flash"
        except Exception as e:
            fallback = True
            reason = str(e)

    if not data:
        provider_used = "offline_mock"
        data = {
            "utterance": "Understood, Architect. The subagents have been alerted. Your guide stands ready to advance the chronicle.",
            "suggested_chips": ["Advance to next sector", "Speak with the rival", "Examine the secret ledger"],
        }

    latency = (time.perf_counter() - t0) * 1000.0
    return SyncOrAsyncNarrativeChatTurnResponse(
        director_utterance=data.get("utterance", "The realm shifts according to your decree."),
        next_stage="compiled_active",
        follow_up_question=None,
        suggested_chips=data.get("suggested_chips", []),
        updated_graph=existing_graph,
        spawned_subagents=[],
        guide_agent=None,
        suggested_biome=inferred_biome,
        compilation_prompt=compilation_prompt,
        telemetry=TelemetryMetadata(
            provider=provider_used,
            latency_ms=latency,
            fallback_occurred=fallback,
            fallback_reason=reason,
        ),
    )
