// primary react three fiber canvas with connected walkable sub-rooms and one seamless sky
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

export function WorldCanvas(_props: WorldCanvasProps) {
  const { currentRoomId, rooms, npcs, worldTitle } = useWorldStore();
  const currentRoom = rooms[currentRoomId];
  const worldGroupRef = useRef<THREE.Group>(null);
  const skyboxGroupRef = useRef<THREE.Group>(null);

  const allRooms = useMemo(() => Object.values(rooms), [rooms]);

  // first room of the world is synthesized synchronously, so use it as the same-world placeholder sky
  const worldFallbackPano = allRooms[0]?.panorama_url;
  const panoramaUrl =
    currentRoom?.panorama_url || worldFallbackPano || "/generated_worlds/archive_giza_necropolis/giza_forecourt_panorama.webp";
  const mutationLevel = currentRoom?.mutation_level || 0.0;

  return (
    <div
      className="w-full h-full relative select-none outline-none"
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.focus();
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 0.5], fov: 75, far: 2000 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%", background: "#050508" }}
      >
        <ambientLight intensity={1.25} />
        <directionalLight position={[20, 60, 30]} intensity={1.65} />
        <pointLight position={[0, 10, 0]} intensity={0.9} />

        {/* one seamless infinite-distance sky that follows the camera and crossfades between rooms */}
        <group ref={skyboxGroupRef} name="skybox-enclosure-root">
          <PanoramaSphere
            panoramaUrl={panoramaUrl}
            fallbackUrl={worldFallbackPano}
            mutationFactor={mutationLevel}
            radius={180}
          />
        </group>

        <group ref={worldGroupRef} name="walkable-world-root">
          {allRooms.map((room) => {
            const rx = room.worldX || 0;
            const rz = room.worldZ || 0;
            const isCurrent = room.room_id === currentRoomId;
            const roomNpcs = Object.values(npcs).filter((n) => n.room_id === room.room_id);
            const roomCtx = `${room.biome_type || ""} ${room.name || ""} ${worldTitle || ""}`;

            return (
              <group key={room.room_id} position={[rx, 0, rz]} name={`room-zone-${room.room_id}`}>
                <ReflectiveFloorGrid roomName={room.name} biomeType={room.biome_type} isCurrentRoom={isCurrent} />
                <PropSpawner propsList={room.props || []} roomContext={roomCtx} />
                <CharacterSpawner npcs={roomNpcs} roomContext={roomCtx} />
              </group>
            );
          })}
        </group>

        <CameraController
          enableZoom={false}
          rotateSpeed={-0.35}
          worldGroupRef={worldGroupRef}
          skyboxGroupRef={skyboxGroupRef}
        />
      </Canvas>
    </div>
  );
}
