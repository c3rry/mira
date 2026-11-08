// primary react three fiber canvas container with walkable world-root group, props and characters
"use client";

import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { PanoramaSphere } from "./PanoramaSphere";
import { CameraController } from "./controls/CameraController";
import { PropSpawner } from "./PropSpawner";
import { CharacterSpawner } from "./CharacterSpawner";
import { ReflectiveFloorGrid } from "./environment/ReflectiveFloorGrid";
import { useWorldStore } from "@/store/useWorldStore";

interface WorldCanvasProps {
  displacementScale?: number;
}

export function WorldCanvas({ displacementScale = 28.0 }: WorldCanvasProps) {
  const { currentRoomId, rooms, npcs } = useWorldStore();
  const currentRoom = rooms[currentRoomId];
  const worldGroupRef = useRef<THREE.Group>(null);

  // fallback to default cached assets if room has no url
  const panoramaUrl = currentRoom?.panorama_url || "/cached_worlds/desert_oasis/panorama.webp";
  const depthUrl = currentRoom?.depth_url || "/cached_worlds/desert_oasis/depth.png";
  const mutationLevel = currentRoom?.mutation_level || 0.0;
  const currentProps = currentRoom?.props || [];

  // filter npcs belonging to the current room
  const currentRoomNPCs = useMemo(() => {
    return Object.values(npcs).filter((npc) => npc.room_id === currentRoomId);
  }, [npcs, currentRoomId]);

  return (
    <div className="w-full h-full relative select-none">
      <Canvas
        camera={{ position: [0, 0, 0.1], fov: 75 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%", background: "#050508" }}
      >
        {/* scene lighting for 3d props and characters */}
        <ambientLight intensity={1.25} />
        <directionalLight position={[20, 60, 30]} intensity={1.65} />
        <pointLight position={[0, 10, 0]} intensity={0.9} />

        {/* walkable world group: translated by WASD locomotion while OrbitControls rotates look direction */}
        <group ref={worldGroupRef} name="walkable-world-root">
          {/* panoramic inverted sphere with 16-bit depth displacement */}
          <PanoramaSphere
            panoramaUrl={panoramaUrl}
            depthUrl={depthUrl}
            displacementScale={displacementScale}
            mutationFactor={mutationLevel}
          />

          {/* tactile 3d architectural floor compass */}
          <ReflectiveFloorGrid />

          {/* interactive 3d props spawned at grounded coordinates */}
          <PropSpawner propsList={currentProps} />

          {/* autonomous patrolling npc humanoid avatars */}
          <CharacterSpawner npcs={currentRoomNPCs} />
        </group>

        {/* street view camera controller + WASD walking locomotion */}
        <CameraController
          enableZoom={false}
          rotateSpeed={-0.35}
          worldGroupRef={worldGroupRef}
        />
      </Canvas>
    </div>
  );
}
