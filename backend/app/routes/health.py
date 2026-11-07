# health check and diagnostics endpoint
import os
from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    # system health and cache hydration telemetry
    status: str
    mock_world_loaded: bool
    rooms_count: int
    initial_room: str
    offline_mode: bool
    spacetimedb_host: str


@router.get("/health", response_model=HealthResponse)
async def get_health(request: Request):
    # check if mock world is loaded in app state
    mock_world = getattr(request.app.state, "mock_world", None)
    rooms_count = len(mock_world.rooms) if mock_world else 0
    initial_room = mock_world.initial_room_id if mock_world else ""
    offline_mode = os.getenv("NEXT_PUBLIC_USE_CACHE", "false").lower() == "true"
    st_host = os.getenv("NEXT_PUBLIC_SPACETIMEDB_HOST", "localhost:3001")

    return HealthResponse(
        status="healthy",
        mock_world_loaded=mock_world is not None,
        rooms_count=rooms_count,
        initial_room=initial_room,
        offline_mode=offline_mode,
        spacetimedb_host=st_host,
    )
