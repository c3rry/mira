// spacetimedb canonical table interfaces and reducer declarations for mira

export interface WorldRoom {
  room_id: string;
  name: string;
  panorama_url: string;
  depth_url: string;
  adjacent_room_ids: string[];
  mutation_level: number;
  biome_type: string;
}

export interface NPCAgent {
  npc_id: string;
  name: string;
  room_id: string;
  persona_description: string;
  thought_log: string[];
  active_plan: string;
  inventory: string[];
  hp: number;
}

export interface QuestObjective {
  quest_id: string;
  title: string;
  is_completed: boolean;
  trigger_flag: string;
}

export interface PlayerSession {
  player_id: string;
  room_id: string;
  last_active_timestamp: number;
}

// reducer signatures for reactive state transitions
export type UpdatePlayerRoomReducer = (player_id: string, target_room_id: string) => void;
export type MoveNPCReducer = (npc_id: string, destination_room_id: string) => void;
export type MutateRoomAtmosphereReducer = (room_id: string, mutation_factor: number) => void;
export type CommitNPCDialogueReducer = (
  npc_id: string,
  player_utterance: string,
  response_utterance: string,
  thought_log: string
) => void;
