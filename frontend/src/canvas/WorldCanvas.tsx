// primary react three fiber canvas container with clamped dpr, props and characters
"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { PanoramaSphere } from "./PanoramaSphere";
import { CameraController } from "./controls/CameraController";
import { PropSpawner } from "./PropSpawner";
import { CharacterSpawner } from "./CharacterSpawner";
import { useWorldStore } from "@/store/useWorldStore";

interface WorldCanvasProps {
  displacementScale?: number;
}

export function WorldCanvas({ displacementScale = 25.0 }: WorldCanvasProps) {
  const { currentRoomId, rooms, npcs } = useWorldStore();
  const currentRoom = rooms[currentRoomId];

  // fallback to default cached assets if room has no url
  const panoramaUrl = currentRoom?.panorama_url || "/cached_worlds/cyberpunk_alley/panorama.webp";
  const depthUrl = currentRoom?.depth_url || "/cached_worlds/cyberpunk_alley/depth.png";
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
        <ambientLight intensity={1.2} />
        <directionalLight position={[0, 40, 20]} intensity={1.5} />
        <pointLight position={[0, 0, 0]} intensity={0.8} />

        {/* panoramic inverted sphere with 16-bit depth displacement */}
        <PanoramaSphere
          panoramaUrl={panoramaUrl}
          depthUrl={depthUrl}
          displacementScale={displacementScale}
          mutationFactor={mutationLevel}
        />

        {/* interactive 3d props spawned at grounded coordinates */}
        <PropSpawner propsList={currentProps} />

        {/* autonomous npc humanoid avatars */}
        <CharacterSpawner npcs={currentRoomNPCs} />

        {/* street view camera controller clamped to prevent pole flipping */}
        <CameraController enableZoom={false} rotateSpeed={-0.35} />
      </Canvas>
    </div>
  );
}
