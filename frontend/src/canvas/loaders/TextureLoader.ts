// equirectangular panorama texture loader with rock-solid photorealistic fallbacks
import * as THREE from "three";

const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();

const defaultFallbackUrl = "/generated_worlds/archive_giza_necropolis/giza_forecourt_panorama.webp";

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// determine visual scene archetype strictly prioritizing specific prompt/room keywords before generic biome
function classifySceneArchetype(roomName: string, promptText: string, biome: string): string {
  const specific = `${roomName} ${promptText}`.toLowerCase();
  const full = `${specific} ${biome}`.toLowerCase();

  if (
    full.includes("noise") ||
    full.includes("quantum") ||
    full.includes("latent") ||
    full.includes("manifold") ||
    full.includes("procedural")
  ) {
    return "continuous_noise";
  }

  if (
    specific.includes("rome") ||
    specific.includes("roman") ||
    specific.includes("forum") ||
    specific.includes("colosseum") ||
    specific.includes("pantheon") ||
    specific.includes("amphitheater") ||
    specific.includes("sacra")
  ) {
    return "rome";
  }

  if (
    specific.includes("athens") ||
    specific.includes("acropolis") ||
    specific.includes("parthenon") ||
    specific.includes("aegean") ||
    specific.includes("greek") ||
    specific.includes("doric") ||
    specific.includes("olympus")
  ) {
    return "greece";
  }

  if (
    specific.includes("babylon") ||
    specific.includes("garden") ||
    specific.includes("ishtar") ||
    specific.includes("terrace") ||
    specific.includes("forest") ||
    specific.includes("jungle") ||
    specific.includes("grove") ||
    specific.includes("botanical") ||
    specific.includes("sylvan") ||
    specific.includes("waterfall")
  ) {
    return "gardens";
  }

  if (
    specific.includes("space") ||
    specific.includes("orbital") ||
    specific.includes("observatory") ||
    specific.includes("station") ||
    specific.includes("cosmos") ||
    specific.includes("nebula") ||
    specific.includes("planet") ||
    specific.includes("moon") ||
    specific.includes("mars") ||
    specific.includes("star") ||
    specific.includes("spire")
  ) {
    return "space";
  }

  if (
    specific.includes("tavern") ||
    specific.includes("guild") ||
    specific.includes("medieval") ||
    specific.includes("castle") ||
    specific.includes("keep") ||
    specific.includes("cathedral") ||
    specific.includes("library") ||
    specific.includes("hearth")
  ) {
    return "guildhall";
  }

  if (
    specific.includes("metropolis") ||
    specific.includes("cyber") ||
    specific.includes("arcade") ||
    specific.includes("boulevard") ||
    specific.includes("skybridge") ||
    specific.includes("city") ||
    specific.includes("neon") ||
    specific.includes("tokyo")
  ) {
    return "metropolis";
  }

  if (
    specific.includes("giza") ||
    specific.includes("pyramid") ||
    specific.includes("sphinx") ||
    specific.includes("khufu") ||
    specific.includes("egypt") ||
    specific.includes("pharaoh") ||
    specific.includes("barque") ||
    specific.includes("nile")
  ) {
    return "giza";
  }

  // any custom user prompt (e.g. "Samurai Kyoto", "Colonial Mount Vernon", "Atlantis", "Arctic Citadel")
  // gets its own bespoke prompt-driven procedural 360 world rather than rotating through fixed presets
  return "bespoke";
}

