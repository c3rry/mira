// translucent architectural ground compass and perspective floor plane
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

  const accentColor = useMemo(() => {
    if (biome.includes("desert") || biome.includes("giza") || biome.includes("pyramid") || biome.includes("ruin")) {
      return "#d4af37";
    }
    if (biome.includes("tavern") || biome.includes("medieval") || biome.includes("roman")) {
      return "#c87d32";
    }
    if (biome.includes("forest") || biome.includes("cavern") || biome.includes("garden")) {
      return "#4ade80";
    }
    if (biome.includes("space") || biome.includes("station") || biome.includes("spire")) {
      return "#93c5fd";
    }
    return "#eab308";
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

    // subtle architectural stone tile lines
    ctx.strokeStyle = "rgba(212, 175, 55, 0.28)";
    ctx.lineWidth = 2;
    const step = 64;
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

    // concentric compass rings
    const cx = size / 2;
    const cy = size / 2;
    for (const r of [140, 280, 420]) {
      ctx.strokeStyle = "rgba(253, 246, 226, 0.32)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    return texture;
  }, []);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.12;
    }
  });

  if (!floorTexture) return null;

  return (
    <group position={[0, -26, 0]}>
      {/* translucent architectural floor overlay preserving underlying 360 panorama floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[190, 64]} />
        <meshBasicMaterial
          map={floorTexture}
          transparent={true}
          opacity={0.34}
          depthWrite={false}
        />
      </mesh>

      {/* central compass astrolabe ring */}
      <mesh ref={ringRef} position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[18, 20.5, 48]} />
        <meshBasicMaterial
          color={accentColor}
          side={THREE.DoubleSide}
          transparent={true}
          opacity={0.45}
        />
      </mesh>
    </group>
  );
}
