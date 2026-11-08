# Mira 3D RPG Engine — Lab Machine Handoff & Local Diffusion Integration Plan

> **Purpose of this Document**: Complete architectural handoff from the personal laptop session to the **GPU Lab Computer**. It covers everything implemented so far, the exact technical pitfalls currently blocking photorealistic panorama synthesis and first-person `WASD` locomotion, and the step-by-step execution plan to integrate **local diffusion models** + **true 3D room-scale locomotion** on the lab workstation.

---

## 1. Current State of the Codebase (What Is Already Built & Pushed)

### 1.1 Backend (`backend/`)
* **FastAPI World Compiler & Game Loop** (`backend/app/main.py`, `backend/app/services/compiler.py`):
  * `POST /chat/refine`: Refines raw player prompts into architectural world prompts with quick-reply chips.
  * `POST /world/compile`: Synthesizes a multi-room `WorldGraph` (3–4 connected rooms, lighting configs, grounded 3D props, and autonomous NPCs).
  * `POST /npc/interact`: Runs the NPC dialogue cascade with memory/reflection/planning/action logs.
  * `POST /world/tick`: Advances autonomous NPC thoughts and room states.
  * `POST /vision/ground`: Detects objects/landmarks in panoramic images and converts 2D bounding boxes `[ymin, xmin, ymax, xmax]` into 3D spherical coordinates `(r, theta, phi)`.
* **Gemini Structured World Synthesis & Key Rotation** (`backend/app/services/gemini_generator.py`):
  * Automatically loads `backend/.env` and rotates across `GEMINI_API_KEY_PRIMARY`, `GEMINI_API_KEY_SECONDARY`, and `GEMINI_API_KEY_TERTIARY`.
  * Uses `gemini-3.5-flash-lite` / `gemini-3.8-flash` to generate `WorldGraph` JSON with per-room lighting (`ambient_color` for sky hue, `fog_color` for stone/ground hue) and sub-room indices (`idx=0..3`).
* **Gemini Vision Grounding** (`backend/vision/grounding.py`):
  * Switched from NVIDIA NIM to Gemini Vision (`gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-2.5-flash`) for 2D-to-3D spherical coordinate grounding.
* **Strict In-Character Epistemic Guardrails on NPCs** (`backend/app/services/nemotron_cascade.py`):
  * Added `ANACHRONISM_PATTERNS`, `is_anachronistic_or_out_of_character_query()`, and `build_in_character_refusal()`.
  * Any out-of-era or programming query (e.g., asking George Washington for the Python code to "Two Sum", LeetCode algorithms, or modern tech) is strictly intercepted and refused in-character (`action_dispatch="refuse_anachronism"`).
* **Multi-Instrument Procedural Soundtrack Generator** (`backend/scripts/generate_real_music.py`):
  * Generates 24-second multi-layered `.wav` and `.mp3` scores (bowed string/choir pads, plucked harp/oud/lute arpeggios, vibrato solo leads, celesta counter-melodies, basslines, percussion, and multi-tap concert hall reverb) into `frontend/public/audio/tracks/`.

### 1.2 Frontend (`frontend/`)
* **Imaginative Player-First UI** (`frontend/src/app/page.tsx`, `DialogueModal.tsx`, `PromptRefinementChat.tsx`):
  * Stripped developer telemetry badges (`FallbackStatusBadge`), `Ledger [G]` (`GodModePalette`), `Chronicle Tick` debug button, raw `[MEMORY]/[REFLECTION]` trace dumps, and millisecond latency readouts.
  * Added a sleek world-switcher library drawer, top-right audio mute/unmute controls, and bottom room-navigation pills.
* **3D Scene & Entities** (`frontend/src/canvas/`):
  * `PanoramaSphere.tsx`: Renders the equirectangular room texture with 16-bit vertex depth displacement (`displacementShader.ts`) and latent denoising transitions.
  * `CharacterSpawner.tsx`: Renders stylized 3D humanoid NPCs with period/biome-matched garments that patrol along figure-8 paths (`patrolRadiusX=32`, `patrolRadiusZ=18`) and pause only when hovered.
  * `PropSpawner.tsx`: Spawns biome-matched 3D architectural monuments (brass armillary spheres, lapis fountains, fluted Corinthian columns with braziers, sandstone obelisks).

