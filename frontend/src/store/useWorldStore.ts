// zustand primary world store with world archives, diffusion state, subtitles, and adaptive themes
import { create } from "zustand";

export interface SphericalCoord {
  r: number;
  theta: number;
  phi: number;
}

export interface PropItem {
  prop_id: string;
  name: string;
  mesh_url: string;
  position: SphericalCoord;
  scale?: number;
  interactive?: boolean;
}

export interface RoomVisualPalette {
  dominant_color: string;
  accent_color: string;
  sky_tone: string;
  floor_tone: string;
}

export interface WorldRoom {
  room_id: string;
  name: string;
  panorama_url: string;
  depth_url: string;
  adjacent_room_ids: string[];
  mutation_level: number;
  biome_type: string;
  props?: PropItem[];
  worldX?: number;
  worldZ?: number;
  topology_type?: "linear" | "nature_open" | "city_grid" | "hub_spoke" | string;
  visual_palette?: RoomVisualPalette;
}

export interface NPCAgent {
  npc_id: string;
  name: string;
  room_id: string;
  persona_description: string;
  thought_log: string[];
  active_plan?: string;
  inventory: string[];
  hp: number;
  position?: SphericalCoord;
}

export interface QuestObjective {
  quest_id: string;
  title: string;
  is_completed: boolean;
  trigger_flag: string;
}

export interface TelemetryMetadata {
  provider: "nemotron_70b" | "gemini_flash" | "offline_mock";
  latency_ms: number;
  fallback_occurred: boolean;
  fallback_reason?: string;
}

export interface SubtitleCue {
  npcId: string;
  speaker: string;
  persona: string;
  text: string;
  thoughtLog?: string;
  timestamp: string;
}

export interface SavedWorldEntry {
  world_id: string;
  title: string;
  prompt: string;
  biome_hint: string;
  created_at: string;
  world_data: any;
}

export interface AdaptiveTheme {
  id: "desert" | "classical" | "forest" | "space" | "metropolis";
  label: string;
  panelBg: string;
  panelBorder: string;
  accentColor: string;
  accentText: string;
  mutedText: string;
  buttonBg: string;
  buttonText: string;
}

export function resolveAdaptiveTheme(
  biome?: string,
  roomName?: string,
  worldTitle?: string
): AdaptiveTheme {
  const specific = `${roomName || ""} ${worldTitle || ""}`.toLowerCase();
  const text = `${specific} ${biome || ""}`.toLowerCase();

  if (
    specific.includes("space") ||
    specific.includes("station") ||
    specific.includes("orbital") ||
    specific.includes("spire") ||
    specific.includes("cosmos") ||
    specific.includes("observatory")
  ) {
    return {
      id: "space",
      label: "Celestial Alabaster & Astrolabe Silver",
      panelBg: "rgba(13, 18, 30, 0.90)",
      panelBorder: "#93c5fd",
      accentColor: "#93c5fd",
      accentText: "#e0f2fe",
      mutedText: "#cbd5e1",
      buttonBg: "#2563eb",
      buttonText: "#f8fafc",
    };
  }

  if (
    specific.includes("forest") ||
    specific.includes("garden") ||
    specific.includes("babylon") ||
    specific.includes("jungle") ||
    specific.includes("grove") ||
    specific.includes("cavern") ||
    specific.includes("atlantis")
  ) {
    return {
      id: "forest",
      label: "Botanical Jade & Sylvan Gold",
      panelBg: "rgba(11, 24, 16, 0.90)",
      panelBorder: "#65a30d",
      accentColor: "#a3e635",
      accentText: "#ecfccb",
      mutedText: "#b7d5c4",
      buttonBg: "#3f6212",
      buttonText: "#f7fee7",
    };
  }

  if (
    specific.includes("tavern") ||
    specific.includes("medieval") ||
    specific.includes("roman") ||
    specific.includes("rome") ||
    specific.includes("colosseum") ||
    specific.includes("pantheon") ||
    specific.includes("athens") ||
    specific.includes("acropolis") ||
    specific.includes("parthenon") ||
    specific.includes("castle") ||
    specific.includes("temple") ||
    specific.includes("guild")
  ) {
    return {
      id: "classical",
      label: "Classical Vellum & Imperial Bronze",
      panelBg: "rgba(24, 15, 12, 0.90)",
      panelBorder: "#c87d32",
      accentColor: "#d99b52",
      accentText: "#f5ebd6",
      mutedText: "#cbb69d",
      buttonBg: "#9a4b26",
      buttonText: "#fdf6e2",
    };
  }

  if (
    specific.includes("giza") ||
    specific.includes("pyramid") ||
    specific.includes("egypt") ||
    specific.includes("sphinx") ||
    specific.includes("sand") ||
    specific.includes("pharaoh")
  ) {
    return {
      id: "desert",
      label: "Egyptian Sandstone & Solar Gold",
      panelBg: "rgba(26, 18, 10, 0.90)",
      panelBorder: "#d4af37",
      accentColor: "#d4af37",
      accentText: "#fde68a",
      mutedText: "#d6c3a5",
      buttonBg: "#b48327",
      buttonText: "#140e07",
    };
  }

  if (text.includes("space")) {
    return {
      id: "space",
      label: "Celestial Alabaster & Astrolabe Silver",
      panelBg: "rgba(13, 18, 30, 0.90)",
      panelBorder: "#93c5fd",
      accentColor: "#93c5fd",
      accentText: "#e0f2fe",
      mutedText: "#cbd5e1",
      buttonBg: "#2563eb",
      buttonText: "#f8fafc",
    };
  }

  if (text.includes("forest")) {
    return {
      id: "forest",
      label: "Botanical Jade & Sylvan Gold",
      panelBg: "rgba(11, 24, 16, 0.90)",
      panelBorder: "#65a30d",
      accentColor: "#a3e635",
      accentText: "#ecfccb",
      mutedText: "#b7d5c4",
      buttonBg: "#3f6212",
      buttonText: "#f7fee7",
    };
  }

  if (text.includes("tavern") || text.includes("medieval")) {
    return {
      id: "classical",
      label: "Classical Vellum & Imperial Bronze",
      panelBg: "rgba(24, 15, 12, 0.90)",
      panelBorder: "#c87d32",
      accentColor: "#d99b52",
      accentText: "#f5ebd6",
      mutedText: "#cbb69d",
      buttonBg: "#9a4b26",
      buttonText: "#fdf6e2",
    };
  }

  if (text.includes("desert") || text.includes("oasis")) {
    return {
      id: "desert",
      label: "Egyptian Sandstone & Solar Gold",
      panelBg: "rgba(26, 18, 10, 0.90)",
      panelBorder: "#d4af37",
      accentColor: "#d4af37",
      accentText: "#fde68a",
      mutedText: "#d6c3a5",
      buttonBg: "#b48327",
      buttonText: "#140e07",
    };
  }

  return {
    id: "metropolis",
    label: "Architectural Brass & Obsidian Slate",
    panelBg: "rgba(16, 18, 26, 0.90)",
    panelBorder: "#ca8a04",
    accentColor: "#eab308",
    accentText: "#fef08a",
    mutedText: "#cbd5e1",
    buttonBg: "#a16207",
    buttonText: "#fefce8",
  };
}

const ARCHIVE_STORAGE_KEY = "mira_world_archives_v12_photoreal_raw";

