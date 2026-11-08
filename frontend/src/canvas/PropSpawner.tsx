// photorealistic pbr architectural monument and prop spawner with procedural stone/marble veining and bump maps
"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PropItem, useWorldStore } from "../store/useWorldStore";

interface SinglePropProps {
  prop: PropItem;
  index: number;
  biome: string;
  onSelect?: (prop: PropItem) => void;
}

function SingleProp({ prop, index, biome, onSelect }: SinglePropProps) {
  const [hovered, setHovered] = useState(false);
  const ringOuterRef = useRef<THREE.Mesh>(null);
  const ringInnerRef = useRef<THREE.Mesh>(null);

  // position monument on eye-level floor plane (y = -6.0) to the side of the central view
  const position = useMemo(() => {
    const rawTheta = prop.position?.theta;
    const angle =
      typeof rawTheta === "number" && Math.abs(rawTheta) <= 1.4
        ? rawTheta
        : 0.48 + index * 0.35;
    const distance = 25.0;
    const x = distance * Math.sin(angle);
    const z = -distance * Math.cos(angle);
    return new THREE.Vector3(x, -6.0, z);
  }, [prop.position, index]);

  const rotation = useMemo(() => {
    const rot = new THREE.Euler();
    rot.y = Math.atan2(-position.x, -position.z);
    return rot;
  }, [position]);

  const scale = (prop.scale || 1.0) * 0.32 * (hovered ? 1.06 : 1.0);
  const b = biome.toLowerCase();

  const isOcean =
    b.includes("ocean") ||
    b.includes("sea") ||
    b.includes("benthic") ||
    b.includes("trench") ||
    b.includes("abyss") ||
    b.includes("hydrothermal") ||
    b.includes("coral") ||
    b.includes("underwater") ||
    b.includes("brine");
  const isLunar =
    !isOcean &&
    (b.includes("moon") ||
      b.includes("lunar") ||
      b.includes("mare") ||
      b.includes("tranquillitatis") ||
      b.includes("procellarum") ||
      b.includes("copernicus") ||
      b.includes("tycho") ||
      b.includes("apollo") ||
      b.includes("regolith") ||
      b.includes("crater"));
  const isAlpineNature =
    !isOcean &&
    !isLunar &&
    (b.includes("everest") ||
      b.includes("himalaya") ||
      b.includes("glacier") ||
      b.includes("icefall") ||
      b.includes("snow") ||
      b.includes("alpine") ||
      b.includes("summit") ||
      b.includes("peak") ||
      b.includes("mountain") ||
      b.includes("arctic"));
  const isWildNature =
    isAlpineNature ||
    isLunar ||
    isOcean ||
    b.includes("canyon") ||
    b.includes("gorge") ||
    b.includes("volcano") ||
    b.includes("wilderness") ||
    b.includes("trail") ||
    b.includes("basin");
  const isSpace = !isWildNature && (b.includes("space") || b.includes("orbital") || b.includes("observatory") || b.includes("station"));
  const isForest = !isWildNature && (b.includes("forest") || b.includes("garden") || b.includes("babylon"));
  const isClassical = !isWildNature && (b.includes("tavern") || b.includes("medieval") || b.includes("rome") || b.includes("roman") || b.includes("athens"));

  // procedural PBR marble/limestone veining and fluted stone bump texture
  const { stoneMap, stoneBump } = useMemo(() => {
    if (typeof document === "undefined") return { stoneMap: null, stoneBump: null };
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    const bumpCanvas = document.createElement("canvas");
    bumpCanvas.width = 512;
    bumpCanvas.height = 512;
    const bCtx = bumpCanvas.getContext("2d");
    if (!ctx || !bCtx) return { stoneMap: null, stoneBump: null };

    const baseCol = isSpace
      ? "#475569"
      : isForest
        ? "#1e3a5f"
        : isClassical
          ? "#ede9e0"
          : "#dfc28f";
    ctx.fillStyle = baseCol;
    ctx.fillRect(0, 0, 512, 512);

    bCtx.fillStyle = "#808080";
    bCtx.fillRect(0, 0, 512, 512);

    // vertical fluted column channels & masonry courses
    for (let x = 0; x < 512; x += 32) {
      const g = bCtx.createLinearGradient(x, 0, x + 32, 0);
      g.addColorStop(0, "#505050");
      g.addColorStop(0.5, "#b8b8b8");
      g.addColorStop(1, "#505050");
      bCtx.fillStyle = g;
      bCtx.fillRect(x, 0, 32, 512);

      const cg = ctx.createLinearGradient(x, 0, x + 32, 0);
      cg.addColorStop(0, "rgba(0,0,0,0.12)");
      cg.addColorStop(0.5, "rgba(255,255,255,0.08)");
      cg.addColorStop(1, "rgba(0,0,0,0.12)");
      ctx.fillStyle = cg;
      ctx.fillRect(x, 0, 32, 512);
    }

    // horizontal ashlar masonry seams
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 2;
    for (let y = 0; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    const albedo = new THREE.CanvasTexture(canvas);
    albedo.colorSpace = THREE.SRGBColorSpace;
    const bump = new THREE.CanvasTexture(bumpCanvas);
    return { stoneMap: albedo, stoneBump: bump };
  }, [isSpace, isForest, isClassical]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringOuterRef.current) {
      ringOuterRef.current.rotation.y = t * 0.35;
      ringOuterRef.current.rotation.x = 0.4 + Math.sin(t * 0.5) * 0.15;
    }
    if (ringInnerRef.current) {
      ringInnerRef.current.rotation.z = -t * 0.5;
      ringInnerRef.current.rotation.y = -t * 0.25;
    }
  });

  return (
    <group
      position={position}
      rotation={rotation}
      scale={[scale, scale, scale]}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) onSelect(prop);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* base foundation: natural boulder/ice shelf in wilderness, or architectural plinth in cities/monuments */}
      {isWildNature ? (
        <mesh position={[0, 2.2, 0]} rotation={[0.15, 0.4, -0.1]}>
          <dodecahedronGeometry args={[6.8, 1]} />
          <meshStandardMaterial
            color={isAlpineNature ? "#cbd5e1" : "#57534e"}
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>
      ) : (
        <>
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[14, 2.4, 14]} />
            <meshStandardMaterial
              map={stoneMap}
              bumpMap={stoneBump}
              bumpScale={0.18}
              roughness={0.45}
              metalness={0.15}
            />
          </mesh>
          <mesh position={[0, 3.2, 0]}>
            <boxGeometry args={[11.2, 1.8, 11.2]} />
            <meshStandardMaterial
              color="#c59b27"
              metalness={0.85}
              roughness={0.22}
            />
          </mesh>
          <mesh position={[0, 4.6, 0]}>
            <cylinderGeometry args={[4.4, 5.2, 1.6, 32]} />
            <meshStandardMaterial
              map={stoneMap}
              bumpMap={stoneBump}
              bumpScale={0.15}
              roughness={0.4}
            />
          </mesh>
        </>
      )}

      {isOcean ? (
        <>
          {/* abyssal hydrothermal black smoker mineral spire & bioluminescent deep-sea coral formation */}
          <mesh position={[0, 11.0, 0]} rotation={[0.05, 0.4, -0.05]}>
            <cylinderGeometry args={[1.8, 4.5, 20.0, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.92} metalness={0.1} />
          </mesh>
          <mesh position={[0, 21.0, 0]}>
            <sphereGeometry args={[2.5, 16, 16]} />
            <meshPhysicalMaterial
              color="#06b6d4"
              emissive="#0891b2"
              emissiveIntensity={hovered ? 1.2 : 0.65}
              roughness={0.15}
              clearcoat={1.0}
            />
          </mesh>
          <mesh position={[3.2, 7.5, 1.8]} rotation={[-0.2, 0.5, 0.3]}>
            <coneGeometry args={[2.0, 12.0, 8]} />
            <meshPhysicalMaterial
              color="#a855f7"
              emissive="#7c3aed"
              emissiveIntensity={0.5}
              roughness={0.2}
              transmission={0.4}
            />
          </mesh>
          <mesh position={[-2.8, 5.0, 2.0]} rotation={[0.3, -0.4, -0.2]}>
            <torusGeometry args={[2.4, 0.5, 12, 24]} />
            <meshPhysicalMaterial color="#ec4899" emissive="#db2777" emissiveIntensity={0.4} roughness={0.25} />
          </mesh>
        </>
      ) : isLunar ? (
        <>
          {/* Apollo scientific laser reflector & lunar regolith survey telemetry sensor */}
          <mesh position={[0, 5.0, 0]}>
            <cylinderGeometry args={[1.5, 2.8, 8.0, 12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, 10.5, 0]} rotation={[0.35, 0, 0]}>
            <boxGeometry args={[7.5, 1.0, 5.5]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.95} roughness={0.08} />
          </mesh>
          <mesh position={[0, 13.5, 0]}>
            <cylinderGeometry args={[0.15, 0.25, 6.0, 8]} />
            <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, 16.8, 0]}>
            <sphereGeometry args={[0.65, 16, 16]} />
            <meshPhysicalMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={hovered ? 1.0 : 0.5}
              roughness={0.1}
            />
          </mesh>
        </>
      ) : isAlpineNature ? (
        <>
          {/* natural Himalayan glacial ice serac spire and granite rock cairn */}
          <mesh position={[0, 13.5, 0]} rotation={[0.08, 0.5, -0.05]}>
            <coneGeometry args={[4.8, 22.0, 6]} />
            <meshPhysicalMaterial
              color="#bae6fd"
              emissive="#0284c7"
              emissiveIntensity={hovered ? 0.35 : 0.12}
              roughness={0.18}
              metalness={0.05}
              transmission={0.35}
              clearcoat={0.9}
            />
          </mesh>
          <mesh position={[3.8, 8.2, 2.2]} rotation={[-0.12, 0.2, 0.18]}>
            <coneGeometry args={[3.2, 13.0, 5]} />
            <meshPhysicalMaterial
              color="#e0f2fe"
              roughness={0.22}
              clearcoat={0.8}
            />
          </mesh>
        </>
      ) : isWildNature ? (
        <>
          {/* natural geological rock monolith */}
          <mesh position={[0, 12.5, 0]} rotation={[0.1, 0.3, -0.06]}>
            <dodecahedronGeometry args={[5.5, 1]} />
            <meshStandardMaterial color="#78716c" roughness={0.88} metalness={0.06} />
          </mesh>
          <mesh position={[0, 19.5, 0]} rotation={[-0.15, 0.8, 0.1]}>
            <dodecahedronGeometry args={[3.4, 1]} />
            <meshStandardMaterial color="#a8a29e" roughness={0.82} metalness={0.06} />
          </mesh>
        </>
      ) : isSpace ? (
        <>
          {/* precision brass & brushed-steel celestial armillary sphere */}
          <mesh position={[0, 12.0, 0]}>
            <cylinderGeometry args={[2.2, 3.2, 13.5, 32]} />
            <meshStandardMaterial
              map={stoneMap}
              bumpMap={stoneBump}
              metalness={0.78}
              roughness={0.22}
            />
          </mesh>
          <mesh ref={ringOuterRef} position={[0, 23.5, 0]} rotation={[0.4, 0.4, 0]}>
            <torusGeometry args={[5.8, 0.45, 24, 64]} />
            <meshStandardMaterial color="#d4af37" metalness={0.92} roughness={0.16} />
          </mesh>
          <mesh ref={ringInnerRef} position={[0, 23.5, 0]} rotation={[-0.3, 0.8, 0]}>
            <torusGeometry args={[4.4, 0.35, 20, 48]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.88} roughness={0.18} />
          </mesh>
          <mesh position={[0, 23.5, 0]}>
            <sphereGeometry args={[2.4, 32, 32]} />
            <meshPhysicalMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={hovered ? 0.9 : 0.45}
              roughness={0.1}
              metalness={0.1}
              clearcoat={1.0}
            />
          </mesh>
        </>
      ) : isForest ? (
        <>
          {/* glazed lapis lazuli & gilded Babylonian lotus column */}
          <mesh position={[0, 13.5, 0]}>
            <cylinderGeometry args={[2.9, 3.5, 16.5, 32]} />
            <meshStandardMaterial
              map={stoneMap}
              bumpMap={stoneBump}
              bumpScale={0.22}
              roughness={0.32}
              metalness={0.35}
            />
          </mesh>
          <mesh position={[0, 22.8, 0]}>
            <cylinderGeometry args={[6.2, 2.8, 3.2, 32]} />
            <meshStandardMaterial color="#c59b27" metalness={0.88} roughness={0.2} />
          </mesh>
          <mesh position={[0, 25.4, 0]}>
            <sphereGeometry args={[3.2, 32, 32]} />
            <meshPhysicalMaterial
              color="#34d399"
              emissive="#059669"
              emissiveIntensity={hovered ? 0.7 : 0.3}
              roughness={0.15}
              clearcoat={0.9}
            />
          </mesh>
        </>
      ) : isClassical ? (
        <>
          {/* fluted Pentelic marble Corinthian column & gilded tripod brazier */}
          <mesh position={[0, 14.5, 0]}>
            <cylinderGeometry args={[2.8, 3.3, 18.5, 32]} />
            <meshStandardMaterial
              map={stoneMap}
              bumpMap={stoneBump}
              bumpScale={0.28}
              roughness={0.38}
              metalness={0.08}
            />
          </mesh>
          {/* Corinthian capital */}
          <mesh position={[0, 24.4, 0]}>
            <cylinderGeometry args={[4.6, 2.9, 2.4, 24]} />
            <meshStandardMaterial color="#c59b27" metalness={0.82} roughness={0.24} />
          </mesh>
          <mesh position={[0, 26.0, 0]}>
            <boxGeometry args={[8.4, 1.4, 8.4]} />
            <meshStandardMaterial map={stoneMap} roughness={0.35} />
          </mesh>
          <mesh position={[0, 28.0, 0]}>
            <sphereGeometry args={[2.6, 24, 24]} />
            <meshStandardMaterial
              color="#fbbf24"
              emissive="#d97706"
              emissiveIntensity={hovered ? 0.85 : 0.45}
              roughness={0.2}
            />
          </mesh>
        </>
      ) : (
        <>
          {/* tapered Aswan granite & Tura limestone obelisk with electrum pyramidion */}
          <mesh position={[0, 14.5, 0]} rotation={[0, Math.PI / 4, 0]}>
            <cylinderGeometry args={[2.2, 3.8, 19.0, 4]} />
            <meshStandardMaterial
              map={stoneMap}
              bumpMap={stoneBump}
              bumpScale={0.24}
              roughness={0.42}
              metalness={0.18}
            />
          </mesh>
          {/* gilded electrum pyramidion capstone */}
          <mesh position={[0, 26.2, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[2.2, 4.4, 4]} />
            <meshStandardMaterial
              color="#eab308"
              emissive={hovered ? "#facc15" : "#a16207"}
              emissiveIntensity={hovered ? 0.55 : 0.2}
              metalness={0.94}
              roughness={0.14}
            />
          </mesh>
        </>
      )}

      {/* contact ground shadow */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[9.0, 32]} />
        <meshBasicMaterial color="#000000" transparent={true} opacity={0.38} />
      </mesh>
    </group>
  );
}

interface PropSpawnerProps {
  propsList: PropItem[];
  roomContext?: string;
  onPropClick?: (prop: PropItem) => void;
}

export function PropSpawner({ propsList, roomContext, onPropClick }: PropSpawnerProps) {
  const currentRoomId = useWorldStore((state) => state.currentRoomId);
  const rooms = useWorldStore((state) => state.rooms);
  const worldTitle = useWorldStore((state) => state.worldTitle);
  const activeRoom = rooms[currentRoomId];
  const biome = roomContext || `${activeRoom?.biome_type || ""} ${activeRoom?.name || ""} ${worldTitle || ""}`;

  if (!propsList || propsList.length === 0) {
    return null;
  }

  return (
    <group name="prop-spawner-layer">
      {propsList.map((item, idx) => (
        <SingleProp
          key={item.prop_id}
          prop={item}
          index={idx}
          biome={biome}
          onSelect={onPropClick}
        />
      ))}
    </group>
  );
}
