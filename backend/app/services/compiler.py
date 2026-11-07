# world compilation orchestrator with 9.0s circuit breaker and zero-latency cache fallback
import asyncio
import logging
import time
from typing import Optional
from backend.app.schemas import (
    GenerationMetadata,
    WorldCompileResponse,
    WorldGraph,
)
from backend.app.services.gemini_generator import generate_world_graph

logger = logging.getLogger("mira.compiler")

CIRCUIT_BREAKER_TIMEOUT_SECONDS = 9.0


async def compile_world_with_circuit_breaker(
    prompt: str,
    biome_hint: Optional[str] = None,
    cached_world: Optional[WorldGraph] = None,
    timeout_seconds: Optional[float] = None,
) -> WorldCompileResponse:
    effective_timeout = (
        timeout_seconds
        if timeout_seconds is not None
        else CIRCUIT_BREAKER_TIMEOUT_SECONDS
    )
    start_time = time.perf_counter()

    try:
        # wrap generative call in strict circuit breaker timeout
        world_graph = await asyncio.wait_for(
            generate_world_graph(prompt=prompt, biome_hint=biome_hint),
            timeout=effective_timeout,
        )

        latency_ms = (time.perf_counter() - start_time) * 1000.0
        return WorldCompileResponse(
            world_graph=world_graph,
            generation_metadata=GenerationMetadata(
                source="live_generative",
                provider="gemini_flash",
                latency_ms=round(latency_ms, 2),
            ),
        )

    except asyncio.TimeoutError:
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        logger.warning(
            f"[CircuitBreaker] Upstream generation timed out after {effective_timeout}s. Returning cached fallback."
        )

        # resolve in-memory fallback graph
        fallback_graph = (
            cached_world.model_copy(deep=True)
            if cached_world
            else WorldGraph(
                world_id="offline_fallback_world",
                title="Offline Frontier",
                initial_room_id="room_fallback_01",
                rooms=[],
                quests=[],
            )
        )

        return WorldCompileResponse(
            world_graph=fallback_graph,
            generation_metadata=GenerationMetadata(
                source="cache_fallback",
                provider="gemini_flash",
                latency_ms=round(latency_ms, 2),
                reason=f"timeout_{int(effective_timeout)}s",
            ),
        )

    except Exception as exc:
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        logger.warning(
            f"[CircuitBreaker] Upstream error ({type(exc).__name__}: {exc}). Returning cached fallback."
        )

        fallback_graph = (
            cached_world.model_copy(deep=True)
            if cached_world
            else WorldGraph(
                world_id="offline_fallback_world",
                title="Offline Frontier",
                initial_room_id="room_fallback_01",
                rooms=[],
                quests=[],
            )
        )

        return WorldCompileResponse(
            world_graph=fallback_graph,
            generation_metadata=GenerationMetadata(
                source="cache_fallback",
                provider="gemini_flash",
                latency_ms=round(latency_ms, 2),
                reason=f"error_{type(exc).__name__}",
            ),
        )
