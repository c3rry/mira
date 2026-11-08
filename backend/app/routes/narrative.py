# fastapi route handlers for nemotron narrative director and story knowledge graph
from fastapi import APIRouter, HTTPException, Request
from backend.app.schemas import (
    NarrativeChatTurnRequest,
    NarrativeChatTurnResponse,
    StoryKnowledgeGraph,
)
from backend.app.services.narrative_director import process_narrative_director_turn

router = APIRouter(prefix="/story", tags=["narrative"])

# In-memory session knowledge graph cache per world_id
_world_graphs: dict[str, StoryKnowledgeGraph] = {}


@router.post("/director/turn", response_model=NarrativeChatTurnResponse)
async def narrative_director_turn_endpoint(body: NarrativeChatTurnRequest):
    """
    Executes an interactive turn with Nemotron 70B Narrative Director.
    Asks sequential one-by-one questions, converts vague premises into non-spoiling
    Story Knowledge Graphs, and dispenses physical subagents with distinct movement modes.
    """
    # If request didn't supply existing_graph, see if we have one cached
    if not body.existing_graph and body.world_id in _world_graphs:
        body.existing_graph = _world_graphs[body.world_id]

    response = await process_narrative_director_turn(body)

    # Cache updated graph if compiled
    if response.updated_graph:
        _world_graphs[body.world_id] = response.updated_graph

    return response


@router.get("/knowledge-graph/{world_id}", response_model=StoryKnowledgeGraph)
async def get_knowledge_graph_endpoint(world_id: str):
    """Retrieves the active Story Knowledge Graph for a given world."""
    graph = _world_graphs.get(world_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Knowledge graph not initialized for this world.")
    return graph
