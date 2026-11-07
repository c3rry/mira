// anonymous cors texture loader with in-memory caching and fallback
import * as THREE from "three";

const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();
loader.setCrossOrigin("anonymous");

const defaultFallbackUrl = "/cached_worlds/cyberpunk_alley/panorama.webp";

// creates a procedural fallback texture if network fails completely
function createProceduralFallbackTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // dark futuristic grid background
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#00f0ff33";
    ctx.lineWidth = 2;
    for (let x = 0; x <= canvas.width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#00f0ff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MIRA 3D - OFFLINE PANORAMA LOOPBACK", canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function loadPanoramaTexture(
  url: string,
  fallbackUrl: string = defaultFallbackUrl
): Promise<THREE.Texture> {
  // check in-memory cache
  if (textureCache.has(url)) {
    return Promise.resolve(textureCache.get(url)!);
  }

  return new Promise((resolve) => {
    loader.load(
      url,
      (texture) => {
        // configure texture mapping for equirectangular panorama
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        textureCache.set(url, texture);
        resolve(texture);
      },
      undefined,
      (err) => {
        console.warn(`[TextureLoader] Failed to load ${url}, attempting fallback: ${fallbackUrl}`, err);
        // attempt secondary fallback if primary failed
        if (url !== fallbackUrl) {
          loader.load(
            fallbackUrl,
            (fallbackTexture) => {
              fallbackTexture.colorSpace = THREE.SRGBColorSpace;
              fallbackTexture.minFilter = THREE.LinearFilter;
              fallbackTexture.magFilter = THREE.LinearFilter;
              fallbackTexture.generateMipmaps = false;
              fallbackTexture.wrapS = THREE.RepeatWrapping;
              fallbackTexture.wrapT = THREE.ClampToEdgeWrapping;
              textureCache.set(url, fallbackTexture);
              resolve(fallbackTexture);
            },
            undefined,
            () => {
              // ultimate procedural fallback
              const procedural = createProceduralFallbackTexture();
              textureCache.set(url, procedural);
              resolve(procedural);
            }
          );
        } else {
          const procedural = createProceduralFallbackTexture();
          textureCache.set(url, procedural);
          resolve(procedural);
        }
      }
    );
  });
}
