# gemini generator service with tri-account key rotation, vision art direction, and bespoke world synthesis
import asyncio
import hashlib
import json
import logging
import math
import os
from pathlib import Path
import re
import time
import urllib.parse
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
from google import genai
from google.genai import types
from backend.app.schemas import (
    LightingConfig,
    NodeState,
    NPCEntity,
    PropEntity,
    QuestObjective,
    RoomVisualPalette,
    SphericalCoord,
    WorldGraph,
)
from backend.app.services.local_diffusion import generate_room_panorama_and_depth
from backend.app.services.connected_synthesizer import (
    compute_inter_room_bearing,
    synthesize_connected_room_assets,
    build_connected_multi_face_prompts,
)
from backend.app.services.infinite_world_field import InfiniteWorldField
from backend.app.services.fusion_logger import (
    trace_theme_detected,
    trace_room_planned,
    trace_minimap_alignment,
)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
load_dotenv()

logger = logging.getLogger("mira.gemini")

# in-memory key lockout tracker
quota_cooldown_until: Dict[str, float] = {}
key_rotation_index: int = 0


def try_generate_gemini_panorama_image(
    room_name: str,
    prompt: str,
    world_id: str,
    room_idx: int,
) -> Optional[str]:
    # attempt live gemini image generation if quota is available; save to frontend/public/cached_worlds/generated/
    api_key = get_active_api_key()
    if not api_key:
        return None

    out_dir = Path("frontend/public/cached_worlds/generated")
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", f"{world_id}_{room_idx}")
    out_file = out_dir / f"{safe_id}.png"
    if out_file.exists() and out_file.stat().st_size > 1000:
        return f"/cached_worlds/generated/{safe_id}.png"

    try:
        client = genai.Client(api_key=api_key)
        img_prompt = (
            f"Photorealistic 360-degree equirectangular architectural panorama of '{room_name}' "
            f"in the world of '{prompt}'. Masterpiece architectural photography, natural volumetric lighting, "
            "ultra-detailed stone, foliage, and sky, 8k resolution."
        )
        resp = client.models.generate_content(
            model="gemini-3.1-flash-image",
            contents=img_prompt,
            config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
        )
        for part in resp.candidates[0].content.parts:
            if getattr(part, "inline_data", None) and part.inline_data.data:
                out_file.write_bytes(part.inline_data.data)
                return f"/cached_worlds/generated/{safe_id}.png"
    except Exception:
        pass
    return None


def get_clean_world_graph_schema() -> dict:
    # strip default values to comply with gemini api schema constraints
    schema = WorldGraph.model_json_schema()

    def _strip(obj: Any) -> Any:
        if isinstance(obj, dict):
            obj.pop("default", None)
            for v in obj.values():
                _strip(v)
        elif isinstance(obj, list):
            for v in obj:
                _strip(v)
        return obj

    return _strip(schema)


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


def detect_theme_category(text: str, biome_hint: Optional[str] = None) -> str:
    # prioritize explicit text keywords before falling back to biome_hint
    lower_text = (text or "").lower()
    if any(
        k in lower_text
        for k in [
            "space", "station", "orbital", "spire", "moon", "lunar", "mars", "martian",
            "cosmos", "star", "astral", "nebula", "observatory", "galaxy", "planet",
            "neptune", "jupiter", "saturn", "uranus", "venus", "mercury", "pluto",
            "titan", "europa", "triton", "gas giant", "methane", "ice giant", "exoplanet",
            "deep space", "outer space", "celestial", "interstellar", "sci-fi", "starship",
            "everest", "himalaya", "glacier", "snow", "icefall", "alpine", "arctic", "tundra", "summit",
        ]
    ):
        return "space_station"
    if any(k in lower_text for k in ["forest", "jungle", "garden", "grove", "canopy", "fungi", "elven", "woods", "swamp", "island", "atlantis", "ocean", "babylon", "waterfall", "botanical", "coral", "sea"]):
        return "enchanted_forest"
    if any(k in lower_text for k in ["tavern", "medieval", "castle", "roman", "rome", "colosseum", "temple", "cathedral", "knight", "citadel", "palace", "victorian", "gothic", "athens", "acropolis", "parthenon", "greek", "forum", "pantheon", "monastery", "guild", "library"]):
        return "medieval_tavern"
    if any(k in lower_text for k in [
        "cyber", "neon", "metropolis", "city", "arcade", "tokio", "tokyo", "alley", "skybridge",
        "boulevard", "industrial", "steampunk", "factory", "lab", "street", "avenue", "broadway",
        "square", "urban", "district", "quarter", "manhattan", "york", "crosswalk", "downtown",
        "traffic", "transit", "subway", "promenade"
    ]):
        return "cyberpunk_alley"
    if any(k in lower_text for k in ["giza", "pyramid", "egypt", "sphinx", "pharaoh", "nile", "desert", "oasis", "sand", "dune", "sahara", "canyon", "mesa", "petra"]):
        return "desert_oasis"

    hint = (biome_hint or "").lower()
    if hint in ["medieval_tavern", "enchanted_forest", "space_station", "cyberpunk_alley", "desert_oasis"]:
        return hint
    if any(w in lower_text for w in ["alien", "star", "sky", "flight"]):
        return "space_station"
    if any(w in lower_text for w in ["modern", "road", "vehicle", "tech", "glass", "store", "shop"]):
        return "cyberpunk_alley"
    return "medieval_tavern"


def detect_topology_type(text: str, biome_hint: Optional[str] = None) -> str:
    # identify spatial topology: linear (subways/planes), nature_open (4-way unbounded), city_grid, or hub_spoke
    lower_text = (text or "").lower()
    if any(
        k in lower_text
        for k in [
            "subway", "metro", "train", "carriage", "rail", "railway",
            "plane", "airplane", "airliner", "cabin", "cockpit", "flight",
            "corridor", "hallway", "tunnel", "pipe", "pipeline", "hyperloop",
            "tram", "walkway", "aisle", "gangway"
        ]
    ):
        return "linear"

    # nature environments: no limits, always give all 4 directions!
    if any(
        k in lower_text
        for k in [
            "everest", "mountain", "himalaya", "peak", "summit", "ridge",
            "trail", "path", "pass", "hike", "canyon", "gorge", "glacier",
            "serac", "icefall", "wilds", "wilderness", "valley", "slope",
            "forest", "jungle", "garden", "grove", "woods", "ocean", "sea",
            "island", "desert", "dune", "dunes", "sahara", "oasis", "nile",
            "giza", "pyramid", "sphinx", "mars", "moon", "neptune", "planet",
            "nature", "alpine", "arctic", "tundra"
        ]
    ):
        return "nature_open"

    if any(
        k in lower_text
        for k in [
            "city", "downtown", "seattle", "manhattan", "tokyo", "chicago",
            "street", "avenue", "boulevard", "alley", "district", "quarter",
            "blocks", "intersection", "metropolis", "urban", "grid"
        ]
    ):
        return "city_grid"

    return "hub_spoke"


