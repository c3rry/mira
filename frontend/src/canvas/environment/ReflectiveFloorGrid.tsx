// eye-level walkable 3d architectural floor plane with tiled stone/marble/sandstone shaders and colonnade markers
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorldStore } from "@/store/useWorldStore";

export function ReflectiveFloorGrid() {
  const ringRef = useRef<THREE.Mesh>(null);
  const { currentRoomId, rooms } = useWorldStore();
  const activeRoom = rooms[currentRoomId];
  const biome = (activeRoom?.biome_type || activeRoom?.name || "desert_oasis").toLowerCase();

  const palette = useMemo(() => {
    if (biome.includes("desert") || biome.includes("giza") || biome.includes("pyramid") || biome.includes("ruin")) {
      return {
        accent: "#d4af37",
        tileA: "rgba(194, 154, 92, 0.34)",
        tileB: "rgba(168, 128, 68, 0.28)",
        grout: "rgba(212, 175, 55, 0.55)",
      };
    }
    if (biome.includes("tavern") || biome.includes("medieval") || biome.includes("roman") || biome.includes("rome") || biome.includes("athens")) {
      return {
        accent: "#c87d32",
        tileA: "rgba(155, 118, 82, 0.34)",
        tileB: "rgba(128, 92, 58, 0.28)",
        grout: "rgba(217, 155, 82, 0.52)",
      };
    }
    if (biome.includes("forest") || biome.includes("cavern") || biome.includes("garden") || biome.includes("babylon")) {
      return {
        accent: "#4ade80",
        tileA: "rgba(56, 118, 78, 0.34)",
        tileB: "rgba(42, 96, 62, 0.28)",
        grout: "rgba(163, 230, 53, 0.50)",
      };
    }
    if (biome.includes("space") || biome.includes("station") || biome.includes("spire") || biome.includes("orbital")) {
      return {
        accent: "#93c5fd",
        tileA: "rgba(71, 85, 105, 0.36)",
        tileB: "rgba(51, 65, 85, 0.30)",
        grout: "rgba(147, 197, 253, 0.55)",
      };
    }
    return {
      accent: "#eab308",
      tileA: "rgba(68, 64, 60, 0.36)",
      tileB: "rgba(48, 45, 42, 0.30)",
      grout: "rgba(234, 179, 8, 0.52)",
    };
  }, [biome]);

  const floorTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);

    // alternating architectural stone/marble paving slabs for unmistakable walking feedback
    const step = 128;
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        const isEven = ((x / step) + (y / step)) % 2 === 0;
        ctx.fillStyle = isEven ? palette.tileA : palette.tileB;
        ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
      }
    }

    // crisp stone grout and inlaid brass lines
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

    // fine sub-tile bevel lines
    ctx.strokeStyle = "rgba(253, 246, 226, 0.22)";
    ctx.lineWidth = 1;
    const halfStep = 64;
    for (let i = halfStep; i < size; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    return texture;
  }, [palette]);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.14;
    }
  });

  if (!floorTexture) return null;

  // placed at human eye-height floor offset (y = -6.0 instead of y = -26.0)
  return (
    <group position={[0, -6.0, 0]}>
      {/* walkable tiled 3d architectural floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[140, 64]} />
        <meshBasicMaterial
          map={floorTexture}
          transparent={true}
          opacity={0.58}
          depthWrite={false}
        />
      </mesh>

      {/* central compass astrolabe ring */}
      <mesh ref={ringRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.5, 7.6, 48]} />
        <meshBasicMaterial
          color={palette.accent}
          side={THREE.DoubleSide}
          transparent={true}
          opacity={0.62}
        />
      </mesh>

      {/* outer sanctuary boundary ring */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[38.0, 39.2, 64]} />
        <meshBasicMaterial
          color={palette.accent}
          side={THREE.DoubleSide}
          transparent={true}
          opacity={0.38}
        />
      </mesh>
    </group>
  );
}
