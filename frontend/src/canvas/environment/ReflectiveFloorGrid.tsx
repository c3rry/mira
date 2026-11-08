// eye-level walkable 3d floor plane and inter-room causeway with adaptive nature vs architectural materials
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorldStore } from "@/store/useWorldStore";

export function isNaturalBiomeContext(text: string): boolean {
  const t = text.toLowerCase();
  const explicitBuilding = [
    "temple",
    "palace",
    "castle",
    "citadel",
    "cathedral",
    "dojo",
    "pagoda",
    "shrine",
    "tavern",
    "guild",
    "forum",
    "colosseum",
    "pantheon",
    "parthenon",
    "acropolis",
    "pyramid",
    "sphinx",
    "city",
    "metropolis",
    "arcade",
    "station",
    "observatory",
    "courtyard",
    "colonnade",
    "rotunda",
  ].some((w) => t.includes(w));

  const naturalWords = [
    "everest",
    "himalaya",
    "k2",
    "alps",
    "mountain",
    "peak",
    "summit",
    "ridge",
    "glacier",
    "icefall",
    "cwm",
    "col",
    "alpine",
    "snow",
    "tundra",
    "arctic",
    "volcano",
    "caldera",
    "lava",
    "canyon",
    "gorge",
    "valley",
    "cliff",
    "mesa",
    "sahara",
    "dune",
    "forest",
    "jungle",
    "woods",
    "wilderness",
    "ocean",
    "sea",
    "island",
    "waterfall",
    "cave",
    "cavern",
    "nature",
    "trail",
    "basin",
    "moon",
    "lunar",
    "mars",
    "martian",
    "tranquility",
    "procellarum",
    "copernicus",
    "expanse",
    "frontier",
  ].some((w) => t.includes(w));

  return naturalWords && !explicitBuilding;
}

interface ReflectiveFloorGridProps {
  roomName?: string;
  biomeType?: string;
  isCurrentRoom?: boolean;
}

export function ReflectiveFloorGrid({
  roomName,
  biomeType,
  isCurrentRoom = true,
}: ReflectiveFloorGridProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const { currentRoomId, rooms, worldTitle } = useWorldStore();
  const activeRoom = rooms[currentRoomId];
  const contextText = `${roomName || activeRoom?.name || ""} ${worldTitle || ""} ${biomeType || activeRoom?.biome_type || "desert_oasis"}`.toLowerCase();
  const isNature = isNaturalBiomeContext(contextText);

  const palette = useMemo(() => {
    if (
      contextText.includes("everest") ||
      contextText.includes("himalaya") ||
      contextText.includes("glacier") ||
      contextText.includes("icefall") ||
      contextText.includes("snow") ||
      contextText.includes("alpine") ||
      contextText.includes("summit") ||
      contextText.includes("peak") ||
      contextText.includes("mountain") ||
      contextText.includes("arctic")
    ) {
      return {
        kind: "snow" as const,
        accent: "#7dd3fc",
        tileA: "rgba(226, 240, 253, 0.34)",
        tileB: "rgba(186, 214, 242, 0.28)",
        grout: "rgba(125, 211, 252, 0.42)",
      };
    }
    if (isNature) {
      if (contextText.includes("canyon") || contextText.includes("dune") || contextText.includes("sahara") || contextText.includes("mesa")) {
        return {
          kind: "nature_sand" as const,
          accent: "#f59e0b",
          tileA: "rgba(194, 145, 86, 0.30)",
          tileB: "rgba(166, 118, 64, 0.25)",
          grout: "rgba(245, 158, 11, 0.38)",
        };
      }
      return {
        kind: "nature_earth" as const,
        accent: "#4ade80",
        tileA: "rgba(54, 98, 65, 0.30)",
        tileB: "rgba(42, 78, 52, 0.25)",
        grout: "rgba(134, 239, 172, 0.36)",
      };
    }
    if (contextText.includes("desert") || contextText.includes("giza") || contextText.includes("pyramid") || contextText.includes("ruin")) {
      return {
        kind: "stone" as const,
        accent: "#d4af37",
        tileA: "rgba(194, 154, 92, 0.34)",
        tileB: "rgba(168, 128, 68, 0.28)",
        grout: "rgba(212, 175, 55, 0.55)",
      };
    }
    if (contextText.includes("tavern") || contextText.includes("medieval") || contextText.includes("roman") || contextText.includes("rome") || contextText.includes("athens")) {
      return {
        kind: "stone" as const,
        accent: "#c87d32",
        tileA: "rgba(155, 118, 82, 0.34)",
        tileB: "rgba(128, 92, 58, 0.28)",
        grout: "rgba(217, 155, 82, 0.52)",
      };
    }
    if (contextText.includes("forest") || contextText.includes("cavern") || contextText.includes("garden") || contextText.includes("babylon")) {
      return {
        kind: "stone" as const,
        accent: "#4ade80",
        tileA: "rgba(56, 118, 78, 0.34)",
        tileB: "rgba(42, 96, 62, 0.28)",
        grout: "rgba(163, 230, 53, 0.50)",
      };
    }
    if (contextText.includes("space") || contextText.includes("station") || contextText.includes("spire") || contextText.includes("orbital")) {
      return {
        kind: "stone" as const,
        accent: "#93c5fd",
        tileA: "rgba(71, 85, 105, 0.36)",
        tileB: "rgba(51, 65, 85, 0.30)",
        grout: "rgba(147, 197, 253, 0.55)",
      };
    }
    return {
      kind: "stone" as const,
      accent: "#eab308",
      tileA: "rgba(68, 64, 60, 0.36)",
      tileB: "rgba(48, 45, 42, 0.30)",
      grout: "rgba(234, 179, 8, 0.52)",
    };
  }, [contextText, isNature]);

  const floorTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);

    if (palette.kind === "snow" || palette.kind === "nature_sand" || palette.kind === "nature_earth") {
      // organic wind-sculpted snowdrifts, glacial ice cracks, or natural terrain contours (zero man-made tiles)
      ctx.fillStyle = palette.tileA;
      ctx.fillRect(0, 0, size, size);

      for (let i = 0; i < 48; i++) {
        const y = (i / 48) * size;
        ctx.strokeStyle = i % 2 === 0 ? palette.tileB : palette.grout;
        ctx.lineWidth = 4 + (i % 5) * 2;
        ctx.beginPath();
        for (let x = 0; x <= size; x += 32) {
          const wave = Math.sin((x / size) * Math.PI * 4 + i * 0.7) * 14;
          if (x === 0) ctx.moveTo(x, y + wave);
          else ctx.lineTo(x, y + wave);
        }
        ctx.stroke();
      }
    } else {
      // alternating architectural stone/marble paving slabs
      const step = 128;
      for (let y = 0; y < size; y += step) {
        for (let x = 0; x < size; x += step) {
          const isEven = (x / step + y / step) % 2 === 0;
          ctx.fillStyle = isEven ? palette.tileA : palette.tileB;
          ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
        }
      }

      ctx.strokeStyle = palette.grout;
      ctx.lineWidth = 3;
      for (let i = 0; i <= size; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 12);
    return texture;
  }, [palette]);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.14;
    }
  });

  if (!floorTexture) return null;

  return (
    <group position={[0, -6.0, 0]}>
      {/* subtle central compass ring at room origin - zero artificial floor plane slicing through panorama */}
      <mesh ref={ringRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.2, 4.8, 48]} />
        <meshBasicMaterial
          color={palette.accent}
          side={THREE.DoubleSide}
          transparent={true}
          opacity={isCurrentRoom ? 0.32 : 0.08}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