def generate_room_visual_palette(
    room_name: str, prompt: str, biome: str
) -> RoomVisualPalette:
    # compute authentic visual colors to reflect the materials and sky/ground of each room
    combined = f"{room_name} {prompt} {biome}".lower()

    if any(k in combined for k in ["subway", "metro", "train", "carriage", "rail"]):
        return RoomVisualPalette(
            dominant_color="#475569",  # industrial brushed steel
            accent_color="#f59e0b",    # transit amber / hazard gold
            sky_tone="#334155",        # curved metallic ceiling
            floor_tone="#0f172a",      # ribbed transit rubber floor
        )
    if any(k in combined for k in ["plane", "airplane", "flight", "cabin", "cockpit"]):
        return RoomVisualPalette(
            dominant_color="#3b82f6",  # pressurized aero blue
            accent_color="#60a5fa",    # avionics display cyan
            sky_tone="#1e3a8a",        # high-altitude stratosphere
            floor_tone="#1e293b",      # cabin carpet slate
        )
    if any(k in combined for k in ["seattle", "emerald", "sound", "waterfront", "pier"]):
        return RoomVisualPalette(
            dominant_color="#0f766e",  # pac-nw emerald teal
            accent_color="#22d3ee",    # rainy neon cyan
            sky_tone="#1e293b",        # overcast twilight slate
            floor_tone="#0f172a",      # wet asphalt
        )
    if any(k in combined for k in ["city", "downtown", "metropolis", "arcade", "cyber", "tokyo", "alley"]):
        return RoomVisualPalette(
            dominant_color="#7c3aed",  # neon violet
            accent_color="#06b6d4",    # electric cyan
            sky_tone="#0f172a",        # night sky
            floor_tone="#18181b",      # dark concrete
        )
    if any(k in combined for k in ["everest", "himalaya", "glacier", "icefall", "snow", "peak", "alpine"]):
        return RoomVisualPalette(
            dominant_color="#0284c7",  # glacial azure
            accent_color="#e0f2fe",    # pristine snow white
            sky_tone="#38bdf8",        # high-altitude cerulean
            floor_tone="#0c4a6e",      # deep crevasse blue
        )
    if any(k in combined for k in ["giza", "pyramid", "sphinx", "egypt", "desert", "sand", "oasis"]):
        return RoomVisualPalette(
            dominant_color="#d97706",  # sunlit sandstone
            accent_color="#fbbf24",    # solar gold
            sky_tone="#fed7aa",        # desert dusk
            floor_tone="#78350f",      # limestone bedrock
        )
    if any(k in combined for k in ["rome", "roman", "colosseum", "pantheon", "forum"]):
        return RoomVisualPalette(
            dominant_color="#b45309",  # travertine bronze
            accent_color="#f59e0b",    # imperial gold
            sky_tone="#fef3c7",        # sunlit marble
            floor_tone="#451a03",      # porphyry terra
        )
    if any(k in combined for k in ["babylon", "garden", "forest", "sylvan", "grove", "botanical"]):
        return RoomVisualPalette(
            dominant_color="#059669",  # lush jade
            accent_color="#34d399",    # spring leaf
            sky_tone="#134e4a",        # cedar canopy
            floor_tone="#064e3b",      # mossy loam
        )
    if any(k in combined for k in ["neptune", "methane", "ice giant", "uranus"]):
        return RoomVisualPalette(
            dominant_color="#0284c7",  # methane cobalt
            accent_color="#38bdf8",    # storm azure
            sky_tone="#0c4a6e",        # deep atmosphere
            floor_tone="#082f49",      # mantle ocean
        )
    if any(k in combined for k in ["space", "station", "orbital", "cosmos", "astrolabe", "observatory"]):
        return RoomVisualPalette(
            dominant_color="#3b82f6",  # orbital sapphire
            accent_color="#93c5fd",    # starlight silver
            sky_tone="#0f172a",        # cosmic void
            floor_tone="#1e293b",      # titanium deck
        )

    return RoomVisualPalette(
        dominant_color="#ca8a04",
        accent_color="#fde047",
        sky_tone="#1e293b",
        floor_tone="#0f172a",
    )


