# test suite for 9.0s circuit breaker and fallback response schemas
import asyncio
import pytest
from httpx import ASGITransport, AsyncClient
from backend.app.main import app
from backend.app.schemas import WorldCompileResponse, WorldGraph


@pytest.mark.asyncio
async def test_compile_live_generative_success(monkeypatch):
    # test successful live generation return
    dummy_graph = WorldGraph(
        world_id="generated_test_world",
        title="Generated Cyber Oasis",
        initial_room_id="room_01",
        rooms=[],
        quests=[],
    )

    async def mock_generate(prompt, biome_hint=None):
        return dummy_graph

    monkeypatch.setattr(
        "backend.app.services.compiler.generate_world_graph", mock_generate
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        async with app.router.lifespan_context(app):
            resp = await client.post(
                "/world/compile",
                json={"prompt": "neon cyberpunk courtyard", "biome_hint": "cyberpunk"},
            )
            assert resp.status_code == 200
            data = resp.json()
            validated = WorldCompileResponse.model_validate(data)
            assert validated.generation_metadata.source == "live_generative"
            assert validated.generation_metadata.provider == "gemini_flash"
            assert validated.world_graph.world_id == "generated_test_world"


@pytest.mark.asyncio
async def test_compile_circuit_breaker_timeout_fallback(monkeypatch):
    # test upstream timeout triggers 200 OK cache fallback
    async def mock_slow_generate(prompt, biome_hint=None):
        await asyncio.sleep(15.0)
        return None

    monkeypatch.setattr(
        "backend.app.services.compiler.generate_world_graph", mock_slow_generate
    )
    # patch timeout to 0.1s for fast deterministic test execution
    monkeypatch.setattr(
        "backend.app.services.compiler.CIRCUIT_BREAKER_TIMEOUT_SECONDS", 0.1
    )
    monkeypatch.setattr(
        "backend.app.services.gemini_generator.generate_room_panorama_and_depth",
        lambda **kwargs: None,
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        async with app.router.lifespan_context(app):
            resp = await client.post(
                "/world/compile",
                json={"prompt": "slow generating world"},
            )
            assert resp.status_code == 200
            data = resp.json()
            validated = WorldCompileResponse.model_validate(data)
            assert validated.generation_metadata.source == "cache_fallback"
            assert "timeout" in (validated.generation_metadata.reason or "")
            # verify pre-loaded 15 rooms are delivered in fallback
            assert len(validated.world_graph.rooms) == 15


@pytest.mark.asyncio
async def test_compile_upstream_exception_fallback(monkeypatch):
    # test upstream 500 or rate limit exception triggers cache fallback
    async def mock_failing_generate(prompt, biome_hint=None):
        raise ConnectionError("Upstream Gemini API connection reset")

    monkeypatch.setattr(
        "backend.app.services.compiler.generate_world_graph", mock_failing_generate
    )
    monkeypatch.setattr(
        "backend.app.services.gemini_generator.generate_room_panorama_and_depth",
        lambda **kwargs: None,
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        async with app.router.lifespan_context(app):
            resp = await client.post(
                "/world/compile",
                json={"prompt": "failing world prompt"},
            )
            assert resp.status_code == 200
            data = resp.json()
            validated = WorldCompileResponse.model_validate(data)
            assert validated.generation_metadata.source == "cache_fallback"
            assert "ConnectionError" in (validated.generation_metadata.reason or "")
            assert len(validated.world_graph.rooms) == 15
