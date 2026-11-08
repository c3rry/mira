# canonical pydantic contracts for mira 3d rpg engine
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class TelemetryMetadata(BaseModel):
    # active model provider servicing the request
    provider: Literal["nemotron_70b", "gemini_flash", "offline_mock"]
    latency_ms: float
    fallback_occurred: bool = False
    fallback_reason: Optional[str] = None


class SphericalCoord(BaseModel):
    # inward-facing sphere radius (default 500 units)
    r: float = 500.0
    # azimuth angle in radians [-pi, pi]
    theta: float
    # polar angle in radians [0, pi]
    phi: float


class VisionBoundingBox(BaseModel):
    # normalized vision coordinate bounds [0, 1000]
    ymin: float
    xmin: float
    ymax: float
    xmax: float
    label: Optional[str] = None


class PropEntity(BaseModel):
    # interactive 3d prop metadata
    prop_id: str
    name: str
    mesh_url: str
    position: SphericalCoord
    scale: float = 1.0
    interactive: bool = False


class NPCEntity(BaseModel):
    # autonomous npc entity definition
    npc_id: str
    name: str
    room_id: str
    persona_description: str
    thought_log: List[str] = Field(default_factory=list)
    active_plan: Optional[str] = None
    inventory: List[str] = Field(default_factory=list)
    hp: int = 100
    position: Optional[SphericalCoord] = None


class LightingConfig(BaseModel):
    # room lighting attributes
    ambient_color: str = "#ffffff"
    ambient_intensity: float = 0.8
    fog_color: str = "#000000"
    fog_density: float = 0.015


class RoomVisualPalette(BaseModel):
    dominant_color: str = "#0284c7"
    accent_color: str = "#38bdf8"
    sky_tone: str = "#1e293b"
    floor_tone: str = "#0f172a"


class NodeState(BaseModel):
    # 360 panoramic room node definition
    room_id: str
    name: str
    biome_type: str
    panorama_url: str
    depth_url: str
    adjacent_room_ids: List[str] = Field(default_factory=list)
    mutation_level: float = 0.0
    lighting: LightingConfig = Field(default_factory=LightingConfig)
    npcs: List[NPCEntity] = Field(default_factory=list)
    props: List[PropEntity] = Field(default_factory=list)
    worldX: Optional[float] = None
    worldZ: Optional[float] = None
    topology_type: Optional[str] = None
    visual_palette: Optional[RoomVisualPalette] = None


class QuestObjective(BaseModel):
    # narrative quest condition
    quest_id: str
    title: str
    is_completed: bool = False
    trigger_flag: str


class WorldGraph(BaseModel):
    # authoritative world topology
    world_id: str
    title: str
    initial_room_id: str
    rooms: List[NodeState] = Field(default_factory=list)
    quests: List[QuestObjective] = Field(default_factory=list)
    topology_type: Optional[str] = "hub_spoke"


class WorldExpandRequest(BaseModel):
    world_id: str
    from_room_id: str
    direction: Optional[str] = "forward"
    world_prompt: str
    existing_room_ids: List[str] = Field(default_factory=list)
    topology_type: Optional[str] = None
    from_room_name: Optional[str] = None
    from_room_biome: Optional[str] = None
    from_room_x: Optional[float] = None
    from_room_z: Optional[float] = None
    from_room_palette: Optional[RoomVisualPalette] = None
    from_room_panorama_url: Optional[str] = None
    from_room_depth_url: Optional[str] = None
    from_room_lighting: Optional[LightingConfig] = None
    target_x: Optional[float] = None
    target_z: Optional[float] = None


class WorldExpandResponse(BaseModel):
    new_room: NodeState
    connected_room_id: str
    world_id: str
    topology_type: str


class NPCInteractionRequest(BaseModel):
    # npc dialogue prompt payload
    npc_id: str
    player_message: str
    room_id: str
    simulate_provider: Optional[Literal["nemotron_70b", "gemini_flash", "offline_mock"]] = None


class NPCInteractionResponse(BaseModel):
    # partitioned dialogue and thought response
    npc_id: str
    utterance: str
    thought_log: str
    action_dispatch: Optional[str] = None
    telemetry: TelemetryMetadata


class WorldCompileRequest(BaseModel):
    # prompt-to-world compilation payload
    prompt: str
    biome_hint: Optional[str] = None


class GenerationMetadata(BaseModel):
    # telemetry on generation provenance
    source: Literal["live_generative", "cache_fallback"]
    provider: Optional[str] = "gemini_flash"
    latency_ms: float
    reason: Optional[str] = None