def enrich_and_normalize_graph(
    graph: WorldGraph, prompt: str, biome_hint: Optional[str] = None
) -> WorldGraph:
    # guarantee every room has custom panorama parameters, connected edges, coordinates, and visible npcs
    theme_cat = detect_theme_category(prompt, biome_hint)
    topology_type = detect_topology_type(f"{graph.title} {prompt}", biome_hint)
    graph.topology_type = topology_type

    room_ids = [r.room_id for r in graph.rooms]
    num_rooms = len(graph.rooms)

    init_palette = generate_room_visual_palette(
        graph.rooms[0].name if graph.rooms else "Origin", prompt, theme_cat
    )
    trace_theme_detected(
        prompt=prompt,
        archetype=theme_cat,
        topology_type=topology_type,
        palette=init_palette.model_dump(),
    )

    for idx, room in enumerate(graph.rooms):
        b_type = detect_theme_category(f"{room.name} {prompt}", biome_hint or room.biome_type)
        room.biome_type = b_type
        room.topology_type = topology_type
        room.visual_palette = generate_room_visual_palette(room.name, prompt, b_type)
        base_pano = f"/cached_worlds/{b_type}/panorama.webp"
        base_depth = f"/cached_worlds/{b_type}/depth.png"

        # assign context-appropriate spatial coordinates & adjacency vectors
        if topology_type == "linear":
            # strict 1D linear corridor (Z axis, spacing 220)
            room.worldX = 0.0
            room.worldZ = -float(idx) * 220.0
            adj = []
            if idx > 0:
                adj.append(graph.rooms[idx - 1].room_id)
            if idx < num_rooms - 1:
                adj.append(graph.rooms[idx + 1].room_id)
            room.adjacent_room_ids = adj
        elif topology_type == "nature_open":
            # 4-way unbounded open nature exploration: NO LIMITS
            cardinal_offsets = [
                (0.0, 0.0),      # Center / Base camp
                (0.0, -220.0),   # North Expanse
                (220.0, 0.0),    # East Ridge
                (0.0, 220.0),    # South Basin
                (-220.0, 0.0),   # West Vista
            ]
            wx, wz = cardinal_offsets[idx % len(cardinal_offsets)]
            room.worldX = wx
            room.worldZ = wz
            if idx == 0:
                room.adjacent_room_ids = [r.room_id for i, r in enumerate(graph.rooms) if i != 0]
            else:
                room.adjacent_room_ids = [graph.rooms[0].room_id]
        elif topology_type == "city_grid":
            # 2D city street intersections (2x2 or 2x3 block grid)
            col = idx % 2
            row = idx // 2
            room.worldX = float(col) * 220.0
            room.worldZ = -float(row) * 220.0
            adj = []
            if col > 0:
                adj.append(graph.rooms[idx - 1].room_id)
            if col < 1 and (idx + 1) < num_rooms:
                adj.append(graph.rooms[idx + 1].room_id)
            if row > 0:
                adj.append(graph.rooms[idx - 2].room_id)
            if (idx + 2) < num_rooms:
                adj.append(graph.rooms[idx + 2].room_id)
            room.adjacent_room_ids = adj
        else:  # hub_spoke
            if idx == 0:
                room.worldX = 0.0
                room.worldZ = 0.0
                room.adjacent_room_ids = [r.room_id for i, r in enumerate(graph.rooms) if i != 0][:3]
            else:
                spoke_offsets = [
                    (0.0, -220.0),   # North
                    (220.0, 0.0),    # East
                    (0.0, 220.0),    # South
                    (-220.0, 0.0),   # West
                ]
                sx, sz = spoke_offsets[(idx - 1) % len(spoke_offsets)]
                room.worldX = sx
                room.worldZ = sz
                room.adjacent_room_ids = [graph.rooms[0].room_id]

        dx = (room.worldX or 0.0) - (graph.rooms[0].worldX or 0.0)
        dz = (room.worldZ or 0.0) - (graph.rooms[0].worldZ or 0.0)
        theta_fwd = math.atan2(dx, dz) if idx > 0 else 0.0
        theta_recip = (theta_fwd + math.pi) % (2 * math.pi) if idx > 0 else 0.0
        u_recip = ((theta_recip / (2 * math.pi)) + 0.5) % 1.0 if idx > 0 else 0.5
        trace_room_planned(
            room_idx=idx,
            room_id=room.room_id,
            name=room.name,
            world_x=room.worldX or 0.0,
            world_z=room.worldZ or 0.0,
            parent_id=graph.rooms[0].room_id if idx > 0 else None,
            parent_name=graph.rooms[0].name if idx > 0 else None,
            theta_forward=theta_fwd if idx > 0 else None,
            theta_reciprocal=theta_recip if idx > 0 else None,
            u_reciprocal=u_recip if idx > 0 else None,
        )

        q_room = urllib.parse.quote(room.name)
        q_prompt = urllib.parse.quote(prompt[:100])
        q_biome = urllib.parse.quote(b_type)

        # pass lighting colors and architectural style into panorama_url so custom worlds render uniquely
        amb_col = urllib.parse.quote(getattr(room.lighting, "ambient_color", "") or "")
        fog_col = urllib.parse.quote(getattr(room.lighting, "fog_color", "") or "")

        safe_world = re.sub(r"[^a-zA-Z0-9_-]", "", graph.world_id or "world_default")
        safe_room = re.sub(r"[^a-zA-Z0-9_-]", "", room.room_id or f"room_{idx}")

        # Derive direction relative to root room
        dir_label = "north"
        if room.worldX is not None and room.worldZ is not None:
            if abs(room.worldX) > abs(room.worldZ):
                dir_label = "east" if room.worldX > 0 else "west"
            else:
                dir_label = "south" if room.worldZ > 0 else "north"

        # Synchronously synthesize the initial room (idx == 0) via JoPano 6-Face Cubemap + Poisson CFB
        # so the user can enter IMMEDIATELY into the bespoke fusion room,
        # while synthesizing rooms 1..N in background threads so /world/compile never times out!
        if idx == 0:
            local_assets = generate_room_panorama_and_depth(
                world_id=graph.world_id,
                room_id=room.room_id,
                room_name=room.name,
                world_prompt=prompt,
                biome_type=b_type,
                room_idx=idx,
                ambient_color=getattr(room.lighting, "ambient_color", "") or "",
                fog_color=getattr(room.lighting, "fog_color", "") or "",
                from_room_name=None,
                direction=None,
                target_x=room.worldX,
                target_z=room.worldZ,
                from_x=0.0,
                from_z=0.0,
            )
            if local_assets is not None:
                room.panorama_url, room.depth_url = local_assets
            else:
                pano_url, depth_url = synthesize_connected_room_assets(
                    world_id=graph.world_id,
                    new_room_id=room.room_id,
                    new_room_name=room.name,
                    from_room=None,
                    direction="north",
                    target_x=room.worldX or 0.0,
                    target_z=room.worldZ or 0.0,
                    biome_type=b_type,
                    world_prompt=prompt,
                )
                room.panorama_url = pano_url
                room.depth_url = depth_url
        else:
            # Set target URLs for rooms 1..N
            clean_w = re.sub(r"[^a-zA-Z0-9_-]", "", graph.world_id or "world_default")
            clean_r = re.sub(r"[^a-zA-Z0-9_-]", "", room.room_id or f"room_{idx}")
            room.panorama_url = f"/generated_worlds/{clean_w}/{clean_r}_panorama.webp"
            room.depth_url = f"/generated_worlds/{clean_w}/{clean_r}_depth.png"

            # Spawn dedicated background fusion worker for each neighbor room
            import threading
            threading.Thread(
                target=generate_room_panorama_and_depth,
                kwargs={
                    "world_id": graph.world_id,
                    "room_id": room.room_id,
                    "room_name": room.name,
                    "world_prompt": prompt,
                    "biome_type": b_type,
                    "room_idx": idx,
                    "ambient_color": getattr(room.lighting, "ambient_color", "") or "",
                    "fog_color": getattr(room.lighting, "fog_color", "") or "",
                    "from_room_name": graph.rooms[0].name,
                    "direction": dir_label,
                    "target_x": room.worldX,
                    "target_z": room.worldZ,
                    "from_x": graph.rooms[0].worldX or 0.0,
                    "from_z": graph.rooms[0].worldZ or 0.0,
                },
                daemon=True,
            ).start()

        # ensure connected adjacency graph
        if not room.adjacent_room_ids:
            adj = [rid for rid in room_ids if rid != room.room_id]
            room.adjacent_room_ids = adj[:2]

        # normalize npc room_id and spherical coordinates so agents stand clearly in view
        if not room.npcs:
            room.npcs = [
                NPCEntity(
                    npc_id=f"npc_{room.room_id}_guide",
                    name=f"Custodian of {room.name.split()[0]}",
                    room_id=room.room_id,
                    persona_description=f"Chronicler and guardian of {room.name} within {graph.title}.",
                    thought_log=[
                        f"[MEMORY] Standing watch over {room.name}.",
                        "[REFLECTION] A traveler has entered the sanctuary.",
                        "[PLANNING] Offer counsel and reveal the history of this domain.",
                        "[ACTION] Step forward and greet the traveler.",
                    ],
                    active_plan=f"Guide travelers through {room.name}.",
                    inventory=["ancient_chronicle", "sanctuary_seal"],
                    hp=100,
                    position=SphericalCoord(r=500.0, theta=-0.28, phi=1.65),
                )
            ]
        else:
            for n_idx, npc in enumerate(room.npcs):
                npc.room_id = room.room_id
                spread_theta = -0.32 + (n_idx * 0.45)
                npc.position = SphericalCoord(r=500.0, theta=spread_theta, phi=1.65)
                if not npc.thought_log:
                    npc.thought_log = [
                        f"[MEMORY] Observing {room.name}. [REFLECTION] Traveler approaches. [PLANNING] Converse openly. [ACTION] Await inquiry."
                    ]

        if not room.props:
            room.props = []

    if graph.rooms and graph.initial_room_id not in room_ids:
        graph.initial_room_id = graph.rooms[0].room_id

    trace_minimap_alignment(
        world_id=graph.world_id,
        rooms_summary=[
            {
                "room_id": r.room_id,
                "name": r.name,
                "x": r.worldX,
                "z": r.worldZ,
                "adjacent": r.adjacent_room_ids,
            }
            for r in graph.rooms
        ],
    )

    return graph


