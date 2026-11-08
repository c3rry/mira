# massive neural fusion and 2D-to-3D visual consistency trace logger
# records every prompt decomposition, reciprocal bearing, 6-face multi-text prompt,
# GPU diffusion step, seam blend metric, and 2D floorplan coordinate to backend/logs/mira_fusion_trace.log

from datetime import datetime
import json
import logging
import os
from pathlib import Path
import threading
from typing import Any, Dict, List, Optional

LOG_DIR = Path(__file__).resolve().parents[2] / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
TRACE_FILE = LOG_DIR / "mira_fusion_trace.log"

_LOCK = threading.Lock()
logger = logging.getLogger("mira.fusion_tracer")


def _write_trace_entry(category: str, data: Dict[str, Any]) -> None:
    timestamp = datetime.utcnow().isoformat() + "Z"
    record = {
        "timestamp": timestamp,
        "category": category,
        **data,
    }
    line = json.dumps(record, default=str)
    with _LOCK:
        try:
            with open(TRACE_FILE, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except Exception as e:
            logger.warning(f"Failed to write trace entry: {e}")


def trace_compilation_start(world_id: str, prompt: str, biome_hint: Optional[str] = None) -> None:
    _write_trace_entry(
        "WORLD_COMPILATION_START",
        {
            "world_id": world_id,
            "prompt": prompt,
            "biome_hint": biome_hint,
        },
    )
    logger.info(f"[TRACE] World compilation initiated: ID='{world_id}', prompt='{prompt}'")


def trace_theme_detected(
    prompt: str,
    archetype: str,
    topology_type: str,
    palette: Dict[str, str],
) -> None:
    _write_trace_entry(
        "THEME_AND_TOPOLOGY_CLASSIFICATION",
        {
            "prompt": prompt,
            "detected_archetype": archetype,
            "topology_type": topology_type,
            "visual_palette": palette,
        },
    )
    logger.info(
        f"[TRACE] Classification: archetype='{archetype}', topology='{topology_type}', "
        f"dominant='{palette.get('dominant_color')}', sky='{palette.get('sky_tone')}'"
    )


def trace_room_planned(
    room_idx: int,
    room_id: str,
    name: str,
    world_x: float,
    world_z: float,
    parent_id: Optional[str] = None,
    parent_name: Optional[str] = None,
    theta_forward: Optional[float] = None,
    theta_reciprocal: Optional[float] = None,
    u_reciprocal: Optional[float] = None,
) -> None:
    _write_trace_entry(
        "ROOM_SPATIAL_GEOMETRY_PLAN",
        {
            "room_idx": room_idx,
            "room_id": room_id,
            "name": name,
            "world_coordinates": {"x": world_x, "z": world_z},
            "parent_room": {"room_id": parent_id, "name": parent_name},
            "bearing_geometry": {
                "theta_forward_rad": round(theta_forward, 4) if theta_forward is not None else None,
                "theta_reciprocal_rad": round(theta_reciprocal, 4) if theta_reciprocal is not None else None,
                "u_reciprocal_equirectangular": round(u_reciprocal, 4) if u_reciprocal is not None else None,
            },
        },
    )


def trace_6face_prompts(
    room_id: str,
    room_name: str,
    world_prompt: str,
    anchor_prompt: str,
    face_prompts: List[str],
    negative_prompt: str,
    modality: str,
) -> None:
    face_labels = ["Front", "Back", "Left", "Right", "Up", "Down"]
    face_map = {face_labels[i]: face_prompts[i] for i in range(min(len(face_labels), len(face_prompts)))}
    _write_trace_entry(
        "JOPANO_6FACE_MULTI_TEXT_PROMPTS",
        {
            "room_id": room_id,
            "room_name": room_name,
            "world_prompt": world_prompt,
            "scene_modality": modality,
            "anchor_prompt_f0": anchor_prompt,
            "directional_face_prompts": face_map,
            "negative_prompt": negative_prompt,
        },
    )


def trace_diffusion_inference(
    room_id: str,
    room_name: str,
    seed: int,
    gamma: int,
    num_steps: int,
    latency_ms: float,
    vram_mb: Optional[float] = None,
) -> None:
    _write_trace_entry(
        "DIFFUSION_INFERENCE_COMPLETE",
        {
            "room_id": room_id,
            "room_name": room_name,
            "seed": seed,
            "gamma_condition_switch": gamma,
            "num_cubemap_denoise_steps": num_steps,
            "latency_ms": round(latency_ms, 2),
            "vram_allocated_mb": round(vram_mb, 2) if vram_mb is not None else None,
        },
    )


def trace_jopano_blending(
    room_id: str,
    seam_ssim_before: float,
    seam_ssim_after: float,
    seam_sobel_before: float,
    seam_sobel_after: float,
    poisson_iterations: int,
) -> None:
    _write_trace_entry(
        "JOPANO_POISSON_CFB_METRICS",
        {
            "room_id": room_id,
            "poisson_iterations": poisson_iterations,
            "metrics": {
                "seam_ssim_before": round(seam_ssim_before, 4),
                "seam_ssim_after": round(seam_ssim_after, 4),
                "seam_sobel_before": round(seam_sobel_before, 4),
                "seam_sobel_after": round(seam_sobel_after, 4),
            },
        },
    )


def trace_assets_saved(
    room_id: str,
    pano_path: str,
    pano_size_bytes: int,
    depth_path: str,
    depth_size_bytes: int,
    is_real_diffusion: bool,
) -> None:
    _write_trace_entry(
        "FUSION_ASSETS_SAVED_TO_DISK",
        {
            "room_id": room_id,
            "panorama_file": pano_path,
            "panorama_size_bytes": pano_size_bytes,
            "depth_file": depth_path,
            "depth_size_bytes": depth_size_bytes,
            "is_neural_diffusion_asset": is_real_diffusion,
        },
    )
    logger.info(
        f"[TRACE] Assets saved for {room_id}: Pano={pano_path} ({pano_size_bytes}B), "
        f"Depth={depth_path} ({depth_size_bytes}B), RealFusion={is_real_diffusion}"
    )


def trace_expansion_event(
    from_room_id: str,
    direction: str,
    target_x: float,
    target_z: float,
    new_room_id: str,
    new_room_name: str,
    pano_url: str,
    depth_url: str,
    npc_name: str,
) -> None:
    _write_trace_entry(
        "WORLD_EXPANSION_EVENT",
        {
            "from_room_id": from_room_id,
            "direction": direction,
            "target_coordinates": {"x": target_x, "z": target_z},
            "new_room_id": new_room_id,
            "new_room_name": new_room_name,
            "panorama_url": pano_url,
            "depth_url": depth_url,
            "assigned_npc": npc_name,
        },
    )


def trace_minimap_alignment(
    world_id: str,
    rooms_summary: List[Dict[str, Any]],
) -> None:
    _write_trace_entry(
        "MINIMAP_2D_TOPOLOGICAL_ALIGNMENT",
        {
            "world_id": world_id,
            "total_nodes": len(rooms_summary),
            "rooms": rooms_summary,
        },
    )