export const BUILTIN_ARCHIVES: SavedWorldEntry[] = [
  {
    world_id: "archive_continuous_noise",
    title: "Continuous Latent Expanse",
    prompt: "Continuous multi-dimensional procedural noise chamber with iridescent quantum interference fields and harmonic manifolds",
    biome_hint: "continuous_noise",
    created_at: "Procedural Manifold",
    world_data: {
      world_id: "archive_continuous_noise",
      title: "Continuous Latent Expanse",
      initial_room_id: "noise_origin",
      rooms: [
        {
          room_id: "noise_origin",
          name: "Continuous Noise Chamber",
          biome_type: "continuous_noise",
          worldX: 0,
          worldZ: 0,
          panorama_url: "/generated_worlds/archive_continuous_noise/noise_origin_panorama.webp?room=Continuous%20Noise%20Chamber&prompt=Continuous%20Latent%20Expanse&biome=continuous_noise&x=0&z=0&idx=0&sky=%23090514&floor=%231e1b4b",
          depth_url: "/generated_worlds/archive_continuous_noise/noise_origin_depth.png",
          adjacent_room_ids: ["noise_north", "noise_east", "noise_south", "noise_west"],
          mutation_level: 0.25,
          visual_palette: {
            sky_tone: "#090514",
            floor_tone: "#1e1b4b",
            dominant_color: "#38bdf8",
            accent_color: "#a855f7",
          },
          npcs: [
            {
              npc_id: "npc_aethel",
              name: "Aethel, Quantum Chronicler",
              room_id: "noise_origin",
              persona_description: "Observer of the continuous procedural manifold and keeper of multi-dimensional latent harmonics.",
              thought_log: [
                "[MEMORY] The continuous noise waves propagate across the 4-way coordinate axes.",
                "[REFLECTION] An explorer arrives at the origin of the procedural manifold.",
                "[PLANNING] Reveal how expanding outward morphs the noise field into new harmonic domains.",
                "[ACTION] Welcome traveler to the Continuous Noise Chamber.",
              ],
              inventory: ["quantum_prism", "latent_vector_key"],
              hp: 100,
              position: { r: 500, theta: -0.22, phi: 1.65 },
            },
          ],
        },
        {
          room_id: "noise_north",
          name: "Quantum Interference Spire — North",
          biome_type: "continuous_noise",
          worldX: 0,
          worldZ: -220,
          panorama_url: "/generated_worlds/archive_continuous_noise/noise_north_panorama.webp?room=Quantum%20Interference%20Spire&prompt=Continuous%20Latent%20Expanse&from=Continuous%20Noise%20Chamber&dir=north&biome=continuous_noise&x=0&z=-220&idx=1&sky=%230284c7&floor=%23090514",
          depth_url: "/generated_worlds/archive_continuous_noise/noise_north_depth.png",
          adjacent_room_ids: ["noise_origin"],
          mutation_level: 0.25,
          visual_palette: {
            sky_tone: "#0284c7",
            floor_tone: "#090514",
            dominant_color: "#06b6d4",
            accent_color: "#38bdf8",
          },
          npcs: [],
        },
        {
          room_id: "noise_east",
          name: "Harmonic Resonance Terrace — East",
          biome_type: "continuous_noise",
          worldX: 220,
          worldZ: 0,
          panorama_url: "/generated_worlds/archive_continuous_noise/noise_east_panorama.webp?room=Harmonic%20Resonance%20Terrace&prompt=Continuous%20Latent%20Expanse&from=Continuous%20Noise%20Chamber&dir=east&biome=continuous_noise&x=220&z=0&idx=2&sky=%23a855f7&floor=%231e1b4b",
          depth_url: "/generated_worlds/archive_continuous_noise/noise_east_depth.png",
          adjacent_room_ids: ["noise_origin"],
          mutation_level: 0.25,
          visual_palette: {
            sky_tone: "#a855f7",
            floor_tone: "#1e1b4b",
            dominant_color: "#c084fc",
            accent_color: "#f43f5e",
          },
          npcs: [],
        },
        {
          room_id: "noise_south",
          name: "Sub-Dimensional Flux Basin — South",
          biome_type: "continuous_noise",
          worldX: 0,
          worldZ: 220,
          panorama_url: "/generated_worlds/archive_continuous_noise/noise_south_panorama.webp?room=Sub-Dimensional%20Flux%20Basin&prompt=Continuous%20Latent%20Expanse&from=Continuous%20Noise%20Chamber&dir=south&biome=continuous_noise&x=0&z=220&idx=3&sky=%2310b981&floor=%23064e3b",
          depth_url: "/generated_worlds/archive_continuous_noise/noise_south_depth.png",
          adjacent_room_ids: ["noise_origin"],
          mutation_level: 0.25,
          visual_palette: {
            sky_tone: "#10b981",
            floor_tone: "#064e3b",
            dominant_color: "#34d399",
            accent_color: "#facc15",
          },
          npcs: [],
        },
        {
          room_id: "noise_west",
          name: "Perlin Domain Warp Ridge — West",
          biome_type: "continuous_noise",
          worldX: -220,
          worldZ: 0,
          panorama_url: "/generated_worlds/archive_continuous_noise/noise_west_panorama.webp?room=Perlin%20Domain%20Warp%20Ridge&prompt=Continuous%20Latent%20Expanse&from=Continuous%20Noise%20Chamber&dir=west&biome=continuous_noise&x=-220&z=0&idx=4&sky=%23f59e0b&floor=%23451a03",
          depth_url: "/generated_worlds/archive_continuous_noise/noise_west_depth.png",
          adjacent_room_ids: ["noise_origin"],
          mutation_level: 0.25,
          visual_palette: {
            sky_tone: "#f59e0b",
            floor_tone: "#451a03",
            dominant_color: "#fbbf24",
            accent_color: "#38bdf8",
          },
          npcs: [],
        },
      ],
      quests: [
        {
          quest_id: "quest_noise_01",
          title: "Harmonize the Continuous Noise Manifold",
          description: "Traverse the 4-way cardinal gateways to explore continuous procedural morphing across the latent field.",
          completed: false,
          trigger_flag: "explored_noise_origin",
        },
      ],
    },
  },
  {
    world_id: "archive_giza_necropolis",
    title: "The Necropolis of Giza",
    prompt: "The Great Pyramids of Giza at golden hour with the Sphinx causeway and Old Kingdom temples",
    biome_hint: "desert_oasis",
    created_at: "Old Kingdom, IV Dynasty",
    world_data: {
      world_id: "archive_giza_necropolis",
      title: "The Necropolis of Giza",
      initial_room_id: "giza_forecourt",
      rooms: [
        {
          room_id: "giza_forecourt",
          name: "Great Pyramid Forecourt",
          biome_type: "desert_oasis",
          worldX: 0,
          worldZ: 0,
          panorama_url: "/generated_worlds/archive_giza_necropolis/giza_forecourt_panorama.webp",
          depth_url: "/generated_worlds/archive_giza_necropolis/giza_forecourt_depth.png",
          adjacent_room_ids: ["sphinx_causeway", "khufu_gallery", "solar_barque"],
          mutation_level: 0.0,
          npcs: [
            {
              npc_id: "npc_khaemwaset",
              name: "Khaemwaset, Royal Architect",
              room_id: "giza_forecourt",
              persona_description: "Chief Overseer of Royal Works, keeper of the sacred cubit and solar alignments of Khufu's horizon.",
              thought_log: [
                "[MEMORY] The casing stones of Tura limestone reflect the meridian sun across the plateau.",
                "[REFLECTION] A traveler approaches the northern entrance of the Great Pyramid.",
                "[PLANNING] Expound upon the sacred geometry and guide them toward the Sphinx Sanctuary.",
                "[ACTION] Welcome the traveler in the name of Ra.",
              ],
              inventory: ["royal_cubit_rod", "papyrus_plan_of_khufu"],
              hp: 100,
              position: { r: 500, theta: -0.22, phi: 1.65 },
            },
          ],
        },
        {
          room_id: "sphinx_causeway",
          name: "Sanctuary of the Great Sphinx",
          biome_type: "desert_oasis",
          worldX: 220,
          worldZ: 0,
          panorama_url: "/generated_worlds/archive_giza_necropolis/sphinx_causeway_panorama.webp",
          depth_url: "/generated_worlds/archive_giza_necropolis/sphinx_causeway_depth.png",
          adjacent_room_ids: ["giza_forecourt"],
          mutation_level: 0.0,
          npcs: [
            {
              npc_id: "npc_neferu",
              name: "Neferu, High Priestess",
              room_id: "sphinx_causeway",
              persona_description: "Interpreter of the Dream Stela resting between the paws of Horemakhet.",
              thought_log: [
                "[MEMORY] The Dream Stela records the covenant of the sun god upon the limestone monolith.",
                "[REFLECTION] The visitor seeks the riddle of the eastern horizon.",
                "[PLANNING] Recite the inscription of the Sphinx.",
                "[ACTION] Gesture toward the altar between the lion paws.",
              ],
              inventory: ["dream_stela_rubbing", "lapis_amulet"],
              hp: 100,
              position: { r: 500, theta: 0.18, phi: 1.65 },
            },
          ],
        },
        {
          room_id: "khufu_gallery",
          name: "Grand Gallery of Khufu",
          biome_type: "desert_oasis",
          worldX: 0,
          worldZ: -220,
          panorama_url: "/generated_worlds/archive_giza_necropolis/khufu_gallery_panorama.webp",
          depth_url: "/generated_worlds/archive_giza_necropolis/khufu_gallery_depth.png",
          adjacent_room_ids: ["giza_forecourt"],
          mutation_level: 0.0,
          npcs: [
            {
              npc_id: "npc_imhotep_scribe",
              name: "Scribe Merer",
              room_id: "khufu_gallery",
              persona_description: "Inspector of the Wadi al-Jarf papyri documenting the transport of fine limestone along the Nile.",
              thought_log: [
                "[MEMORY] Forty boatloads of Tura limestone arrived before the inundation subsided.",
                "[REFLECTION] The traveler examines the corbelled granite vault.",
                "[PLANNING] Share the logbook of the pyramid builders.",
                "[ACTION] Unroll the papyrus ledger.",
              ],
              inventory: ["logbook_of_merer", "reed_pen"],
              hp: 100,
              position: { r: 500, theta: -0.15, phi: 1.65 },
            },
          ],
        },
        {
          room_id: "solar_barque",
          name: "Court of the Solar Barque",
          biome_type: "desert_oasis",
          worldX: 0,
          worldZ: 220,
          panorama_url: "/generated_worlds/archive_giza_necropolis/solar_barque_panorama.webp",
          depth_url: "/generated_worlds/archive_giza_necropolis/solar_barque_depth.png",
          adjacent_room_ids: ["giza_forecourt"],
          mutation_level: 0.0,
          npcs: [
            {
              npc_id: "npc_menkaure_nav",
              name: "Navigator Seneb",
              room_id: "solar_barque",
              persona_description: "Master shipwright of the cedarwood vessel bound for the Imperishable Stars.",
              thought_log: [
                "[MEMORY] Twelve hundred planks of Lebanon cedar were stitched without a single iron nail.",
                "[REFLECTION] The traveler admires the celestial oars.",
                "[PLANNING] Explain the voyage across the Duat.",
                "[ACTION] Bow respectfully.",
              ],
              inventory: ["cedar_compass", "star_chart_of_orion"],
              hp: 100,
              position: { r: 500, theta: 0.22, phi: 1.65 },
            },
          ],
        },
      ],
      quests: [
        {
          quest_id: "q_giza_1",
          title: "Converse with Khaemwaset in the Great Pyramid Forecourt",
          is_completed: false,
          trigger_flag: "met_architect",
        },
      ],
    },
  },
  {
    world_id: "archive_imperial_rome",
    title: "Imperial Forum of Rome",
    prompt: "Sunlit Roman Forum, Colosseum travertine arcades, and the Rotunda of the Pantheon",
    biome_hint: "medieval_tavern",
    created_at: "Anno Urbis Conditae DCCCXXX",
    world_data: {
      world_id: "archive_imperial_rome",
      title: "Imperial Forum of Rome",
      initial_room_id: "rome_forum",
      rooms: [
        {
          room_id: "rome_forum",
          name: "Via Sacra & Roman Forum",
          biome_type: "medieval_tavern",
          panorama_url: "/generated_worlds/archive_imperial_rome/rome_forum_panorama.webp?v=jopano",
          depth_url: "/generated_worlds/archive_imperial_rome/rome_forum_depth.png?v=jopano",
          adjacent_room_ids: ["rome_pantheon", "rome_colosseum"],
          mutation_level: 0.0,
          npcs: [
            {
              npc_id: "npc_vitruvius",
              name: "Marcus Vitruvius Pollio",
              room_id: "rome_forum",
              persona_description: "Author of De Architectura, defender of firmitas, utilitas, and venustas.",
              thought_log: [
                "[MEMORY] Architecture depends upon Order, Arrangement, Eurhythmy, Symmetry, Propriety, and Economy.",
                "[REFLECTION] A scholar walks along the Via Sacra.",
                "[PLANNING] Discuss the proportions of the Corinthian colonnade.",
                "[ACTION] Extend a scroll of architectural elevations.",
              ],
              inventory: ["ten_books_on_architecture", "bronze_calipers"],
              hp: 100,
              position: { r: 500, theta: -0.2, phi: 1.65 },
            },
          ],
        },
        {
          room_id: "rome_pantheon",
          name: "Rotunda of the Pantheon",
          biome_type: "medieval_tavern",
          panorama_url: "/generated_worlds/archive_imperial_rome/rome_basilica_panorama.webp?v=jopano",
          depth_url: "/generated_worlds/archive_imperial_rome/rome_basilica_depth.png?v=jopano",
          adjacent_room_ids: ["rome_forum", "rome_colosseum"],
          mutation_level: 0.0,
          npcs: [
            {
              npc_id: "npc_apollodorus",
              name: "Apollodorus of Damascus",
              room_id: "rome_pantheon",
              persona_description: "Imperial engineer who spanned the unreinforced coffered dome.",
              thought_log: [
                "[MEMORY] Pumice aggregate lightens the upper crown around the twenty-seven-foot oculus.",
                "[REFLECTION] The sunbeam illuminates the porphyry floor tiles.",
                "[PLANNING] Point out the spherical geometry of the interior.",
                "[ACTION] Look upward toward the oculus.",
              ],
              inventory: ["dome_centering_plan"],
              hp: 100,
              position: { r: 500, theta: 0.15, phi: 1.65 },
            },
          ],
        },
        {
          room_id: "rome_colosseum",
          name: "Flavian Amphitheater Colonnade",
          biome_type: "medieval_tavern",
          panorama_url: "/generated_worlds/archive_imperial_rome/rome_tabularium_panorama.webp?v=jopano",
          depth_url: "/generated_worlds/archive_imperial_rome/rome_tabularium_depth.png?v=jopano",
          adjacent_room_ids: ["rome_forum", "rome_pantheon"],
          mutation_level: 0.0,
          npcs: [
            {
              npc_id: "npc_senator_valeria",
              name: "Senator Valeria Maxima",
              room_id: "rome_colosseum",
              persona_description: "Patron of the civic basilicas and curator of the imperial aqueducts.",
              thought_log: [
                "[MEMORY] Eighty travertine arches channel fifty thousand citizens without congestion.",
                "[REFLECTION] The visitor studies the Doric, Ionic, and Corinthian tiers.",
                "[PLANNING] Welcome them to the Flavian promenade.",
                "[ACTION] Speak with senatorial poise.",
              ],
              inventory: ["senatorial_decree"],
              hp: 100,
              position: { r: 500, theta: -0.18, phi: 1.65 },
            },
          ],
        },
      ],
      quests: [],
    },
  },
  {
    world_id: "archive_sylvan_gardens",
    title: "Hanging Gardens of Babylon",
    prompt: "Sunlit terraced botanical sanctuary with marble aqueducts, waterfalls, and cedar pavilions",
    biome_hint: "enchanted_forest",
    created_at: "Sixth Century BCE",
    world_data: {
      world_id: "archive_sylvan_gardens",
      title: "Hanging Gardens of Babylon",
      initial_room_id: "babylon_terrace",
      rooms: [
        {
          room_id: "babylon_terrace",
          name: "Upper Cedar Terrace",
          biome_type: "enchanted_forest",
          panorama_url: "/generated_worlds/archive_sylvan_gardens/sylvan_glade_panorama.webp?v=jopano",
          depth_url: "/generated_worlds/archive_sylvan_gardens/sylvan_glade_depth.png?v=jopano",
          adjacent_room_ids: ["babylon_aqueduct"],
          mutation_level: 0.0,
          npcs: [
            {
              npc_id: "npc_amytis",
              name: "Queen Amytis of Media",
              room_id: "babylon_terrace",
              persona_description: "Founder of the terraced mountain gardens above the Euphrates plain.",
              thought_log: [
                "[MEMORY] Archimedes screws raise water from the Euphrates to the highest stone vaults.",
                "[REFLECTION] A guest walks beneath the pomegranate and cedar arbors.",
                "[PLANNING] Share the botanical marvels of the terrace.",
                "[ACTION] Offer a greeting beneath the sunlit colonnade.",
              ],
              inventory: ["cedar_blossom"],
              hp: 100,
              position: { r: 500, theta: -0.2, phi: 1.65 },
            },
          ],
        },
        {
          room_id: "babylon_aqueduct",
          name: "Ishtar Water Pavilion",
          biome_type: "enchanted_forest",
          panorama_url: "/generated_worlds/archive_sylvan_gardens/sylvan_bridge_panorama.webp?v=jopano",
          depth_url: "/generated_worlds/archive_sylvan_gardens/sylvan_bridge_depth.png?v=jopano",
          adjacent_room_ids: ["babylon_terrace"],
          mutation_level: 0.0,
          npcs: [
            {
              npc_id: "npc_nabonidus",
              name: "Chronicler Berossus",
              room_id: "babylon_aqueduct",
              persona_description: "Astronomer-priest of Marduk and historian of the Chaldean dynasties.",
              thought_log: [
                "[MEMORY] Glazed lapis bricks line the processional waterway.",
                "[REFLECTION] The traveler observes the hydraulic channels.",
                "[PLANNING] Converse on Babylonian astronomy and engineering.",
                "[ACTION] Gesture to the water clock.",
              ],
              inventory: ["cuneiform_cylinder"],
              hp: 100,
              position: { r: 500, theta: 0.2, phi: 1.65 },
            },
          ],
        },
      ],
      quests: [],
    },
  },
];

