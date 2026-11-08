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
import { ZoneGateway } from "./environment/ZoneGateway";
import { useWorldStore } from "@/store/useWorldStore";

interface WorldCanvasProps {
  displacementScale?: number;
}

export function WorldCanvas(_props: WorldCanvasProps) {
  const { currentRoomId, rooms, npcs, worldTitle, worldPrompt, transitionDirection, setCurrentRoom } = useWorldStore();
  const currentRoom = rooms[currentRoomId];
  const worldGroupRef = useRef<THREE.Group>(null);
  const skyboxGroupRef = useRef<THREE.Group>(null);

  const allRooms = useMemo(() => Object.values(rooms), [rooms]);

  // Compute 3D zone transition gateways connecting the active room to its adjacent neighbors
  const gateways = useMemo(() => {
    if (!currentRoom) return [];
    const list: Array<{
      id: string;
      targetRoomId: string;
      position: [number, number, number];
      angleY: number;
      label: string;
      style: "snow" | "nature" | "architecture";
    }> = [];

    const xA = currentRoom.worldX || 0;
    const zA = currentRoom.worldZ || 0;
    const adjList = currentRoom.adjacent_room_ids || [];

    adjList.forEach((adjId) => {
      const rB = rooms[adjId];
      if (!rB) return;

      const xB = rB.worldX || 0;
      const zB = rB.worldZ || 0;

      const dx = xB - xA;
      const dz = zB - zA;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.1) return;

      const nx = dx / dist;
      const nz = dz / dist;

      // Position gateway hotspot 32 units from room origin along bearing vector to neighbor
      const gateX = xA + nx * 32.0;
      const gateZ = zA + nz * 32.0;
      const angleY = Math.atan2(nx, -nz);

      const themeCombined = `${currentRoom.biome_type || ""} ${rB.biome_type || ""} ${currentRoom.name} ${rB.name}`.toLowerCase();
      let style: "snow" | "nature" | "architecture" = "architecture";
      if (themeCombined.includes("space") || themeCombined.includes("everest") || themeCombined.includes("glacier")) {
        style = "snow";
      } else if (themeCombined.includes("forest") || themeCombined.includes("garden") || themeCombined.includes("jungle")) {
        style = "nature";
      }

      list.push({
        id: `${currentRoom.room_id}->${rB.room_id}`,
        targetRoomId: rB.room_id,
        position: [gateX, 0, gateZ],
        angleY,
        label: rB.name,
        style,
      });
    });

    return list;
  }, [currentRoom, rooms]);

  // guaranteed existing fallback panorama based on active biome
  const themeCat = currentRoom?.biome_type || "desert_oasis";
  const defaultBiomePano = `/cached_worlds/${themeCat}/panorama.webp`;
  const worldFallbackPano = allRooms[0]?.panorama_url || defaultBiomePano;
  const panoramaUrl = currentRoom?.panorama_url || worldFallbackPano;
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
            transitionDirection={transitionDirection}
            radius={180}
            visualPalette={currentRoom?.visual_palette}
          />
        </group>

        <group ref={worldGroupRef} name="walkable-world-root">
          {currentRoom && (
            <group position={[currentRoom.worldX || 0, 0, currentRoom.worldZ || 0]} name={`room-zone-${currentRoom.room_id}`}>
              <ReflectiveFloorGrid roomName={currentRoom.name} biomeType={currentRoom.biome_type} isCurrentRoom={true} />
              <CharacterSpawner
                npcs={Object.values(npcs).filter((n) => n.room_id === currentRoom.room_id)}
                roomContext={`${currentRoom.biome_type || ""} ${currentRoom.name || ""} ${worldTitle || ""}`}
                worldPrompt={worldPrompt || worldTitle || ""}
                visualPalette={currentRoom.visual_palette}
              />
            </group>
          )}

          {/* Connected zone transition gateways aligned with reciprocal portal bearings */}
          {gateways.map((gate) => (
            <ZoneGateway
              key={gate.id}
              position={gate.position}
              angleY={gate.angleY}
              label={gate.label}
              style={gate.style}
              onNavigate={() => setCurrentRoom(gate.targetRoomId)}
            />
          ))}
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
