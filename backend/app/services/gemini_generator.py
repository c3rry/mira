# gemini generator service with tri-account key rotation, vision art direction, and bespoke world synthesis
import asyncio
import hashlib
import json
import logging
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
    SphericalCoord,
    WorldGraph,
)
from backend.app.services.local_diffusion import generate_room_panorama_and_depth

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
    if any(k in lower_text for k in ["space", "station", "orbital", "spire", "moon", "mars", "cosmos", "star", "astral", "nebula", "observatory", "galaxy", "planet"]):
        return "space_station"
    if any(k in lower_text for k in ["forest", "jungle", "garden", "grove", "canopy", "fungi", "elven", "woods", "swamp", "island", "atlantis", "ocean", "babylon", "waterfall", "botanical", "coral", "sea"]):
        return "enchanted_forest"
    if any(k in lower_text for k in ["tavern", "medieval", "castle", "roman", "rome", "colosseum", "temple", "cathedral", "knight", "citadel", "palace", "victorian", "gothic", "athens", "acropolis", "parthenon", "greek", "forum", "pantheon", "monastery", "guild", "library"]):
        return "medieval_tavern"
    if any(k in lower_text for k in ["cyber", "neon", "metropolis", "city", "arcade", "tokio", "tokyo", "alley", "skybridge", "boulevard", "industrial", "steampunk", "factory", "lab"]):
        return "cyberpunk_alley"
    if any(k in lower_text for k in ["giza", "pyramid", "egypt", "sphinx", "pharaoh", "nile", "desert", "oasis", "sand", "dune", "sahara", "canyon", "mesa", "petra"]):
        return "desert_oasis"

    hint = (biome_hint or "").lower()
    if hint in ["medieval_tavern", "enchanted_forest", "space_station", "cyberpunk_alley", "desert_oasis"]:
        return hint
    return "medieval_tavern"


def enrich_and_normalize_graph(
    graph: WorldGraph, prompt: str, biome_hint: Optional[str] = None
) -> WorldGraph:
    # guarantee every room has custom panorama parameters, connected edges, and visible npcs
    theme_cat = detect_theme_category(prompt, biome_hint)
    room_ids = [r.room_id for r in graph.rooms]

    for idx, room in enumerate(graph.rooms):
        b_type = detect_theme_category(f"{room.name} {prompt}", biome_hint or room.biome_type)
        room.biome_type = b_type
        base_pano = f"/cached_worlds/{b_type}/panorama.webp"
        base_depth = f"/cached_worlds/{b_type}/depth.png"

        q_room = urllib.parse.quote(room.name)
        q_prompt = urllib.parse.quote(prompt[:100])
        q_biome = urllib.parse.quote(b_type)

        # pass lighting colors and architectural style into panorama_url so custom worlds render uniquely
        amb_col = urllib.parse.quote(getattr(room.lighting, "ambient_color", "") or "")
        fog_col = urllib.parse.quote(getattr(room.lighting, "fog_color", "") or "")

        # Synchronously synthesize the initial room (idx == 0) via JoPano 6-Face Cubemap + Poisson CFB (~2.8s)
        # and synthesize rooms 1..N asynchronously in a background thread so /world/compile never hits proxy timeout!
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
            )
            if local_assets is not None:
                room.panorama_url, room.depth_url = local_assets
            else:
                room.panorama_url = base_pano
                room.depth_url = base_depth
        else:
            safe_world = re.sub(r"[^a-zA-Z0-9_-]", "", graph.world_id or "world_default")
            safe_room = re.sub(r"[^a-zA-Z0-9_-]", "", room.room_id or f"room_{idx}")
            room.panorama_url = f"/generated_worlds/{safe_world}/{safe_room}_panorama.webp"
            room.depth_url = f"/generated_worlds/{safe_world}/{safe_room}_depth.png"

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
            room.props = [
                PropEntity(
                    prop_id=f"prop_{room.room_id}_monument",
                    name=f"{room.name} Obelisk",
                    mesh_url="/cached_worlds/models/terminal.glb",
                    position=SphericalCoord(r=500.0, theta=0.42, phi=1.70),
                    scale=1.0,
                    interactive=True,
                )
            ]

    if graph.rooms and graph.initial_room_id not in room_ids:
        graph.initial_room_id = graph.rooms[0].room_id

    return graph


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
                props=[
                    PropEntity(
                        prop_id=f"prop_{digest}_{i+1}",
                        name=f"{r_name} Pillar",
                        mesh_url="/cached_worlds/models/terminal.glb",
                        position=SphericalCoord(r=500.0, theta=0.38, phi=1.70),
                        scale=1.0,
                        interactive=True,
                    )
                ],
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
