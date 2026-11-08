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

export interface KnowledgeLocationNode {
  location_id: string;
  name: string;
  room_id: string;
  biome_type: string;
  story_role: string;
  atmosphere_desc: string;
  world_x: number;
  world_z: number;
}

export interface KnowledgeAgentNode {
  agent_id: string;
  name: string;
  role: string;
  personality: string;
  appearance_style: string;
  current_location_id: string;
  movement_mode: "escorting_player" | "patrolling" | "stationed" | "beckoning_to_gateway";
  target_gateway_bearing?: number;
  narrative_dialogue_arc: string[];
  secret_knowledge: string;
  faction: string;
  patrol_waypoints?: Array<{ r: number; theta: number; phi: number }>;
  active_thought?: string;
}

export interface KnowledgeRelationshipEdge {
  source_agent_id: string;
  target_agent_id: string;
  relation_type: "allies_with" | "mistrusts" | "guards" | "reports_to" | "guides_player_to" | "rival_of";
  interaction_lore: string;
}

export interface KnowledgeStoryBeatNode {
  beat_id: string;
  title: string;
  stage: "act_1_exposition" | "act_2_exploration" | "act_3_revelation";
  narrative_cue: string;
  target_location_id: string;
  required_agent_id: string;
  is_unlocked: boolean;
}

export interface StoryKnowledgeGraph {
  story_title: string;
  synopsis: string;
  interview_stage: "ask_core_story" | "ask_sub_environments" | "ask_key_agents" | "compiled_active";
  locations: KnowledgeLocationNode[];
  agents: KnowledgeAgentNode[];
  relationships: KnowledgeRelationshipEdge[];
  story_beats: KnowledgeStoryBeatNode[];
  current_beat_id?: string;
}

export interface NarrativeDirectorMessage {
  role: "mira" | "director" | "player";
  content: string;
  timestamp: string;
  chips?: string[];
  followUp?: string;
  suggestedBiome?: string;
  compilationPrompt?: string;
}

export interface GuideGuidanceState {
  agentId: string;
  name: string;
  targetRoomId: string | null;
  nextHopRoomId: string | null;
  isStalling: boolean;
  stallMessage: string | null;
  instructionText: string;
  chunkedPath: string[];
}

export interface WorldCheckpoint {
  checkpoint_id: string;
  world_id: string;
  world_title: string;
  current_room_id: string;
  room_name: string;
  timestamp: string;
  rooms: Record<string, WorldRoom>;
  storyGraph: StoryKnowledgeGraph | null;
  narrativeMessages: NarrativeDirectorMessage[];
  guideState: GuideGuidanceState | null;
  playerPosition: { x: number; z: number; yaw: number };
  status: "saved" | "restored";
  label?: string;
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
const CHECKPOINTS_STORAGE_KEY = "mira_world_checkpoints_v1";
const ACTIVE_STATE_STORAGE_KEY = "mira_active_game_state_v1";

import builtinWorldsData from "./builtin_worlds.json";

export const BUILTIN_ARCHIVES: SavedWorldEntry[] = (builtinWorldsData as any[]).map((w) => ({
  world_id: w.world_id,
  title: w.title,
  prompt: w.description || w.title,
  biome_hint: w.biome_hint,
  created_at: "Pre-compiled Spatial Chronicle",
  world_data: w,
}));

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
  worldPrompt: string;
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
  renderedRoomIds: Record<string, boolean>;
  isPriorityWorkerActive: boolean;

  // Nemotron narrative director & story knowledge graph
  storyGraph: StoryKnowledgeGraph | null;
  narrativeMessages: NarrativeDirectorMessage[];
  isNarrativeLoading: boolean;
  isGodModeDirectorOpen: boolean;
  guideState: GuideGuidanceState | null;

  // Checkpoint persistence system
  checkpoints: WorldCheckpoint[];
  activeCheckpoint: WorldCheckpoint | null;
  checkpointStatusText: string | null;

  // actions
  setActiveScreen: (screen: "title" | "storage" | "create" | "game") => void;
  setIsCompilingWorld: (compiling: boolean) => void;
  setDiffusionProgress: (progress: number) => void;
  setActiveSubtitle: (cue: SubtitleCue | null) => void;
  setPlayerPosition: (pos: { x: number; z: number; yaw: number }) => void;
  saveWorldToArchive: (entry: SavedWorldEntry) => void;
  deleteWorldFromArchive: (worldId: string) => void;
  loadArchivedWorld: (entry: SavedWorldEntry) => void;
  saveCheckpoint: (label?: string) => string;
  loadCheckpoint: (checkpointId: string) => void;
  restoreActiveCheckpoint: () => void;

