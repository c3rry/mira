# world graph compilation endpoints
from fastapi import APIRouter, Request
from backend.app.schemas import WorldCompileRequest, WorldCompileResponse
from backend.app.services.compiler import compile_world_with_circuit_breaker

router = APIRouter(tags=["world"])


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
