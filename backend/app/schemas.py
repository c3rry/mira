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