export function inferTopologyType(text?: string): "linear" | "nature_open" | "city_grid" | "hub_spoke" {
  const t = (text || "").toLowerCase();
  if (
    t.includes("subway") ||
    t.includes("metro") ||
    t.includes("train") ||
    t.includes("carriage") ||
    t.includes("plane") ||
    t.includes("airplane") ||
    t.includes("flight") ||
    t.includes("cabin") ||
    t.includes("tunnel") ||
    t.includes("corridor") ||
    t.includes("hallway")
  ) {
    return "linear";
  }
  // nature environments: no limits, always give all 4 directions!
  if (
    t.includes("everest") ||
    t.includes("mountain") ||
    t.includes("himalaya") ||
    t.includes("peak") ||
    t.includes("summit") ||
    t.includes("trail") ||
    t.includes("hike") ||
    t.includes("canyon") ||
    t.includes("gorge") ||
    t.includes("glacier") ||
    t.includes("wilderness") ||
    t.includes("forest") ||
    t.includes("jungle") ||
    t.includes("garden") ||
    t.includes("grove") ||
    t.includes("desert") ||
    t.includes("oasis") ||
    t.includes("dune") ||
    t.includes("giza") ||
    t.includes("pyramid") ||
    t.includes("sphinx") ||
    t.includes("nature") ||
    t.includes("ocean") ||
    t.includes("planet")
  ) {
    return "nature_open";
  }
  if (
    t.includes("city") ||
    t.includes("downtown") ||
    t.includes("seattle") ||
    t.includes("street") ||
    t.includes("avenue") ||
    t.includes("boulevard") ||
    t.includes("district") ||
    t.includes("metropolis") ||
    t.includes("urban")
  ) {
    return "city_grid";
  }
  return "hub_spoke";
}

