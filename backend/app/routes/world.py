# world graph compilation and interactive prompt refinement endpoints
from fastapi import APIRouter, Request
from backend.app.schemas import (
    ChatRefineRequest,
    ChatRefineResponse,
    LightingConfig,
    NodeState,
    WorldCompileRequest,
    WorldCompileResponse,
    WorldExpandRequest,
    WorldExpandResponse,
)
from backend.app.services.compiler import compile_world_with_circuit_breaker
from backend.app.services.gemini_generator import generate_expanded_room
from backend.app.services.prompt_refiner import refine_prompt_and_ask_clarifications
from backend.app.services.fusion_logger import trace_expansion_event

router = APIRouter(tags=["world"])


@router.post("/chat/refine", response_model=ChatRefineResponse)
async def refine_prompt(body: ChatRefineRequest):
    return refine_prompt_and_ask_clarifications(
        prompt=body.prompt,
        selected_options=body.selected_options,
    )


@router.post("/world/compile", response_model=WorldCompileResponse)
async def compile_world(body: WorldCompileRequest, request: Request):
    # resolve pre-loaded mock world from app state
    cached_world = getattr(request.app.state, "mock_world", None)

    # execute world compilation with 9.0s circuit breaker
    response = await compile_world_with_circuit_breaker(
        prompt=body.prompt,
        biome_hint=body.biome_hint,
        cached_world=cached_world,
    )

    return response


@router.post("/world/expand", response_model=WorldExpandResponse)
async def expand_world_endpoint(body: WorldExpandRequest, request: Request):
    from_room = None
    cached_world = getattr(request.app.state, "mock_world", None)
    if cached_world and getattr(cached_world, "rooms", None):
        for r in cached_world.rooms:
            if r.room_id == body.from_room_id:
                from_room = r
                break

    if not from_room and body.from_room_name:
        b_theme = body.from_room_biome or "desert_oasis"
        from_room = NodeState(
            room_id=body.from_room_id,
            name=body.from_room_name,
            biome_type=b_theme,
            panorama_url=body.from_room_panorama_url or f"/cached_worlds/{b_theme}/panorama.webp",
            depth_url=body.from_room_depth_url or f"/cached_worlds/{b_theme}/depth.png",
            worldX=body.from_room_x or 0.0,
            worldZ=body.from_room_z or 0.0,
            visual_palette=body.from_room_palette,
            lighting=body.from_room_lighting or LightingConfig(),
        )

    new_node = generate_expanded_room(
        world_id=body.world_id,
        from_room_id=body.from_room_id,
        from_room=from_room,
        direction=body.direction,
        world_prompt=body.world_prompt,
        existing_room_ids=body.existing_room_ids,
        topology_type=body.topology_type,
        target_x=body.target_x,
        target_z=body.target_z,
    )

    npc_name = new_node.npcs[0].name if new_node.npcs else "None"
    trace_expansion_event(
        from_room_id=body.from_room_id,
        direction=body.direction,
        target_x=new_node.worldX or 0.0,
        target_z=new_node.worldZ or 0.0,
        new_room_id=new_node.room_id,
        new_room_name=new_node.name,
        pano_url=new_node.panorama_url,
        depth_url=new_node.depth_url,
        npc_name=npc_name,
    )

    return WorldExpandResponse(
        new_room=new_node,
        connected_room_id=body.from_room_id,
        world_id=body.world_id,
        topology_type=new_node.topology_type or "nature_open",
    )
