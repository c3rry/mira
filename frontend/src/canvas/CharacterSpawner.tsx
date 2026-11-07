// character spawner for mixamo and procedural humanoid npc entities
"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sphericalToCartesian } from "./controls/CameraController";
import { NPCAgent, useWorldStore } from "../store/useWorldStore";

interface SingleNPCProps {
  npc: NPCAgent;
  onSelect?: (npcId: string) => void;
}

function SingleNPC({ npc, onSelect }: SingleNPCProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // resolve 3d position from spherical coordinates or default floor anchor
  const position = useMemo(() => {
    const r = npc.position?.r || 500.0;
    const theta = npc.position?.theta ?? 0.0;
    const phi = npc.position?.phi ?? (0.75 * Math.PI);
    // position at comfortable visual distance inside inward skybox
    const targetR = Math.max(120, r * 0.65);
    return sphericalToCartesian(targetR, theta, phi);
  }, [npc.position]);

  // orient character towards origin center
  const rotation = useMemo(() => {
    const theta = npc.position?.theta ?? 0.0;
    const rot = new THREE.Euler();
    rot.y = -theta;
    return rot;
  }, [npc.position]);

  // procedural idle breathing and subtle hover float animation
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const elapsed = clock.getElapsedTime();
      groupRef.current.position.y = position.y + Math.sin(elapsed * 2.0) * 1.5;
    }
  });

  const selectedNpcId = useWorldStore((state) => state.selectedNpcId);
  const isSelected = selectedNpcId === npc.npc_id;

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) {
          onSelect(npc.npc_id);
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* humanoid head with cyber visor */}
      <mesh position={[0, 28, 0]}>
        <sphereGeometry args={[4.5, 16, 16]} />
        <meshStandardMaterial
          color={isSelected ? "#ec4899" : hovered ? "#f43f5e" : "#e2e8f0"}
          roughness={0.4}
        />
      </mesh>

      {/* glowing visor */}
      <mesh position={[0, 28.5, 3.8]}>
        <boxGeometry args={[5.5, 1.6, 1.2]} />
        <meshBasicMaterial color={isSelected ? "#f43f5e" : "#06b6d4"} />
      </mesh>

      {/* torso / jacket */}
      <mesh position={[0, 16, 0]}>
        <cylinderGeometry args={[5, 4, 16, 12]} />
        <meshStandardMaterial
          color={isSelected ? "#be185d" : hovered ? "#475569" : "#1e293b"}
          metalness={0.5}
          roughness={0.5}
        />
      </mesh>

      {/* shoulders */}
      <mesh position={[0, 22, 0]}>
        <boxGeometry args={[14, 3, 5]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* ground aura beacon */}
      <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[8, 14, 32]} />
        <meshBasicMaterial
          color={isSelected ? "#ec4899" : hovered ? "#06b6d4" : "#64748b"}
          side={THREE.DoubleSide}
          transparent={true}
          opacity={isSelected ? 0.8 : hovered ? 0.6 : 0.25}
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

  const handleSelect = (npcId: string) => {
    selectNPC(npcId);
    if (onNPCSelect) onNPCSelect(npcId);
  };

  if (!npcs || npcs.length === 0) {
    return null;
  }

  return (
    <group name="character-spawner-layer">
      {npcs.map((npc) => (
        <SingleNPC key={npc.npc_id} npc={npc} onSelect={handleSelect} />
      ))}
    </group>
  );
}
