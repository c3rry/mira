# standalone gpu panorama + depth worker for nvidia brev cloud instances or multi-gpu nodes
import base64
import hashlib
import io
import os
import time
import torch
import torch.nn as nn
import torch.nn.functional as F
from diffusers import AutoPipelineForText2Image
from fastapi import FastAPI
from PIL import Image
from pydantic import BaseModel

app = FastAPI(title="Mira Brev GPU Panorama Worker")

PIPE = None


def patch_circular_conv2d(model: nn.Module) -> int:
    count = 0
    for mod in model.modules():
        if isinstance(mod, nn.Conv2d):
            ph, pw = (
                mod.padding
                if isinstance(mod.padding, tuple)
                else (mod.padding, mod.padding)
            )
            if pw > 0 or ph > 0:
                st, dil, grp = mod.stride, mod.dilation, mod.groups

                def _make_fwd(p_h: int, p_w: int, s, d, g):
                    def _fwd(self_m: nn.Conv2d, x: torch.Tensor) -> torch.Tensor:
                        if p_w > 0:
                            x = F.pad(x, (p_w, p_w, 0, 0), mode="circular")
                        if p_h > 0:
                            x = F.pad(x, (0, 0, p_h, p_h), mode="replicate")
                        return F.conv2d(
                            x, self_m.weight, self_m.bias, stride=s, padding=0, dilation=d, groups=g
                        )

                    return _fwd

                mod.forward = _make_fwd(int(ph), int(pw), st, dil, grp).__get__(
                    mod, nn.Conv2d
                )
                count += 1
    return count


@app.on_event("startup")
def load_models():
    global PIPE
    model_id = os.getenv("BREV_MODEL_ID", "stabilityai/sdxl-turbo")
    PIPE = AutoPipelineForText2Image.from_pretrained(
        model_id, torch_dtype=torch.float16, variant="fp16"
    ).to("cuda")
    patch_circular_conv2d(PIPE.unet)
    patch_circular_conv2d(PIPE.vae)


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = ""
    seed: int = 42
    width: int = 1024
    height: int = 512


@app.post("/generate")
def generate_panorama(req: GenerateRequest):
    t0 = time.perf_counter()
    gen = torch.Generator(device="cuda").manual_seed(req.seed)
    img = PIPE(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt,
        num_inference_steps=4,
        guidance_scale=0.0,
        width=req.width,
        height=req.height,
        generator=gen,
    ).images[0]
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=92)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return {
        "image_base64": b64,
        "latency_ms": round((time.perf_counter() - t0) * 1000.0, 2),
    }