class WorldCompileResponse(BaseModel):
    # compiled world graph with generation telemetry
    world_graph: WorldGraph
    generation_metadata: GenerationMetadata


class WorldTickRequest(BaseModel):
    # world loop tick simulation
    world_id: str
    current_room_id: str


class NPCRoamDecision(BaseModel):
    # autonomous npc room transition
    npc_id: str
    origin_room_id: str
    destination_room_id: str


class WorldTickResponse(BaseModel):
    # world tick cycle state updates
    moved_npcs: List[NPCRoamDecision] = Field(default_factory=list)
    quest_updates: List[QuestObjective] = Field(default_factory=list)


class ClarifyingOption(BaseModel):
    label: str
    enhancement: str


class ClarifyingQuestion(BaseModel):
    id: str
    question: str
    options: List[ClarifyingOption]


class ChatRefineRequest(BaseModel):
    prompt: str
    selected_options: Optional[List[str]] = None


class ChatRefineResponse(BaseModel):
    refined_prompt: str
    suggested_biome: str
    clarifying_questions: List[ClarifyingQuestion]


class KnowledgeLocationNode(BaseModel):
    location_id: str
    name: str
    room_id: str
    biome_type: str
    story_role: str
    atmosphere_desc: str
    world_x: float = 0.0
    world_z: float = 0.0


class KnowledgeAgentNode(BaseModel):
    agent_id: str
    name: str
    role: str  # "Guide", "Historian", "Rival", "Keeper", "Scout", "Merchant"
    personality: str
    appearance_style: str
    current_location_id: str
    movement_mode: Literal["escorting_player", "patrolling", "stationed", "beckoning_to_gateway"] = "stationed"
    target_gateway_bearing: Optional[float] = None
    narrative_dialogue_arc: List[str] = Field(default_factory=list)
    secret_knowledge: str
    faction: str
    patrol_waypoints: List[Dict[str, float]] = Field(default_factory=list)
    active_thought: Optional[str] = None


class KnowledgeRelationshipEdge(BaseModel):
    source_agent_id: str
    target_agent_id: str
    relation_type: Literal["allies_with", "mistrusts", "guards", "reports_to", "guides_player_to", "rival_of"]
    interaction_lore: str


class KnowledgeStoryBeatNode(BaseModel):
    beat_id: str
    title: str
    stage: Literal["act_1_exposition", "act_2_exploration", "act_3_revelation"]
    narrative_cue: str
    target_location_id: str
    required_agent_id: str
    is_unlocked: bool = False


class StoryKnowledgeGraph(BaseModel):
    story_title: str
    synopsis: str
    interview_stage: Literal[
        "ask_core_story",
        "ask_sub_environments",
        "ask_key_agents",
        "compiled_active",
        "premise",
        "sub_environments",
        "key_figures",
    ]
    locations: List[KnowledgeLocationNode] = Field(default_factory=list)
    agents: List[KnowledgeAgentNode] = Field(default_factory=list)
    relationships: List[KnowledgeRelationshipEdge] = Field(default_factory=list)
    story_beats: List[KnowledgeStoryBeatNode] = Field(default_factory=list)
    current_beat_id: Optional[str] = None


class NarrativeChatTurnRequest(BaseModel):
    world_id: str
    world_title: str
    current_room_id: str
    player_message: Optional[str] = None
    stage: Optional[str] = "ask_core_story"
    existing_graph: Optional[StoryKnowledgeGraph] = None
    simulate_provider: Optional[Literal["nemotron_70b", "gemini_flash", "offline_mock"]] = None


class NarrativeChatTurnResponse(BaseModel):
    director_utterance: str
    next_stage: Literal[
        "ask_core_story",
        "ask_sub_environments",
        "ask_key_agents",
        "compiled_active",
        "premise",
        "sub_environments",
        "key_figures",
    ]
    follow_up_question: Optional[str] = None
    suggested_chips: List[str] = Field(default_factory=list)
    premise_suggestions: List[str] = Field(default_factory=list)
    updated_graph: Optional[StoryKnowledgeGraph] = None
    spawned_subagents: List[KnowledgeAgentNode] = Field(default_factory=list)
    guide_agent: Optional[KnowledgeAgentNode] = None
    suggested_biome: Optional[str] = None
    compilation_prompt: Optional[str] = None
    telemetry: TelemetryMetadata