def generate_expanded_room(
    world_id: str,
    from_room_id: str,
    direction: Optional[str],
    world_prompt: str,
    existing_room_ids: List[str],
    from_room: Optional[NodeState] = None,
    topology_type: Optional[str] = None,
    target_x: Optional[float] = None,
    target_z: Optional[float] = None,
) -> NodeState:
    # Synthesizes a new authentic, connected room extending the world frontier
    clean_prompt = (world_prompt or "").strip() or "Architectural Zone"
    topo = topology_type or detect_topology_type(clean_prompt)
    theme = detect_theme_category(clean_prompt)
    next_idx = len(existing_room_ids) + 1
    digest = hashlib.md5(f"{world_id}_{next_idx}_{clean_prompt}".encode("utf-8")).hexdigest()[:6]
    new_room_id = f"room_{digest}_{next_idx}"

    if from_room and from_room.worldX is not None and from_room.worldZ is not None:
        from_x = from_room.worldX
        from_z = from_room.worldZ
    else:
        if topo == "linear":
            from_x = 0.0
            from_z = -float(max(0, len(existing_room_ids) - 1)) * 220.0
        else:
            from_x = 0.0
            from_z = 0.0

    dir_lower = (direction or "forward").lower()
    if target_x is not None and target_z is not None:
        new_x = float(target_x)
        new_z = float(target_z)
    elif topo == "linear":
        new_x = from_x
        # forward extends negative Z, backward extends positive Z
        new_z = from_z + 220.0 if dir_lower in ["backward", "back", "south", "down"] else from_z - 220.0
    elif topo == "nature_open" or topo == "city_grid":
        # NO LIMITS: full 4-directional continuous exploration in all 4 cardinal directions!
        if dir_lower in ["north", "forward", "up"]:
            new_x, new_z = from_x, from_z - 220.0
        elif dir_lower in ["south", "backward", "down"]:
            new_x, new_z = from_x, from_z + 220.0
        elif dir_lower in ["east", "right"]:
            new_x, new_z = from_x + 220.0, from_z
        elif dir_lower in ["west", "left"]:
            new_x, new_z = from_x - 220.0, from_z
        else:
            cardinals = [
                (from_x, from_z - 220.0),
                (from_x + 220.0, from_z),
                (from_x, from_z + 220.0),
                (from_x - 220.0, from_z),
            ]
            new_x, new_z = cardinals[(next_idx - 1) % len(cardinals)]
    else:  # hub_spoke
        ang = ((next_idx - 1) * 0.785)
        new_x = 220.0 * math.sin(ang)
        new_z = -220.0 * math.cos(ang)

    # Evocative naming synthesis referencing parent room connection
    from_base_name = (from_room.name if from_room else clean_prompt).split("-")[0].strip()
    cardinal_name = dir_lower.capitalize() if dir_lower in ["north", "south", "east", "west"] else "Forward"

    lower_p = clean_prompt.lower()
    if any(k in lower_p for k in ["subway", "metro", "train"]):
        car_titles = [
            ("Carriage Beta: Passenger Lounge", "Stainless steel passenger cabin with overhead handrails and illuminated transit route maps", "Conductor Ellis", "Transit conductor verifying passenger tickets and station interchanges."),
            ("Carriage Gamma: Dining & Bistro Car", "Art-deco dining carriage with polished mahogany tables and warm amber lamps", "Chef Armand", "Rail steward serving warm tea and pastries along the line."),
            ("Carriage Delta: Observation Vista", "Glass-domed panoramic observatory car surveying the subterranean tracks", "Navigator Silas", "Signalman monitoring the switch tracks and tunnel lanterns."),
            ("Carriage Epsilon: Freight & Machine Hold", "Industrial engine compartment humming with bronze dynamos and pneumatic valves", "Chief Engineer Vance", "Master mechanic maintaining the electric traction motors."),
        ]
        name, desc, npc_n, npc_p = car_titles[(next_idx - 1) % len(car_titles)]
    elif any(k in lower_p for k in ["plane", "airplane", "flight"]):
        plane_titles = [
            ("Forward First Class Cabin", "Pressurized leather interior with panoramic curved portholes overlooking cloud seas", "Purser Claire", "Chief flight purser offering warm hospitality at cruising altitude."),
            ("Flight Deck Navigation Vestibule", "Avionics threshold gleaming with illuminated altimeters and celestial heading gyros", "First Officer Ray", "Co-pilot charting celestial vectors through the upper jetstream."),
            ("Mid-Fuselage Sky Galley", "Sleek composite galley with illuminated service carts and soft blue cabin illumination", "Attendant Devon", "Flight attendant preparing refreshments for transcontinental travelers."),
            ("Aft Panorama Lounge", "Observation seating at the tail of the aircraft surveying the vast contrails and twilight horizon", "Captain Sterling", "Senior captain briefing passengers on atmospheric crossing waypoints."),
        ]
        name, desc, npc_n, npc_p = plane_titles[(next_idx - 1) % len(plane_titles)]
    elif any(k in lower_p for k in ["seattle"]):
        seattle_titles = [
            (f"{from_base_name} - Waterfront Arcade", "Historic brick market arcade overlooking Elliott Bay under misty Pacific Northwest skies", "Fishmonger Sam", "Market vendor reciting the history of the century-old public market."),
            (f"{from_base_name} - Pergola Promenade", "Victorian iron pergola and cobblestone square ringed by illuminated cafes", "Curator Maeve", "Urban historian preserving the Klondike Gold Rush archives."),
            (f"{from_base_name} - Transit Mall", "Sleek elevated monorail platform and pedestrian promenade amidst misted skyscrapers", "Conductor Roy", "Monorail engineer guiding travelers between downtown and the Seattle Center."),
            (f"{from_base_name} - Pier Promenade", "Cedar boardwalk pier extending into Puget Sound with views of the snow-capped Olympics", "Captain Thorne", "Ferry captain docking the cross-sound vessel at sunset."),
        ]
        name, desc, npc_n, npc_p = seattle_titles[(next_idx - 1) % len(seattle_titles)]
    elif any(k in lower_p for k in ["everest", "mountain", "himalaya"]):
        everest_titles = [
            (f"{from_base_name} - {cardinal_name} Serac Camp", "Wind-hardened expedition tent platform perched above colossal blue ice pinnacles", "Dawa Sherpa", "Veteran route-fixer securing safety lines across the icefall."),
            (f"{from_base_name} - {cardinal_name} Face Traverses", "Sheer blue ice wall reflecting the sun with ascending fixed ropes", "Dr. Chen, High Altitude Medic", "Expedition doctor monitoring physiological adaptation."),
            (f"{from_base_name} - {cardinal_name} Rock Crest", "Knife-edge rock ridge between Nepal and Tibet under dark indigo sky", "Pasang the Guide", "Summit veteran pointing out the Kangchenjunga massif on the horizon."),
            (f"{from_base_name} - {cardinal_name} Cornice", "Windswept snow cornice overlooking the endless Himalayan sea of peaks", "Tashi, Cairn Chronicler", "Chronicler leaving prayer flags at the high vantage point."),
        ]
        name, desc, npc_n, npc_p = everest_titles[(next_idx - 1) % len(everest_titles)]
    field = InfiniteWorldField(clean_prompt)
    info = field.sample_field(new_x, new_z)
    name = info["name"]
    desc = info["description"]
    npc_n = info["npc_title"]
    npc_p = info["npc_role"]
    palette = info["palette"]
    theme = info["sector_type"] if info["sector_type"] != "general" else theme

    from_id = from_room.room_id if from_room else from_room_id
    adj_ids = [from_id] if from_id else []

    from_name = from_room.name if from_room else clean_prompt
    from_x_val = from_room.worldX if (from_room and from_room.worldX is not None) else from_x
    from_z_val = from_room.worldZ if (from_room and from_room.worldZ is not None) else from_z

    dir_label = dir_lower
    if new_x is not None and new_z is not None and from_x_val is not None and from_z_val is not None:
        dx_val = new_x - from_x_val
        dz_val = new_z - from_z_val
        if abs(dx_val) > abs(dz_val):
            dir_label = "east" if dx_val > 0 else "west"
        else:
            dir_label = "south" if dz_val > 0 else "north"

    # Synthesize dedicated connected panorama and 16-bit depth map via fusion pipeline:
    # Portal facing parent room blends seamlessly; outward headings morph into the new sector's landscape!
    local_assets = generate_room_panorama_and_depth(
        world_id=world_id,
        room_id=new_room_id,
        room_name=name,
        world_prompt=clean_prompt,
        biome_type=theme,
        room_idx=next_idx,
        ambient_color=palette.dominant_color,
        fog_color=palette.sky_tone,
        from_room_name=from_name,
        direction=dir_label,
        target_x=new_x,
        target_z=new_z,
        from_x=from_x_val,
        from_z=from_z_val,
    )
    if local_assets is not None:
        pano_url, depth_url = local_assets
    else:
        pano_url, depth_url = synthesize_connected_room_assets(
            world_id=world_id,
            new_room_id=new_room_id,
            new_room_name=name,
            from_room=from_room,
            direction=dir_label,
            target_x=new_x,
            target_z=new_z,
            biome_type=theme,
            world_prompt=clean_prompt,
        )

    new_node = NodeState(
        room_id=new_room_id,
        name=name,
        biome_type=theme,
        panorama_url=pano_url,
        depth_url=depth_url,
        adjacent_room_ids=adj_ids,
        mutation_level=0.0,
        lighting=LightingConfig(
            ambient_color=palette.dominant_color,
            ambient_intensity=1.1,
            fog_color=palette.sky_tone,
            fog_density=0.006,
        ),
        npcs=[
            NPCEntity(
                npc_id=f"npc_{new_room_id}",
                name=npc_n,
                room_id=new_room_id,
                persona_description=npc_p,
                thought_log=[
                    f"[MEMORY] Stationed at the entrance of {name}, directly connected from {from_base_name}.",
                    f"[REFLECTION] Traveler approached across the {dir_lower} threshold from {from_base_name}.",
                    f"[PLANNING] Counsel the traveler entering {name}.",
                    f"[ACTION] Welcome traveler to this newly charted sector.",
                ],
                active_plan=f"Survey {name}.",
                inventory=["sector_map", "traveler_key"],
                hp=100,
                position=SphericalCoord(r=500.0, theta=-0.22, phi=1.65),
            )
        ],
        props=[],
        worldX=round(new_x, 1),
        worldZ=round(new_z, 1),
        topology_type=topo,
        visual_palette=palette,
    )

    return new_node


