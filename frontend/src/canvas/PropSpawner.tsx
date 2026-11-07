// procedural and glb prop spawner positioned via spherical depth grounding
"use client";

import { useMemo, useState } from "react";
import * as THREE from "three";
import { sphericalToCartesian } from "./controls/CameraController";
import type { PropItem } from "../store/useWorldStore";

interface SinglePropProps {
  prop: PropItem;
  onSelect?: (prop: PropItem) => void;
}

function SingleProp({ prop, onSelect }: SinglePropProps) {
  const [hovered, setHovered] = useState(false);

  // calculate 3d world position from spherical coordinates
  const position = useMemo(() => {
    const { r = 500, theta, phi } = prop.position;
    // position slightly inside the displaced sphere surface so props are clearly visible
    const targetR = Math.max(100, r * 0.7);
    return sphericalToCartesian(targetR, theta, phi);
  }, [prop.position]);

  // orient prop upright towards center origin
  const rotation = useMemo(() => {
    const rot = new THREE.Euler();
    rot.y = -prop.position.theta;
    return rot;
  }, [prop.position.theta]);

  const scale = (prop.scale || 1.0) * (hovered ? 1.2 : 1.0);

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
      {/* procedural fallback prop mesh with cyber-aesthetic styling */}
      <mesh position={[0, 10, 0]}>
        <cylinderGeometry args={[6, 8, 20, 16]} />
        <meshStandardMaterial
          color={hovered ? "#00ffff" : "#3b82f6"}
          emissive={hovered ? "#00ffff" : "#1d4ed8"}
          emissiveIntensity={hovered ? 0.8 : 0.3}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* interactive holographic ring */}
      <mesh position={[0, 22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[9, 11, 24]} />
        <meshBasicMaterial
          color={hovered ? "#38bdf8" : "#60a5fa"}
          side={THREE.DoubleSide}
          transparent={true}
          opacity={0.7}
        />
      </mesh>

      {/* ground contact glow disc */}
      <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[12, 16]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent={true}
          opacity={hovered ? 0.4 : 0.15}
        />
      </mesh>
    </group>
  );
}

interface PropSpawnerProps {
  propsList: PropItem[];
  onPropClick?: (prop: PropItem) => void;
}

export function PropSpawner({ propsList, onPropClick }: PropSpawnerProps) {
  if (!propsList || propsList.length === 0) {
    return null;
  }

  return (
    <group name="prop-spawner-layer">
      {propsList.map((item) => (
        <SingleProp key={item.prop_id} prop={item} onSelect={onPropClick} />
      ))}
    </group>
  );
}