export function inferRoomVisualPalette(roomName?: string, worldTitle?: string, biome?: string): RoomVisualPalette {
  const combined = `${roomName || ""} ${worldTitle || ""} ${biome || ""}`.toLowerCase();
  if (combined.includes("subway") || combined.includes("metro") || combined.includes("train") || combined.includes("carriage")) {
    return {
      dominant_color: "#475569",
      accent_color: "#f59e0b",
      sky_tone: "#334155",
      floor_tone: "#0f172a",
    };
  }
  if (combined.includes("plane") || combined.includes("airplane") || combined.includes("flight") || combined.includes("cabin")) {
    return {
      dominant_color: "#3b82f6",
      accent_color: "#60a5fa",
      sky_tone: "#1e3a8a",
      floor_tone: "#1e293b",
    };
  }
  if (combined.includes("seattle") || combined.includes("pier") || combined.includes("sound") || combined.includes("waterfront")) {
    return {
      dominant_color: "#0f766e",
      accent_color: "#22d3ee",
      sky_tone: "#1e293b",
      floor_tone: "#0f172a",
    };
  }
  if (combined.includes("city") || combined.includes("metropolis") || combined.includes("cyber") || combined.includes("tokyo")) {
    return {
      dominant_color: "#7c3aed",
      accent_color: "#06b6d4",
      sky_tone: "#0f172a",
      floor_tone: "#18181b",
    };
  }
  if (combined.includes("everest") || combined.includes("glacier") || combined.includes("icefall") || combined.includes("himalaya")) {
    return {
      dominant_color: "#0284c7",
      accent_color: "#e0f2fe",
      sky_tone: "#38bdf8",
      floor_tone: "#0c4a6e",
    };
  }
  if (combined.includes("giza") || combined.includes("pyramid") || combined.includes("sphinx") || combined.includes("desert") || combined.includes("oasis")) {
    return {
      dominant_color: "#d97706",
      accent_color: "#fbbf24",
      sky_tone: "#fed7aa",
      floor_tone: "#78350f",
    };
  }
  if (combined.includes("rome") || combined.includes("colosseum") || combined.includes("forum") || combined.includes("pantheon")) {
    return {
      dominant_color: "#b45309",
      accent_color: "#f59e0b",
      sky_tone: "#fef3c7",
      floor_tone: "#451a03",
    };
  }
  if (combined.includes("babylon") || combined.includes("garden") || combined.includes("forest") || combined.includes("sylvan")) {
    return {
      dominant_color: "#059669",
      accent_color: "#34d399",
      sky_tone: "#134e4a",
      floor_tone: "#064e3b",
    };
  }
  if (combined.includes("neptune") || combined.includes("methane") || combined.includes("space") || combined.includes("station") || combined.includes("astrolabe")) {
    return {
      dominant_color: "#0284c7",
      accent_color: "#38bdf8",
      sky_tone: "#0f172a",
      floor_tone: "#082f49",
    };
  }
  return {
    dominant_color: "#ca8a04",
    accent_color: "#fde047",
    sky_tone: "#1e293b",
    floor_tone: "#0f172a",
  };
}

