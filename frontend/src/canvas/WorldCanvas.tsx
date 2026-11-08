// primary react three fiber canvas with connected walkable sub-rooms, transition gateways, and one seamless sky
"use client";

import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { PanoramaSphere } from "./PanoramaSphere";
import { CameraController } from "./controls/CameraController";
import { PropSpawner } from "./PropSpawner";
import { CharacterSpawner } from "./CharacterSpawner";
import { isNaturalBiomeContext, ReflectiveFloorGrid } from "./environment/ReflectiveFloorGrid";
import { ZoneGateway } from "./environment/ZoneGateway";
import { useWorldStore, WorldRoom } from "@/store/useWorldStore";

interface WorldCanvasProps {
  displacementScale?: number;
}

interface CorridorSegment {
  key: string;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  nameA: string;
  nameB: string;
  midX: number;
  midZ: number;
  length: number;
  angleY: number;
}

// distance from a room center to its gateway (floor pad radius is ~105)
const GATEWAY_OFFSET = 96;

export function WorldCanvas(_props: WorldCanvasProps) {
  const { currentRoomId, rooms, npcs, worldTitle } = useWorldStore();
  const currentRoom = rooms[currentRoomId];
  const worldGroupRef = useRef<THREE.Group>(null);
  const skyboxGroupRef = useRef<THREE.Group>(null);

  const allRooms = useMemo(() => Object.values(rooms), [rooms]);

  // first room of the world is synthesized synchronously, so use it as the same-world placeholder sky
  const worldFallbackPano = allRooms[0]?.panorama_url;
  const panoramaUrl =
    currentRoom?.panorama_url || worldFallbackPano || "/cached_worlds/desert_oasis/panorama.webp";
  const mutationLevel = currentRoom?.mutation_level || 0.0;

  const style = useMemo<"snow" | "nature" | "architecture">(() => {
    const ctx = `${worldTitle || ""} ${allRooms.map((r) => r.name).join(" ")}`.toLowerCase();
    const snow = ["everest", "himalaya", "glacier", "snow", "alpine", "summit", "icefall", "arctic"].some((w) =>
      ctx.includes(w)
    );
    if (snow) return "snow";
    return isNaturalBiomeContext(ctx) ? "nature" : "architecture";
  }, [worldTitle, allRooms]);

  // physical connecting walkways between adjacent rooms
  const corridors = useMemo<CorridorSegment[]>(() => {
    const segs: CorridorSegment[] = [];
    const seen = new Set<string>();
    allRooms.forEach((rA: WorldRoom) => {
      (rA.adjacent_room_ids || []).forEach((adjId) => {
        const rB = rooms[adjId];
        if (!rB) return;
        const pairKey = [rA.room_id, rB.room_id].sort().join("::");
        if (seen.has(pairKey)) return;
        seen.add(pairKey);

        const ax = rA.worldX || 0;
        const az = rA.worldZ || 0;
        const bx = rB.worldX || 0;
        const bz = rB.worldZ || 0;
        const dx = bx - ax;
        const dz = bz - az;
        const dist = Math.hypot(dx, dz);
        // skip diagonal links that would cut through other rooms
        if (dist < 1 || dist > 260) return;

        segs.push({
          key: pairKey,
          ax,
          az,
          bx,
          bz,
          nameA: rA.name,
          nameB: rB.name,
          midX: (ax + bx) / 2,
          midZ: (az + bz) / 2,
          length: dist,
          angleY: Math.atan2(dx, dz),
        });
      });
    });
    return segs;
  }, [allRooms, rooms]);

  const pathColor = style === "snow" ? "#bae6fd" : style === "nature" ? "#86efac" : "#d4af37";
  const edgeColor = style === "snow" ? "#7dd3fc" : style === "nature" ? "#4ade80" : "#facc15";

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
            radius={900}
          />
        </group>

        <group ref={worldGroupRef} name="walkable-world-root">
          {corridors.map((seg) => {
            const ux = (seg.bx - seg.ax) / seg.length;
            const uz = (seg.bz - seg.az) / seg.length;
            return (
              <group key={seg.key}>
                {/* walkway strip */}
                <group position={[seg.midX, -5.96, seg.midZ]} rotation={[0, seg.angleY, 0]}>
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[28, seg.length]} />
                    <meshBasicMaterial
                      color={pathColor}
                      transparent
                      opacity={style === "architecture" ? 0.3 : 0.2}
                      side={THREE.DoubleSide}
                      depthWrite={false}
                    />
                  </mesh>
                  {[-13.5, 13.5].map((x) => (
                    <mesh key={x} position={[x, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                      <planeGeometry args={[0.7, seg.length]} />
                      <meshBasicMaterial color={edgeColor} transparent opacity={0.55} side={THREE.DoubleSide} />
                    </mesh>
                  ))}
                </group>

                {/* gateway leaving room A toward room B */}
                <ZoneGateway
                  position={[seg.ax + ux * GATEWAY_OFFSET, 0, seg.az + uz * GATEWAY_OFFSET]}
                  angleY={seg.angleY}
                  label={seg.nameB}
                  style={style}
                />
                {/* gateway leaving room B toward room A */}
                <ZoneGateway
                  position={[seg.bx - ux * GATEWAY_OFFSET, 0, seg.bz - uz * GATEWAY_OFFSET]}
                  angleY={seg.angleY + Math.PI}
                  label={seg.nameA}
                  style={style}
                />
              </group>
            );
          })}

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
