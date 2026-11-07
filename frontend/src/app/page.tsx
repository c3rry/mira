"use client";

import { useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useWorldStore } from "@/store/useWorldStore";
import { AudioManager } from "@/audio/AudioManager";
import { FallbackStatusBadge } from "@/components/hud/FallbackStatusBadge";
import { MinimapTopology } from "@/components/minimap/MinimapTopology";
import { PromptRefinementChat } from "@/components/chat/PromptRefinementChat";
import { MutationControls } from "@/components/MutationControls";

// dynamically import 3d canvas to prevent ssr webgl errors
const WorldCanvas = dynamic(
  () => import("@/canvas/WorldCanvas").then((mod) => mod.WorldCanvas),
  { ssr: false }
);

export default function Home() {
  const {
    currentRoomId,
    rooms,
    npcs,
    selectedNpcId,
    selectNPC,
    lastTelemetry,
    hydrateFromMockWorld,
    initializeSync,
    setCurrentRoom,
  } = useWorldStore();

  const [backendHealth, setBackendHealth] = useState<string>("checking...");
  const [audioActive, setAudioActive] = useState<boolean>(false);
  const [isTicking, setIsTicking] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const selectedNpc = selectedNpcId ? npcs[selectedNpcId] : null;

  // trigger world tick to advance npcs across graph edges
  const handleTriggerTick = async () => {
    setIsTicking(true);
    try {
      const res = await fetch("/world/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          world_id: "mira_world",
          current_room_id: currentRoomId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.moved_npcs && data.moved_npcs.length > 0) {
          const move = data.moved_npcs[0];
          console.log(`[TICK] NPC ${move.npc_id} migrated: ${move.origin_room_id} -> ${move.destination_room_id}`);
        }
      }
    } catch (err) {
      console.warn("tick error:", err);
    } finally {
      setIsTicking(false);
    }
  };

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

    // load manifest biomes and mock world
    fetch("/cached_worlds/manifest.json")
      .then((r) => r.json())
      .then((m) => {
        if (m && m.biomes) {
          const defaultProps: Record<string, any[]> = {
            cyberpunk_alley: [
              {
                prop_id: "prop_cryo_terminal",
                name: "Cryo Terminal",
                mesh_url: "/cached_worlds/models/terminal.glb",
                position: { r: 500.0, theta: -0.5, phi: 2.1 },
                scale: 1.0,
                interactive: true,
              },
            ],
          };

          const defaultNpcs: Record<string, any[]> = {
            cyberpunk_alley: [
              {
                npc_id: "npc_cipher",
                name: "Cipher",
                room_id: "cyberpunk_alley",
                persona_description: "Rogue bio-synthetic hacker seeking the neural decryption keys.",
                thought_log: ["Initialized standby sequence.", "Observed player arrival."],
                active_plan: "Verify player credentials before granting datapad access.",
                inventory: ["encrypted_datapad", "cryo_capsule"],
                hp: 100,
                position: { r: 500.0, theta: 0.785, phi: 2.356 },
              },
            ],
          };

          const roomsList = Object.entries(m.biomes).map(([id, b]: [string, any]) => ({
            room_id: id,
            name: b.name,
            panorama_url: b.panorama,
            depth_url: b.depth,
            adjacent_room_ids: [],
            mutation_level: 0.0,
            biome_type: id,
            props: defaultProps[id] || [],
            npcs: defaultNpcs[id] || [],
          }));

          // check query string for specific initial biome
          const params = new URLSearchParams(window.location.search);
          const requestedBiome = params.get("biome");
          const initialId =
            requestedBiome && m.biomes[requestedBiome]
              ? requestedBiome
              : roomsList[0]?.room_id || "cyberpunk_alley";

          hydrateFromMockWorld({
            world_id: "local_manifest_world",
            initial_room_id: initialId,
            rooms: roomsList,
            quests: [],
          });
        }
      })
      .catch((err) => {
        console.warn("could not load manifest, falling back to mock", err);
      });
  }, [hydrateFromMockWorld, initializeSync]);

  const activeRoom = rooms[currentRoomId];

  // dual-track ambient audio cross-fade on room navigation
  useEffect(() => {
    if (activeRoom) {
      const audioMgr = AudioManager.getInstance();
      const trackUrl = `/audio/tracks/${activeRoom.biome_type || "ambient"}.mp3`;
      audioMgr.fadeToTrack(trackUrl, 0.6, 1.5);
    }
  }, [currentRoomId, activeRoom]);

  const toggleAudioUnlock = async () => {
    const ok = await AudioManager.getInstance().unlockAudio();
    setAudioActive(ok);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden flex flex-col bg-[#050508]">
      {/* top telemetry hud */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3 bg-black/60 backdrop-blur-md border-b border-white/10 pointer-events-auto">
        <div className="flex items-center space-x-4">
          <div className="text-sm font-bold tracking-wider text-cyan-400">
            MIRA 3D ENGINE
          </div>
          <div className="px-2.5 py-0.5 text-xs rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 font-mono">
            Room: {currentRoomId || "initializing..."}
          </div>
          <FallbackStatusBadge />
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

          {/* audio gesture unlock toggle */}
          <button
            onClick={toggleAudioUnlock}
            className={`px-3 py-1 rounded border transition-colors ${
              audioActive
                ? "bg-cyan-950/80 border-cyan-500/50 text-cyan-300"
                : "bg-black/40 border-white/10 text-neutral-400 hover:text-white"
            }`}
          >
            {audioActive ? "🔊 Audio Active" : "🔇 Unmute Audio"}
          </button>

          {/* manual world tick button */}
          <button
            onClick={handleTriggerTick}
            disabled={isTicking}
            className="px-3 py-1 rounded bg-purple-950/80 border border-purple-500/40 text-purple-300 hover:bg-purple-900/80 hover:text-purple-100 transition-colors disabled:opacity-50 font-mono"
          >
            {isTicking ? "Ticking..." : "⚡ World Tick"}
          </button>
        </div>
      </header>

      {/* active npc dialogue / status overlay */}
      {selectedNpc && (
        <aside className="absolute top-16 right-6 z-20 w-80 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-cyan-500/40 shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-cyan-300">{selectedNpc.name}</span>
            <button
              onClick={() => selectNPC(null)}
              className="text-xs text-neutral-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-neutral-300 mb-3">{selectedNpc.persona_description}</p>
          {selectedNpc.thought_log && selectedNpc.thought_log.length > 0 && (
            <div className="bg-cyan-950/50 border border-cyan-500/30 p-2.5 rounded-lg text-[11px] font-mono text-cyan-200">
              <span className="text-cyan-400 font-semibold block mb-1">NPC Thought Trace:</span>
              &ldquo;{selectedNpc.thought_log[selectedNpc.thought_log.length - 1]}&rdquo;
            </div>
          )}
        </aside>
      )}

      {/* 3d canvas viewport container */}
      <div id="mira-canvas-container" className="absolute inset-0 z-0">
        <WorldCanvas />
      </div>

      {/* left floating prompt refinement compiler */}
      <div className="absolute top-16 left-6 z-20 pointer-events-auto">
        <PromptRefinementChat />
      </div>

      {/* bottom-left minimap topology */}
      <div className="absolute bottom-24 left-6 z-20 pointer-events-auto hidden md:block">
        <MinimapTopology />
      </div>

      {/* bottom-right in-situ atmosphere mutation slider */}
      <div className="absolute bottom-24 right-6 z-20 pointer-events-auto hidden md:block">
        <MutationControls />
      </div>

      {/* bottom room switcher floating controls */}
      <footer className="absolute bottom-6 left-6 right-6 z-10 flex flex-col sm:flex-row items-center justify-between pointer-events-none gap-4">
        <div className="bg-black/70 backdrop-blur-md p-4 rounded-xl border border-white/10 pointer-events-auto max-w-sm">
          <h2 className="text-sm font-semibold text-white">
            {activeRoom?.name || "Loading Panorama..."}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Drag to look 360°. Inverted sphere geometry 128x64.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center bg-black/70 backdrop-blur-md p-2 rounded-xl border border-white/10 pointer-events-auto">
          {Object.keys(rooms).map((rId) => (
            <button
              key={rId}
              onClick={() => {
                startTransition(() => {
                  setCurrentRoom(rId);
                });
              }}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                rId === currentRoomId
                  ? "bg-cyan-500 text-black font-semibold shadow-lg shadow-cyan-500/30 scale-105"
                  : "bg-white/10 text-neutral-300 hover:bg-white/20 hover:text-white"
              }`}
            >
              {rooms[rId]?.name || rId}
            </button>
          ))}
        </div>
      </footer>
    </main>
  );
}
