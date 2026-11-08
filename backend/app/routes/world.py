# world graph compilation and interactive prompt refinement endpoints
from fastapi import APIRouter, Request
from backend.app.schemas import (
    ChatRefineRequest,
    ChatRefineResponse,
    WorldCompileRequest,
    WorldCompileResponse,
)
from backend.app.services.compiler import compile_world_with_circuit_breaker
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