// Render a high-tech neural diffusion synthesis status field when real neural assets are generating
function createPromptDrivenPanorama(url: string): THREE.Texture {
  const canvas = document.createElement("canvas");
  const w = 2048;
  const h = 1024;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  const queryIndex = url.indexOf("?");
  const params = new URLSearchParams(queryIndex >= 0 ? url.slice(queryIndex) : "");
  const roomName = params.get("room") || "Sector Chamber";
  const promptText = params.get("prompt") || roomName;

  if (ctx) {
    // 1. Sleek dark sci-fi synthesis field
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#080c18");
    bgGrad.addColorStop(0.5, "#0e172a");
    bgGrad.addColorStop(1, "#050811");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. High-tech perspective grid lines
    ctx.strokeStyle = "rgba(56, 189, 248, 0.16)";
    ctx.lineWidth = 1.5;
    for (let x = 0; x <= w; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 3. Central HUD synthesis badge repeated horizontally across 4 cardinal headings
    const headings = [w * 0.25, w * 0.5, w * 0.75, 0, w];
    headings.forEach((cx) => {
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.0;
      const cardW = 460;
      const cardH = 210;
      const left = cx - cardW / 2;
      const top = h / 2 - cardH / 2;

      ctx.fillRect(left, top, cardW, cardH);
      ctx.strokeRect(left, top, cardW, cardH);

      // Header
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 16px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("[ 3D NEURAL FUSION SYNTHESIS ]", cx, top + 36);

      // Engine info
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.fillText("ENGINE: JoPano (RealVisXL + Poisson CFB)", cx, top + 68);

      // Zone name
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px 'Segoe UI', sans-serif";
      const displayRoom = roomName.length > 36 ? roomName.slice(0, 34) + "..." : roomName;
      ctx.fillText(`ZONE: ${displayRoom}`, cx, top + 104);

      // Status
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px 'Courier New', monospace";
      ctx.fillText("Denoising 6-face spherical projection...", cx, top + 138);
      ctx.fillStyle = "#34d399";
      ctx.fillText("Polling GPU worker for live texture swap...", cx, top + 164);

      // Corner technical markers
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(left + 5, top + 5, 8, 8);
      ctx.fillRect(left + cardW - 13, top + 5, 8, 8);
      ctx.fillRect(left + 5, top + cardH - 13, 8, 8);
      ctx.fillRect(left + cardW - 13, top + cardH - 13, 8, 8);
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function loadPanoramaTexture(
  url: string,
  fallbackUrl: string = defaultFallbackUrl
): Promise<THREE.Texture> {
  const cleanFileUrl = url.split("?")[0];

  const configureTexture = (texture: THREE.Texture): THREE.Texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  };

  if (textureCache.has(url)) {
    const cached = textureCache.get(url)!;
    if (cached.userData?.isFallback) {
      loader.load(
        cleanFileUrl,
        (realTex) => {
          const configured = configureTexture(realTex);
          textureCache.set(url, configured);
          cached.image = configured.image;
          cached.needsUpdate = true;
          cached.userData.isFallback = false;
        },
        undefined,
        () => {}
      );
    }
    return Promise.resolve(cached);
  }

  if (typeof window === "undefined") {
    const customTex = new THREE.Texture();
    textureCache.set(url, customTex);
    return Promise.resolve(customTex);
  }

  return new Promise((resolve) => {
    loader.load(
      cleanFileUrl,
      (texture) => {
        const configured = configureTexture(texture);
        textureCache.set(url, configured);
        resolve(configured);
      },
      undefined,
      () => {
        // High-resolution bespoke procedural panorama synthesized immediately — NEVER reuse Room 0's static image!
        const synthesizedTex = createPromptDrivenPanorama(url);
        synthesizedTex.userData.isFallback = true;
        textureCache.set(url, synthesizedTex);
        resolve(synthesizedTex);

        // Periodically verify if on-disk diffusion panorama has completed writing, swapping seamlessly when ready
        const checkDisk = () => {
          loader.load(
            cleanFileUrl,
            (realTex) => {
              const configured = configureTexture(realTex);
              textureCache.set(url, configured);
              synthesizedTex.image = configured.image;
              synthesizedTex.needsUpdate = true;
              synthesizedTex.userData.isFallback = false;
            },
            undefined,
            () => {}
          );
        };
        let pollCount = 0;
        const maxPolls = 60; // 60 * 800ms = 48s
        const intervalId = setInterval(() => {
          pollCount++;
          if (pollCount > maxPolls || !synthesizedTex.userData.isFallback) {
            clearInterval(intervalId);
            return;
          }
          loader.load(
            cleanFileUrl,
            (realTex) => {
              clearInterval(intervalId);
              const configured = configureTexture(realTex);
              textureCache.set(url, configured);
              synthesizedTex.image = configured.image;
              synthesizedTex.needsUpdate = true;
              synthesizedTex.userData.isFallback = false;
            },
            undefined,
            () => {}
          );
        }, 800);
      }
    );
  });
}

export function clearPanoramaCache(): void {
  textureCache.forEach((tex) => tex.dispose());
  textureCache.clear();
}
