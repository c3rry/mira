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

// synthesize a bright, architecturally detailed 360 panorama tailored to room and prompt
function createPromptDrivenPanorama(url: string): THREE.Texture {
  const canvas = document.createElement("canvas");
  const w = 2048;
  const h = 1024;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  const queryIndex = url.indexOf("?");
  const params = new URLSearchParams(queryIndex >= 0 ? url.slice(queryIndex) : "");
  const roomName = params.get("room") || "Grand Sanctuary Courtyard";
  const promptText = params.get("prompt") || roomName;
  const biome = (params.get("biome") || "").toLowerCase();
  const roomIdx = parseInt(params.get("idx") || "0", 10);
  const customSkyHex = params.get("sky") || "";
  const customFloorHex = params.get("floor") || "";
  const worldX = parseFloat(params.get("x") || "0");
  const worldZ = parseFloat(params.get("z") || "0");

  const archetype = classifySceneArchetype(roomName, promptText, biome);
  const seedKey = `${roomName}_${promptText}_${archetype}_${roomIdx}_${worldX}_${worldZ}`;
  const rand = seededRandom(hashString(seedKey) + roomIdx * 131);
  const horizonY = h / 2;

  let subRoomVariant = roomIdx % 4;
  if (!isNaN(worldX) && !isNaN(worldZ) && (Math.abs(worldX) > 40 || Math.abs(worldZ) > 40)) {
    if (worldZ > 80) subRoomVariant = 3;
    else if (worldX > 80) subRoomVariant = 1;
    else if (worldZ < -80) subRoomVariant = 2;
    else subRoomVariant = 0;
  }

  if (ctx) {
    if (archetype === "rome") {
      // 1. Imperial Forum of Rome — 4 distinct sub-rooms sharing Roman Classical travertine & porphyry style
      if (subRoomVariant === 1) {
        // Sub-Room 1: Rotunda of the Pantheon (Interior Coffered Dome & Central Sunbeam Oculus)
        const domeGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        domeGrad.addColorStop(0, "#fef3c7");
        domeGrad.addColorStop(0.22, "#78716c");
        domeGrad.addColorStop(0.65, "#57534e");
        domeGrad.addColorStop(1, "#a8a29e");
        ctx.fillStyle = domeGrad;
        ctx.fillRect(0, 0, w, horizonY);

        // Sunken Roman Coffered Ceiling Grid
        ctx.strokeStyle = "#44403c";
        ctx.lineWidth = 3;
        for (let r = 45; r < horizonY - 80; r += 44) {
          for (let x = 30; x < w; x += 96) {
            ctx.strokeRect(x, r, 80, 34);
            ctx.strokeStyle = "#d6d3d1";
            ctx.strokeRect(x + 6, r + 5, 68, 24);
            ctx.strokeStyle = "#44403c";
          }
        }

        // Dramatic Volumetric Sunbeam Streaming from the Zenith Oculus
        const beamGrad = ctx.createLinearGradient(w / 2, 0, w / 2 + 160, h);
        beamGrad.addColorStop(0, "rgba(254, 249, 195, 0.75)");
        beamGrad.addColorStop(0.6, "rgba(253, 224, 71, 0.28)");
        beamGrad.addColorStop(1, "rgba(253, 224, 71, 0.05)");
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(w / 2 - 140, 0);
        ctx.lineTo(w / 2 + 140, 0);
        ctx.lineTo(w / 2 + 420, h);
        ctx.lineTo(w / 2 - 120, h);
        ctx.closePath();
        ctx.fill();

        // Corinthian Marble Apse Niches around Perimeter
        for (let x = 110; x < w; x += 240) {
          ctx.fillStyle = "#292524";
          ctx.beginPath();
          ctx.arc(x, horizonY - 120, 52, Math.PI, 0);
          ctx.rect(x - 52, horizonY - 120, 104, 120);
          ctx.fill();
          ctx.strokeStyle = "#d97706";
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.fillStyle = "#f5f5f4";
          ctx.fillRect(x - 64, horizonY - 140, 16, 140);
          ctx.fillRect(x + 48, horizonY - 140, 16, 140);
        }

        // Polychrome Porphyry & Giallo Antico Marble Rotunda Floor
        const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        floorGrad.addColorStop(0, "#7c2d12");
        floorGrad.addColorStop(0.5, "#9a3412");
        floorGrad.addColorStop(1, "#431407");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, horizonY, w, horizonY);

      } else if (subRoomVariant === 2) {
        // Sub-Room 2: Flavian Amphitheater Colonnade (Inside the Colosseum Arena & Tiered Cavea)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, "#0284c7");
        skyGrad.addColorStop(0.5, "#7dd3fc");
        skyGrad.addColorStop(1, "#fef3c7");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY);

        // 360-Degree Wrapping Travertine Tiered Amphitheater Arches
        const wallH = 310;
        ctx.fillStyle = "#e7d8c1";
        ctx.fillRect(0, horizonY - wallH, w, wallH);
        for (let tier = 0; tier < 3; tier++) {
          const ty = horizonY - (tier + 1) * 98;
          ctx.strokeStyle = "#78350f";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(0, ty);
          ctx.lineTo(w, ty);
          ctx.stroke();
          for (let ax = 48; ax < w; ax += 84) {
            ctx.fillStyle = tier === 2 ? "#7dd3fc" : "#292524";
            ctx.beginPath();
            ctx.arc(ax, ty + 38, 24, Math.PI, 0);
            ctx.rect(ax - 24, ty + 38, 48, 52);
            ctx.fill();
            // engaged Roman half-columns between arches
            ctx.fillStyle = "#f5f5f4";
            ctx.fillRect(ax + 34, ty + 6, 12, 88);
          }
        }

        // Crimson Imperial Velarium Awning Pennants overhead
        for (let x = 0; x < w; x += 128) {
          ctx.fillStyle = x % 256 === 0 ? "rgba(185, 28, 28, 0.72)" : "rgba(217, 119, 6, 0.65)";
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + 90, 0);
          ctx.lineTo(x + 45, 165);
          ctx.closePath();
          ctx.fill();
        }

        // Sunlit Sand & Travertine Arena Floor
        const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        floorGrad.addColorStop(0, "#fde68a");
        floorGrad.addColorStop(0.6, "#d97706");
        floorGrad.addColorStop(1, "#92400e");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, horizonY, w, horizonY);

      } else if (subRoomVariant === 3) {
        // Sub-Room 3: Gardens of the Palatine Hill (Elevated Imperial Cypress Overlook)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, "#1e40af");
        skyGrad.addColorStop(0.55, "#f59e0b");
        skyGrad.addColorStop(1, "#fef08a");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY);

        // Italian Cypress Trees & Marble Pergola Colonnade
        for (let x = 90; x < w; x += 160) {
          // Tall slender Mediterranean cypress
          ctx.fillStyle = "#14532d";
          ctx.beginPath();
          ctx.ellipse(x, horizonY - 160, 26, 150, 0, 0, Math.PI * 2);
          ctx.fill();
          // White marble pergola pillar
          ctx.fillStyle = "#fafaf9";
          ctx.fillRect(x + 65, horizonY - 210, 22, 210);
          ctx.fillStyle = "#d97706";
          ctx.fillRect(x + 58, horizonY - 218, 36, 12);
        }
        ctx.fillStyle = "#e7e5e4";
        ctx.fillRect(0, horizonY - 230, w, 16);

        // Mosaic Reflecting Pool & Terracotta Floor
        const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        floorGrad.addColorStop(0, "#b45309");
        floorGrad.addColorStop(1, "#78350f");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, horizonY, w, horizonY);

      } else {
        // Sub-Room 0: Via Sacra & Roman Forum (Triumphal Arch, Temple Pediment & Basilica Arcades)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, "#1d4ed8");
        skyGrad.addColorStop(0.55, "#60a5fa");
        skyGrad.addColorStop(1, "#fef3c7");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY);

        const sunX = w * 0.35;
        const sunY = horizonY - 230;
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, 160);
        sunGrad.addColorStop(0, "#ffffff");
        sunGrad.addColorStop(0.4, "#fde68a");
        sunGrad.addColorStop(1, "rgba(254, 243, 199, 0)");
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 160, 0, Math.PI * 2);
        ctx.fill();

        const cx = w / 2;
        ctx.fillStyle = "#e7e5e4";
        ctx.beginPath();
        ctx.arc(cx, horizonY - 90, 240, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = "#a8a29e";
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = "#f5f5f4";
        ctx.beginPath();
        ctx.moveTo(cx - 260, horizonY - 150);
        ctx.lineTo(cx, horizonY - 250);
        ctx.lineTo(cx + 260, horizonY - 150);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#b45309";
        ctx.lineWidth = 4;
        ctx.stroke();

        for (let x = cx - 220; x <= cx + 220; x += 55) {
          ctx.fillStyle = "#fafaf9";
          ctx.fillRect(x - 12, horizonY - 150, 24, 150);
          ctx.strokeStyle = "#d6d3d1";
          ctx.strokeRect(x - 12, horizonY - 150, 24, 150);
          ctx.fillStyle = "#d97706";
          ctx.fillRect(x - 16, horizonY - 158, 32, 10);
        }

        for (const wingX of [140, w - 580]) {
          const wingW = 440;
          const wingH = 260;
          ctx.fillStyle = "#e7d8c1";
          ctx.fillRect(wingX, horizonY - wingH, wingW, wingH);
          ctx.strokeStyle = "#92400e";
          ctx.lineWidth = 3;
          ctx.strokeRect(wingX, horizonY - wingH, wingW, wingH);

          for (let tier = 0; tier < 3; tier++) {
            const ty = horizonY - (tier + 1) * 82;
            ctx.beginPath();
            ctx.moveTo(wingX, ty);
            ctx.lineTo(wingX + wingW, ty);
            ctx.stroke();
            for (let ax = wingX + 35; ax < wingX + wingW - 20; ax += 55) {
              ctx.fillStyle = "#44403c";
              ctx.beginPath();
              ctx.arc(ax, ty + 35, 16, Math.PI, 0);
              ctx.rect(ax - 16, ty + 35, 32, 42);
              ctx.fill();
            }
          }
        }

        const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        floorGrad.addColorStop(0, "#d6c7b2");
        floorGrad.addColorStop(0.5, "#b89f80");
        floorGrad.addColorStop(1, "#7c2d12");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, horizonY, w, horizonY);
      }

    } else if (archetype === "greece") {
      // 2. Acropolis of Athens & Aegean Sea (Distinct sub-rooms per roomIdx)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, subRoomVariant % 2 === 0 ? "#0284c7" : "#1d4ed8");
      skyGrad.addColorStop(0.65, "#7dd3fc");
      skyGrad.addColorStop(1, "#fef9c3");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, horizonY);

      // Deep Azure Aegean Sea & Distant Cycladic Islands at Horizon
      ctx.fillStyle = "#0369a1";
      ctx.fillRect(0, horizonY - 65, w, 65);
      for (const ix of [260, 1480, 1820]) {
        ctx.fillStyle = "#64748b";
        ctx.beginPath();
        ctx.moveTo(ix - 140, horizonY - 65);
        ctx.quadraticCurveTo(ix, horizonY - 135, ix + 140, horizonY - 65);
        ctx.fill();
      }

      if (subRoomVariant === 1) {
        // Propylaea Monumental Gateway Wings
        for (const gx of [w / 2 - 480, w / 2 + 120]) {
          ctx.fillStyle = "#f8fafc";
          ctx.fillRect(gx, horizonY - 260, 360, 260);
          ctx.strokeStyle = "#94a3b8";
          ctx.strokeRect(gx, horizonY - 260, 360, 260);
          for (let cx = gx + 30; cx < gx + 340; cx += 65) {
            ctx.fillStyle = "#e2e8f0";
            ctx.fillRect(cx - 12, horizonY - 220, 24, 220);
          }
        }
      } else {
        // Pentelic White Marble Parthenon Peristyle
        const px = w / 2 - 380;
        const pw = 760;
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.moveTo(px - 20, horizonY - 220);
        ctx.lineTo(w / 2, horizonY - 330);
        ctx.lineTo(px + pw + 20, horizonY - 220);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(px, horizonY - 220, pw, 32);
        ctx.strokeStyle = "#0284c7";
        ctx.strokeRect(px, horizonY - 220, pw, 32);

        for (let x = px + 24; x <= px + pw - 24; x += 64) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x - 14, horizonY - 188, 28, 188);
          ctx.strokeStyle = "#94a3b8";
          ctx.strokeRect(x - 14, horizonY - 188, 28, 188);
        }
      }

      const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
      floorGrad.addColorStop(0, "#f1f5f9");
      floorGrad.addColorStop(1, "#cbd5e1");
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, horizonY, w, horizonY);

    } else if (archetype === "gardens") {
      // 3. Hanging Gardens of Babylon / Botanical Sanctuary (Distinct sub-rooms per roomIdx)
      if (subRoomVariant === 1) {
        // Sub-Room 1: Ishtar Glazed Lapis Lazuli Water Pavilion & Aqueduct Arches
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, "#047857");
        skyGrad.addColorStop(0.55, "#34d399");
        skyGrad.addColorStop(1, "#fde68a");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY);

        // Babylonian Ishtar Blue Glazed Brick Processional Walls & Golden Reliefs
        ctx.fillStyle = "#1e3a8a";
        ctx.fillRect(80, horizonY - 270, w - 160, 270);
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 6;
        ctx.strokeRect(80, horizonY - 270, w - 160, 270);

        // Arched Stone Hydraulic Aqueducts streaming waterfalls into the pavilion
        for (let ax = 180; ax < w - 140; ax += 220) {
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.arc(ax, horizonY - 140, 56, Math.PI, 0);
          ctx.rect(ax - 56, horizonY - 140, 112, 140);
          ctx.fill();
          ctx.strokeStyle = "#eab308";
          ctx.lineWidth = 4;
          ctx.stroke();

          // White foam cascade
          ctx.fillStyle = "rgba(224, 242, 254, 0.7)";
          ctx.fillRect(ax - 20, horizonY - 140, 40, 140);
        }

        // Turquoise Reflection Basin Floor with Travertine Stepping Stones
        const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        floorGrad.addColorStop(0, "#0284c7");
        floorGrad.addColorStop(0.6, "#0369a1");
        floorGrad.addColorStop(1, "#065f46");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, horizonY, w, horizonY);

      } else {
        // Sub-Room 0/2/3: Upper Cedar Terrace & Stepped Ziggurat Sanctuary
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, "#059669");
        skyGrad.addColorStop(0.55, "#6ee7b7");
        skyGrad.addColorStop(1, "#fef08a");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY);

        for (let step = 0; step < 4; step++) {
          const tw = 960 - step * 180;
          const th = 75;
          const ty = horizonY - (step + 1) * th;
          ctx.fillStyle = step % 2 === 0 ? "#1e3a8a" : "#b45309";
          ctx.fillRect(w / 2 - tw / 2, ty, tw, th);
          ctx.strokeStyle = "#facc15";
          ctx.lineWidth = 3;
          ctx.strokeRect(w / 2 - tw / 2, ty, tw, th);

          for (const wx of [w / 2 - tw / 3, w / 2, w / 2 + tw / 3]) {
            ctx.fillStyle = "#38bdf8";
            ctx.fillRect(wx - 22, ty, 44, th);
            ctx.fillStyle = "#e0f2fe";
            ctx.fillRect(wx - 8, ty, 16, th);
          }
        }

        for (let x = 90; x < w; x += 195) {
          if (Math.abs(x - w / 2) < 280) continue;
          ctx.fillStyle = "#78350f";
          ctx.fillRect(x - 16, horizonY - 220, 32, 220);
          ctx.fillStyle = "#16a34a";
          ctx.beginPath();
          ctx.arc(x, horizonY - 250, 110, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#4ade80";
          ctx.beginPath();
          ctx.arc(x - 20, horizonY - 270, 65, 0, Math.PI * 2);
          ctx.fill();
        }

        const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        floorGrad.addColorStop(0, "#15803d");
        floorGrad.addColorStop(1, "#14532d");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, horizonY, w, horizonY);

        ctx.fillStyle = "#0284c7";
        ctx.beginPath();
        ctx.moveTo(w / 2 - 90, horizonY);
        ctx.lineTo(w / 2 + 90, horizonY);
        ctx.lineTo(w / 2 + 380, h);
        ctx.lineTo(w / 2 - 380, h);
        ctx.closePath();
        ctx.fill();
      }

    } else if (archetype === "space") {
      // 4. Celestial Orbital Observatory (Sub-room variations in planet, nebula & brass astrolabe geometry)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, "#090d16");
      skyGrad.addColorStop(0.5, subRoomVariant % 2 === 0 ? "#1e3a8a" : "#312e81");
      skyGrad.addColorStop(1, "#38bdf8");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, horizonY);

      for (let i = 0; i < 450; i++) {
        ctx.fillStyle = i % 5 === 0 ? "#fde047" : "#ffffff";
        const sz = i % 7 === 0 ? 3 : 2;
        ctx.fillRect(rand() * w, rand() * (horizonY - 30), sz, sz);
      }

      const px = w / 2 + (subRoomVariant - 1) * 260;
      const py = horizonY - 220;
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.ellipse(px, py, 260, 55, -0.2, 0, Math.PI * 2);
      ctx.stroke();

      const planetGrad = ctx.createRadialGradient(px - 40, py - 40, 20, px, py, 140);
      planetGrad.addColorStop(0, subRoomVariant === 1 ? "#f9a8d4" : "#93c5fd");
      planetGrad.addColorStop(0.6, subRoomVariant === 1 ? "#9333ea" : "#2563eb");
      planetGrad.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(px, py, 140, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 6;
      for (let x = 128; x < w; x += 256) {
        ctx.beginPath();
        ctx.moveTo(x, horizonY);
        ctx.quadraticCurveTo(w / 2, -120, w - x, horizonY);
        ctx.stroke();
      }

      const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
      floorGrad.addColorStop(0, "#e2e8f0");
      floorGrad.addColorStop(0.5, "#94a3b8");
      floorGrad.addColorStop(1, "#334155");
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, horizonY, w, horizonY);

    } else if (archetype === "guildhall") {
      // 5. Highland Timber & Limestone Guildhall / Medieval Tavern
      const wallGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      wallGrad.addColorStop(0, "#451a03");
      wallGrad.addColorStop(1, "#92400e");
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, w, horizonY);

      for (let x = 120; x < w; x += 220) {
        ctx.fillStyle = "#292524";
        ctx.fillRect(x - 16, 0, 32, horizonY);
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.arc(x + 95, 160, 44, Math.PI, 0);
        ctx.rect(x + 51, 160, 88, 220);
        ctx.fill();
        ctx.strokeStyle = "#b45309";
        ctx.lineWidth = 6;
        ctx.stroke();
      }

      ctx.fillStyle = "#57534e";
      ctx.fillRect(w / 2 - 150, horizonY - 240, 300, 240);
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(w / 2, horizonY, 95, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(w / 2, horizonY, 55, Math.PI, 0);
      ctx.fill();

      const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
      floorGrad.addColorStop(0, "#78350f");
      floorGrad.addColorStop(1, "#451a03");
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, horizonY, w, horizonY);

    } else if (archetype === "metropolis") {
      // 6. Grand Metropolis Arcade / Cyberpunk Boulevard
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, "#1e1b4b");
      skyGrad.addColorStop(0.55, subRoomVariant % 2 === 0 ? "#6d28d9" : "#0369a1");
      skyGrad.addColorStop(1, "#f59e0b");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, horizonY);

      for (let x = 20; x < w; x += 72) {
        const bh = 190 + rand() * 260;
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(x, horizonY - bh, 62, bh);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, horizonY - bh, 62, bh);
        for (let wy = horizonY - bh + 14; wy < horizonY - 14; wy += 18) {
          for (let wx = x + 8; wx < x + 52; wx += 14) {
            ctx.fillStyle = rand() > 0.35 ? "#fef08a" : "#38bdf8";
            ctx.fillRect(wx, wy, 8, 10);
          }
        }
      }

      const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
      floorGrad.addColorStop(0, "#475569");
      floorGrad.addColorStop(1, "#0f172a");
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, horizonY, w, horizonY);

    } else if (archetype === "bespoke") {
      // 7. Bespoke Prompt-Synthesized World — generates unique color palettes, horizons, and architecture for any custom prompt
      const promptHash = hashString(promptText.toLowerCase());
      const baseHue = promptHash % 360;
      const accentHue = (baseHue + 38) % 360;
      const groundHue = (baseHue + 18) % 360;

      const skyTop = /^#[0-9a-fA-F]{6}$/.test(customSkyHex)
        ? customSkyHex
        : `hsl(${baseHue}, 58%, ${subRoomVariant === 2 ? 18 : 32}%)`;
      const skyMid = `hsl(${accentHue}, 64%, ${subRoomVariant === 2 ? 34 : 58}%)`;
      const skyHorizon = `hsl(${(accentHue + 25) % 360}, 85%, 78%)`;

      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, skyTop);
      skyGrad.addColorStop(0.58, skyMid);
      skyGrad.addColorStop(1, skyHorizon);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, horizonY);

      // Volumetric sun or celestial moon
      const sunX = (w * 0.42 + subRoomVariant * 280) % w;
      const sunY = horizonY - 225;
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 14, sunX, sunY, 185);
      sunGrad.addColorStop(0, "#ffffff");
      sunGrad.addColorStop(0.35, skyHorizon);
      sunGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 185, 0, Math.PI * 2);
      ctx.fill();

      // Layered distant mountain / skyline silhouettes seeded by prompt
      ctx.fillStyle = `hsl(${baseHue}, 32%, 28%)`;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      for (let mx = 0; mx <= w; mx += 64) {
        const mh = 75 + Math.sin(mx * 0.006 + promptHash) * 55 + rand() * 35;
        ctx.lineTo(mx, horizonY - mh);
      }
      ctx.lineTo(w, horizonY);
      ctx.closePath();
      ctx.fill();

      // Distinct Sub-Room Architectural Structures sharing the bespoke world style
      const stoneMain = `hsl(${groundHue}, 28%, 76%)`;
      const stoneShade = `hsl(${groundHue}, 24%, 48%)`;
      const trimGold = `hsl(${accentHue}, 72%, 56%)`;

      if (subRoomVariant === 0) {
        // Sub-Room 0: Grand Sovereign Courtyard & Domed Sanctuary Pavilion
        ctx.fillStyle = stoneMain;
        ctx.beginPath();
        ctx.arc(w / 2, horizonY - 110, 210, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = trimGold;
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = stoneShade;
        ctx.fillRect(w / 2 - 260, horizonY - 110, 520, 110);

        for (let cx = 140; cx < w; cx += 180) {
          ctx.fillStyle = stoneMain;
          ctx.fillRect(cx - 16, horizonY - 220, 32, 220);
          ctx.strokeStyle = stoneShade;
          ctx.strokeRect(cx - 16, horizonY - 220, 32, 220);
          ctx.fillStyle = trimGold;
          ctx.fillRect(cx - 22, horizonY - 230, 44, 12);
        }
      } else if (subRoomVariant === 1) {
        // Sub-Room 1: Vaulted Colonnade Cloister & Reflecting Basin
        for (let ax = 100; ax < w; ax += 160) {
          ctx.fillStyle = stoneMain;
          ctx.fillRect(ax - 18, horizonY - 260, 36, 260);
          ctx.strokeStyle = trimGold;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(ax + 62, horizonY - 180, 62, Math.PI, 0);
          ctx.stroke();
        }
      } else if (subRoomVariant === 2) {
        // Sub-Room 2: High Citadel Overlook & Monumental Spires
        for (let sx = 180; sx < w; sx += 320) {
          const sh = 240 + (sx % 120);
          ctx.fillStyle = stoneMain;
          ctx.fillRect(sx - 48, horizonY - sh, 96, sh);
          ctx.fillStyle = trimGold;
          ctx.beginPath();
          ctx.moveTo(sx - 56, horizonY - sh);
          ctx.lineTo(sx, horizonY - sh - 85);
          ctx.lineTo(sx + 56, horizonY - sh);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // Sub-Room 3: Inner Rotunda Archive & Illuminated Sanctum
        ctx.fillStyle = stoneShade;
        ctx.fillRect(120, horizonY - 250, w - 240, 250);
        for (let wx = 200; wx < w - 180; wx += 190) {
          ctx.fillStyle = skyHorizon;
          ctx.beginPath();
          ctx.arc(wx, horizonY - 150, 38, Math.PI, 0);
          ctx.rect(wx - 38, horizonY - 150, 76, 130);
          ctx.fill();
          ctx.strokeStyle = trimGold;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }

      const floorTop = /^#[0-9a-fA-F]{6}$/.test(customFloorHex)
        ? customFloorHex
        : `hsl(${groundHue}, 34%, 52%)`;
      const floorBot = `hsl(${groundHue}, 38%, 26%)`;
      const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
      floorGrad.addColorStop(0, floorTop);
      floorGrad.addColorStop(1, floorBot);
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, horizonY, w, horizonY);

    } else {
      // 8. Egyptian Necropolis of Giza — 4 distinct sub-rooms sharing Old Kingdom Sandstone & Gold style
      if (subRoomVariant === 1) {
        // Sub-Room 1: Sanctuary of the Great Sphinx (Monumental Lion-Human Monolith & Dream Stela)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, "#1d4ed8");
        skyGrad.addColorStop(0.5, "#60a5fa");
        skyGrad.addColorStop(1, "#fde047");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY);

        // Distant Silhouette of Khafre Pyramid on Left Horizon
        ctx.fillStyle = "#d99b52";
        ctx.beginPath();
        ctx.moveTo(320, horizonY - 240);
        ctx.lineTo(90, horizonY);
        ctx.lineTo(550, horizonY);
        ctx.closePath();
        ctx.fill();

        // Monumental Great Sphinx Carved Limestone Monolith in Center
        const sx = w / 2;
        // Lion recumbent body & extended paws
        ctx.fillStyle = "#eab664";
        ctx.fillRect(sx - 280, horizonY - 125, 560, 125);
        ctx.fillStyle = "#d49b4b";
        ctx.fillRect(sx - 340, horizonY - 55, 160, 55);
        ctx.fillRect(sx + 180, horizonY - 55, 160, 55);

        // Royal Nemes Striped Headdress & Head of Horemakhet
        ctx.fillStyle = "#f3d088";
        ctx.beginPath();
        ctx.moveTo(sx, horizonY - 320);
        ctx.lineTo(sx - 115, horizonY - 125);
        ctx.lineTo(sx + 115, horizonY - 125);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#1e3a8a";
        ctx.lineWidth = 4;
        for (let hy = horizonY - 290; hy < horizonY - 135; hy += 18) {
          ctx.beginPath();
          ctx.moveTo(sx - 85, hy);
          ctx.lineTo(sx + 85, hy);
          ctx.stroke();
        }

        // Rose Granite Dream Stela Altar between the Paws
        ctx.fillStyle = "#b91c1c";
        ctx.fillRect(sx - 38, horizonY - 105, 76, 105);
        ctx.strokeStyle = "#facc15";
        ctx.strokeRect(sx - 38, horizonY - 105, 76, 105);

        const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        floorGrad.addColorStop(0, "#e5b162");
        floorGrad.addColorStop(1, "#a16207");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, horizonY, w, horizonY);

      } else if (subRoomVariant === 2) {
        // Sub-Room 2: Grand Gallery of Khufu (Interior Ascending Corbelled Red-Granite Vault)
        const vaultGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        vaultGrad.addColorStop(0, "#291811");
        vaultGrad.addColorStop(0.5, "#5c341d");
        vaultGrad.addColorStop(1, "#9a5b2d");
        ctx.fillStyle = vaultGrad;
        ctx.fillRect(0, 0, w, horizonY);

        // Corbelled Stepped Granite Masonry Layers converging toward the King's Chamber
        for (let step = 0; step < 7; step++) {
          const inset = step * 42;
          const yTop = step * 36;
          ctx.strokeStyle = "#d97706";
          ctx.lineWidth = 3;
          ctx.strokeRect(inset, yTop, w - inset * 2, horizonY - yTop);
        }

        // Glowing Bronze Oil Torches lining the Gallery Ramp
        for (let tx = 140; tx < w; tx += 220) {
          const torchGrad = ctx.createRadialGradient(tx, horizonY - 95, 6, tx, horizonY - 95, 85);
          torchGrad.addColorStop(0, "#ffffff");
          torchGrad.addColorStop(0.35, "#facc15");
          torchGrad.addColorStop(1, "rgba(234, 88, 12, 0)");
          ctx.fillStyle = torchGrad;
          ctx.beginPath();
          ctx.arc(tx, horizonY - 95, 85, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#78350f";
          ctx.fillRect(tx - 6, horizonY - 95, 12, 95);
        }

        // Polished Aswan Rose-Granite Ascending Ramp Floor
        const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        floorGrad.addColorStop(0, "#7c2d12");
        floorGrad.addColorStop(1, "#451a03");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, horizonY, w, horizonY);

      } else if (subRoomVariant === 3) {
        // Sub-Room 3: Court of the Solar Barque (Sacred Cedarwood Vessel & Star Ceiling)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, "#0f172a");
        skyGrad.addColorStop(0.55, "#1e3a8a");
        skyGrad.addColorStop(1, "#f59e0b");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY);

        // Sacred Lebanon Cedarwood Solar Barque with Papyrus Prow & Golden Oars
        const bx = w / 2;
        ctx.fillStyle = "#92400e";
        ctx.beginPath();
        ctx.moveTo(bx - 380, horizonY - 195);
        ctx.quadraticCurveTo(bx, horizonY + 35, bx + 380, horizonY - 195);
        ctx.lineTo(bx + 310, horizonY - 40);
        ctx.quadraticCurveTo(bx, horizonY + 45, bx - 310, horizonY - 40);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 4;
        ctx.stroke();

        // Central Golden Pharaonic Naos Shrine Cabin on Deck
        ctx.fillStyle = "#d97706";
        ctx.fillRect(bx - 110, horizonY - 185, 220, 105);
        ctx.strokeStyle = "#fef08a";
        ctx.strokeRect(bx - 110, horizonY - 185, 220, 105);

        // Ceremonial Solar Oars
        for (let ox = bx - 240; ox <= bx + 240; ox += 48) {
          ctx.strokeStyle = "#fde047";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(ox, horizonY - 75);
          ctx.lineTo(ox - 24, horizonY + 25);
          ctx.stroke();
        }

        const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        floorGrad.addColorStop(0, "#1e3a8a");
        floorGrad.addColorStop(0.4, "#ca8a04");
        floorGrad.addColorStop(1, "#78350f");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, horizonY, w, horizonY);

      } else {
        // Sub-Room 0: Great Pyramid Forecourt (Three Pyramids of Giza & Sunlit Colonnade)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, "#3b82f6");
        skyGrad.addColorStop(0.55, "#93c5fd");
        skyGrad.addColorStop(1, "#fde68a");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY);

        const sunX = (w * 0.5 + (roomIdx * 260 - 180) + w) % w;
        const sunY = horizonY - 210;
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 190);
        sunGrad.addColorStop(0, "#ffffff");
        sunGrad.addColorStop(0.35, "#fef08a");
        sunGrad.addColorStop(1, "rgba(253, 224, 71, 0)");
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 190, 0, Math.PI * 2);
        ctx.fill();

        const pyramidOffsets = [-460, 0, 460];
        pyramidOffsets.forEach((offset, pIdx) => {
          const px = w / 2 + offset + ((roomIdx % 2) * 50 - 25);
          const ph = pIdx === 1 ? 350 : 265;
          const pw = pIdx === 1 ? 410 : 310;

          ctx.fillStyle = "#f3d088";
          ctx.beginPath();
          ctx.moveTo(px, horizonY - ph);
          ctx.lineTo(px - pw, horizonY);
          ctx.lineTo(px + 25, horizonY);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#c89648";
          ctx.beginPath();
          ctx.moveTo(px, horizonY - ph);
          ctx.lineTo(px + 25, horizonY);
          ctx.lineTo(px + pw, horizonY);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#facc15";
          ctx.beginPath();
          ctx.moveTo(px, horizonY - ph);
          ctx.lineTo(px - pw * 0.14, horizonY - ph * 0.86);
          ctx.lineTo(px + pw * 0.14, horizonY - ph * 0.86);
          ctx.closePath();
          ctx.fill();
        });

        for (let x = 110; x < w; x += 240) {
          if (Math.abs(x - w / 2) < 280) continue;
          const colH = 260;
          ctx.fillStyle = "#e7be74";
          ctx.fillRect(x - 18, horizonY - colH, 36, colH);
          ctx.strokeStyle = "#9a6b28";
          ctx.lineWidth = 2;
          ctx.strokeRect(x - 18, horizonY - colH, 36, colH);
          ctx.fillStyle = "#d4af37";
          ctx.fillRect(x - 26, horizonY - colH - 16, 52, 16);
        }

        const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        floorGrad.addColorStop(0, "#eab664");
        floorGrad.addColorStop(1, "#c68b38");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, horizonY, w, horizonY);
      }
    }

    // subtle atmospheric film grain & natural ambient occlusion vignette for photorealistic depth
    const vigGrad = ctx.createLinearGradient(0, horizonY - 45, 0, horizonY + 45);
    vigGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    vigGrad.addColorStop(0.5, "rgba(18, 12, 6, 0.24)");
    vigGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, horizonY - 45, w, 90);

    // perspective architectural stone paving grid on floor
    ctx.strokeStyle = "rgba(255, 248, 220, 0.22)";
    ctx.lineWidth = 1.5;
    for (let x = 0; x <= w; x += 128) {
      const spread = (x - w / 2) * 2.5;
      ctx.beginPath();
      ctx.moveTo(x, horizonY);
      ctx.lineTo(w / 2 + spread, h);
      ctx.stroke();
    }
    for (let y = horizonY + 22; y < h; y += 38) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Render reciprocal portal gateway leading directly back into parent room
    const fromName = params.get("from");
    const uBackStr = params.get("u_back");
    if (fromName && uBackStr) {
      const uBack = parseFloat(uBackStr);
      if (!isNaN(uBack)) {
        const portalCx = ((Math.round(uBack * w) % w) + w) % w;
        const pHalfW = 90;
        const pTopY = horizonY - 240;
        const pBotY = horizonY + 115;

        // Ground light spill pouring forward out of portal
        const spillGrad = ctx.createLinearGradient(0, pBotY, 0, pBotY + 160);
        spillGrad.addColorStop(0, "rgba(250, 204, 21, 0.42)");
        spillGrad.addColorStop(1, "rgba(250, 204, 21, 0.0)");
        ctx.fillStyle = spillGrad;
        ctx.beginPath();
        const sw = pHalfW * 2.2;
        ctx.moveTo(portalCx - pHalfW, pBotY);
        ctx.lineTo(portalCx + pHalfW, pBotY);
        ctx.lineTo(portalCx + sw, pBotY + 160);
        ctx.lineTo(portalCx - sw, pBotY + 160);
        ctx.closePath();
        ctx.fill();

        // Portal interior glow revealing parent room
        ctx.fillStyle = "rgba(234, 179, 8, 0.32)";
        ctx.fillRect(portalCx - pHalfW + 20, pTopY + 20, pHalfW * 2 - 40, pBotY - pTopY - 20);

        // Monumental stone/metallic pylons
        ctx.fillStyle = "#d4af37";
        ctx.fillRect(portalCx - pHalfW, pTopY, 24, pBotY - pTopY + 12);
        ctx.fillRect(portalCx + pHalfW - 24, pTopY, 24, pBotY - pTopY + 12);

        // Lintel & pediment
        ctx.fillRect(portalCx - pHalfW - 14, pTopY - 28, pHalfW * 2 + 28, 28);
        ctx.strokeStyle = "#fef08a";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(portalCx - pHalfW - 14, pTopY - 28, pHalfW * 2 + 28, 28);

        // Directional waypoint label plaque
        ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
        ctx.fillRect(portalCx - 110, pTopY - 60, 220, 26);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(portalCx - 110, pTopY - 60, 220, 26);
        ctx.fillStyle = "#fef08a";
        ctx.font = "bold 13px 'Times New Roman', serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const clippedFrom = fromName.length > 22 ? fromName.slice(0, 20) + ".." : fromName;
        ctx.fillText(`← TO ${clippedFrom.toUpperCase()}`, portalCx, pTopY - 47);
      }
    }
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
  if (textureCache.has(url)) {
    return Promise.resolve(textureCache.get(url)!);
  }

  if (typeof window === "undefined") {
    const customTex = new THREE.Texture();
    textureCache.set(url, customTex);
    return Promise.resolve(customTex);
  }

  // Strip query string when loading static/generated .webp or .png files from disk
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
        // First fallback: attempt fallbackUrl if specified and different
        const cleanFallback = fallbackUrl ? fallbackUrl.split("?")[0] : "";
        if (cleanFallback && cleanFallback !== cleanFileUrl) {
          loader.load(
            cleanFallback,
            (fallbackTexture) => {
              const configured = configureTexture(fallbackTexture);
              configured.userData.isFallback = true;
              textureCache.set(url, configured);
              resolve(configured);
            },
            undefined,
            () => {
              // High-resolution bespoke procedural panorama synthesized synchronously — NEVER a black screen!
              const synthesizedTex = createPromptDrivenPanorama(url);
              synthesizedTex.userData.isFallback = true;
              textureCache.set(url, synthesizedTex);
              resolve(synthesizedTex);
            }
          );
        } else {
          // Immediately synthesize high-resolution bespoke procedural panorama — NEVER a black screen!
          const synthesizedTex = createPromptDrivenPanorama(url);
          synthesizedTex.userData.isFallback = true;
          textureCache.set(url, synthesizedTex);
          resolve(synthesizedTex);
        }
      }
    );
  });
}

export function clearPanoramaCache(): void {
  textureCache.forEach((tex) => tex.dispose());
  textureCache.clear();
}
