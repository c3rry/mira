# vision grounding endpoint
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from pydantic import BaseModel
from backend.vision.grounding import detect_and_ground_image

router = APIRouter(tags=["vision"])


class VisionGroundRequest(BaseModel):
    image_path: Optional[str] = "shared/test_panorama.webp"
    radius: float = 500.0
    force_fallback: bool = False


class VisionGroundResponse(BaseModel):
    anchors: List[Dict[str, Any]]
    total_count: int
    radius: float


@router.post("/vision/ground", response_model=VisionGroundResponse)
async def ground_panorama_endpoint(req: VisionGroundRequest) -> VisionGroundResponse:
    # process vision coordinate grounding for panoramic image
    results = detect_and_ground_image(
        image_path_or_bytes=req.image_path or "shared/test_panorama.webp",
        r=req.radius,
        force_fallback=req.force_fallback,
    )
    return VisionGroundResponse(
        anchors=results,
        total_count=len(results),
        radius=req.radius,
    )