export function generateThematicRoomName(
  worldTitle: string,
  biome: string | undefined,
  dir: string,
  x: number,
  z: number
): string {
  const t = `${worldTitle} ${biome || ""}`.toLowerCase();
  const dirLabel = dir.charAt(0).toUpperCase() + dir.slice(1);

  if (
    t.includes("noise") ||
    t.includes("latent") ||
    t.includes("quantum") ||
    t.includes("procedural") ||
    t.includes("manifold")
  ) {
    const ring = Math.max(1, Math.round(Math.hypot(x, z) / 220));
    const names: Record<string, string[]> = {
      north: ["Quantum Interference Spire", "Phase Coherence Zenith", "Spectral Flux Column", "Superposition Pinnacle"],
      south: ["Sub-Dimensional Flux Basin", "Entanglement Nexus", "Wavefunction Collapse Terrace", "Harmonic Interference Hollow"],
      east: ["Harmonic Resonance Promenade", "Frequency Domain Vista", "Eigenstate Corridor", "Phase-Locked Loop Arcade"],
      west: ["Perlin Domain Warp Ridge", "Fractal Horizon Crest", "Cellular Voronoi Bluff", "Continuous Gradient Canyon"],
    };
    const list = names[dir] || names.north;
    const idx = Math.abs(Math.round((x * 3 + z * 7) / 220)) % list.length;
    const ringSuffix = ring > 1 ? ` — Sector ${ring}` : "";
    return `${list[idx]}${ringSuffix}`;
  }

  if (
    t.includes("everest") ||
    t.includes("himalaya") ||
    t.includes("mountain") ||
    t.includes("glacier") ||
    t.includes("icefall")
  ) {
    const names: Record<string, string[]> = {
      north: ["North Col High Seracs", "Rongbuk Glacier Crest", "Nuptse Face Overlook", "Lhotse Couloir Route"],
      south: ["South Col Razor Ridge", "Western Cwm Glacial Basin", "Khumbu Icefall Traverse", "Hillary Step Crest"],
      east: ["Kangshung Glacier Wall", "East Cirque Serac Field", "Chomo Lonzo Overlook", "Makalu Ridge Vista"],
      west: ["West Rongbuk Basin", "Pumori Shoulder Vista", "Tibetan Plateau Threshold", "Lingtren Ice Cliff"],
    };
    const list = names[dir] || names.north;
    const idx = Math.abs(Math.round((x * 3 + z * 7) / 220)) % list.length;
    return list[idx];
  }

  if (
    t.includes("times square") ||
    t.includes("manhattan") ||
    t.includes("city") ||
    t.includes("metropolis") ||
    t.includes("broadway") ||
    t.includes("street") ||
    t.includes("avenue") ||
    t.includes("square") ||
    t.includes("urban") ||
    t.includes("downtown") ||
    t.includes("york")
  ) {
    const ring = Math.max(1, Math.round(Math.hypot(x, z) / 220));
    const ringSuffix = ring > 1 ? ` — Sector ${ring}` : "";
    const names: Record<string, string[]> = {
      north: ["Broadway Apex Plaza", "Duffy Square Red Steps", "47th Street Neon Crossing", "Marquis Center Esplanade"],
      south: ["Seventh Avenue South Hub", "42nd Street Theater Way", "Times Square Subway Mezzanine", "One Times Square Forecourt"],
      east: ["Sixth Avenue Promenade", "Rockefeller Plaza Corridor", "Midtown Neon Arcade", "Avenue of the Americas Crossing"],
      west: ["Eighth Avenue Theater District", "Hell's Kitchen Broadway Way", "Shubert Alley Promenade", "Broadway Stage Threshold"],
    };
    const list = names[dir] || names.north;
    const idx = Math.abs(Math.round((x * 3 + z * 7) / 220)) % list.length;
    return `${list[idx]}${ringSuffix}`;
  }

  const titleLower = worldTitle.toLowerCase();
  if (
    titleLower.includes("giza") ||
    titleLower.includes("pyramid") ||
    titleLower.includes("sphinx") ||
    titleLower.includes("pharaoh") ||
    titleLower.includes("egypt")
  ) {
    const ring = Math.max(1, Math.round(Math.hypot(x, z) / 220));
    const tierSuffix = ring > 1 ? ` — Sector ${ring}` : "";
    const names: Record<string, string[]> = {
      north: [
        `Grand Hypostyle Hall${tierSuffix}`,
        `Northern Pyramid Enclosure${tierSuffix}`,
        `Royal Sphinxtown Promenade${tierSuffix}`,
        `Limestone Pavement of Khufu${tierSuffix}`,
        `Khafre Pinnacle Vista${tierSuffix}`,
        `Upper Necropolis Citadel${tierSuffix}`,
      ],
      south: [
        `Verdant Date Palm Oasis${tierSuffix}`,
        `Sacred Alabaster Water Terraces${tierSuffix}`,
        `Southern Solar Barque Court${tierSuffix}`,
        `Turquoise Lotus Spring${tierSuffix}`,
        `Valley Temple Porphyry Court${tierSuffix}`,
        `Sakkara Vista Promenade${tierSuffix}`,
      ],
      east: [
        `Nile Canal Reflection Promenade${tierSuffix}`,
        `Sanctuary of the Great Sphinx${tierSuffix}`,
        `Eastern Basalt Quay${tierSuffix}`,
        `Royal Harbor Landing${tierSuffix}`,
        `Colonnade of Hathor${tierSuffix}`,
        `Papyrus Delta Shore${tierSuffix}`,
      ],
      west: [
        `Western Mastaba Terrace${tierSuffix}`,
        `Wind-Carved Basalt Gorge${tierSuffix}`,
        `Giza Plateau Sandcrest${tierSuffix}`,
        `Royal Offering Chapel${tierSuffix}`,
        `Sandstone Obelisk Pass${tierSuffix}`,
        `Dune Sea Overlook${tierSuffix}`,
      ],
    };
    const list = names[dir] || names.north;
    const idx = Math.abs(Math.round((x * 3 + z * 7) / 220)) % list.length;
    return list[idx];
  }

  if (
    t.includes("seattle") ||
    t.includes("emerald") ||
    t.includes("sound") ||
    t.includes("waterfront")
  ) {
    const names: Record<string, string[]> = {
      north: ["Pike Place Waterfront Arcade", "Belltown Promenade", "Seattle Center Monorail Way"],
      south: ["Pioneer Square Pergola Promenade", "Occidental Park Brick Crossing", "King Street Transit Hall"],
      east: ["Westlake Transit Mall", "Capitol Hill Pine Corridor", "Convention Center Archway"],
      west: ["Elliott Bay Pier Promenade", "Alaskan Way Cedar Boardwalk", "Puget Sound Ferry Slip"],
    };
    const list = names[dir] || names.north;
    const idx = Math.abs(Math.round((x * 3 + z * 7) / 220)) % list.length;
    return list[idx];
  }

  if (t.includes("subway") || t.includes("train") || t.includes("metro")) {
    const carNum = Math.abs(Math.round(z / 220)) + 1;
    if (dir === "forward") return `Carriage ${carNum}: Forward Passenger Coach`;
    return `Carriage ${carNum}: Rear Observation Car`;
  }

  if (t.includes("plane") || t.includes("airplane") || t.includes("flight")) {
    const secNum = Math.abs(Math.round(z / 220)) + 1;
    if (dir === "forward") return `Section ${secNum}: Forward Avionics Deck`;
    return `Section ${secNum}: Aft Cabin Lounge`;
  }

  if (
    t.includes("space") ||
    t.includes("orbital") ||
    t.includes("observatory") ||
    t.includes("station")
  ) {
    const names: Record<string, string[]> = {
      north: ["Zenith Astrolabe Array", "Meridian Telescope Deck", "Polar Telemetry Spire"],
      south: ["Nadir Earth-Viewing Cupola", "Southern Planetary Sensor Array", "Orbital Docking Corridor"],
      east: ["Apogee Botanical Atrium", "Solar Array Gantry", "Starlight Observation Ring"],
      west: ["Perigee Navigation Center", "Deep Space Telemetry Hub", "Celestial Archive Vault"],
    };
    const list = names[dir] || names.north;
    const idx = Math.abs(Math.round((x * 3 + z * 7) / 220)) % list.length;
    return list[idx];
  }

  if (
    t.includes("rome") ||
    t.includes("colosseum") ||
    t.includes("forum") ||
    t.includes("pantheon")
  ) {
    const names: Record<string, string[]> = {
      north: ["Via Sacra Processional", "Senate Curia Steps", "Temple of Mars Ultor"],
      south: ["Palatine Terraced Gardens", "Circus Maximus Overlook", "Imperial Domus Vestibule"],
      east: ["Colosseum Arena Floor", "Arch of Constantine Plaza", "Ludus Magnus Colonnade"],
      west: ["Pantheon Oculus Rotunda", "Forum Boarium Promenade", "Capitoline Hill Crest"],
    };
    const list = names[dir] || names.north;
    const idx = Math.abs(Math.round((x * 3 + z * 7) / 220)) % list.length;
    return list[idx];
  }

  if (
    t.includes("forest") ||
    t.includes("garden") ||
    t.includes("sylvan") ||
    t.includes("babylon")
  ) {
    const names: Record<string, string[]> = {
      north: ["Upper Cedar Canopy", "Moonlit Waterfall Grotto", "Sylvan Grove Overlook"],
      south: ["Sunken Fern Hollow", "River Euphrates Promenade", "Ancient Moss Glade"],
      east: ["Ishtar Water Pavilion", "Pomegranate Peristyle Arbor", "Emerald Bamboo Terrace"],
      west: ["Hanging Balustrade Vista", "Sacred Spring Basin", "Twilight Lotus Pond"],
    };
    const list = names[dir] || names.north;
    const idx = Math.abs(Math.round((x * 3 + z * 7) / 220)) % list.length;
    return list[idx];
  }

  const baseTitle = worldTitle.split("—")[0].trim();
  const words = baseTitle.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 2);
  const subject = words.slice(0, 3).join(" ") || baseTitle;
  const ring = Math.max(1, Math.round(Math.hypot(x, z) / 220));
  const ringSuffix = ring > 1 ? ` — Sector ${ring}` : "";
  const dirSuffixes: Record<string, string[]> = {
    north: ["Zenith Vista", "Northern Sector", "High Crossing", "Observation Deck"],
    south: ["Southern Basin", "Valley Threshold", "South Promenade", "Lower Court"],
    east: ["Eastern Overlook", "Dawn Corridor", "Sunrise Plaza", "East Gate"],
    west: ["Western Ridge", "Twilight Terrace", "Sunset Causeway", "West Arcade"],
  };
  const list = dirSuffixes[dir] || dirSuffixes.north;
  const idx = Math.abs(Math.round((x * 3 + z * 7) / 220)) % list.length;
  return `${subject} — ${list[idx]}${ringSuffix}`;
}

export interface WorldState {
  currentRoomId: string;
  worldTitle: string;
  topologyType: string;
  isExpanding: boolean;
  rooms: Record<string, WorldRoom>;
  npcs: Record<string, NPCAgent>;
  quests: QuestObjective[];
  lastTelemetry: TelemetryMetadata | null;
  isOfflineMode: boolean;
  isSpacetimeConnected: boolean;
  simulatedProvider: "nemotron_70b" | "gemini_flash" | "offline_mock" | null;
  isGodModeOpen: boolean;
  selectedNpcId: string | null;

  // screen navigation & world storage archives
  activeScreen: "title" | "storage" | "create" | "game";
  savedWorlds: SavedWorldEntry[];
  isCompilingWorld: boolean;
  diffusionProgress: number;
  activeSubtitle: SubtitleCue | null;
  playerPosition: { x: number; z: number; yaw: number };
  teleportTrigger: number;
  transitionDirection: [number, number, number];

  // actions
  setActiveScreen: (screen: "title" | "storage" | "create" | "game") => void;
  setIsCompilingWorld: (compiling: boolean) => void;
  setDiffusionProgress: (progress: number) => void;
  setActiveSubtitle: (cue: SubtitleCue | null) => void;
  setPlayerPosition: (pos: { x: number; z: number; yaw: number }) => void;
  saveWorldToArchive: (entry: SavedWorldEntry) => void;
  deleteWorldFromArchive: (worldId: string) => void;
  loadArchivedWorld: (entry: SavedWorldEntry) => void;

  setCurrentRoom: (roomId: string, walkedInto?: boolean) => void;
  selectNPC: (npcId: string | null) => void;
  setMutationLevel: (roomId: string, level: number) => void;
  appendThoughtLog: (npcId: string, thought: string) => void;
  setLastTelemetry: (telemetry: TelemetryMetadata) => void;
  setSimulatedProvider: (provider: "nemotron_70b" | "gemini_flash" | "offline_mock" | null) => void;
  toggleGodMode: () => void;
  hydrateFromMockWorld: (worldData: any) => void;
  ensureNeighborZones: (roomId: string) => void;
  expandWorld: (fromRoomId?: string, direction?: string, targetX?: number, targetZ?: number) => Promise<WorldRoom | null>;
  initializeSync: () => void;
}

const expansionQueue: Array<{
  fromRoomId?: string;
  direction?: string;
  targetX?: number;
  targetZ?: number;
}> = [];

