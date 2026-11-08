# Mira 3D RPG Engine — Lab Machine Handoff & Local Diffusion Integration Plan

> **Purpose of this Document**: Complete architectural handoff and zero-to-running environment rebuild guide for an **Antigravity Agent** running on the **GPU Lab Computer**. It covers:
> 1. **Exact instructions for an Antigravity Agent to rebuild the entire project environment from a fresh `git clone`** (including regenerating all gitignored binary assets: `.env`, `.wav`/`.mp3` audio stems, `.webp`/`.png` cached panoramas, Python/Conda + CUDA packages, and Node.js packages).
> 2. **Everything built and pushed so far**.
> 3. **Current pitfalls** blocking photorealistic panorama synthesis and first-person `WASD` locomotion.
> 4. **The execution plan** to integrate **local GPU diffusion models** + **true 3D room-scale locomotion** on the lab workstation.

---

## 0. Antigravity Agent Instructions: Rebuild Project Environment from Scratch

> **AGENT DIRECTIVE**: When starting on the lab computer after a fresh `git clone https://github.com/c3rry/mira.git`, note that `.gitignore` excludes `*.env`, `*.wav`, `*.mp3`, `*.webp`, `*.png`, `*.glb`, `node_modules/`, and `.next/`. You **MUST** execute the steps below in order to rebuild the full runtime environment and regenerate all required static assets before launching the servers or adding local diffusion.

### Step 0.1: Inspect Lab Hardware & Existing Toolchains
Run a single hardware/toolchain check first so you know which GPU, CUDA version, Conda/Python, and Node versions are present:
```powershell
nvidia-smi
conda --version
python --version
node --version
npm --version
```

### Step 0.2: Create the Python / Conda Environment (`mira`)
1. Create the base environment from `conda.yml` (or Python 3.11 `venv` if Conda is unavailable):
   ```powershell
   # If Conda is installed:
   conda env create -f conda.yml
   conda activate mira

   # OR if using standard Python 3.11 venv:
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install --upgrade pip
   pip install numpy pillow "google-genai>=0.7.0" "fastapi==0.110.0" "uvicorn[standard]==0.28.0" "pydantic==2.6.4" "httpx==0.27.0" "opencv-python-headless==4.9.0.80" trimesh python-dotenv pytest pytest-asyncio pytest-mock
   ```
2. **Install Local GPU Diffusion Dependencies** (on the Lab GPU machine only — do NOT modify `conda.yml` directly unless approved per `AGENTS.md`):
   ```powershell
   # Install PyTorch with CUDA support (adjust cu121 / cu124 based on nvidia-smi CUDA version)
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
   pip install diffusers transformers accelerate safetensors
   ```

### Step 0.3: Create `backend/.env` from `backend/.env.example`
Copy `backend/.env.example` to `backend/.env` and populate the API keys (ask the user for their Gemini keys if not already set in system environment variables):
```powershell
Copy-Item backend\.env.example backend\.env
```
Ensure `backend/.env` contains:
```env
PORT=8000
HOST=0.0.0.0
SHARED_PATH=/shared/mock_world.json
NEXT_PUBLIC_USE_CACHE=false
NEXT_PUBLIC_SPACETIMEDB_HOST=localhost:3001
NVIDIA_API_KEY=nvapi-...
NVIDIA_NIM_ENDPOINT=https://integrate.api.nvidia.com/v1
GEMINI_API_KEY_PRIMARY=<USER_GEMINI_KEY_1>
GEMINI_API_KEY_SECONDARY=<USER_GEMINI_KEY_2>
GEMINI_API_KEY_TERTIARY=<USER_GEMINI_KEY_3>
```

### Step 0.4: Regenerate All Gitignored Audio & Visual Fallback Assets
Because `.gitignore` ignores `*.wav`, `*.mp3`, `*.webp`, and `*.png`, a fresh clone will have an empty `frontend/public/audio/` and `frontend/public/cached_worlds/`. Run the two included generator scripts from the repo root (`C:\code\mira` or lab repo root) to deterministically rebuild every asset on disk:
```powershell
# 1. Regenerate all 24-second multi-instrument .wav and .mp3 music stems in frontend/public/audio/tracks/
python backend/scripts/generate_real_music.py

# 2. Regenerate all base fallback 2048x1024 .webp panoramas and .png depth maps in frontend/public/cached_worlds/
python backend/scripts/generate_rich_panoramas.py
```

### Step 0.5: Install Frontend Dependencies (`frontend/`)
```powershell
cd frontend
npm install
npx tsc --noEmit
cd ..
```

### Step 0.6: Verify Full Backend Test Suite & Start Both Dev Servers
```powershell
# Run the 30 backend unit & integration tests (should pass in ~2.5s)
pytest backend/tests -v

# Start FastAPI Backend on Port 8000 (Background Daemon Task 1)
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

# Start Next.js Frontend on Port 3000 (Background Daemon Task 2)
cd frontend
npm run dev
```

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

## 2. Current Pitfalls & Root Causes (Why We Moved to the Lab Machine)