def synthesize_prompt_world_graph(
    prompt: str, biome_hint: Optional[str] = None
) -> WorldGraph:
    # deterministic prompt-driven architectural world synthesis when upstream llm is unavailable
    clean_prompt = prompt.strip() or "Ancient Sanctuary"
    theme = detect_theme_category(clean_prompt, biome_hint)
    digest = hashlib.md5(clean_prompt.lower().encode("utf-8")).hexdigest()[:6]
    world_id = f"world_{digest}"

    lower_p = clean_prompt.lower()
    if any(k in lower_p for k in ["giza", "pyramid", "egypt", "sphinx", "pharaoh"]):
        title = "The Necropolis of Giza"
        room_specs = [
            ("Great Pyramid Forecourt", "Sunlit limestone plaza at the base of Khufu's Great Pyramid", "Khaemwaset, Royal Architect", "Master builder overseeing the sacred geometry and solar alignment of the Great Pyramid."),
            ("Causeway of the Great Sphinx", "Monumental carved limestone guardian overlooking the Nile valley", "Neferu, High Priestess of Ra", "Keeper of the solar liturgy and translator of the Old Kingdom stelae."),
            ("Grand Gallery of Khufu", "Ascending corbelled granite gallery illuminated by bronze oil lamps", "Imhotep the Chronicler", "Scholar preserving the astronomical scrolls beneath the King's Chamber."),
            ("Solar Barque Sanctuary", "Sacred cedar vessel chamber carved into the bedrock of the plateau", "Captain Menkaure", "Navigator of the Pharaoh's celestial barque across the horizon."),
        ]
    elif any(k in lower_p for k in ["rome", "roman", "colosseum", "forum", "empire", "pantheon"]):
        title = "Imperial Forum of Rome"
        room_specs = [
            ("Colosseum Arena Floor", "Sunlit travertine amphitheater surrounded by marble colonnades", "Cassius Aurelius", "Veteran Tribune of the Praetorian Guard overseeing the imperial games."),
            ("Via Sacra Processional", "Triumphal marble roadway flanked by Corinthian temples", "Senator Valeria", "Patrician orator debating provincial decrees on the Senate steps."),
            ("Rotunda of the Pantheon", "Coffered concrete dome pierced by the sunlit central oculus", "Vitruvius the Elder", "Master engineer studying the harmonic proportions of the dome."),
            ("Gardens of the Palatine", "Terraced cypress courtyard overlooking the Roman Forum", "Marcus the Stoic", "Philosopher recording meditations beneath the marble portico."),
        ]
    elif any(k in lower_p for k in ["babylon", "hanging", "garden", "botanical", "forest", "grove", "sylvan"]):
        title = "Hanging Gardens of Babylon"
        room_specs = [
            ("Upper Cedar Terrace", "Sunlit botanical sanctuary with terraced waterfalls and marble colonnades", "Queen Amytis of Media", "Founder of the terraced mountain gardens above the Euphrates plain."),
            ("Ishtar Water Pavilion", "Glazed lapis lazuli courtyard fed by stone hydraulic aqueducts", "Chronicler Berossus", "Astronomer-priest of Marduk and historian of the Chaldean dynasties."),
            ("Pomegranate Cloister", "Shaded peristyle arbor fragrant with cedar and myrrh blossoms", "Nabopolassar the Builder", "Royal hydraulic engineer overseeing the Archimedes water screws."),
            ("Euphrates Overlook", "High marble balustrade surveying the river and temple ziggurat", "Lady Nitocris", "Architect of the river embankments and royal bridges of Babylon."),
        ]
    elif any(k in lower_p for k in ["athens", "acropolis", "parthenon", "greek", "aegean", "hellenic"]):
        title = "Acropolis of Athens"
        room_specs = [
            ("Parthenon Eastern Portico", "Sunlit Pentelic marble Doric colonnade overlooking the Aegean horizon", "Phidias the Sculptor", "Master sculptor of the Panathenaic frieze and the Athena Parthenos."),
            ("Propylaea Monumental Gateway", "Grand marble ceremonial threshold atop the sacred rock", "Mnesicles of Athens", "Architect of the monumental gateway and Pinakotheke gallery."),
            ("Porch of the Caryatids", "Ionic sanctuary of the Erechtheion supported by sculpted marble maidens", "Pericles of Cholargos", "Statesman and patron of the Golden Age architectural renewal."),
            ("Theater of Dionysus", "Curved limestone auditorium carved into the southern slope of the Acropolis", "Sophocles of Colonus", "Tragic playwright rehearsing chorus odes beneath the Attic sun."),
        ]
    elif any(k in lower_p for k in ["moon", "lunar", "mars", "martian", "asteroid"]) and not any(
        k in lower_p for k in ["station", "base", "colony", "observatory", "habitat"]
    ):
        is_mars = "mars" in lower_p or "martian" in lower_p
        title = "Martian Frontier" if is_mars else "Lunar Expanse"
        room_specs = (
            [
                ("Jezero Crater Floor", "Rust red regolith plain scattered with basalt boulders", "Dr. Ares, Planetary Geologist", "Field scientist cataloguing ancient river delta sediments."),
                ("Valles Marineris Rim", "Edge of a colossal canyon system under a butterscotch sky", "Commander Vega", "Expedition lead surveying the canyon descent routes."),
                ("Olympus Mons Foothills", "Gently rising volcanic slopes of the largest volcano in the solar system", "Rover Pilot Kade", "Navigator mapping safe traverse paths across lava flows."),
                ("Utopia Planitia Dunes", "Wind-sculpted dark dune field stretching to the horizon", "Dr. Sol, Atmospheric Scientist", "Researcher tracking dust devils and seasonal frost."),
            ]
            if is_mars
            else [
                ("Sea of Tranquility", "Flat grey basaltic mare plain under a black star-filled sky", "Commander Armstrong", "Astronaut who studies the untouched regolith of the first landing plain."),
                ("Copernicus Crater", "Terraced crater walls and central peaks of a vast impact basin", "Dr. Shoemaker, Selenologist", "Geologist reading the impact history in the crater rays."),
                ("Oceanus Procellarum", "Endless grey Ocean of Storms with sinuous lava rilles", "Navigator Collins", "Pilot charting traverse routes across the volcanic plains."),
                ("Far Side Basin", "Heavily cratered highlands where Earth never rises", "Dr. Chang'e, Astronomer", "Radio astronomer listening to the quiet cosmos from the far side."),
            ]
        )
    elif any(k in lower_p for k in ["space", "orbital", "observatory", "station", "cosmos", "astral", "planet"]):
        title = "Celestial Orbital Observatory"
        room_specs = [
            ("Grand Astrolabe Rotunda", "Alabaster and brass cupola overlooking the illuminated planetary horizon", "Astronomer Hypatia", "Chief celestial cartographer calculating orbital harmonics and star ephemerides."),
            ("Zenith Telescope Gallery", "Refracting brass meridian instrument aligned with the solar corona", "Commander Cassini", "Keeper of the deep-space telemetry array and orbital gyroscopes."),
            ("Apogee Botanical Atrium", "Pressurized glass conservatory sustaining terrestrial flora in high orbit", "Dr. Kepler", "Bio-astronomer cultivating the orbital biosphere."),
            ("Celestial Archive Vault", "Armillary sphere chamber storing millennia of stellar observations", "Navigator Ptolemy", "Curator of the star catalogs and astrometric plates."),
        ]
    elif any(k in lower_p for k in ["metropolis", "arcade", "cyber", "city", "boulevard", "skybridge"]):
        title = "Grand Metropolis Arcade"
        room_specs = [
            ("Aetherium Glass Galleria", "Vaulted iron-and-crystal boulevard illuminated by warm amber lanterns", "Director Vance", "Chief urban archivist of the Grand Metropolis transit network."),
            ("Brass Skybridge Overlook", "Elevated suspension promenade spanning the twilight towers", "Engineer Tesla", "Designer of the atmospheric induction lamps and bronze dynamos."),
            ("The Clockwork Conservatory", "Monumental rotunda housing the central municipal chronometer", "Curator Ada", "Mathematician maintaining the analytical difference engines."),
            ("Plaza of the Guilds", "Flagstone civic forum ringed by illuminated art-deco facades", "Magistrate Sterling", "Speaker of the metropolitan council."),
        ]
    elif any(k in lower_p for k in ["everest", "himalaya", "k2", "alps", "alpine", "mountain", "peak", "summit", "glacier", "snow", "tundra", "arctic"]):
        words = [w.capitalize() for w in re.findall(r"[a-zA-Z0-9]+", clean_prompt) if len(w) > 1]
        subject = " ".join(words[:4]) if words else "Mount Everest"
        title = subject if "mount" in lower_p or "everest" in lower_p else f"The Alpine Peaks of {subject}"
        room_specs = [
            (f"{subject} Khumbu Icefall", f"Towering blue glacial seracs and wind-swept snowfield at the base of {subject}", "Tenzing, Lead Sherpa Guide", f"Veteran high-altitude mountaineer navigating the shifting crevasses of {subject}."),
            ("Western Cwm Glacial Valley", f"High-altitude sunlit snow basin surrounded by sheer granite faces of {subject}", "Dr. Hillary, Glaciologist", f"Expedition scientist measuring glacial ice cores and katabatic wind patterns on {subject}."),
            ("South Col Razor Ridge", f"Windswept saddle of metamorphic rock and packed snow at 8,000 meters on {subject}", "Pemba, High Camp Quartermaster", f"Mountaineer maintaining the oxygen caches and weather telemetry along the ridge."),
            (f"{subject} Summit Crest", f"The highest snow-and-ice pinnacle overlooking a vast sea of Himalayan peaks", "Ang Dorje, Summit Chronicler", f"Keeper of the summit cairn and witness to the curvature of the horizon."),
        ]
    elif any(k in lower_p for k in ["canyon", "gorge", "desert", "sahara", "dune", "mesa", "volcano", "caldera", "ocean", "island", "cave", "cavern", "waterfall", "wilderness", "national park", "yosemite"]):
        words = [w.capitalize() for w in re.findall(r"[a-zA-Z0-9]+", clean_prompt) if len(w) > 2]
        subject = " ".join(words[:4]) if words else "The Untamed Wilderness"
        title = f"Expedition to {subject}"
        room_specs = [
            (f"{subject} Trailhead Overlook", f"Untouched natural wilderness threshold of {clean_prompt}", "Ranger Elara", f"Field naturalist documenting the geology and ecosystems of {subject}."),
            (f"{subject} Deep Gorge", f"Expansive natural terrain and formations within {clean_prompt}", "Prof. Thorne, Geologist", f"Earth scientist studying the ancient rock strata of {subject}."),
            (f"{subject} High Ridge", f"Elevated natural crest surveying the wild horizon of {clean_prompt}", "Kaelen, Wilderness Pathfinder", f"Tracker charting the natural passes across {subject}."),
            (f"{subject} Heart Basin", f"Pristine inner natural sanctuary at the core of {clean_prompt}", "Dr. Lin, Botanist", f"Researcher preserving the untouched flora of {subject}."),
        ]
    else:
        # extract meaningful title words from user prompt
        words = [w.capitalize() for w in re.findall(r"[a-zA-Z0-9]+", clean_prompt) if len(w) > 2]
        subject = " ".join(words[:4]) if words else "The Uncharted Realm"
        title = f"Chronicles of {subject}"
        room_specs = [
            (f"{subject} Threshold", f"Primary sunlit entry zone of {clean_prompt}", "Aurelia, First Chronicler", f"Historian documenting the origins and landscape of {subject}."),
            (f"Heart of {words[0] if words else 'Antiquity'}", f"Central expanse within {clean_prompt}", "Lord Vaelen", f"Steward safeguarding the heritage of {subject}."),
            (f"High Overlook of {words[-1] if words else 'Light'}", f"Elevated panoramic vista across {clean_prompt}", "Lyra the Cartographer", f"Master navigator charting the horizons of {subject}."),
            (f"Far Reach of {subject}", f"Distant connected vantage at the edge of {clean_prompt}", "Archivist Solon", f"Keeper of the expedition records of {subject}."),
        ]

    rooms: List[NodeState] = []
    r_ids = [f"room_{digest}_{i+1}" for i in range(len(room_specs))]

    for i, (r_name, r_desc, npc_name, npc_persona) in enumerate(room_specs):
        rid = r_ids[i]
        adj = [r_ids[(i - 1) % len(r_ids)], r_ids[(i + 1) % len(r_ids)]]
        rooms.append(
            NodeState(
                room_id=rid,
                name=r_name,
                biome_type=theme,
                panorama_url=f"/cached_worlds/{theme}/panorama.webp",
                depth_url=f"/cached_worlds/{theme}/depth.png",
                adjacent_room_ids=adj,
                mutation_level=0.0,
                lighting=LightingConfig(
                    ambient_color="#fffbeb",
                    ambient_intensity=1.2,
                    fog_color="#fef3c7",
                    fog_density=0.005,
                ),
                npcs=[
                    NPCEntity(
                        npc_id=f"npc_{digest}_{i+1}",
                        name=npc_name,
                        room_id=rid,
                        persona_description=npc_persona,
                        thought_log=[
                            f"[MEMORY] Positioned within {r_name} ({r_desc}).",
                            f"[REFLECTION] The traveler seeks knowledge of {title}.",
                            "[PLANNING] Share historical insight and guide their exploration.",
                            f"[ACTION] Welcome the traveler to {r_name}.",
                        ],
                        active_plan=f"Preserve the heritage of {r_name}.",
                        inventory=["inscribed_tablet", "sanctuary_key"],
                        hp=100,
                        position=SphericalCoord(r=500.0, theta=-0.22, phi=1.65),
                    )
                ],
                props=[],
            )
        )

    graph = WorldGraph(
        world_id=world_id,
        title=title,
        initial_room_id=r_ids[0],
        rooms=rooms,
        quests=[
            QuestObjective(
                quest_id=f"quest_{digest}_1",
                title=f"Survey the monuments of {title}",
                is_completed=False,
                trigger_flag="surveyed_monuments",
            ),
            QuestObjective(
                quest_id=f"quest_{digest}_2",
                title=f"Converse with {room_specs[0][2]}",
                is_completed=False,
                trigger_flag="conversed_elder",
            ),
        ],
    )

    return enrich_and_normalize_graph(graph, clean_prompt, biome_hint)


