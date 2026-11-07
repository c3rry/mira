# world tick router for autonomous npc graph-adjacency roaming and quest state evaluation
import random
from typing import Optional
from fastapi import APIRouter, Request
from backend.app.schemas import NPCRoamDecision, WorldTickRequest, WorldTickResponse

router = APIRouter(tags=["world-tick"])


@router.post("/world/tick", response_model=WorldTickResponse)
async def world_tick_endpoint(
    request: Request,
    body: Optional[WorldTickRequest] = None,
) -> WorldTickResponse:
    # retrieve preloaded world graph from app state
    world_graph = getattr(request.app.state, "mock_world", None)
    if not world_graph:
        return WorldTickResponse(moved_npcs=[], quest_updates=[])

    moved_npcs: list[NPCRoamDecision] = []

    # map rooms by id for rapid adjacency lookup
    rooms_map = {r.room_id: r for r in world_graph.rooms}

    # evaluate each room's npcs for graph-adjacency roaming
    for room in world_graph.rooms:
        if not room.adjacent_room_ids or not room.npcs:
            continue

        for npc in list(room.npcs):
            # pick random adjacent room destination
            destination_id = random.choice(room.adjacent_room_ids)
            if destination_id in rooms_map:
                origin_id = room.room_id

                # transfer npc from origin room to destination room in state
                room.npcs.remove(npc)
                npc.room_id = destination_id
                npc.thought_log.append(f"Roamed from {origin_id} to {destination_id}")
                rooms_map[destination_id].npcs.append(npc)

                moved_npcs.append(
                    NPCRoamDecision(
                        npc_id=npc.npc_id,
                        origin_room_id=origin_id,
                        destination_room_id=destination_id,
                    )
                )

    return WorldTickResponse(
        moved_npcs=moved_npcs,
        quest_updates=world_graph.quests,
    )