  setCurrentRoom: (roomId: string, walkedInto?: boolean) => void;
  selectNPC: (npcId: string | null) => void;
  setMutationLevel: (roomId: string, level: number) => void;
  appendThoughtLog: (npcId: string, thought: string) => void;
  setLastTelemetry: (telemetry: TelemetryMetadata) => void;
  setSimulatedProvider: (provider: "nemotron_70b" | "gemini_flash" | "offline_mock" | null) => void;
  toggleGodMode: () => void;
  toggleGodModeDirector: () => void;
  resetWorld: () => void;
  setGodModeDirectorOpen: (open: boolean) => void;
  sendNarrativeTurn: (playerMessage?: string) => Promise<void>;
  compileAndManifestFromMira: (prompt?: string, biome?: string) => Promise<void>;
  updateGuideGuidance: () => void;
  advanceStoryBeat: (beatId: string) => void;
  dispatchSubagentMovement: (agentId: string, mode: "escorting_player" | "patrolling" | "stationed" | "beckoning_to_gateway") => void;
  hydrateFromMockWorld: (worldData: any) => void;
  ensureNeighborZones: (roomId: string) => void;
  markRoomRendered: (roomId: string, rendered?: boolean) => void;
  scheduleBoundedPriorityRendering: () => void;
  expandWorld: (fromRoomId?: string, direction?: string, targetX?: number, targetZ?: number) => Promise<WorldRoom | null>;
  initializeSync: () => void;
}

import initialWorldData from "./initial_world.json";

const initialRoomsMap: Record<string, WorldRoom> = {};
const initialNpcsMap: Record<string, NPCAgent> = {};

if (initialWorldData && Array.isArray((initialWorldData as any).rooms)) {
  (initialWorldData as any).rooms.forEach((r: any) => {
    initialRoomsMap[r.room_id] = {
      ...r,
      visual_palette: inferRoomVisualPalette(r.biome_type, r.name),
    };
    if (Array.isArray(r.npcs)) {
      r.npcs.forEach((n: any) => {
        initialNpcsMap[n.npc_id] = n;
      });
    }
  });
}

const initialRoomId = (initialWorldData as any)?.initial_room_id || "room_cyber_lab_01";
const initialWorldTitle = (initialWorldData as any)?.title || "The Shrouded Frontier";

const expansionQueue: Array<{
  fromRoomId?: string;
  direction?: string;
  targetX?: number;
  targetZ?: number;
}> = [];

