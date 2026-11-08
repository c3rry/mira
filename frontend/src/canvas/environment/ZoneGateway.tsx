// modern interactive ground navigation hotspot (Matterport / Street View style)
// provides smooth clickable portal rings, directional chevrons, and floating label
"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ZoneGatewayProps {
  position: [number, number, number];
  angleY: number;
  label: string;
  style: "snow" | "nature" | "architecture";
  onNavigate?: () => void;
}

function makeLabelTexture(text: string, color: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 110;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Frosted glassy dark pill
  ctx.fillStyle = "rgba(10, 14, 22, 0.88)";
  ctx.beginPath();
  ctx.roundRect(4, 4, 632, 102, 24);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(4, 4, 632, 102, 24);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const clipped = text.length > 26 ? text.slice(0, 24) + ".." : text;
  ctx.fillText(`→  ${clipped.toUpperCase()}  ←`, 320, 56);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function ZoneGateway({ position, angleY, label, style, onNavigate }: ZoneGatewayProps) {
  const [hovered, setHovered] = useState(false);
  const ringRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);

  const palette =
    style === "snow"
      ? { glow: "#7dd3fc", core: "#38bdf8" }
      : style === "nature"
      ? { glow: "#4ade80", core: "#22c55e" }
      : { glow: "#facc15", core: "#eab308" };

  const labelTex = useMemo(() => makeLabelTexture(label, palette.glow), [label, palette.glow]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.45;
    }
    if (pulseRef.current) {
      const mat = pulseRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (hovered ? 0.45 : 0.22) + Math.sin(t * 3.0) * 0.1;
    }
  });

  const floorY = -5.8;

  return (
    <group
      position={position}
      rotation={[0, angleY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onNavigate?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        if (typeof document !== "undefined") document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        if (typeof document !== "undefined") document.body.style.cursor = "auto";
      }}
    >
      {/* 1. Ground Portal Ring (Matterport / Street View style navigation circle) */}
      <mesh
        ref={ringRef}
        position={[0, floorY + 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={hovered ? [1.2, 1.2, 1.2] : [1.0, 1.0, 1.0]}
      >
        <ringGeometry args={[2.8, 3.4, 48]} />
        <meshBasicMaterial
          color={hovered ? "#ffffff" : palette.glow}
          side={THREE.DoubleSide}
          transparent
          opacity={hovered ? 0.95 : 0.7}
          depthWrite={false}
        />
      </mesh>

      {/* 2. Inner Glowing Core Disc */}
      <mesh
        ref={pulseRef}
        position={[0, floorY + 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={hovered ? [1.15, 1.15, 1.15] : [1.0, 1.0, 1.0]}
      >
        <circleGeometry args={[2.6, 36]} />
        <meshBasicMaterial
          color={palette.core}
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>

      {/* 3. Directional Forward Chevron Arrow */}
      <mesh position={[0, floorY + 0.08, -1.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.9, 1.8, 3]} />
        <meshBasicMaterial
          color={hovered ? "#ffffff" : palette.glow}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* 4. Elegant Floating Frosted-Glass Plaque at eye level */}
      {labelTex && (
        <sprite
          position={[0, floorY + 3.8, 0]}
          scale={hovered ? [10.5, 1.8, 1] : [9.2, 1.6, 1]}
        >
          <spriteMaterial map={labelTex} transparent depthWrite={false} />
        </sprite>
      )}
    </group>
  );
}