---

## 2. Current Pitfalls & Root Causes (Why We Are Moving to the Lab Machine)

### Pitfall 1: Cloud Image Generation Quota Is Hard-Locked to `0` on Free Tier
* **What happened**: While `GEMINI_API_KEY_*` keys have active quota for text (`gemini-3.5-flash-lite`) and vision (`gemini-3.8-flash`), Google's Free Tier sets image generation quota (`gemini-3.1-flash-image` / `imagen-3.0`) to `limit: 0` (`429 RESOURCE_EXHAUSTED`).
* **Why Gemini Vision couldn't replace it**: Vision models are *image-to-text* encoders (they inspect existing images and output JSON coordinates); they cannot output new image pixels.
* **Consequence**: Because no cloud diffusion model returned pixel buffers, the frontend fell back to HTML5 2D procedural canvas drawing (`TextureLoader.ts`). While `TextureLoader.ts` draws custom colors and shapes per room, 2D canvas primitives (`ctx.fillRect`, gradients, polygons) will never look like a photorealistic 360° environment.
* **Solution on Lab Machine**: Run a **local diffusion pipeline** on the lab GPU (SDXL / Flux.1-dev / SD-Turbo with 360° circular padding + Depth-Anything-V2 or ZoeDepth) to synthesize real, high-resolution equirectangular `.webp`/`.png` panoramas and 16-bit `.png` depth maps on the fly.

### Pitfall 2: Why `WASD` Movement Still Feels Non-Responsive / Broken
There are three stacked mechanical and geometric reasons why `WASD` does not currently work as expected:
1. **The 500-Radius Sphere Parallax Illusion**:
   * `PanoramaSphere` is a single giant sphere with `radius = 500` centered at `(0, 0, 0)`.
   * Moving the player `10–40` units inside a `500`-unit hollow sphere produces almost zero angular shift on the distant sphere walls, and the floor (`ReflectiveFloorGrid`) is placed way down at `y = -48`, so there is no ground plane moving beneath your feet.
2. **OrbitControls vs. First-Person Camera Conflict**:
   * `CameraController.tsx` uses `<OrbitControls>` pinned around the origin (`camera.position = [0, 0, 0.1]`) and tries to translate `worldGroupRef.current.position` in the opposite direction while `OrbitControls` simultaneously manages the camera matrix.
   * Furthermore, when `PanoramaSphere` (`scale={[-1, 1, 1]}`) is inside `worldGroupRef` and gets translated away from the camera, you end up looking at the sphere off-center (distorting the horizon) without feeling like you are walking across a real floor.
3. **DOM Focus & Input Capture**:
   * Clicking UI buttons (such as *"Enter World"* or room navigation chips) leaves keyboard focus on `<button>` elements or outside the canvas container, and without a dedicated click-to-walk / canvas focus handler or visible on-screen movement HUD/footstep feedback, key events are easily missed or unnoticeable.

---

## 3. Lab Computer Setup & Execution Plan

### Step 1: Clone & Bootstrap on the Lab Machine
 Note: Because `backend/.env` and generated `.wav`/`.mp3`/`.webp` assets are gitignored in `.gitignore`, run the music generator script once after pulling on the lab machine:

```powershell
git pull origin main

# 1. Recreate or copy backend/.env with your GEMINI_API_KEY_PRIMARY / SECONDARY / TERTIARY
# 2. Generate the multi-instrument audio stems (since *.wav and *.mp3 are in .gitignore)
python backend/scripts/generate_real_music.py

# 3. Start Backend (Terminal 1)
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

# 4. Start Frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

---

### Step 2: Integrate Local GPU Panorama + Depth Diffusion (`backend/app/services/local_diffusion.py`)

Depending on what is installed on the lab computer, we will wire `POST /world/compile` to one of two local GPU backends:

#### Option A: Direct PyTorch `diffusers` In-Process Service (Recommended if Lab GPU has >= 12GB VRAM)
1. **Model Stack**:
   * **RGB Panorama**: `stabilityai/sdxl-turbo` or `black-forest-labs/FLUX.1-schnell` (4-step inference, ~1.2s–2.5s per `1024x512` or `2048x1024` panorama on an RTX 3090/4090/A6000).
   * **Seamless 360° Tiling**: Enable circular padding (`conv_layer.padding_mode = 'circular'` on the horizontal `X` axis of all UNet and VAE `Conv2d` layers) so the left (`u=0`) and right (`u=1`) edges of the equirectangular panorama stitch with zero seam.
   * **Metric Depth Map**: Run `depth-anything/Depth-Anything-V2-Small-hf` (or `Intel/dpt-hybrid-midas`) on the generated RGB panorama (~80ms on GPU) to produce a true 16-bit depth map for `PanoramaSphere.tsx` vertex displacement and floor collision.
2. **Output Path**:
   * Save each generated room's panorama to `frontend/public/generated_worlds/<world_id>/<room_id>_panorama.webp` and `<room_id>_depth.png`.
   * Return those exact local URLs (`/generated_worlds/<world_id>/<room_id>_panorama.webp`) in `NodeState.panorama_url` and `NodeState.depth_url` so `TextureLoader.ts` loads the real GPU-rendered image directly via `THREE.TextureLoader` instead of falling back to the 2D procedural canvas.

#### Option B: Local ComfyUI / Automatic1111 API Bridge (If Lab Machine Already Runs a Local Image Server)
1. Point `LOCAL_DIFFUSION_URL=http://127.0.0.1:8188` (ComfyUI) or `http://127.0.0.1:7860` (A1111/Forge) in `backend/.env`.
2. In `gemini_generator.py`, replace `try_generate_gemini_panorama_image` with an async call to the local diffusion endpoint for each of the 4 rooms in parallel/batch, using Gemini's room description + architectural style prompt so all 4 sub-rooms share a cohesive visual style while depicting distinct spaces.

---

### Step 3: Fix `WASD` Locomotion & Grounded 3D Room Scale (`frontend/src/canvas/`)

To make `WASD` walking immediately responsive, physical, and unmistakable:

1. **Decouple the Skybox Sphere from the Walkable 3D Room Floor**:
   * Keep `PanoramaSphere` centered around the camera (or moving at `0.15x` parallax) as the distant 360° architectural enclosure, while placing a **true textured 3D architectural floor plane** at human eye level (`y = -6.0` instead of `y = -48.0`) with tiled stone/marble/sandstone shaders, columns, props, and patrolling NPCs right in the foreground.
2. **Replace Origin-Locked `OrbitControls` with True First-Person / Walkable Camera Rig (`CameraController.tsx`)**:
   * Move the `camera.position` and `OrbitControls.target` **together by the exact same `moveDelta` vector** inside `useFrame` *before* calling `controlsRef.current.update()`, with `enableDamping` handled cleanly so `OrbitControls` never snaps the camera back to `(0, 0, 0.1)`.
   * Add a subtle on-screen **compass / coordinates & WASD movement indicator** in the HUD so you can immediately verify key capture and position change, and auto-blur clicked HUD buttons (`e.currentTarget.blur()`) so keyboard focus always stays on the 3D viewport.

---

## 4. Verification Checklist for Next Session on Lab Machine
- [ ] Run `nvidia-smi` on the lab computer to check GPU model, VRAM, and CUDA version.
- [ ] Choose Option A (`diffusers` in-process with `sdxl-turbo` / `FLUX.1-schnell` + circular 360° conv padding) or Option B (local ComfyUI/A1111 endpoint).
- [ ] Verify that compiling any prompt generates 4 real photorealistic `.webp` panoramas + `.png` depth maps on disk under `frontend/public/generated_worlds/`.
- [ ] Verify grounded `WASD` walking across the 3D floor with immediate foreground parallax alongside roaming NPCs.