export const useWorldStore = create<WorldState>((set, get) => ({
  currentRoomId: initialRoomId,
  worldTitle: initialWorldTitle,
  worldPrompt: "Exploring the ancient ruins and neon chambers of the frontier",
  topologyType: "metropolis_grid",
  isExpanding: false,
  rooms: initialRoomsMap,
  npcs: initialNpcsMap,
  quests: (initialWorldData as any)?.quests || [],
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

  activeScreen: "game",
  savedWorlds: BUILTIN_ARCHIVES,
  isCompilingWorld: false,
  diffusionProgress: 100,
  activeSubtitle: null,
  playerPosition: { x: 0, z: 0, yaw: 0 },
  teleportTrigger: 0,
  transitionDirection: [0, 0, -1],
  renderedRoomIds: { [initialRoomId]: true },
  isPriorityWorkerActive: false,

  storyGraph: null,
  narrativeMessages: [],
  isNarrativeLoading: false,
  isGodModeDirectorOpen: false,
  guideState: null,
  checkpoints: [],
  activeCheckpoint: null,
  checkpointStatusText: null,

  setActiveScreen: (screen) => {
    set({ activeScreen: screen });
  },

  setIsCompilingWorld: (compiling) => {
    set({ isCompilingWorld: compiling, diffusionProgress: compiling ? 15 : 100 });
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
      worldPrompt: entry.prompt || entry.title,
      activeScreen: "game",
    });
    get().saveCheckpoint(`World Loaded: ${entry.title}`);
  },

  saveCheckpoint: (label?: string) => {
    const s = get();
    const currentRoom = s.rooms[s.currentRoomId];
    const cpId = `cp_${Date.now()}`;
    const newCp: WorldCheckpoint = {
      checkpoint_id: cpId,
      world_id: (s as any).worldId || "world_active",
      world_title: s.worldTitle,
      current_room_id: s.currentRoomId,
      room_name: currentRoom?.name || s.currentRoomId,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      rooms: s.rooms,
      storyGraph: s.storyGraph,
      narrativeMessages: s.narrativeMessages,
      guideState: s.guideState,
      playerPosition: s.playerPosition,
      status: "saved",
      label: label || `Checkpoint at ${currentRoom?.name || "Sanctuary"}`,
    };

    set((state) => {
      const updated = [newCp, ...state.checkpoints.filter((c) => c.checkpoint_id !== cpId)];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(CHECKPOINTS_STORAGE_KEY, JSON.stringify(updated));
          localStorage.setItem(ACTIVE_STATE_STORAGE_KEY, JSON.stringify(newCp));
        } catch {}
      }
      return {
        checkpoints: updated,
        activeCheckpoint: newCp,
        checkpointStatusText: `Checkpoint saved: ${newCp.room_name}`,
      };
    });

    setTimeout(() => {
      set({ checkpointStatusText: null });
    }, 3500);

    return cpId;
  },

  loadCheckpoint: (checkpointId: string) => {
    const cp = get().checkpoints.find((c) => c.checkpoint_id === checkpointId);
    if (!cp) return;

    set({
      worldTitle: cp.world_title,
      currentRoomId: cp.current_room_id,
      rooms: cp.rooms,
      storyGraph: cp.storyGraph,
      narrativeMessages: cp.narrativeMessages || [],
      guideState: cp.guideState,
      playerPosition: cp.playerPosition,
      activeCheckpoint: { ...cp, status: "restored" },
      activeScreen: "game",
      checkpointStatusText: `Restored checkpoint: ${cp.room_name}`,
    });

    get().ensureNeighborZones(cp.current_room_id);
    get().scheduleBoundedPriorityRendering();
    get().updateGuideGuidance();

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(ACTIVE_STATE_STORAGE_KEY, JSON.stringify(cp));
      } catch {}
    }

    setTimeout(() => {
      set({ checkpointStatusText: null });
    }, 3500);
  },

  restoreActiveCheckpoint: () => {
    const active = get().activeCheckpoint || get().checkpoints[0];
    if (active) {
      get().loadCheckpoint(active.checkpoint_id);
    }
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
        renderedRoomIds: {
          ...state.renderedRoomIds,
          [roomId]: true,
        },
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
      get().scheduleBoundedPriorityRendering();
      get().updateGuideGuidance();
      get().saveCheckpoint(`Arrived at ${targetRoom.name}`);
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

  toggleGodModeDirector: () => {
    const next = !get().isGodModeDirectorOpen;
    set({ isGodModeDirectorOpen: next });
    if (next && get().narrativeMessages.length === 0) {
      get().sendNarrativeTurn();
    }
  },

  resetWorld: () => {
    // Completely clear conversation history, story graph, active subtitles, and restart world cleanly
    try {
      if (typeof window !== "undefined") {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith("mira_") || k.includes("checkpoint") || k.includes("world"))) {
            localStorage.removeItem(k);
          }
        }
      }
    } catch (e) {
      console.warn("Storage reset warning:", e);
    }

    set({
      storyGraph: null,
      narrativeMessages: [],
      isNarrativeLoading: false,
      activeSubtitle: null,
      isCompilingWorld: false,
      diffusionProgress: 100,
      currentRoomId: initialRoomId,
      worldTitle: initialWorldTitle,
      rooms: { ...initialRoomsMap },
      npcs: { ...initialNpcsMap },
      renderedRoomIds: { [initialRoomId]: true },
    });

    // Automatically trigger fresh opening prompt
    setTimeout(() => {
      get().sendNarrativeTurn();
    }, 100);
  },

  setGodModeDirectorOpen: (open: boolean) => {
    set({ isGodModeDirectorOpen: open });
    if (open && get().narrativeMessages.length === 0) {
      get().sendNarrativeTurn();
    }
  },

  sendNarrativeTurn: async (playerMessage?: string) => {
    const state = get();
    const currentGraph = state.storyGraph;
    const stage = currentGraph ? currentGraph.interview_stage : "ask_core_story";

    if (playerMessage) {
      const userMsg: NarrativeDirectorMessage = {
        role: "player",
        content: playerMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      set({
        narrativeMessages: [...state.narrativeMessages, userMsg],
        isNarrativeLoading: true,
      });
    } else {
      set({ isNarrativeLoading: true });
    }

    const controller = new AbortController();
    const abortTimeout = setTimeout(() => controller.abort(), 20000);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
      const res = await fetch(`${apiUrl}/story/director/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          world_id: state.worldTitle.toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "world_active",
          world_title: state.worldTitle,
          current_room_id: state.currentRoomId,
          player_message: playerMessage || null,
          stage,
          existing_graph: currentGraph,
          simulate_provider: state.simulatedProvider,
        }),
      });
      clearTimeout(abortTimeout);

      if (res.ok) {
        const data = await res.json();
        const dirMsg: NarrativeDirectorMessage = {
          role: "mira",
          content: data.director_utterance,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          chips: data.suggested_chips || [],
          followUp: data.follow_up_question || undefined,
          suggestedBiome: data.suggested_biome || undefined,
          compilationPrompt: data.compilation_prompt || undefined,
        };

        const updatedState: Partial<WorldState> = {
          narrativeMessages: [...get().narrativeMessages, dirMsg],
          isNarrativeLoading: false,
          lastTelemetry: data.telemetry || get().lastTelemetry,
        };

        if (data.updated_graph) {
          updatedState.storyGraph = data.updated_graph;
        }

        // Integrate physical subagents into the active 3D world!
        if (Array.isArray(data.spawned_subagents) && data.spawned_subagents.length > 0) {
          const currentNpcs = { ...get().npcs };
          data.spawned_subagents.forEach((ag: KnowledgeAgentNode, idx: number) => {
            currentNpcs[ag.agent_id] = {
              npc_id: ag.agent_id,
              name: ag.name,
              room_id: get().currentRoomId,
              persona_description: `${ag.role}: ${ag.personality}. Secrets: ${ag.secret_knowledge}`,
              thought_log: ag.active_thought ? [ag.active_thought] : [`[PLANNING] Advance story beat in ${get().currentRoomId}.`],
              inventory: ["astrolabe", "cipher_key"],
              hp: 100,
              position: { r: 500, theta: -0.22 + idx * 0.42, phi: 1.65 },
            };
          });
          updatedState.npcs = currentNpcs;
        }

        // If guide agent returned, announce greeting and subtitle
        if (data.guide_agent) {
          const speech = data.guide_agent.narrative_dialogue_arc?.[0] || `Welcome, explorer! Follow my lead.`;
          updatedState.activeSubtitle = {
            npcId: data.guide_agent.agent_id,
            speaker: data.guide_agent.name,
            persona: `${data.guide_agent.role} — ${data.guide_agent.faction}`,
            text: speech,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
        }

        set(updatedState);
        get().updateGuideGuidance();
        return;
      }
    } catch (err) {
      console.warn("Nemotron narrative turn failed:", err);
    } finally {
      clearTimeout(abortTimeout);
    }

    // Fallback safe turn response if network dropped or timed out
    const fallbackDirMsg: NarrativeDirectorMessage = {
      role: "mira",
      content: playerMessage
        ? `I have recorded your command: "${playerMessage}". Preparing to enter your world.`
        : "What other clues or allies shall we summon to aid our quest?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      chips: [],
      followUp: "Who should join us? Name a companion:",
    };

    set({
      narrativeMessages: [...get().narrativeMessages, fallbackDirMsg],
      isNarrativeLoading: false,
    });
  },

  compileAndManifestFromMira: async (overridePrompt?: string, overrideBiome?: string) => {
    const state = get();
    const promptToUse = (overridePrompt || state.worldTitle || "The Great Pyramids of Giza").trim();
    const biomeToUse = overrideBiome || undefined;

    set({ isCompilingWorld: true, isGodModeDirectorOpen: false });
    const startTime = performance.now();

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
      const res = await fetch(`${apiUrl}/world/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptToUse,
          biome_hint: biomeToUse,
        }),
      });

      const latencyMs = performance.now() - startTime;
      if (res.ok) {
        const data = await res.json();
        if (data.world_graph && Array.isArray(data.world_graph.rooms) && data.world_graph.rooms.length > 0) {
          data.world_graph.prompt = promptToUse;
          get().hydrateFromMockWorld(data.world_graph);
          get().saveWorldToArchive({
            world_id: data.world_graph.world_id || `world_${Date.now()}`,
            title: data.world_graph.title || promptToUse,
            prompt: promptToUse,
            biome_hint: biomeToUse || "custom",
            created_at: new Date().toLocaleString(),
            world_data: data.world_graph,
          });
          get().setActiveScreen("game");
        }

        const source = data.generation_metadata?.source || "live_generative";
        const isLive = source === "live_generative" || source === "gemini_generative";
        get().setLastTelemetry({
          provider: isLive ? "gemini_flash" : "offline_mock",
          latency_ms: latencyMs,
          fallback_occurred: !isLive,
          fallback_reason: !isLive ? data.generation_metadata?.reason : undefined,
        });
      }
    } catch (e) {
      console.warn("compileAndManifestFromMira error:", e);
    } finally {
      set({ isCompilingWorld: false });
      get().updateGuideGuidance();
    }
  },

  updateGuideGuidance: () => {
    const state = get();
    if (!state.storyGraph) return;

    const currentRoom = state.rooms[state.currentRoomId];
    if (!currentRoom) return;

    // Find active guide agent
    const guide = state.storyGraph.agents.find((a) => a.role.toLowerCase() === "guide") || state.storyGraph.agents[0];
    if (!guide) return;

    // Find current active story beat
    const activeBeat = state.storyGraph.story_beats.find((b) => b.is_unlocked) || state.storyGraph.story_beats[0];
    const targetLoc = state.storyGraph.locations.find((l) => l.location_id === activeBeat?.target_location_id);
    const targetRoomId = targetLoc?.room_id || state.currentRoomId;

    if (targetRoomId === state.currentRoomId) {
      set({
        guideState: {
          agentId: guide.agent_id,
          name: guide.name,
          targetRoomId,
          nextHopRoomId: null,
          isStalling: false,
          stallMessage: null,
          instructionText: `We have reached ${currentRoom.name}! Explore the chamber for clues.`,
          chunkedPath: [currentRoom.room_id],
        },
      });
      return;
    }

    // BFS path across rooms to targetRoomId
    const queue: Array<{ id: string; path: string[] }> = [{ id: state.currentRoomId, path: [state.currentRoomId] }];
    const visited = new Set<string>([state.currentRoomId]);
    let foundPath: string[] | null = null;

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur.id === targetRoomId) {
        foundPath = cur.path;
        break;
      }
      const r = state.rooms[cur.id];
      if (r && r.adjacent_room_ids) {
        for (const adj of r.adjacent_room_ids) {
          if (!visited.has(adj)) {
            visited.add(adj);
            queue.push({ id: adj, path: [...cur.path, adj] });
          }
        }
      }
    }

    const chunkedPath = foundPath || [state.currentRoomId, targetRoomId];
    const nextHopRoomId = chunkedPath.length > 1 ? chunkedPath[1] : targetRoomId;
    const isNextHopRendered = Boolean(state.renderedRoomIds[nextHopRoomId]);
    const nextHopRoom = state.rooms[nextHopRoomId];
    const nextHopName = nextHopRoom?.name || "the next chamber";

    if (!isNextHopRendered) {
      // In-character age 10-13 stalling dialogue while chunk renders!
      const stallPhrases = [
        `Hold up a moment, explorer! The stone gears in this archway are still shifting into place. Let me inspect the runes on this lintel before we step into ${nextHopName}.`,
        `Wait—my astrolabe is picking up magnetic interference ahead. Give me ten seconds to calibrate the bearing so we don't trip an ancient mechanism entering ${nextHopName}.`,
        `Check out this carving on the wall while the dust clears in the corridor to ${nextHopName}! That constellation glyph is our key.`,
      ];
      const hash = Math.abs(nextHopRoomId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0));
      const stallMsg = stallPhrases[hash % stallPhrases.length];

      set({
        guideState: {
          agentId: guide.agent_id,
          name: guide.name,
          targetRoomId,
          nextHopRoomId,
          isStalling: true,
          stallMessage: stallMsg,
          instructionText: stallMsg,
          chunkedPath,
        },
      });

      // Priority render the next hop immediately!
      get().scheduleBoundedPriorityRendering();
    } else {
      // Fully rendered and safe!
      set({
        guideState: {
          agentId: guide.agent_id,
          name: guide.name,
          targetRoomId,
          nextHopRoomId,
          isStalling: false,
          stallMessage: null,
          instructionText: `The archway to ${nextHopName} is open and clear! Follow me through.`,
          chunkedPath,
        },
      });
    }
  },

  advanceStoryBeat: (beatId: string) => {
    set((state) => {
      if (!state.storyGraph) return state;
      const updatedBeats = state.storyGraph.story_beats.map((b) =>
        b.beat_id === beatId ? { ...b, is_unlocked: true } : b
      );
      return {
        storyGraph: {
          ...state.storyGraph,
          story_beats: updatedBeats,
          current_beat_id: beatId,
        },
      };
    });
    get().updateGuideGuidance();
  },

  dispatchSubagentMovement: (agentId: string, mode: "escorting_player" | "patrolling" | "stationed" | "beckoning_to_gateway") => {
    set((state) => {
      if (!state.storyGraph) return state;
      const updatedAgents = state.storyGraph.agents.map((ag) =>
        ag.agent_id === agentId ? { ...ag, movement_mode: mode } : ag
      );
      return {
        storyGraph: {
          ...state.storyGraph,
          agents: updatedAgents,
        },
      };
    });
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
    const rawPrompt = worldData.prompt || worldData.title || rawTitle;

    const initialRendered: Record<string, boolean> = {};
    if (initialId) {
      initialRendered[initialId] = true;
    }

    set((state) => ({
      worldTitle: rawTitle,
      worldPrompt: rawPrompt,
      topologyType: topo,
      currentRoomId: initialId,
      rooms: roomsMap,
      npcs: npcsMap,
      quests: worldData.quests || [],
      selectedNpcId: null,
      activeSubtitle: null,
      renderedRoomIds: initialRendered,
      playerPosition: {
        x: initialRoom?.worldX || 0,
        z: initialRoom?.worldZ || 0,
        yaw: 0,
      },
      teleportTrigger: state.teleportTrigger + 1,
    }));

    // immediately ensure all adjacent neighboring zones exist upon entering the world
    get().ensureNeighborZones(initialId);
    get().scheduleBoundedPriorityRendering();
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
      }
    }

    if (modified) {
      currentRooms[roomId] = {
        ...sourceRoom,
        adjacent_room_ids: Array.from(newAdjacent),
      };
      set({ rooms: currentRooms, npcs: currentNpcs });
    }

    // Slowly begin rendering neighbor rooms with priority along current exploration path
    get().scheduleBoundedPriorityRendering();
  },

  markRoomRendered: (roomId: string, rendered: boolean = true) => {
    set((state) => ({
      renderedRoomIds: {
        ...state.renderedRoomIds,
        [roomId]: rendered,
      },
    }));
  },

  scheduleBoundedPriorityRendering: () => {
    const state = get();
    if (state.isExpanding || state.isPriorityWorkerActive) {
      return;
    }

    const currentRoom = state.rooms[state.currentRoomId];
    if (!currentRoom) return;

    const currX = currentRoom.worldX || 0;
    const currZ = currentRoom.worldZ || 0;
    const tDir = state.transitionDirection || [0, 0, -1];
    const tDirLen = Math.hypot(tDir[0], tDir[2]) || 1;
    const headingX = tDir[0] / tDirLen;
    const headingZ = tDir[2] / tDirLen;

    const MAX_BOUNDED_RANGE = 450.0; // Strictly bounded range: <= 2 hops (never infinite)

    // Find all unrendered candidate rooms within bounded range
    const candidates: Array<{
      roomId: string;
      room: WorldRoom;
      dist: number;
      score: number;
    }> = [];

    for (const [rId, room] of Object.entries(state.rooms)) {
      if (rId === state.currentRoomId) continue;
      if (state.renderedRoomIds[rId]) continue; // already fully rendered

      const rx = room.worldX || 0;
      const rz = room.worldZ || 0;
      const dx = rx - currX;
      const dz = rz - currZ;
      const dist = Math.hypot(dx, dz);

      if (dist > MAX_BOUNDED_RANGE) {
        continue; // Outside bounded range - strictly do not render!
      }

      // Directional alignment with player exploration path heading
      const nx = dist > 0.001 ? dx / dist : 0;
      const nz = dist > 0.001 ? dz / dist : 0;
      const dot = nx * headingX + nz * headingZ; // -1 (behind) to +1 (in front)

      // Direct adjacent neighbors get highest immediate priority
      const isDirectNeighbor = (currentRoom.adjacent_room_ids || []).includes(rId);

      // Score: lowest value is highest priority
      const score = dist - (isDirectNeighbor ? 1000 : 0) - (dot * 300);

      candidates.push({ roomId: rId, room, dist, score });
    }

    if (candidates.length === 0) {
      return;
    }

    // Sort candidates by priority score ascending
    candidates.sort((a, b) => a.score - b.score);
    const targetCandidate = candidates[0];

    // Determine direction relative to current room
    const tdx = (targetCandidate.room.worldX || 0) - currX;
    const tdz = (targetCandidate.room.worldZ || 0) - currZ;
    let dir = "north";
    if (Math.abs(tdx) > Math.abs(tdz)) {
      dir = tdx > 0 ? "east" : "west";
    } else {
      dir = tdz > 0 ? "south" : "north";
    }

    set({ isPriorityWorkerActive: true });

    // Slowly and deliberately render with paced delay
    setTimeout(async () => {
      try {
        await get().expandWorld(
          state.currentRoomId,
          dir,
          targetCandidate.room.worldX,
          targetCandidate.room.worldZ
        );
        // Mark candidate as rendered in state
        set((s) => ({
          renderedRoomIds: {
            ...s.renderedRoomIds,
            [targetCandidate.roomId]: true,
          },
          isPriorityWorkerActive: false,
        }));
        get().updateGuideGuidance();
      } catch (e) {
        console.warn("Priority render error:", e);
        set({ isPriorityWorkerActive: false });
      }

      // Pace next room rendering with a deliberate delay
      setTimeout(() => {
        get().scheduleBoundedPriorityRendering();
      }, 1600);
    }, 350);
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

          set((s) => ({
            rooms: updatedRooms,
            npcs: newNpcs,
            isExpanding: false,
            diffusionProgress: 100,
            renderedRoomIds: {
              ...s.renderedRoomIds,
              [nr.room_id]: true,
            },
            activeSubtitle: firstNpc
              ? {
                  npcId: firstNpc.npc_id,
                  speaker: firstNpc.name,
                  persona: firstNpc.persona_description,
                  text: `Discovered new sector: ${nr.name}. Welcome, explorer.`,
                  thoughtLog: firstNpc.thought_log?.[0],
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                }
              : s.activeSubtitle,
          }));

          get().updateGuideGuidance();
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

    set((s) => ({
      rooms: {
        ...s.rooms,
        ...(updatedSource ? { [sourceRoomId]: updatedSource } : {}),
        [fallbackId]: fallbackRoom,
      },
      isExpanding: false,
      diffusionProgress: 100,
      renderedRoomIds: {
        ...s.renderedRoomIds,
        [fallbackId]: true,
      },
    }));

    get().updateGuideGuidance();
    drainQueue();
    return fallbackRoom;
  },

  initializeSync: () => {
    const isOffline = process.env.NEXT_PUBLIC_USE_CACHE === "true";
    set({ isOfflineMode: isOffline });

    if (typeof window !== "undefined") {
      try {
        // Completely flush all saved environments and active sessions on reload to start from scratch
        localStorage.removeItem(ARCHIVE_STORAGE_KEY);
        localStorage.removeItem(CHECKPOINTS_STORAGE_KEY);
        localStorage.removeItem(ACTIVE_STATE_STORAGE_KEY);
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith("mira_") || k.includes("checkpoint") || k.includes("world"))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch (err) {
        console.warn("Storage flush notice:", err);
      }
    }

    // Reset store state to clean initial scratch state
    set({
      savedWorlds: BUILTIN_ARCHIVES,
      checkpoints: [],
      activeCheckpoint: null,
      storyGraph: null,
      narrativeMessages: [],
      currentRoomId: initialRoomId,
      worldTitle: initialWorldTitle,
      rooms: { ...initialRoomsMap },
      npcs: { ...initialNpcsMap },
      activeScreen: "game",
      isCompilingWorld: false,
      diffusionProgress: 100,
      activeSubtitle: null,
      playerPosition: { x: 0, z: 0, yaw: 0 },
      guideState: null,
      renderedRoomIds: { [initialRoomId]: true },
    });

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
