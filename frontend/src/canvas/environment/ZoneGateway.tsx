// glowing transition gateways placed at the boundary between connected sub-rooms
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ZoneGatewayProps {
  position: [number, number, number];
  angleY: number;
  label: string;
  style: "snow" | "nature" | "architecture";
}

function makeLabelTexture(text: string, color: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "rgba(8, 10, 14, 0.78)";
  ctx.fillRect(0, 0, 768, 128);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 760, 120);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 44px 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const clipped = text.length > 30 ? text.slice(0, 28) + ".." : text;
  ctx.fillText(`→ ${clipped.toUpperCase()}`, 384, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function ZoneGateway({ position, angleY, label, style }: ZoneGatewayProps) {
  const veilRef = useRef<THREE.Mesh>(null);

  const palette =
    style === "snow"
      ? { post: "#94a3b8", glow: "#7dd3fc" }
      : style === "nature"
      ? { post: "#57534e", glow: "#86efac" }
      : { post: "#c8b48a", glow: "#facc15" };

  const labelTex = useMemo(() => makeLabelTexture(label, palette.glow), [label, palette.glow]);

  useFrame(({ clock }) => {
    if (veilRef.current) {
      const mat = veilRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.18 + Math.sin(clock.getElapsedTime() * 2.2) * 0.07;
    }
  });

  const floorY = -6.0;
  const width = 26;
  const height = 22;

  return (
    <group position={position} rotation={[0, angleY, 0]}>
      {style === "architecture" ? (
        <>
          {/* stone portal posts and lintel */}
          <mesh position={[-width / 2, floorY + height / 2, 0]}>
            <boxGeometry args={[2.6, height, 2.6]} />
            <meshStandardMaterial color={palette.post} roughness={0.55} />
          </mesh>
          <mesh position={[width / 2, floorY + height / 2, 0]}>
            <boxGeometry args={[2.6, height, 2.6]} />
            <meshStandardMaterial color={palette.post} roughness={0.55} />
          </mesh>
          <mesh position={[0, floorY + height + 1.2, 0]}>
            <boxGeometry args={[width + 5, 2.4, 3.2]} />
            <meshStandardMaterial color={palette.post} roughness={0.5} />
          </mesh>
        </>
      ) : (
        <>
          {/* natural stone cairns / ice pillars marking the trail crossing */}
          {[-width / 2, width / 2].map((x) => (
            <group key={x} position={[x, floorY, 0]}>
              <mesh position={[0, 1.8, 0]}>
                <dodecahedronGeometry args={[2.6, 0]} />
                <meshStandardMaterial color={palette.post} roughness={0.9} />
              </mesh>
              <mesh position={[0, 5.2, 0]} rotation={[0.3, 0.6, 0]}>
                <dodecahedronGeometry args={[1.9, 0]} />
                <meshStandardMaterial color={palette.post} roughness={0.9} />
              </mesh>
              <mesh position={[0, 7.8, 0]} rotation={[0.1, 1.2, 0.2]}>
                <dodecahedronGeometry args={[1.3, 0]} />
                <meshStandardMaterial color={palette.post} roughness={0.9} />
              </mesh>
              {/* trail marker flag */}
              <mesh position={[0, 11.5, 0]}>
                <cylinderGeometry args={[0.15, 0.15, 6, 6]} />
                <meshStandardMaterial color="#e5e7eb" />
              </mesh>
              <mesh position={[1.4, 13.4, 0]}>
                <planeGeometry args={[2.8, 1.6]} />
                <meshBasicMaterial color={palette.glow} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {/* shimmering transition veil */}
      <mesh ref={veilRef} position={[0, floorY + height / 2, 0]}>
        <planeGeometry args={[width - 2.6, height]} />
        <meshBasicMaterial
          color={palette.glow}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* threshold line on the ground */}
      <mesh position={[0, floorY + 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, 1.2]} />
        <meshBasicMaterial color={palette.glow} transparent opacity={0.8} />
      </mesh>

      {/* destination label */}
      {labelTex && (
        <sprite position={[0, floorY + height + 6.5, 0]} scale={[18, 3, 1]}>
          <spriteMaterial map={labelTex} transparent depthWrite={false} />
        </sprite>
      )}
    </group>
  );
}
