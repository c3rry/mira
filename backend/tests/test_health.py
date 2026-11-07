# test suite for health check and lifespan mock pre-loading
import pytest
from httpx import ASGITransport, AsyncClient
from backend.app.main import app


@pytest.mark.asyncio
async def test_root_endpoint():
    # test root status endpoint
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["service"] == "mira-backend"
        assert data["status"] == "online"


@pytest.mark.asyncio
async def test_health_endpoint_with_lifespan():
    # test health endpoint returns healthy with pre-loaded mock world
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # trigger lifespan manually for test client
        async with app.router.lifespan_context(app):
            resp = await client.get("/health")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "healthy"
            assert data["mock_world_loaded"] is True
            assert data["rooms_count"] == 15
            assert data["initial_room"] == "room_cyber_lab_01"
            assert data["spacetimedb_host"] == "localhost:3001"