### Pitfall 1: Cloud Image Generation Quota Is Hard-Locked to `0` on Free Tier
* **What happened**: While `GEMINI_API_KEY_*` keys have active quota for text (`gemini-3.5-flash-lite`) and vision (`gemini-3.8-flash`), Google's Free Tier sets image generation quota (`gemini-3.1-flash-image` / `imagen-3.0`) to `limit: 0` (`429 RESOURCE_EXHAUSTED`).
* **Why Gemini Vision couldn't replace it**: Vision models are *image-to-text* encoders (they inspect existing images and output JSON coordinates); they cannot output new image pixels.
* **Consequence**: Because no cloud diffusion model returned pixel buffers, the frontend fell back to HTML5 2D procedural canvas drawing (`TextureLoader.ts`). While `TextureLoader.ts` draws custom colors and shapes per room, 2D canvas primitives (`ctx.fillRect`, gradients, polygons) will never look like a photorealistic 360° environment.
* **Solution on Lab Machine**: Run a **local diffusion pipeline** on the lab GPU (SDXL / Flux.1-schnell / SDXL-Turbo with 360° circular padding + Depth-Anything-V2) to synthesize real, high-resolution equirectangular `.webp`/`.png` panoramas and `.png` depth maps on the fly.

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

## 3. Lab Computer Execution Plan (Next Tasks for Antigravity Agent)

### Task A: Integrate Local GPU Panorama + Depth Diffusion (`backend/app/services/local_diffusion.py`)

Depending on what is installed on the lab computer, wire `POST /world/compile` (`backend/app/services/gemini_generator.py`) to one of two local GPU backends:

#### Option 1: Direct PyTorch `diffusers` In-Process Service (Recommended if Lab GPU has >= 12GB VRAM)
1. **Model Stack**:
   * **RGB Panorama**: `stabilityai/sdxl-turbo` or `black-forest-labs/FLUX.1-schnell` (4-step inference, ~1.2s–2.5s per `1024x512` or `2048x1024` panorama on an RTX 3090/4090/A6000).
   * **Seamless 360° Tiling**: Patch all `nn.Conv2d` layers in the UNet and VAE to use circular padding along the horizontal width axis (`padding_mode='circular'`) so the left (`u=0`) and right (`u=1`) edges of the equirectangular panorama stitch with zero visible seam.
   * **Metric Depth Map**: Run `depth-anything/Depth-Anything-V2-Small-hf` on the generated RGB panorama (~80ms on GPU) to produce a true depth map for `PanoramaSphere.tsx` vertex displacement.
2. **Output Path**:
   * Save each generated room's panorama to `frontend/public/generated_worlds/<world_id>/<room_id>_panorama.webp` and `<room_id>_depth.png`.
   * Return those exact local URLs (`/generated_worlds/<world_id>/<room_id>_panorama.webp`) in `NodeState.panorama_url` and `NodeState.depth_url` so `TextureLoader.ts` loads the real GPU-rendered image directly via `THREE.TextureLoader` instead of falling back to the 2D procedural canvas.

#### Option 2: Local ComfyUI / Automatic1111 API Bridge (If Lab Machine Already Runs a Local Image Server)
1. Point `LOCAL_DIFFUSION_URL=http://127.0.0.1:8188` (ComfyUI) or `http://127.0.0.1:7860` (A1111/Forge) in `backend/.env`.
2. In `gemini_generator.py`, replace `try_generate_gemini_panorama_image` with an async call to the local diffusion endpoint for each of the 4 rooms, using Gemini's room description + shared world architectural style prompt so all 4 sub-rooms share a cohesive visual style while depicting distinct spaces.

---

### Task B: Fix `WASD` Locomotion & Grounded 3D Room Scale (`frontend/src/canvas/`)

To make `WASD` walking immediately responsive, physical, and unmistakable:

1. **Decouple the Skybox Sphere from the Walkable 3D Room Floor**:
   * Keep `PanoramaSphere` centered around the camera (or moving at subtle `0.12x` parallax) as the distant 360° architectural enclosure, while placing a **true textured 3D architectural floor plane** at human eye height (`y = -6.0` instead of `y = -48.0`) with tiled stone/marble/sandstone shaders, columns, props, and patrolling NPCs right in the foreground.
2. **Replace Origin-Locked `OrbitControls` with True Walkable Camera Rig (`CameraController.tsx`)**:
   * Move `camera.position` and `controlsRef.current.target` **together by the exact same `moveDelta` vector** inside `useFrame` *before* calling `controlsRef.current.update()`, while keeping `camera` and `target` separated by a small radius (`0.5` units) so `OrbitControls` mouse-look and `WASD` translation work together seamlessly without snapping back to `(0, 0, 0.1)`.
   * Auto-blur clicked HUD buttons (`e.currentTarget.blur()`) so keyboard focus always stays on the 3D viewport.

---

## 4. Verification Checklist for the Lab Session
- [ ] Run Step 0 (`conda`/`venv`, `backend/.env`, `generate_real_music.py`, `generate_rich_panoramas.py`, `npm install`, `pytest`).
- [ ] Verify GPU model and VRAM via `nvidia-smi`.
- [ ] Implement `backend/app/services/local_diffusion.py` and verify that compiling any prompt writes 4 photorealistic `.webp` panoramas + `.png` depth maps under `frontend/public/generated_worlds/`.
- [ ] Verify grounded `WASD` walking across the eye-level 3D floor with immediate foreground parallax alongside roaming NPCs.