async def generate_world_graph(
    prompt: str, biome_hint: Optional[str] = None
) -> WorldGraph:
    # acquire active api key or synthesize prompt-driven world graph directly
    api_key = get_active_api_key()
    if not api_key:
        logger.info("No active Gemini key; synthesizing prompt-specific world graph")
        return synthesize_prompt_world_graph(prompt, biome_hint)

    client = genai.Client(api_key=api_key)
    theme_cat = detect_theme_category(prompt, biome_hint)

    system_instruction = (
        "You are a master geographical, natural, and historical RPG world builder. "
        "Generate a rich WorldGraph conforming strictly to the schema for the user's prompt. "
        "Create 4 connected sub-zones/rooms with evocative, authentic names. "
        "CRITICAL RULE: If the user's prompt describes a natural landscape or wilderness (e.g., Mount Everest, "
        "glacier, mountain peak, forest, canyon, desert, ocean, volcano, the Moon, Mars, or another planet's surface), all room names, descriptions, and props "
        "MUST be 100% pure natural geological/ecological features (e.g., 'Khumbu Icefall', 'Western Cwm Valley', "
        "'South Col Ridge', 'Summit Crest') with ZERO buildings, ZERO dojos, ZERO temples, and ZERO courtyards. "
        "Only include architectural rooms if the prompt is about a city, monument, temple, or building. "
        "Each room must contain 1 named NPC whose room_id matches their room's room_id. "
        f"Set biome_type to '{theme_cat}'."
    )

    full_prompt = f"Create an authentic, detailed 3D world graph for: {prompt}"
    if biome_hint:
        full_prompt += f" (theme: {biome_hint})"

    candidate_models = ["gemini-3.5-flash-lite", "gemini-3.8-flash"]
    clean_schema = get_clean_world_graph_schema()
    loop = asyncio.get_running_loop()

    for model_name in candidate_models:
        try:
            def _call_model(m: str = model_name):
                return client.models.generate_content(
                    model=m,
                    contents=full_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=clean_schema,
                        temperature=0.7,
                        http_options=types.HttpOptions(timeout=12000),
                    ),
                )

            response = await asyncio.wait_for(
                loop.run_in_executor(None, _call_model),
                timeout=12.5,
            )

            if not response or not response.text:
                continue

            raw_json = json.loads(response.text)
            graph = WorldGraph.model_validate(raw_json)
            if not graph.rooms:
                continue

            return enrich_and_normalize_graph(graph, prompt, biome_hint)

        except Exception as exc:
            err_str = str(exc)
            if "429" in err_str or "quota" in err_str.lower() or "exhausted" in err_str.lower():
                mark_key_cooldown(api_key, cooldown_seconds=60.0)
            logger.warning(f"Model {model_name} failed: {exc}")
            continue

    # fallback to prompt-specific architectural synthesis so user prompt is always honored
    logger.info("Using prompt-specific architectural synthesis for world graph")
    return synthesize_prompt_world_graph(prompt, biome_hint)
