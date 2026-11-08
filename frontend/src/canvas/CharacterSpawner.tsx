// character spawner for autonomous patrolling humanoid npc entities with classical serif nameplates
"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NPCAgent, useWorldStore } from "../store/useWorldStore";

interface SingleNPCProps {
  npc: NPCAgent;
  index: number;
  total: number;
  biome: string;
  onSelect?: (npcId: string) => void;
}

function SingleNPC({ npc, index, total, biome, onSelect }: SingleNPCProps) {
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftFootRef = useRef<THREE.Mesh>(null);
  const rightFootRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const selectedNpcId = useWorldStore((state) => state.selectedNpcId);
  const isSelected = selectedNpcId === npc.npc_id;

  // ground character directly on the floor plane (y = -19.5 so boots rest at y = -26)
  // and position in front of the camera (-z direction) as home patrol center
  const basePosition = useMemo(() => {
    const spread = total > 1 ? (index - (total - 1) / 2) * 0.55 : -0.22;
    const rawTheta = npc.position?.theta;
    const angle =
      typeof rawTheta === "number" && Math.abs(rawTheta) <= 1.2 ? rawTheta : spread;
    const distance = 60.0;
    const x = distance * Math.sin(angle);
    const z = -distance * Math.cos(angle);
    return new THREE.Vector3(x, -19.5, z);
  }, [npc.position, index, total]);

  const walkPhaseRef = useRef<number>(index * 2.1);

  const palette = useMemo(() => {
    const b = biome.toLowerCase();
    if (b.includes("desert") || b.includes("giza") || b.includes("pyramid") || b.includes("ruin")) {
      return {
        garment: "#f5ebd6",
        trim: "#d4af37",
        mantle: "#b45309",
        skin: "#c68642",
        headpiece: "#d4af37",
      };
    }
    if (b.includes("tavern") || b.includes("medieval") || b.includes("roman") || b.includes("rome") || b.includes("athens")) {
      return {
        garment: "#7c2d12",
        trim: "#d97706",
        mantle: "#451a03",
        skin: "#e0ac69",
        headpiece: "#92400e",
      };
    }
    if (b.includes("forest") || b.includes("cavern") || b.includes("garden") || b.includes("babylon")) {
      return {
        garment: "#14532d",
        trim: "#a3e635",
        mantle: "#166534",
        skin: "#d2996c",
        headpiece: "#ca8a04",
      };
    }
    if (b.includes("space") || b.includes("station") || b.includes("spire") || b.includes("orbital")) {
      return {
        garment: "#e2e8f0",
        trim: "#60a5fa",
        mantle: "#334155",
        skin: "#cbd5e1",
        headpiece: "#94a3b8",
      };
    }
    return {
      garment: "#1e293b",
      trim: "#eab308",
      mantle: "#0f172a",
      skin: "#d2996c",
      headpiece: "#334155",
    };
  }, [biome]);

  // procedural woven garment and ornamental trim texture
  const garmentTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = palette.garment;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.lineWidth = 2;
    for (let y = 0; y < 512; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    ctx.fillStyle = palette.trim;
    ctx.fillRect(224, 0, 64, 512);
    ctx.fillRect(0, 0, 512, 42);
    ctx.fillRect(0, 460, 512, 52);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [palette]);

  // classical times new roman floating nameplate
  const nametagTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 140;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "rgba(18, 14, 10, 0.92)";
    ctx.fillRect(10, 10, 620, 120);

    ctx.strokeStyle = isSelected || hovered ? "#facc15" : palette.trim;
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 620, 120);
    ctx.lineWidth = 1;
    ctx.strokeRect(18, 18, 604, 104);

    ctx.fillStyle = "#fdf6e2";
    ctx.font = "bold 32px 'Times New Roman', Times, serif";
    ctx.textAlign = "center";
    ctx.fillText(npc.name.toUpperCase(), 320, 62);

    ctx.fillStyle = palette.trim;
    ctx.font = "italic 22px 'Times New Roman', Times, serif";
    ctx.fillText("Click to Converse", 320, 102);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [npc.name, isSelected, hovered, palette.trim]);

  useFrame(({ clock, camera }, delta) => {
    const elapsed = clock.getElapsedTime();
    if (!groupRef.current) return;

    // only pause patrolling when the user is hovering directly over the NPC
    const isPaused = hovered;
    if (!isPaused) {
      walkPhaseRef.current += delta * 0.72;
    }

    const t = walkPhaseRef.current;
    // wide figure-8 patrol loop across the chamber floor
    const patrolRadiusX = 32.0;
    const patrolRadiusZ = 18.0;
    const offsetX = Math.sin(t) * patrolRadiusX;
    const offsetZ = Math.sin(t * 2.0) * patrolRadiusZ;

    const targetX = basePosition.x + offsetX;
    const targetZ = basePosition.z + offsetZ;

    // stride bobbing while walking
    const strideCycle = t * 8.0;
    const bobY = isPaused
      ? Math.sin(elapsed * 2.0) * 0.25
      : Math.abs(Math.sin(strideCycle)) * 1.1;

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.12);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.12);
    groupRef.current.position.y = basePosition.y + bobY;

    // orient toward movement tangent when patrolling, or toward player when hovered
    let desiredYaw: number;
    if (isPaused) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      desiredYaw = Math.atan2(
        camera.position.x - worldPos.x,
        camera.position.z - worldPos.z
      );
    } else {
      const vx = Math.cos(t) * patrolRadiusX;
      const vz = Math.cos(t * 2.0) * 2.0 * patrolRadiusZ;
      desiredYaw = Math.atan2(vx, vz);
    }

    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      desiredYaw,
      0.1
    );

    // animate limbs during walking cycle
    const limbSwing = isPaused ? 0 : Math.sin(strideCycle) * 0.38;
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = limbSwing;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = -0.25 - limbSwing * 0.65;
    }
    if (leftFootRef.current) {
      leftFootRef.current.position.z = 1.0 + Math.sin(strideCycle) * (isPaused ? 0 : 2.6);
      leftFootRef.current.position.y = -4.8 + Math.max(0, Math.cos(strideCycle)) * (isPaused ? 0 : 1.15);
    }
    if (rightFootRef.current) {
      rightFootRef.current.position.z = 1.0 - Math.sin(strideCycle) * (isPaused ? 0 : 2.6);
      rightFootRef.current.position.y = -4.8 + Math.max(0, -Math.cos(strideCycle)) * (isPaused ? 0 : 1.15);
    }

    if (auraRef.current) {
      auraRef.current.rotation.z = elapsed * 0.45;
    }
  });

  return (
    <group
      ref={groupRef}
      position={basePosition}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) {
          onSelect(npc.npc_id);
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        if (typeof document !== "undefined") {
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        if (typeof document !== "undefined") {
          document.body.style.cursor = "default";
        }
      }}
    >
      {/* overhead times new roman nameplate */}
      {nametagTexture && (
        <sprite position={[0, 41, 0]} scale={[24, 5.2, 1]}>
          <spriteMaterial map={nametagTexture} depthTest={false} />
        </sprite>
      )}

      {/* character head */}
      <mesh position={[0, 29, 0]}>
        <sphereGeometry args={[4.4, 24, 24]} />
        <meshStandardMaterial color={palette.skin} roughness={0.55} />
      </mesh>

      {/* eyes */}
      <mesh position={[-1.5, 29.5, 3.9]}>
        <sphereGeometry args={[0.55, 12, 12]} />
        <meshBasicMaterial color="#1c1917" />
      </mesh>
      <mesh position={[1.5, 29.5, 3.9]}>
        <sphereGeometry args={[0.55, 12, 12]} />
        <meshBasicMaterial color="#1c1917" />
      </mesh>

      {/* ceremonial crown / headdress / diadem */}
      <mesh position={[0, 31.8, -0.3]}>
        <cylinderGeometry args={[4.8, 4.5, 3.2, 20]} />
        <meshStandardMaterial color={palette.headpiece} metalness={0.65} roughness={0.3} />
      </mesh>

      {/* broad ceremonial collar / mantle */}
      <mesh position={[0, 24.2, 0]}>
        <cylinderGeometry args={[7.2, 8.4, 2.5, 24]} />
        <meshStandardMaterial color={palette.trim} metalness={0.7} roughness={0.25} />
      </mesh>

      {/* upper torso tunic */}
      <mesh position={[0, 16.5, 0]}>
        <cylinderGeometry args={[5.4, 6.2, 15, 20]} />
        <meshStandardMaterial
          map={garmentTexture}
          roughness={0.5}
          metalness={0.15}
        />
      </mesh>

      {/* lower robe / skirt */}
      <mesh position={[0, 3.5, 0]}>
        <cylinderGeometry args={[6.0, 7.6, 13, 20]} />
        <meshStandardMaterial map={garmentTexture} roughness={0.55} />
      </mesh>

      {/* waist sash */}
      <mesh position={[0, 9.8, 0]}>
        <cylinderGeometry args={[5.9, 5.9, 2.4, 20]} />
        <meshStandardMaterial color={palette.trim} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* left arm */}
      <group ref={leftArmRef} position={[-7.2, 21.5, 0]} rotation={[0, 0, 0.15]}>
        <mesh position={[0, -5.5, 0]}>
          <cylinderGeometry args={[1.8, 1.5, 11, 14]} />
          <meshStandardMaterial map={garmentTexture} />
        </mesh>
        <mesh position={[0, -11.5, 0]}>
          <sphereGeometry args={[1.6, 12, 12]} />
          <meshStandardMaterial color={palette.skin} />
        </mesh>
      </group>

      {/* right arm holding ceremonial staff */}
      <group ref={rightArmRef} position={[7.2, 21.5, 0]} rotation={[-0.25, 0, -0.15]}>
        <mesh position={[0, -5.5, 0]}>
          <cylinderGeometry args={[1.8, 1.5, 11, 14]} />
          <meshStandardMaterial map={garmentTexture} />
        </mesh>
        <mesh position={[0, -11.5, 0]}>
          <sphereGeometry args={[1.6, 12, 12]} />
          <meshStandardMaterial color={palette.skin} />
        </mesh>
        {/* ceremonial bronze staff */}
        <mesh position={[0, -2.0, 2.5]} rotation={[0.25, 0, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 36, 10]} />
          <meshStandardMaterial color={palette.trim} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 16.0, 7.0]}>
          <octahedronGeometry args={[1.8]} />
          <meshStandardMaterial color="#fef08a" emissive={palette.trim} emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* animated boots resting on floor */}
      <mesh ref={leftFootRef} position={[-2.6, -4.8, 1.0]}>
        <boxGeometry args={[2.8, 3.2, 5.4]} />
        <meshStandardMaterial color={palette.mantle} roughness={0.6} />
      </mesh>
      <mesh ref={rightFootRef} position={[2.6, -4.8, 1.0]}>
        <boxGeometry args={[2.8, 3.2, 5.4]} />
        <meshStandardMaterial color={palette.mantle} roughness={0.6} />
      </mesh>

      {/* contact ground shadow */}
      <mesh position={[0, -6.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[9.5, 24]} />
        <meshBasicMaterial color="#000000" transparent={true} opacity={0.45} />
      </mesh>

      {/* classical selection ring on floor */}
      <mesh ref={auraRef} position={[0, -6.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[10.5, 12.2, 36]} />
        <meshBasicMaterial
          color={isSelected || hovered ? "#facc15" : palette.trim}
          side={THREE.DoubleSide}
          transparent={true}
          opacity={isSelected ? 0.95 : hovered ? 0.8 : 0.45}
        />
      </mesh>
    </group>
  );
}

interface CharacterSpawnerProps {
  npcs: NPCAgent[];
  onNPCSelect?: (npcId: string) => void;
}

export function CharacterSpawner({ npcs, onNPCSelect }: CharacterSpawnerProps) {
  const selectNPC = useWorldStore((state) => state.selectNPC);
  const currentRoomId = useWorldStore((state) => state.currentRoomId);
  const rooms = useWorldStore((state) => state.rooms);
  const worldTitle = useWorldStore((state) => state.worldTitle);
  const activeBiome = `${rooms[currentRoomId]?.biome_type || ""} ${rooms[currentRoomId]?.name || ""} ${worldTitle || ""}`;

  const handleSelect = (npcId: string) => {
    selectNPC(npcId);
    if (onNPCSelect) onNPCSelect(npcId);
  };

  if (!npcs || npcs.length === 0) {
    return null;
  }

  return (
    <group name="character-spawner-layer">
      {npcs.map((npc, idx) => (
        <SingleNPC
          key={npc.npc_id}
          npc={npc}
          index={idx}
          total={npcs.length}
          biome={activeBiome}
          onSelect={handleSelect}
        />
      ))}
    </group>
  );
}
