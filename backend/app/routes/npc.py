# npc interaction endpoint orchestrating 3-tier cognitive cascade
from fastapi import APIRouter, HTTPException
from backend.app.schemas import NPCInteractionRequest, NPCInteractionResponse
from backend.app.services.nemotron_cascade import execute_npc_cascade

router = APIRouter(prefix="/npc", tags=["npc"])


@router.post("/interact", response_model=NPCInteractionResponse)
async def interact_with_npc(request: NPCInteractionRequest) -> NPCInteractionResponse:
    # dispatch interaction payload through resilient cascade
    try:
        response = await execute_npc_cascade(request)
        return response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Cascade error: {str(exc)}")