export const useWorldStore = create<WorldState>((set, get) => ({
  currentRoomId: "noise_origin",
  worldTitle: "Continuous Latent Expanse",
  topologyType: "nature_open",
  isExpanding: false,
  rooms: {},
  npcs: {},
  quests: [],
  lastTelemetry: {
    provider: "gemini_flash",
    latency_ms: 420.0,
    fallback_occurred: false,
  },
  isOfflineMode: false,
  isSpacetimeConnected: false,
  simulatedProvider: null,
  isGodModeOpen: false,
  selectedNpcId: null,

  activeScreen: "title",
  savedWorlds: BUILTIN_ARCHIVES,
  isCompilingWorld: false,
  diffusionProgress: 100,
  activeSubtitle: null,
  playerPosition: { x: 0, z: 0, yaw: 0 },
  teleportTrigger: 0,
  transitionDirection: [0, 0, -1],

  setActiveScreen: (screen) => {
    set({ activeScreen: screen });
  },

  setIsCompilingWorld: (compiling) => {
    set({ isCompilingWorld: compiling, diffusionProgress: compiling ? 5 : get().diffusionProgress });
  },

  setDiffusionProgress: (progress) => {
    if (Math.abs(get().diffusionProgress - progress) >= 2 || progress === 100) {
      set({ diffusionProgress: progress });
    }
  },

  setActiveSubtitle: (cue) => {
    set({ activeSubtitle: cue });
  },

  setPlayerPosition: (pos) => {
    const prev = get().playerPosition;
    if (
      Math.abs(prev.x - pos.x) > 0.35 ||
      Math.abs(prev.z - pos.z) > 0.35 ||
      Math.abs(prev.yaw - pos.yaw) > 0.04
    ) {
      set({ playerPosition: pos });
    }
  },

  saveWorldToArchive: (entry) => {
    set((state) => {
      const filtered = state.savedWorlds.filter((w) => w.world_id !== entry.world_id);
      const updated = [entry, ...filtered];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(updated));
        } catch {}
      }
      return { savedWorlds: updated };
    });
  },

  deleteWorldFromArchive: (worldId) => {
    set((state) => {
      const updated = state.savedWorlds.filter((w) => w.world_id !== worldId);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(updated));
        } catch {}
      }
      return { savedWorlds: updated };
    });
  },

  loadArchivedWorld: (entry) => {
    get().hydrateFromMockWorld(entry.world_data);
    set({
      worldTitle: entry.title,
      activeScreen: "game",
    });
  },

  setCurrentRoom: (roomId: string, walkedInto: boolean = false) => {
    const { rooms } = get();
    const prevRoom = rooms[get().currentRoomId];
    const targetRoom = rooms[roomId];
    if (targetRoom) {
      let tDir: [number, number, number] = [0, 0, -1];
      if (prevRoom && prevRoom.room_id !== roomId) {
        const dx = (targetRoom.worldX || 0) - (prevRoom.worldX || 0);
        const dz = (targetRoom.worldZ || 0) - (prevRoom.worldZ || 0);
        const len = Math.hypot(dx, dz);
        if (len > 0.001) {
          tDir = [dx / len, 0, dz / len];
        }
      }

      set((state) => ({
        currentRoomId: roomId,
        transitionDirection: tDir,
        selectedNpcId: null,
        activeSubtitle: null,
        playerPosition: walkedInto
          ? state.playerPosition
          : {
              x: targetRoom.worldX || 0,
              z: targetRoom.worldZ || 0,
              yaw: state.playerPosition.yaw,
            },
        teleportTrigger: walkedInto ? state.teleportTrigger : state.teleportTrigger + 1,
      }));

      // immediately generate neighboring zones as soon as the user enters this environment!
      get().ensureNeighborZones(roomId);
    }
  },

  selectNPC: (npcId: string | null) => {
    if (!npcId) {
      set({ selectedNpcId: null, activeSubtitle: null });
      return;
    }
    const npc = get().npcs[npcId];
    const room = get().rooms[get().currentRoomId];
    if (npc) {
      set({
        selectedNpcId: npcId,
        activeSubtitle: {
          npcId: npc.npc_id,
          speaker: npc.name,
          persona: npc.persona_description,
          text: `Greetings, traveler. You stand within ${room?.name || "the sanctuary"}. How may I counsel you?`,
          thoughtLog: npc.thought_log?.[npc.thought_log.length - 1],
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      });
    } else {
      set({ selectedNpcId: npcId });
    }
  },

  setMutationLevel: (roomId: string, level: number) => {
    set((state) => {
      const room = state.rooms[roomId];
      if (!room) return state;
      return {
        rooms: {
          ...state.rooms,
          [roomId]: {
            ...room,
            mutation_level: Math.max(0.0, Math.min(1.0, level)),
          },
        },
      };
    });
  },

  appendThoughtLog: (npcId: string, thought: string) => {
    set((state) => {
      const npc = state.npcs[npcId];
      if (!npc) return state;
      return {
        npcs: {
          ...state.npcs,
          [npcId]: {
            ...npc,
            thought_log: [...npc.thought_log, thought],
          },
        },
      };
    });
  },

  setLastTelemetry: (telemetry: TelemetryMetadata) => {
    set({ lastTelemetry: telemetry });
  },

  setSimulatedProvider: (provider) => {
    set({ simulatedProvider: provider });
  },

  toggleGodMode: () => {
    set((state) => ({ isGodModeOpen: !state.isGodModeOpen }));
  },

  hydrateFromMockWorld: (worldData: any) => {
    if (!worldData || !Array.isArray(worldData.rooms)) return;

    const roomsMap: Record<string, WorldRoom> = {};
    const npcsMap: Record<string, NPCAgent> = {};

    const rawTitle = worldData.title || "Architectural Chronicle";
    const topo = (worldData.topology_type || inferTopologyType(`${rawTitle} ${worldData.prompt || ""}`)) as "linear" | "nature_open" | "city_grid" | "hub_spoke";

    worldData.rooms.forEach((r: any, idx: number) => {
      const inferredBiome = r.biome_type || "medieval_tavern";
      const rawPano = r.panorama_url || `/cached_worlds/${inferredBiome}/panorama.webp`;

      let defaultX = 0;
      let defaultZ = 0;
      if (topo === "linear") {
        defaultX = 0;
        defaultZ = -idx * 220;
      } else if (topo === "nature_open") {
        // Nature environment: 4 cardinal directions, open expansion
        const cardinalOffsets = [
          [0, 0],       // Center
          [0, -220],    // North
          [220, 0],     // East
          [0, 220],     // South
          [-220, 0],    // West
        ];
        const [nx, nz] = cardinalOffsets[idx % cardinalOffsets.length];
        defaultX = nx;
        defaultZ = nz;
      } else if (topo === "city_grid") {
        defaultX = (idx % 2) * 220;
        defaultZ = -Math.floor(idx / 2) * 220;
      } else {
        // hub_spoke
        if (idx === 0) {
          defaultX = 0;
          defaultZ = 0;
        } else {
          const spokeOffsets = [
            [0, -220],
            [220, 0],
            [0, 220],
            [-220, 0],
          ];
          const [sx, sz] = spokeOffsets[(idx - 1) % spokeOffsets.length];
          defaultX = sx;
          defaultZ = sz;
        }
      }

      const assignedPalette = r.visual_palette || inferRoomVisualPalette(r.name, rawTitle, inferredBiome);

      roomsMap[r.room_id] = {
        room_id: r.room_id,
        name: r.name,
        panorama_url: rawPano,
        depth_url: r.depth_url || `/cached_worlds/${inferredBiome}/depth.png`,
        adjacent_room_ids: Array.isArray(r.adjacent_room_ids) ? [...r.adjacent_room_ids] : [],
        mutation_level: r.mutation_level || 0.0,
        biome_type: inferredBiome,
        props: r.props || [],
        worldX: typeof r.worldX === "number" ? r.worldX : defaultX,
        worldZ: typeof r.worldZ === "number" ? r.worldZ : defaultZ,
        topology_type: r.topology_type || topo,
        visual_palette: assignedPalette,
      };

      const rawNpcs = Array.isArray(r.npcs) && r.npcs.length > 0
        ? r.npcs
        : [
            {
              npc_id: `npc_${r.room_id}_chronicler`,
              name: `Chronicler of ${r.name}`,
              room_id: r.room_id,
              persona_description: `Resident historian and guardian overseeing ${r.name}.`,
              thought_log: [
                `[MEMORY] Keeping watch over ${r.name}. [REFLECTION] A traveler has arrived. [PLANNING] Share the history of this place. [ACTION] Greet the traveler.`,
              ],
              inventory: ["chronicle_scroll"],
              hp: 100,
              position: { r: 500, theta: -0.22 + (idx % 2) * 0.4, phi: 1.65 },
            },
          ];

      rawNpcs.forEach((npc: any, nIdx: number) => {
        npcsMap[npc.npc_id] = {
          npc_id: npc.npc_id,
          name: npc.name,
          room_id: r.room_id,
          persona_description: npc.persona_description,
          thought_log: npc.thought_log || [],
          active_plan: npc.active_plan,
          inventory: npc.inventory || [],
          hp: npc.hp || 100,
          position: npc.position || { r: 500, theta: -0.25 + nIdx * 0.45, phi: 1.65 },
        };
      });
    });

    const orderedIds = Object.keys(roomsMap);

    // establish strict topology-specific adjacencies
    if (topo === "linear") {
      // strictly 1D corridor: room i connects only to i-1 and i+1, NO circular loop!
      orderedIds.forEach((rid, idx) => {
        const adj: string[] = [];
        if (idx > 0) adj.push(orderedIds[idx - 1]);
        if (idx < orderedIds.length - 1) adj.push(orderedIds[idx + 1]);
        roomsMap[rid].adjacent_room_ids = adj;
      });
    } else if (topo === "nature_open") {
      // 4-directional open nature environment: NO LIMITS
      orderedIds.forEach((rid, idx) => {
        if (idx === 0) {
          // Center connects in all 4 cardinal directions
          roomsMap[rid].adjacent_room_ids = orderedIds.slice(1, 5);
        } else {
          // Surrounding zones connect back to center and adjacent perimeter neighbor
          const nextIdx = 1 + ((idx) % (orderedIds.length - 1));
          roomsMap[rid].adjacent_room_ids = [orderedIds[0], orderedIds[nextIdx]];
        }
      });
    } else if (topo === "city_grid") {
      // 2D grid orthogonal connections
      orderedIds.forEach((rid, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const adj: string[] = [];
        if (col > 0 && orderedIds[idx - 1]) adj.push(orderedIds[idx - 1]);
        if (col < 1 && orderedIds[idx + 1]) adj.push(orderedIds[idx + 1]);
        if (row > 0 && orderedIds[idx - 2]) adj.push(orderedIds[idx - 2]);
        if (orderedIds[idx + 2]) adj.push(orderedIds[idx + 2]);
        roomsMap[rid].adjacent_room_ids = adj;
      });
    } else {
      // hub & spoke: center connects to all spokes, spokes connect to center
      orderedIds.forEach((rid, idx) => {
        if (idx === 0) {
          roomsMap[rid].adjacent_room_ids = orderedIds.slice(1, 4);
        } else {
          roomsMap[rid].adjacent_room_ids = [orderedIds[0]];
        }
      });
    }

    const initialId =
      worldData.initial_room_id && roomsMap[worldData.initial_room_id]
        ? worldData.initial_room_id
        : orderedIds[0] || "";

    const initialRoom = roomsMap[initialId];

    set((state) => ({
      worldTitle: rawTitle,
      topologyType: topo,
      currentRoomId: initialId,
      rooms: roomsMap,
      npcs: npcsMap,
      quests: worldData.quests || [],
      selectedNpcId: null,
      activeSubtitle: null,
      playerPosition: {
        x: initialRoom?.worldX || 0,
        z: initialRoom?.worldZ || 0,
        yaw: 0,
      },
      teleportTrigger: state.teleportTrigger + 1,
    }));

    // immediately ensure all adjacent neighboring zones exist upon entering the world
    get().ensureNeighborZones(initialId);
  },

  ensureNeighborZones: (roomId: string) => {
    const state = get();
    const sourceRoom = state.rooms[roomId];
    if (!sourceRoom) return;

    const topo = (sourceRoom.topology_type || state.topologyType || "nature_open") as string;
    const currentRooms = { ...state.rooms };
    const currentNpcs = { ...state.npcs };
    let modified = false;

    interface CandidateOffset {
      dir: "north" | "south" | "east" | "west" | "forward" | "backward";
      dx: number;
      dz: number;
    }

    const offsets: CandidateOffset[] = [];
    if (topo === "linear") {
      offsets.push({ dir: "forward", dx: 0, dz: -220 });
      offsets.push({ dir: "backward", dx: 0, dz: 220 });
    } else {
      // Nature environment or city grid: NO LIMITS - ALWAYS GENERATE ALL 4 DIRECTIONS IMMEDIATELY!
      offsets.push({ dir: "north", dx: 0, dz: -220 });
      offsets.push({ dir: "south", dx: 0, dz: 220 });
      offsets.push({ dir: "east", dx: 220, dz: 0 });
      offsets.push({ dir: "west", dx: -220, dz: 0 });
    }

    const srcX = sourceRoom.worldX || 0;
    const srcZ = sourceRoom.worldZ || 0;
    const newAdjacent = new Set(sourceRoom.adjacent_room_ids || []);

    for (const offset of offsets) {
      const targetX = Math.round((srcX + offset.dx) / 10) * 10;
      const targetZ = Math.round((srcZ + offset.dz) / 10) * 10;

      // check if any room already exists within 65 units of target
      const existing = Object.values(currentRooms).find(
        (r) => Math.hypot((r.worldX || 0) - targetX, (r.worldZ || 0) - targetZ) < 65
      );

      if (existing) {
        newAdjacent.add(existing.room_id);
        if (!existing.adjacent_room_ids?.includes(sourceRoom.room_id)) {
          currentRooms[existing.room_id] = {
            ...existing,
            adjacent_room_ids: [...(existing.adjacent_room_ids || []), sourceRoom.room_id],
          };
          modified = true;
        }
      } else {
        // generate newly connected neighboring zone with spherical bearing continuity!
        const dx = targetX - srcX;
        const dz = targetZ - srcZ;
        const thetaFwd = Math.atan2(dx, -dz);
        const thetaBack = (thetaFwd + Math.PI) % (2 * Math.PI);
        const uBack = (thetaBack / (2 * Math.PI) + 0.5) % 1.0;

        const coordKey = `x${targetX >= 0 ? "p" : "m"}${Math.abs(targetX)}_z${targetZ >= 0 ? "p" : "m"}${Math.abs(targetZ)}`;
        const safeId = `room_gen_${coordKey}`;
        const name = generateThematicRoomName(state.worldTitle, sourceRoom.biome_type, offset.dir, targetX, targetZ);
        const biome = sourceRoom.biome_type || "desert_oasis";
        const pal = inferRoomVisualPalette(name, state.worldTitle, biome);
        const safeWorld = state.worldTitle.toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "world_active";

        const newRoom: WorldRoom = {
          room_id: safeId,
          name,
          panorama_url: `/generated_worlds/${safeWorld}/${safeId}_panorama.webp?room=${encodeURIComponent(name)}&prompt=${encodeURIComponent(state.worldTitle)}&from=${encodeURIComponent(sourceRoom.name)}&dir=${offset.dir}&biome=${encodeURIComponent(biome)}&sky=${encodeURIComponent(pal.sky_tone)}&floor=${encodeURIComponent(pal.floor_tone)}&u_back=${uBack.toFixed(3)}&x=${targetX}&z=${targetZ}&idx=${Object.keys(currentRooms).length + 1}`,
          depth_url: `/generated_worlds/${safeWorld}/${safeId}_depth.png`,
          adjacent_room_ids: [sourceRoom.room_id],
          mutation_level: 0,
          biome_type: biome,
          props: [
            {
              prop_id: `prop_${safeId}`,
              name: `${name} Beacon`,
              mesh_url: "/cached_worlds/models/terminal.glb",
              position: { r: 500, theta: 0.38, phi: 1.7 },
              scale: 1.0,
              interactive: true,
            },
          ],
          worldX: targetX,
          worldZ: targetZ,
          topology_type: topo,
          visual_palette: pal,
        };

        const npcId = `npc_${safeId}`;
        currentNpcs[npcId] = {
          npc_id: npcId,
          name: `Guardian of ${name.split(" ")[0]}`,
          room_id: safeId,
          persona_description: `Resident scout guarding threshold connected to ${sourceRoom.name}.`,
          thought_log: [
            `[MEMORY] Watching gateway connected from ${sourceRoom.name}.`,
            `[REFLECTION] Explorer has crossed the threshold into ${name}.`,
            `[ACTION] Welcome traveler to ${name}.`,
          ],
          active_plan: `Survey sector ${name}.`,
          inventory: ["waypoint_marker"],
          hp: 100,
          position: { r: 500, theta: -0.22, phi: 1.65 },
        };

        currentRooms[safeId] = newRoom;
        newAdjacent.add(safeId);
        modified = true;

        // Asynchronously trigger backend synthesis to generate on-disk panorama with reciprocal portal
        setTimeout(() => {
          get().expandWorld(sourceRoom.room_id, offset.dir, targetX, targetZ);
        }, 80);
      }
    }

    if (modified) {
      currentRooms[roomId] = {
        ...sourceRoom,
        adjacent_room_ids: Array.from(newAdjacent),
      };
      set({ rooms: currentRooms, npcs: currentNpcs });
    }
  },

  expandWorld: async (fromRoomId?: string, direction?: string, targetX?: number, targetZ?: number) => {
    const state = get();
    if (state.isExpanding) {
      if (targetX !== undefined && targetZ !== undefined) {
        const isQueued = expansionQueue.some((q) => q.targetX === targetX && q.targetZ === targetZ);
        if (!isQueued) {
          expansionQueue.push({ fromRoomId, direction, targetX, targetZ });
        }
      }
      return null;
    }

    const drainQueue = () => {
      set({ isExpanding: false });
      if (expansionQueue.length > 0) {
        const nextReq = expansionQueue.shift();
        if (nextReq) {
          setTimeout(() => {
            get().expandWorld(nextReq.fromRoomId, nextReq.direction, nextReq.targetX, nextReq.targetZ);
          }, 80);
        }
      }
    };

    const sourceRoomId = fromRoomId || state.currentRoomId;
    const sourceRoom = state.rooms[sourceRoomId];
    const topo = (sourceRoom?.topology_type || state.topologyType || "nature_open") as string;
    const existingIds = Object.keys(state.rooms);

    set({ isExpanding: true, diffusionProgress: 15 });

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
      const res = await fetch(`${apiUrl}/world/expand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          world_id: state.worldTitle.toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "world_active",
          from_room_id: sourceRoomId,
          direction: direction || (topo === "linear" ? "forward" : "north"),
          world_prompt: state.worldTitle,
          existing_room_ids: existingIds,
          topology_type: topo,
          from_room_name: sourceRoom?.name,
          from_room_biome: sourceRoom?.biome_type,
          from_room_x: sourceRoom?.worldX,
          from_room_z: sourceRoom?.worldZ,
          from_room_palette: sourceRoom?.visual_palette,
          from_room_panorama_url: sourceRoom?.panorama_url,
          from_room_depth_url: sourceRoom?.depth_url,
          target_x: targetX,
          target_z: targetZ,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const nr = data.new_room;
        if (nr && nr.room_id) {
          const newRoom: WorldRoom = {
            room_id: nr.room_id,
            name: nr.name,
            panorama_url: nr.panorama_url,
            depth_url: nr.depth_url,
            adjacent_room_ids: nr.adjacent_room_ids || [sourceRoomId],
            mutation_level: nr.mutation_level || 0,
            biome_type: nr.biome_type || sourceRoom?.biome_type || "desert_oasis",
            props: nr.props || [],
            worldX: nr.worldX,
            worldZ: nr.worldZ,
            topology_type: nr.topology_type || topo,
            visual_palette: nr.visual_palette || inferRoomVisualPalette(nr.name, state.worldTitle, nr.biome_type),
          };

          const newNpcs = { ...state.npcs };
          if (Array.isArray(nr.npcs)) {
            nr.npcs.forEach((npc: any) => {
              newNpcs[npc.npc_id] = {
                npc_id: npc.npc_id,
                name: npc.name,
                room_id: nr.room_id,
                persona_description: npc.persona_description,
                thought_log: npc.thought_log || [],
                active_plan: npc.active_plan,
                inventory: npc.inventory || [],
                hp: npc.hp || 100,
                position: npc.position || { r: 500, theta: -0.22, phi: 1.65 },
              };
            });
          }

          const updatedSource = sourceRoom
            ? {
                ...sourceRoom,
                adjacent_room_ids: Array.from(new Set([...(sourceRoom.adjacent_room_ids || []), nr.room_id])),
              }
            : null;

          const updatedRooms = {
            ...state.rooms,
            ...(updatedSource ? { [sourceRoomId]: updatedSource } : {}),
            [nr.room_id]: newRoom,
          };

          const firstNpc = Array.isArray(nr.npcs) && nr.npcs.length > 0 ? nr.npcs[0] : null;

          set({
            rooms: updatedRooms,
            npcs: newNpcs,
            isExpanding: false,
            diffusionProgress: 100,
            activeSubtitle: firstNpc
              ? {
                  npcId: firstNpc.npc_id,
                  speaker: firstNpc.name,
                  persona: firstNpc.persona_description,
                  text: `Discovered new sector: ${nr.name}. Welcome, explorer.`,
                  thoughtLog: firstNpc.thought_log?.[0],
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                }
              : state.activeSubtitle,
          });

          drainQueue();
          return newRoom;
        }
      }
    } catch (err) {
      console.warn("Continuous expansion fetch failed, synthesizing client-side:", err);
    }

    // Client-side fallback expansion with exact reciprocal spherical bearing math
    const nextIdx = existingIds.length + 1;
    const fromX = sourceRoom?.worldX || 0;
    const fromZ = sourceRoom?.worldZ || 0;
    let newX = targetX !== undefined ? targetX : fromX;
    let newZ = targetZ !== undefined ? targetZ : fromZ - 220;

    if (targetX === undefined || targetZ === undefined) {
      if (topo === "linear") {
        newX = 0;
        newZ = direction === "backward" ? fromZ + 220 : fromZ - 220;
      } else {
        if (direction === "south") newZ = fromZ + 220;
        else if (direction === "east") newX = fromX + 220;
        else if (direction === "west") newX = fromX - 220;
        else newZ = fromZ - 220;
      }
    }

    const fallbackDir = direction || (topo === "linear" ? "forward" : "north");
    const fallbackId = `room_gen_x${newX >= 0 ? "p" : "m"}${Math.abs(newX)}_z${newZ >= 0 ? "p" : "m"}${Math.abs(newZ)}`;
    const fallbackName = generateThematicRoomName(state.worldTitle, sourceRoom?.biome_type, fallbackDir, newX, newZ);
    const fallbackBiome = sourceRoom?.biome_type || "desert_oasis";
    const fallbackPal = inferRoomVisualPalette(fallbackName, state.worldTitle, fallbackBiome);
    const safeWorld = state.worldTitle.toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "world_active";

    const dx = newX - fromX;
    const dz = newZ - fromZ;
    const thetaFwd = Math.atan2(dx, -dz);
    const thetaBack = (thetaFwd + Math.PI) % (2 * Math.PI);
    const uBack = (thetaBack / (2 * Math.PI) + 0.5) % 1.0;

    const fallbackRoom: WorldRoom = {
      room_id: fallbackId,
      name: fallbackName,
      panorama_url: `/generated_worlds/${safeWorld}/${fallbackId}_panorama.webp?room=${encodeURIComponent(fallbackName)}&prompt=${encodeURIComponent(state.worldTitle)}&from=${encodeURIComponent(sourceRoom?.name || "")}&dir=${fallbackDir}&biome=${encodeURIComponent(fallbackBiome)}&sky=${encodeURIComponent(fallbackPal.sky_tone)}&floor=${encodeURIComponent(fallbackPal.floor_tone)}&u_back=${uBack.toFixed(3)}&x=${newX}&z=${newZ}&idx=${nextIdx}`,
      depth_url: `/generated_worlds/${safeWorld}/${fallbackId}_depth.png`,
      adjacent_room_ids: [sourceRoomId],
      mutation_level: 0,
      biome_type: fallbackBiome,
      props: [],
      worldX: newX,
      worldZ: newZ,
      topology_type: topo,
      visual_palette: inferRoomVisualPalette(fallbackName, state.worldTitle, sourceRoom?.biome_type),
    };

    const updatedSource = sourceRoom
      ? {
          ...sourceRoom,
          adjacent_room_ids: Array.from(new Set([...(sourceRoom.adjacent_room_ids || []), fallbackId])),
        }
      : null;

    set({
      rooms: {
        ...state.rooms,
        ...(updatedSource ? { [sourceRoomId]: updatedSource } : {}),
        [fallbackId]: fallbackRoom,
      },
      isExpanding: false,
      diffusionProgress: 100,
    });

    drainQueue();
    return fallbackRoom;
  },

  initializeSync: () => {
    const isOffline = process.env.NEXT_PUBLIC_USE_CACHE === "true";
    set({ isOfflineMode: isOffline });

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const mergedIds = new Set(parsed.map((p: SavedWorldEntry) => p.world_id));
            const combined = [
              ...parsed,
              ...BUILTIN_ARCHIVES.filter((b) => !mergedIds.has(b.world_id)),
            ];
            set({ savedWorlds: combined });
          }
        }
      } catch {}
    }

    if (!isOffline && typeof window !== "undefined") {
      try {
        const spacetimeHost =
          process.env.NEXT_PUBLIC_SPACETIMEDB_HOST || "localhost:3001";
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(`${wsProtocol}//${spacetimeHost}/database/subscribe`);

        ws.onopen = () => {
          set({ isSpacetimeConnected: true });
        };
        ws.onerror = () => {
          set({ isSpacetimeConnected: false });
        };
        ws.onclose = () => {
          set({ isSpacetimeConnected: false });
        };
      } catch {
        set({ isSpacetimeConnected: false });
      }
    }
  },
}));
