# fastapi backend entrypoint and lifespan mock pre-loader
from contextlib import asynccontextmanager
import json
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.routes import health, npc, tick, vision, world
from backend.app.schemas import WorldGraph

# load environment variables from backend/.env or root .env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # lifespan pre-loading of mock world data
    shared_path = os.getenv("SHARED_PATH", "shared/mock_world.json")
    if not os.path.exists(shared_path):
        # check relative to project root
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        candidate = os.path.join(project_root, "shared", "mock_world.json")
        if os.path.exists(candidate):
            shared_path = candidate

    if os.path.exists(shared_path):
        with open(shared_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
        app.state.mock_world = WorldGraph.model_validate(raw_data)
        print(f"[LIFESPAN] Mock world pre-loaded: {len(app.state.mock_world.rooms)} rooms from {shared_path}")
    else:
        app.state.mock_world = None
        print(f"[LIFESPAN] Warning: Mock world not found at {shared_path}")

    # optionally warm up local gpu diffusion in background thread so first compile is fast
    if os.getenv("WARMUP_LOCAL_DIFFUSION", "true").lower() in ("1", "true", "yes"):
        import threading
        from backend.app.services.local_diffusion import warmup_local_diffusion

        threading.Thread(target=warmup_local_diffusion, daemon=True).start()

    yield

    # clean shutdown
    app.state.mock_world = None


app = FastAPI(
    title="Mira 3D RPG Engine - AI Inference Gateway",
    version="1.0.0",
    lifespan=lifespan,
)

# configure cross-origin resource sharing for next.js local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# mount routers directly without /api prefix per project contract
app.include_router(health.router)
app.include_router(world.router)
app.include_router(vision.router)
app.include_router(tick.router)
app.include_router(npc.router)


@app.get("/")
async def root():
    # root status message
    return {
        "service": "mira-backend",
        "status": "online",
        "docs_url": "/docs",
        "health_url": "/health",
    }
