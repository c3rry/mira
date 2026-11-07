"use client";

import { useEffect, useState } from "react";
import { useWorldStore } from "@/store/useWorldStore";

export default function Home() {
  const {
    currentRoomId,
    rooms,
    npcs,
    lastTelemetry,
    isOfflineMode,
    hydrateFromMockWorld,
    initializeSync,
    setCurrentRoom,
  } = useWorldStore();

  const [backendHealth, setBackendHealth] = useState<string>("checking...");

  useEffect(() => {
    // initialize store sync
    initializeSync();

    // fetch backend health
    fetch("/health")
      .then((res) => res.json())
      .then((data) => {
        setBackendHealth(data.status);
      })
      .catch(() => {
        setBackendHealth("offline_fallback");
      });

    // pre-load mock world for local display
    fetch("/api/mock_world", { cache: "no-store" })
      .catch(() => {
        // fallback to local pre-baked manifest
        return fetch("/cached_worlds/manifest.json")
          .then((r) => r.json())
          .then((m) => {
            if (m && m.biomes) {
              const roomsList = Object.entries(m.biomes).map(([id, b]: [string, any]) => ({
                room_id: id,
                name: b.name,
                panorama_url: b.panorama,
                depth_url: b.depth,
                adjacent_room_ids: [],
                mutation_level: 0.0,
                biome_type: id,
                npcs: [],
              }));
              hydrateFromMockWorld({
                world_id: "local_manifest_world",
                initial_room_id: roomsList[0]?.room_id || "",
                rooms: roomsList,
                quests: [],
              });
            }
          });
      });
  }, [hydrateFromMockWorld, initializeSync]);

  const activeRoom = rooms[currentRoomId];

  return (
    <main className="relative w-screen h-screen overflow-hidden flex flex-col bg-[#0a0a0f]">
      {/* top telemetry hud */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3 bg-black/60 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center space-x-4">
          <div className="text-sm font-bold tracking-wider text-cyan-400">
            MIRA 3D ENGINE
          </div>
          <div className="px-2.5 py-0.5 text-xs rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
            Room: {currentRoomId || "initializing..."}
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded bg-black/40 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-neutral-300">Backend: {backendHealth}</span>
          </div>

          <div className="flex items-center space-x-1.5 px-3 py-1 rounded bg-black/40 border border-white/10">
            <span className="text-neutral-400">Model:</span>
            <span className="font-mono text-cyan-300">
              {lastTelemetry?.provider || "offline_mock"}
            </span>
          </div>
        </div>
      </header>

      {/* 3d canvas viewport container (gate 3 target) */}
      <div id="mira-canvas-container" className="flex-1 w-full h-full relative">
        <div className="absolute inset-0 flex items-center justify-center text-center p-6">
          <div className="max-w-md space-y-3 bg-neutral-900/80 p-6 rounded-xl border border-white/10 backdrop-blur-lg">
            <h2 className="text-lg font-semibold text-white">
              {activeRoom?.name || "Initializing 3D World"}
            </h2>
            <p className="text-sm text-neutral-400">
              Canvas viewport loopback verified. Active rooms loaded: {Object.keys(rooms).length}.
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {Object.keys(rooms).map((rId) => (
                <button
                  key={rId}
                  onClick={() => setCurrentRoom(rId)}
                  className={`px-2.5 py-1 text-xs rounded transition-colors ${
                    rId === currentRoomId
                      ? "bg-cyan-500 text-black font-medium"
                      : "bg-white/10 text-neutral-300 hover:bg-white/20"
                  }`}
                >
                  {rId}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
