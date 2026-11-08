# world graph compilation and interactive prompt refinement endpoints
from fastapi import APIRouter, Request
from backend.app.schemas import (
    ChatRefineRequest,
    ChatRefineResponse,
    WorldCompileRequest,
    WorldCompileResponse,
    WorldExpandRequest,
    WorldExpandResponse,
)
from backend.app.services.compiler import compile_world_with_circuit_breaker
from backend.app.services.gemini_generator import generate_expanded_room
from backend.app.services.prompt_refiner import refine_prompt_and_ask_clarifications

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

    new_node = generate_expanded_room(
        world_id=body.world_id,
        from_room_id=body.from_room_id,
        from_room=from_room,
        direction=body.direction,
        world_prompt=body.world_prompt,
        existing_room_ids=body.existing_room_ids,
        topology_type=body.topology_type,
    )

    return WorldExpandResponse(
        new_room=new_node,
        connected_room_id=body.from_room_id,
        world_id=body.world_id,
        topology_type=new_node.topology_type or "nature_open",
    )
