// grounded architectural monument and interactive prop spawner adapted to room biome
"use client";

import { useMemo, useState } from "react";
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

  // position monument on floor plane (y = -26) to the side of the central view
  const position = useMemo(() => {
    const rawTheta = prop.position?.theta;
    const angle =
      typeof rawTheta === "number" && Math.abs(rawTheta) <= 1.4
        ? rawTheta
        : 0.45 + index * 0.35;
    const distance = 68.0;
    const x = distance * Math.sin(angle);
    const z = -distance * Math.cos(angle);
    return new THREE.Vector3(x, -26.0, z);
  }, [prop.position, index]);

  const rotation = useMemo(() => {
    const rot = new THREE.Euler();
    rot.y = Math.atan2(-position.x, -position.z);
    return rot;
  }, [position]);

  const scale = (prop.scale || 1.0) * (hovered ? 1.08 : 1.0);
  const b = biome.toLowerCase();

  const isSpace = b.includes("space") || b.includes("orbital") || b.includes("observatory") || b.includes("station");
  const isForest = b.includes("forest") || b.includes("garden") || b.includes("babylon");
  const isClassical = b.includes("tavern") || b.includes("medieval") || b.includes("rome") || b.includes("roman") || b.includes("athens");

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
      {/* stepped stone / brass pedestal base */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[12, 4, 12]} />
        <meshStandardMaterial
          color={isSpace ? "#334155" : isForest ? "#14532d" : isClassical ? "#d6d3d1" : "#b48a4e"}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>

      {isSpace ? (
        <>
          {/* celestial brass armillary sphere & astrolabe pillar */}
          <mesh position={[0, 11, 0]}>
            <cylinderGeometry args={[2.2, 3.0, 14, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.25} />
          </mesh>
          <mesh position={[0, 23, 0]} rotation={[0.4, 0.4, 0]}>
            <torusGeometry args={[5.5, 0.55, 16, 36]} />
            <meshStandardMaterial color="#eab308" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, 23, 0]}>
            <sphereGeometry args={[2.6, 20, 20]} />
            <meshStandardMaterial
              color="#60a5fa"
              emissive="#3b82f6"
              emissiveIntensity={hovered ? 0.85 : 0.45}
            />
          </mesh>
        </>
      ) : isForest ? (
        <>
          {/* babylonian lapis & marble fountain column */}
          <mesh position={[0, 13, 0]}>
            <cylinderGeometry args={[3.2, 3.6, 18, 16]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.35} metalness={0.4} />
          </mesh>
          <mesh position={[0, 23, 0]}>
            <cylinderGeometry args={[6.5, 2.5, 3.5, 20]} />
            <meshStandardMaterial color="#d4af37" metalness={0.75} roughness={0.25} />
          </mesh>
          <mesh position={[0, 26, 0]}>
            <sphereGeometry args={[3.4, 16, 16]} />
            <meshStandardMaterial
              color="#4ade80"
              emissive="#22c55e"
              emissiveIntensity={hovered ? 0.65 : 0.25}
            />
          </mesh>
        </>
      ) : isClassical ? (
        <>
          {/* fluted greco-roman corinthian marble column & bronze brazier */}
          <mesh position={[0, 14, 0]}>
            <cylinderGeometry args={[3.0, 3.4, 20, 16]} />
            <meshStandardMaterial
              color={hovered ? "#ffffff" : "#f5f5f4"}
              roughness={0.4}
              metalness={0.15}
            />
          </mesh>
          <mesh position={[0, 24.8, 0]}>
            <boxGeometry args={[8.2, 2.2, 8.2]} />
            <meshStandardMaterial color="#d97706" metalness={0.65} roughness={0.3} />
          </mesh>
          <mesh position={[0, 27.5, 0]}>
            <sphereGeometry args={[2.8, 16, 16]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#ea580c"
              emissiveIntensity={hovered ? 0.8 : 0.4}
            />
          </mesh>
        </>
      ) : (
        <>
          {/* carved limestone obelisk shaft */}
          <mesh position={[0, 14, 0]}>
            <cylinderGeometry args={[2.6, 4.2, 20, 4]} />
            <meshStandardMaterial
              color={hovered ? "#fef08a" : "#e5c178"}
              roughness={0.45}
              metalness={0.35}
            />
          </mesh>
          {/* golden pyramidion apex */}
          <mesh position={[0, 26, 0]}>
            <coneGeometry args={[2.6, 4.5, 4]} />
            <meshStandardMaterial
              color="#d4af37"
              emissive={hovered ? "#facc15" : "#b45309"}
              emissiveIntensity={hovered ? 0.6 : 0.25}
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
        </>
      )}
    </group>
  );
}

interface PropSpawnerProps {
  propsList: PropItem[];
  onPropClick?: (prop: PropItem) => void;
}

export function PropSpawner({ propsList, onPropClick }: PropSpawnerProps) {
  const currentRoomId = useWorldStore((state) => state.currentRoomId);
  const rooms = useWorldStore((state) => state.rooms);
  const worldTitle = useWorldStore((state) => state.worldTitle);
  const activeRoom = rooms[currentRoomId];
  const biome = `${activeRoom?.biome_type || ""} ${activeRoom?.name || ""} ${worldTitle || ""}`;

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
