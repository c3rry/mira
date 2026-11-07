#!/usr/bin/env python3

import os
import sys
import json
import argparse
from pathlib import Path

# default biome catalog
BIOMES = [
    {
        "id": "cyberpunk_alley",
        "name": "Cyberpunk Alleyway",
        "prompt": "360 equirectangular panorama of a neon-lit cyberpunk alleyway at night, holographic signs, wet asphalt reflections, hyperdetailed 8k photorealistic",
        "props": ["neon_sign.glb", "dumpster.glb", "vending_machine.glb"],
        "audio": "cyberpunk_ambient.mp3"
    },
    {
        "id": "medieval_tavern",
        "name": "Medieval Tavern",
        "prompt": "360 equirectangular panorama of a cozy medieval fantasy tavern interior, timber beams, stone fireplace with fire, wooden tables and tankards, cinematic lighting",
        "props": ["wooden_table.glb", "wooden_chair.glb", "beer_stein.glb"],
        "audio": "tavern_ambient.mp3"
    },
    {
        "id": "space_station",
        "name": "Sci-Fi Space Station",
        "prompt": "360 equirectangular panorama of an orbital space station interior corridor, airlock, viewport showing earth from space, clean futuristic panels, volumetric blue lights",
        "props": ["airlock_terminal.glb", "crate_scifi.glb", "server_rack.glb"],
        "audio": "scifi_hum.mp3"
    },
    {
        "id": "desert_oasis",
        "name": "Desert Oasis",
        "prompt": "360 equirectangular panorama of a serene desert oasis, clear water spring, palm trees, sand dunes, ancient sandstone ruins, golden sunset lighting",
        "props": ["sandstone_pillar.glb", "palm_frond.glb", "clay_urn.glb"],
        "audio": "desert_wind.mp3"
    },
    {
        "id": "enchanted_forest",
        "name": "Enchanted Forest",
        "prompt": "360 equirectangular panorama of a magical enchanted forest, bioluminescent mushrooms, ancient twisting oak trees, glowing crystal cave opening, ethereal fog",
        "props": ["crystal_cluster.glb", "glowing_mushroom.glb", "stone_altar.glb"],
        "audio": "forest_mystic.mp3"
    }
]

def resolve_target_dirs(root_path: Path):
    # resolve base directories
    cached_worlds = root_path / "frontend" / "public" / "cached_worlds"
    models_props = root_path / "frontend" / "public" / "models" / "props"
    models_chars = root_path / "frontend" / "public" / "models" / "characters"
    audio_dir = root_path / "frontend" / "public" / "audio"
    
    # ensure directories exist
    cached_worlds.mkdir(parents=True, exist_ok=True)
    models_props.mkdir(parents=True, exist_ok=True)
    models_chars.mkdir(parents=True, exist_ok=True)
    audio_dir.mkdir(parents=True, exist_ok=True)
    
    return cached_worlds, models_props, models_chars, audio_dir

def generate_dry_run_assets(cached_worlds: Path, biomes: list):
    # create synthetic fallback assets for testing
    from PIL import Image, ImageDraw
    
    for biome in biomes:
        biome_dir = cached_worlds / biome["id"]
        biome_dir.mkdir(parents=True, exist_ok=True)
        
        rgb_path = biome_dir / "panorama.webp"
        depth_path = biome_dir / "depth.png"
        
        # generate 2048x1024 synthetic panorama
        if not rgb_path.exists():
            img = Image.new("RGB", (2048, 1024), color=(20, 24, 32))
            draw = ImageDraw.Draw(img)
            draw.text((100, 100), f"Pre-baked Biome: {biome['name']}", fill=(200, 220, 255))
            draw.rectangle([0, 512, 2048, 1024], fill=(40, 50, 70))
            img.save(rgb_path, "WEBP", quality=85)
            # log generated texture
            print(f"saved test panorama: {rgb_path}")
            
        # generate 16-bit grayscale depth displacement
        if not depth_path.exists():
            depth = Image.new("I;16", (2048, 1024), color=32768)
            depth.save(depth_path, "PNG")
            # log generated depth map
            print(f"saved test depth map: {depth_path}")

def run_diffusion_pipeline(cached_worlds: Path, biomes: list):
    # import pytorch and diffusion tools
    import torch
    from diffusers import AutoPipelineForText2Image
    from transformers import pipeline
    from PIL import Image
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"using device: {device}")
    
    # load sdxl-lightning
    pipe = AutoPipelineForText2Image.from_pretrained(
        "ByteDance/SDXL-Lightning",
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        variant="fp16" if device == "cuda" else None
    ).to(device)
    
    # load depth anything v2
    depth_estimator = pipeline(task="depth-estimation", model="depth-anything/Depth-Anything-V2-Large-hf", device=device)
    
    for biome in biomes:
        biome_dir = cached_worlds / biome["id"]
        biome_dir.mkdir(parents=True, exist_ok=True)
        
        rgb_path = biome_dir / "panorama.webp"
        depth_path = biome_dir / "depth.png"
        
        if not rgb_path.exists():
            print(f"generating panorama for: {biome['name']}")
            image = pipe(biome["prompt"], num_inference_steps=4, guidance_scale=0.0).images[0]
            image = image.resize((4096, 2048), Image.Resampling.LANCZOS)
            image.save(rgb_path, "WEBP", quality=88)
            print(f"saved {rgb_path}")
            
        if not depth_path.exists():
            print(f"estimating depth for: {biome['name']}")
            raw_rgb = Image.open(rgb_path).convert("RGB")
            depth_result = depth_estimator(raw_rgb)["predicted_depth"]
            depth_16 = depth_result.resize((4096, 2048), Image.Resampling.BILINEAR).convert("I;16")
            depth_16.save(depth_path, "PNG")
            print(f"saved {depth_path}")

def write_manifest(cached_worlds: Path, biomes: list):
    # construct catalog manifest
    manifest_data = {
        "version": "1.0.0",
        "generated_at": "2026-11-06T12:00:00Z",
        "biomes": {}
    }
    
    for biome in biomes:
        manifest_data["biomes"][biome["id"]] = {
            "name": biome["name"],
            "prompt": biome["prompt"],
            "panorama": f"/cached_worlds/{biome['id']}/panorama.webp",
            "depth": f"/cached_worlds/{biome['id']}/depth.png",
            "props": [f"/models/props/{p}" for p in biome["props"]],
            "audio": f"/audio/{biome['audio']}"
        }
        
    manifest_path = cached_worlds / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)
    # log manifest creation
    print(f"manifest written to: {manifest_path}")

def main():
    parser = argparse.ArgumentParser(description="pre-bake 5 biomes for mira")
    parser.add_argument("--dry-run", action="store_true", help="generate test gradient images without diffusion")
    parser.add_argument("--root", type=str, default=".", help="project root directory")
    args = parser.parse_args()
    
    root_path = Path(args.root).resolve()
    cached_worlds, _, _, _ = resolve_target_dirs(root_path)
    
    if args.dry_run:
        # execute lightweight synthetic generation
        generate_dry_run_assets(cached_worlds, BIOMES)
    else:
        try:
            # execute full local gpu diffusion pass
            run_diffusion_pipeline(cached_worlds, BIOMES)
        except Exception as exc:
            # fallback to dry run if cuda or models unavailable
            print(f"gpu generation unavailable ({exc}); falling back to dry-run generation")
            generate_dry_run_assets(cached_worlds, BIOMES)
            
    # write final catalog manifest
    write_manifest(cached_worlds, BIOMES)
    print("pre-baking complete.")

if __name__ == "__main__":
    main()
