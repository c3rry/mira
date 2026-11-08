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

export interface WorldRoom {
  room_id: string;
  name: string;
  panorama_url: string;
  depth_url: string;
  adjacent_room_ids: string[];
  mutation_level: number;
  biome_type: string;
  props?: PropItem[];
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

const ARCHIVE_STORAGE_KEY = "mira_world_archives_v3";

export const BUILTIN_ARCHIVES: SavedWorldEntry[] = [
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
          panorama_url: "/cached_worlds/desert_oasis/panorama.webp?custom=1&room=Great+Pyramid+Forecourt&biome=desert_oasis&prompt=Pyramids+of+Giza&idx=0",
          depth_url: "/cached_worlds/desert_oasis/depth.png",
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
          panorama_url: "/cached_worlds/desert_oasis/panorama.webp?custom=1&room=Sanctuary+of+the+Great+Sphinx&biome=desert_oasis&prompt=Great+Sphinx+of+Giza&idx=1",
          depth_url: "/cached_worlds/desert_oasis/depth.png",
          adjacent_room_ids: ["giza_forecourt", "khufu_gallery"],
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
          panorama_url: "/cached_worlds/desert_oasis/panorama.webp?custom=1&room=Grand+Gallery+of+Khufu&biome=desert_oasis&prompt=Grand+Gallery+Pyramid+of+Giza&idx=2",
          depth_url: "/cached_worlds/desert_oasis/depth.png",
          adjacent_room_ids: ["giza_forecourt", "solar_barque"],
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
          panorama_url: "/cached_worlds/desert_oasis/panorama.webp?custom=1&room=Court+of+the+Solar+Barque&biome=desert_oasis&prompt=Egyptian+Solar+Barque+Temple&idx=3",
          depth_url: "/cached_worlds/desert_oasis/depth.png",
          adjacent_room_ids: ["giza_forecourt", "khufu_gallery"],
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
          panorama_url: "/cached_worlds/medieval_tavern/panorama.webp?custom=1&room=Via+Sacra+Roman+Forum&biome=medieval_tavern&prompt=Imperial+Forum+of+Rome&idx=0",
          depth_url: "/cached_worlds/medieval_tavern/depth.png",
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
          panorama_url: "/cached_worlds/medieval_tavern/panorama.webp?custom=1&room=Rotunda+of+the+Pantheon&biome=medieval_tavern&prompt=Pantheon+Rotunda+Rome&idx=1",
          depth_url: "/cached_worlds/medieval_tavern/depth.png",
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
          panorama_url: "/cached_worlds/medieval_tavern/panorama.webp?custom=1&room=Flavian+Amphitheater+Colonnade&biome=medieval_tavern&prompt=Roman+Colosseum+Arena&idx=2",
          depth_url: "/cached_worlds/medieval_tavern/depth.png",
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
          panorama_url: "/cached_worlds/enchanted_forest/panorama.webp?custom=1&room=Upper+Cedar+Terrace&biome=enchanted_forest&prompt=Hanging+Gardens+of+Babylon&idx=0",
          depth_url: "/cached_worlds/enchanted_forest/depth.png",
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
          panorama_url: "/cached_worlds/enchanted_forest/panorama.webp?custom=1&room=Ishtar+Water+Pavilion&biome=enchanted_forest&prompt=Babylon+Water+Gardens&idx=1",
          depth_url: "/cached_worlds/enchanted_forest/depth.png",
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

export interface WorldState {
  currentRoomId: string;
  worldTitle: string;
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

  // actions
  setActiveScreen: (screen: "title" | "storage" | "create" | "game") => void;
  setIsCompilingWorld: (compiling: boolean) => void;
  setDiffusionProgress: (progress: number) => void;
  setActiveSubtitle: (cue: SubtitleCue | null) => void;
  saveWorldToArchive: (entry: SavedWorldEntry) => void;
  deleteWorldFromArchive: (worldId: string) => void;
  loadArchivedWorld: (entry: SavedWorldEntry) => void;

  setCurrentRoom: (roomId: string) => void;
  selectNPC: (npcId: string | null) => void;
  setMutationLevel: (roomId: string, level: number) => void;
  appendThoughtLog: (npcId: string, thought: string) => void;
  setLastTelemetry: (telemetry: TelemetryMetadata) => void;
  setSimulatedProvider: (provider: "nemotron_70b" | "gemini_flash" | "offline_mock" | null) => void;
  toggleGodMode: () => void;
  hydrateFromMockWorld: (worldData: any) => void;
  initializeSync: () => void;
}

export const useWorldStore = create<WorldState>((set, get) => ({
  currentRoomId: "giza_forecourt",
  worldTitle: "The Necropolis of Giza",
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

  setCurrentRoom: (roomId: string) => {
    const { rooms, npcs } = get();
    if (rooms[roomId]) {
      // find first npc in target room to present an introductory subtitle
      const roomNpc = Object.values(npcs).find((n) => n.room_id === roomId);
      const subtitle: SubtitleCue | null = roomNpc
        ? {
            npcId: roomNpc.npc_id,
            speaker: roomNpc.name,
            persona: roomNpc.persona_description,
            text: `Welcome to ${rooms[roomId].name}. ${roomNpc.persona_description}`,
            thoughtLog: roomNpc.thought_log?.[roomNpc.thought_log.length - 1],
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }
        : null;

      set({
        currentRoomId: roomId,
        selectedNpcId: roomNpc ? roomNpc.npc_id : null,
        activeSubtitle: subtitle,
      });
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

    worldData.rooms.forEach((r: any, idx: number) => {
      const inferredBiome = r.biome_type || "medieval_tavern";
      const rawPano = r.panorama_url || `/cached_worlds/${inferredBiome}/panorama.webp`;
      const worldPrompt = worldData.title || r.name || "Architectural Sanctuary";
      const enrichedPanoUrl = rawPano.includes("custom=1")
        ? rawPano
        : `${rawPano}?custom=1&room=${encodeURIComponent(r.name)}&biome=${encodeURIComponent(inferredBiome)}&prompt=${encodeURIComponent(worldPrompt)}&idx=${idx}`;

      roomsMap[r.room_id] = {
        room_id: r.room_id,
        name: r.name,
        panorama_url: enrichedPanoUrl,
        depth_url: r.depth_url || `/cached_worlds/${inferredBiome}/depth.png`,
        adjacent_room_ids: r.adjacent_room_ids || [],
        mutation_level: r.mutation_level || 0.0,
        biome_type: inferredBiome,
        props: r.props || [],
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

    const initialId =
      worldData.initial_room_id && roomsMap[worldData.initial_room_id]
        ? worldData.initial_room_id
        : Object.keys(roomsMap)[0] || "";

    const initialNpc = Object.values(npcsMap).find((n) => n.room_id === initialId);
    const initialRoom = roomsMap[initialId];

    set({
      worldTitle: worldData.title || "Architectural Chronicle",
      currentRoomId: initialId,
      rooms: roomsMap,
      npcs: npcsMap,
      quests: worldData.quests || [],
      selectedNpcId: initialNpc ? initialNpc.npc_id : null,
      activeSubtitle: initialNpc
        ? {
            npcId: initialNpc.npc_id,
            speaker: initialNpc.name,
            persona: initialNpc.persona_description,
            text: `Welcome to ${initialRoom?.name || "this realm"}. ${initialNpc.persona_description}`,
            thoughtLog: initialNpc.thought_log?.[initialNpc.thought_log.length - 1],
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }
        : null,
    });
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
