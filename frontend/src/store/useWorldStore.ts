// zustand primary world store with reactive spacetimedb sync and offline fallback
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

export interface WorldState {
  // state fields
  currentRoomId: string;
  rooms: Record<string, WorldRoom>;
  npcs: Record<string, NPCAgent>;
  quests: QuestObjective[];
  lastTelemetry: TelemetryMetadata | null;
  isOfflineMode: boolean;
  isSpacetimeConnected: boolean;
  simulatedProvider: "nemotron_70b" | "gemini_flash" | "offline_mock" | null;
  isGodModeOpen: boolean;
  selectedNpcId: string | null;

  // actions
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
  currentRoomId: "room_cyber_lab_01",
  rooms: {},
  npcs: {},
  quests: [],
  lastTelemetry: {
    provider: "offline_mock",
    latency_ms: 0.1,
    fallback_occurred: false,
  },
  isOfflineMode: false,
  isSpacetimeConnected: false,
  simulatedProvider: null,
  isGodModeOpen: false,
  selectedNpcId: null,

  setCurrentRoom: (roomId: string) => {
    const { rooms } = get();
    if (rooms[roomId]) {
      set({ currentRoomId: roomId });
    }
  },

  selectNPC: (npcId: string | null) => {
    set({ selectedNpcId: npcId });
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

    worldData.rooms.forEach((r: any) => {
      roomsMap[r.room_id] = {
        room_id: r.room_id,
        name: r.name,
        panorama_url: r.panorama_url,
        depth_url: r.depth_url,
        adjacent_room_ids: r.adjacent_room_ids || [],
        mutation_level: r.mutation_level || 0.0,
        biome_type: r.biome_type || "default",
        props: r.props || [],
      };

      if (Array.isArray(r.npcs)) {
        r.npcs.forEach((npc: any) => {
          npcsMap[npc.npc_id] = {
            npc_id: npc.npc_id,
            name: npc.name,
            room_id: npc.room_id,
            persona_description: npc.persona_description,
            thought_log: npc.thought_log || [],
            active_plan: npc.active_plan,
            inventory: npc.inventory || [],
            hp: npc.hp || 100,
            position: npc.position,
          };
        });
      }
    });

    set({
      currentRoomId: worldData.initial_room_id || Object.keys(roomsMap)[0] || "",
      rooms: roomsMap,
      npcs: npcsMap,
      quests: worldData.quests || [],
    });
  },

  initializeSync: () => {
    const isOffline = process.env.NEXT_PUBLIC_USE_CACHE === "true";
    set({ isOfflineMode: isOffline });

    if (isOffline) {
      // offline mode: fetch local cached world json
      fetch("/cached_worlds/manifest.json")
        .then((res) => res.json())
        .then((data) => {
          // parse manifest biomes into initial world state
          if (data && data.biomes) {
            const roomsMap: Record<string, WorldRoom> = {};
            Object.entries(data.biomes).forEach(([key, biome]: [string, any]) => {
              roomsMap[key] = {
                room_id: key,
                name: biome.name,
                panorama_url: biome.panorama,
                depth_url: biome.depth,
                adjacent_room_ids: [],
                mutation_level: 0.0,
                biome_type: key,
              };
            });
            set({
              currentRoomId: Object.keys(roomsMap)[0] || "",
              rooms: roomsMap,
            });
          }
        })
        .catch((err) => {
          console.warn("failed to load local manifest:", err);
        });
    }
  },
}));
