"use client";

import { useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import {
  BUILTIN_ARCHIVES,
  resolveAdaptiveTheme,
  useWorldStore,
} from "@/store/useWorldStore";
import { AudioManager } from "@/audio/AudioManager";
import { DialogueModal } from "@/components/hud/DialogueModal";
import { GodModePalette } from "@/components/GodModePalette";
import { GodModeNarrativeDirector } from "@/components/director/GodModeNarrativeDirector";
import { MinimapTopology } from "@/components/minimap/MinimapTopology";


// dynamically import 3d canvas to prevent ssr webgl errors
const WorldCanvas = dynamic(
  () => import("@/canvas/WorldCanvas").then((mod) => mod.WorldCanvas),
  { ssr: false }
);

const STUDIO_PRESETS = [
  {
    numeral: "I",
    title: "The Necropolis of Giza",
    biome: "desert_oasis",
    prompt: "The Great Pyramids of Giza at golden hour with the Sphinx causeway and Old Kingdom temples",
  },
  {
    numeral: "II",
    title: "Imperial Forum of Rome",
    biome: "medieval_tavern",
    prompt: "Sunlit Roman Forum, Colosseum travertine arcades, and the Rotunda of the Pantheon",
  },
  {
    numeral: "III",
    title: "Hanging Gardens of Babylon",
    biome: "enchanted_forest",
    prompt: "Sunlit terraced botanical sanctuary with marble aqueducts, waterfalls, and cedar pavilions",
  },
  {
    numeral: "IV",
    title: "Acropolis of Athens",
    biome: "medieval_tavern",
    prompt: "Sunlit Pentelic marble Parthenon colonnade atop the Acropolis overlooking the Aegean Sea",
  },
  {
    numeral: "V",
    title: "Celestial Orbital Observatory",
    biome: "space_station",
    prompt: "Alabaster and brass celestial observatory dome in high planetary orbit",
  },
  {
    numeral: "VI",
    title: "Grand Metropolis Arcade",
    biome: "cyberpunk_alley",
    prompt: "Luminous twilight metropolis boulevard with glass conservatories and brass skybridges",
  },
];

export default function Home() {
  const {
    currentRoomId,
    worldTitle,
    rooms,
    npcs,
    lastTelemetry,
    activeScreen,
    savedWorlds,
    isCompilingWorld,
    diffusionProgress,
    setActiveScreen,
    setIsCompilingWorld,
    saveWorldToArchive,
    deleteWorldFromArchive,
    loadArchivedWorld,
    hydrateFromMockWorld,
    initializeSync,
    setCurrentRoom,
    toggleGodMode,
    toggleGodModeDirector,
    guideState,
    setLastTelemetry,
    setActiveSubtitle,
    expandWorld,
    isExpanding,
    resetWorld,
  } = useWorldStore();

  const [backendHealth, setBackendHealth] = useState<string>("online");
  const [audioActive, setAudioActive] = useState<boolean>(false);
  const [isTicking, setIsTicking] = useState<boolean>(false);
  const [newWorldPrompt, setNewWorldPrompt] = useState<string>("");
  const [newWorldBiome, setNewWorldBiome] = useState<string>("");
  const [, startTransition] = useTransition();

  const activeRoom = rooms[currentRoomId];
  const theme = resolveAdaptiveTheme(activeRoom?.biome_type, activeRoom?.name, worldTitle);

  // advance autonomous npc chronicle tick
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
          const movedAgent = npcs[move.npc_id];
          setActiveSubtitle({
            npcId: move.npc_id,
            speaker: movedAgent?.name || move.npc_id,
            persona: movedAgent?.persona_description || "Autonomous Chronicler",
            text: `I have traversed from ${move.origin_room_id} to ${move.destination_room_id} to survey the archives.`,
            thoughtLog: move.reasoning_trace,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
        }
      }
    } catch (err) {
      console.warn("tick error:", err);
    } finally {
      setIsTicking(false);
    }
  };

  // compile a new world from the storage / creation screen and immediately enter the noisy latent room
  const handleCreateNewWorld = async (overridePrompt?: string, overrideBiome?: string) => {
    const promptToUse = (overridePrompt || newWorldPrompt || "The Great Pyramids of Giza").trim();
    const biomeToUse = overrideBiome !== undefined ? overrideBiome : newWorldBiome || undefined;

    // switch immediately into the 3d room in noisy latent diffusion state
    setActiveScreen("game");
    setIsCompilingWorld(true);

    const startTime = performance.now();
    try {
      const backendOrigin =
        typeof window !== "undefined" && window.location.port === "3000"
          ? `${window.location.protocol}//${window.location.hostname}:8001`
          : "";
      const res = await fetch(`${backendOrigin}/world/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptToUse,
          biome_hint: biomeToUse,
        }),
      });

      const latencyMs = performance.now() - startTime;
      if (res.ok) {
        const data = await res.json();
        if (data.world_graph && Array.isArray(data.world_graph.rooms) && data.world_graph.rooms.length > 0) {
          data.world_graph.prompt = promptToUse;
          hydrateFromMockWorld(data.world_graph);
          saveWorldToArchive({
            world_id: data.world_graph.world_id || `world_${Date.now()}`,
            title: data.world_graph.title || promptToUse,
            prompt: promptToUse,
            biome_hint: biomeToUse || "custom",
            created_at: new Date().toLocaleString(),
            world_data: data.world_graph,
          });
        }

        const source = data.generation_metadata?.source || "live_generative";
        const isLive = source === "live_generative" || source === "gemini_generative";
        setLastTelemetry({
          provider: isLive ? "gemini_flash" : "offline_mock",
          latency_ms: latencyMs,
          fallback_occurred: !isLive,
          fallback_reason: !isLive ? data.generation_metadata?.reason : undefined,
        });
      }
    } catch (err) {
      console.warn("create world error, synthesizing client-side world:", err);
      // client-side fallback synthesis so custom prompts work even if backend is offline
      const lowerP = promptToUse.toLowerCase();
      const inferredBiome =
        biomeToUse ||
        (lowerP.includes("space") ||
        lowerP.includes("orbital") ||
        lowerP.includes("observatory") ||
        lowerP.includes("neptune") ||
        lowerP.includes("jupiter") ||
        lowerP.includes("saturn") ||
        lowerP.includes("uranus") ||
        lowerP.includes("mars") ||
        lowerP.includes("moon") ||
        lowerP.includes("lunar") ||
        lowerP.includes("planet") ||
        lowerP.includes("exoplanet") ||
        lowerP.includes("cosmos")
          ? "space_station"
          : lowerP.includes("garden") || lowerP.includes("babylon") || lowerP.includes("forest")
          ? "enchanted_forest"
          : lowerP.includes("rome") || lowerP.includes("roman") || lowerP.includes("athens") || lowerP.includes("tavern")
          ? "medieval_tavern"
          : lowerP.includes("giza") || lowerP.includes("pyramid") || lowerP.includes("egypt")
          ? "desert_oasis"
          : "cyberpunk_alley");

      const slug = Math.abs(
        promptToUse.split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 7)
      ).toString(16);

      const fallbackGraph = {
        world_id: `world_${slug}`,
        title: promptToUse.slice(0, 48),
        initial_room_id: `room_${slug}_0`,
        rooms: [
          {
            room_id: `room_${slug}_0`,
            name: `${promptToUse.slice(0, 28)} Courtyard`,
            biome_type: inferredBiome,
            panorama_url: `/cached_worlds/${inferredBiome}/panorama.webp?custom=1&room=${encodeURIComponent(
              promptToUse.slice(0, 28) + " Courtyard"
            )}&biome=${encodeURIComponent(inferredBiome)}&prompt=${encodeURIComponent(promptToUse)}&idx=0`,
            depth_url: `/cached_worlds/${inferredBiome}/depth.png`,
            adjacent_room_ids: [`room_${slug}_1`, `room_${slug}_2`],
            mutation_level: 0.0,
          },
          {
            room_id: `room_${slug}_1`,
            name: `Inner Sanctum of ${promptToUse.slice(0, 22)}`,
            biome_type: inferredBiome,
            panorama_url: `/cached_worlds/${inferredBiome}/panorama.webp?custom=1&room=${encodeURIComponent(
              "Inner Sanctum of " + promptToUse.slice(0, 22)
            )}&biome=${encodeURIComponent(inferredBiome)}&prompt=${encodeURIComponent(promptToUse)}&idx=1`,
            depth_url: `/cached_worlds/${inferredBiome}/depth.png`,
            adjacent_room_ids: [`room_${slug}_0`, `room_${slug}_2`],
            mutation_level: 0.0,
          },
          {
            room_id: `room_${slug}_2`,
            name: `High Overlook of ${promptToUse.slice(0, 22)}`,
            biome_type: inferredBiome,
            panorama_url: `/cached_worlds/${inferredBiome}/panorama.webp?custom=1&room=${encodeURIComponent(
              "High Overlook of " + promptToUse.slice(0, 22)
            )}&biome=${encodeURIComponent(inferredBiome)}&prompt=${encodeURIComponent(promptToUse)}&idx=2`,
            depth_url: `/cached_worlds/${inferredBiome}/depth.png`,
            adjacent_room_ids: [`room_${slug}_0`, `room_${slug}_1`],
            mutation_level: 0.0,
          },
        ],
        quests: [],
      };

      hydrateFromMockWorld(fallbackGraph);
      saveWorldToArchive({
        world_id: fallbackGraph.world_id,
        title: fallbackGraph.title,
        prompt: promptToUse,
        biome_hint: inferredBiome,
        created_at: new Date().toLocaleString(),
        world_data: fallbackGraph,
      });
    } finally {
      setTimeout(() => {
        setIsCompilingWorld(false);
      }, 400);
    }
  };

  useEffect(() => {
    initializeSync();

    fetch("/health")
      .then((res) => res.json())
      .then((data) => {
        setBackendHealth(data.status || "online");
      })
      .catch(() => {
        setBackendHealth("archive_mode");
      });

    // initialize with the continuous procedural noise manifold
    if (BUILTIN_ARCHIVES.length > 0) {
      hydrateFromMockWorld(BUILTIN_ARCHIVES[0].world_data);
    }
  }, [hydrateFromMockWorld, initializeSync]);

  const resolveTrackUrl = (biome?: string) => {
    const valid = [
      "cyberpunk_alley",
      "cyberpunk_facility",
      "desert_oasis",
      "enchanted_forest",
      "medieval_tavern",
      "space_station",
    ];
    if (biome && valid.includes(biome)) {
      return `/audio/tracks/${biome}.wav`;
    }
    return `/audio/tracks/cyberpunk_alley.wav`;
  };

  // cross-fade musical score when room changes
  useEffect(() => {
    if (activeRoom) {
      const audioMgr = AudioManager.getInstance();
      const trackUrl = resolveTrackUrl(activeRoom.biome_type);
      audioMgr.fadeToTrack(trackUrl, 0.65, 1.5);
    }
  }, [currentRoomId, activeRoom]);

  // unlock musical score on first user gesture
  useEffect(() => {
    const handleFirstGesture = async () => {
      const audioMgr = AudioManager.getInstance();
      if (!audioMgr.isAudioUnlocked()) {
        const ok = await audioMgr.unlockAudio();
        setAudioActive(ok);
        if (ok && activeRoom) {
          const trackUrl = resolveTrackUrl(activeRoom.biome_type);
          audioMgr.fadeToTrack(trackUrl, 0.65, 1.0, true);
        }
      }
      window.removeEventListener("pointerdown", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
    };

    window.addEventListener("pointerdown", handleFirstGesture);
    window.addEventListener("keydown", handleFirstGesture);

    return () => {
      window.removeEventListener("pointerdown", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
    };
  }, [activeRoom]);

  const toggleAudioUnlock = async () => {
    const audioMgr = AudioManager.getInstance();
    if (!audioMgr.isAudioUnlocked()) {
      const ok = await audioMgr.unlockAudio();
      setAudioActive(ok);
      if (ok && activeRoom) {
        const trackUrl = resolveTrackUrl(activeRoom.biome_type);
        await audioMgr.fadeToTrack(trackUrl, 0.65, 1.0, true);
      }
    } else {
      const isMuted = audioMgr.toggleMute();
      setAudioActive(!isMuted);
    }
  };

  const diffusionStep = Math.max(1, Math.min(40, Math.ceil((diffusionProgress / 100) * 40)));

  return (
    <main className="relative w-screen h-screen overflow-hidden flex flex-col bg-[#120e0a]">
      {/* persistent 3d webgl viewport */}
      <div id="mira-canvas-container" className="absolute inset-0 z-0">
        <WorldCanvas />
      </div>

      {/* ===================================================================== */}
      {/* SCREEN I: START GAME TITLE SCREEN                                     */}
      {/* ===================================================================== */}
      {activeScreen === "title" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-6 select-none">
          <div
            className="max-w-2xl w-full p-10 border-2 shadow-2xl text-center flex flex-col items-center"
            style={{
              backgroundColor: theme.panelBg,
              borderColor: theme.panelBorder,
            }}
          >
            <div
              className="text-xs uppercase tracking-[0.35em] mb-2"
              style={{ color: theme.accentColor }}
            >
              Anno Domini MMXXVI • Ancient Mystery & Exploration
            </div>

            <h1
              className="text-5xl sm:text-6xl font-bold uppercase tracking-[0.22em] mb-3"
              style={{ color: theme.accentText }}
            >
              M I R A
            </h1>

            <div
              className="w-32 h-[1px] mb-4"
              style={{ backgroundColor: theme.panelBorder }}
            />

            <p
              className="text-base sm:text-lg italic max-w-lg mb-8 leading-relaxed"
              style={{ color: theme.mutedText }}
            >
              An interactive three-dimensional journey through ancient monuments,
              hidden chambers, and resident guides.
            </p>

            <div className="w-full max-w-md flex flex-col gap-3.5">
              <button
                onClick={() => {
                  toggleAudioUnlock();
                  setActiveScreen("game");
                }}
                className="w-full py-3.5 px-6 border-2 text-sm uppercase tracking-[0.24em] font-bold transition-all hover:opacity-90"
                style={{
                  backgroundColor: theme.buttonBg,
                  color: theme.buttonText,
                  borderColor: theme.panelBorder,
                }}
              >
                I. Enter World
              </button>

              <button
                onClick={() => {
                  toggleAudioUnlock();
                  setActiveScreen("storage");
                }}
                className="w-full py-3 px-6 border text-sm uppercase tracking-[0.22em] font-bold transition-all bg-black/50 hover:bg-black/75"
                style={{
                  borderColor: `${theme.panelBorder}88`,
                  color: theme.mutedText,
                }}
              >
                II. World Archives
              </button>
            </div>

            <div
              className="mt-8 pt-4 border-t w-full flex items-center justify-between text-xs italic"
              style={{ borderColor: `${theme.panelBorder}44`, color: theme.mutedText }}
            >
              <span>{worldTitle}</span>
              <span>WASD / Mouse to Explore • Click Characters to Converse</span>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN II: WORLD ARCHIVES (STORAGE) & NEW WORLD SYNTHESIS STUDIO      */}
      {/* ===================================================================== */}
      {(activeScreen === "storage" || activeScreen === "create") && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm p-6 select-none overflow-y-auto">
          <div
            className="max-w-5xl w-full border-2 shadow-2xl flex flex-col max-h-[90vh]"
            style={{
              backgroundColor: theme.panelBg,
              borderColor: theme.panelBorder,
            }}
          >
            {/* top archive header */}
            <div
              className="flex items-center justify-between px-8 py-5 border-b"
              style={{ borderColor: `${theme.panelBorder}66` }}
            >
              <div>
                <div
                  className="text-xs uppercase tracking-[0.28em] mb-1"
                  style={{ color: theme.accentColor }}
                >
                  World Chronicles
                </div>
                <h2
                  className="text-2xl font-bold uppercase tracking-[0.18em]"
                  style={{ color: theme.accentText }}
                >
                  Saved Chronicles
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveScreen("title")}
                  className="px-4 py-1.5 border text-xs uppercase tracking-[0.18em]"
                  style={{ borderColor: `${theme.panelBorder}77`, color: theme.mutedText }}
                >
                  Title Screen
                </button>
                <button
                  onClick={() => setActiveScreen("game")}
                  className="px-5 py-1.5 border text-xs uppercase tracking-[0.18em] font-bold"
                  style={{
                    backgroundColor: theme.buttonBg,
                    color: theme.buttonText,
                    borderColor: theme.panelBorder,
                  }}
                >
                  Return to 3D World
                </button>
              </div>
            </div>

            {/* world storage archive ledger */}
            <div className="w-full p-6 flex flex-col gap-4 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3
                  className="text-sm font-bold uppercase tracking-[0.2em]"
                  style={{ color: theme.accentColor }}
                >
                  Chronicles Ledger
                </h3>
                <span className="text-xs italic" style={{ color: theme.mutedText }}>
                  Select any chronicle to begin your journey
                </span>
              </div>

                <div className="space-y-3">
                  {savedWorlds.length === 0 && (
                    <div className="py-12 text-center text-xs tracking-wider border border-dashed p-6" style={{ borderColor: `${theme.panelBorder}44`, color: theme.mutedText }}>
                      No archived chronicles recorded in local memory. Enter the world to explore or use Mira Director to create new sectors.
                    </div>
                  )}
                  {savedWorlds.map((entry, idx) => {
                    const isCurrent = entry.title === worldTitle;
                    const roomCount = entry.world_data?.rooms?.length || 0;
                    const roomNames = (entry.world_data?.rooms || [])
                      .map((r: any) => r.name)
                      .join(" • ");

                    return (
                      <div
                        key={entry.world_id}
                        className="p-4 border transition-all flex flex-col gap-2"
                        style={{
                          backgroundColor: isCurrent ? `${theme.accentColor}18` : "rgba(0,0,0,0.45)",
                          borderColor: isCurrent ? theme.accentColor : `${theme.panelBorder}55`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-sm font-bold uppercase tracking-wider"
                                style={{ color: theme.accentText }}
                              >
                                Archive {idx + 1}: {entry.title}
                              </span>
                              {isCurrent && (
                                <span
                                  className="text-[10px] uppercase tracking-widest px-2 py-0.5 border font-bold"
                                  style={{
                                    borderColor: theme.accentColor,
                                    color: theme.accentColor,
                                  }}
                                >
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-xs italic mt-0.5" style={{ color: theme.mutedText }}>
                              &ldquo;{entry.prompt}&rdquo;
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => loadArchivedWorld(entry)}
                              className="px-3.5 py-1.5 border text-xs uppercase tracking-widest font-bold"
                              style={{
                                backgroundColor: theme.buttonBg,
                                color: theme.buttonText,
                                borderColor: theme.panelBorder,
                              }}
                            >
                              Enter World
                            </button>
                            {!entry.world_id.startsWith("archive_") && (
                              <button
                                onClick={() => deleteWorldFromArchive(entry.world_id)}
                                className="px-2.5 py-1.5 border text-xs uppercase tracking-wider bg-black/50"
                                style={{
                                  borderColor: `${theme.panelBorder}55`,
                                  color: theme.mutedText,
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        <div
                          className="pt-2 border-t flex flex-wrap items-center justify-between text-[11px]"
                          style={{ borderColor: `${theme.panelBorder}33`, color: theme.mutedText }}
                        >
                          <span>
                            Chambers ({roomCount}): <em className="text-[#fdf6e2]">{roomNames}</em>
                          </span>
                          <span>Recorded: {entry.created_at}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* ===================================================================== */}
      {/* SCREEN III: ACTIVE 3D EXPLORATION HUD (ADAPTIVE THEME & SUBTITLES)    */}
      {/* ===================================================================== */}
      {activeScreen === "game" && (
        <>
          {/* sleek translucent top navigation bar */}
          <header
            className="absolute top-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between px-4 py-1.5 border-b pointer-events-auto gap-2 backdrop-blur-md"
            style={{
              backgroundColor: "rgba(10, 10, 12, 0.72)",
              borderColor: `${theme.panelBorder}66`,
            }}
          >
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setActiveScreen("title")}
                className="text-sm font-bold uppercase tracking-[0.22em] hover:underline"
                style={{ color: theme.accentColor }}
              >
                M I R A
              </button>

              <div
                className="px-2.5 py-0.5 text-[11px] border uppercase tracking-wider"
                style={{
                  borderColor: `${theme.panelBorder}55`,
                  color: theme.accentText,
                }}
              >
                {worldTitle} : <span style={{ color: theme.accentColor }}>{activeRoom?.name || currentRoomId}</span>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2 text-[11px]">
              <button
                onClick={() => setActiveScreen("storage")}
                className="px-2.5 py-0.5 border uppercase tracking-wider font-bold transition-colors"
                style={{
                  backgroundColor: "rgba(0,0,0,0.45)",
                  borderColor: `${theme.panelBorder}88`,
                  color: theme.accentText,
                }}
              >
                Archives
              </button>

              <button
                onClick={() => toggleGodModeDirector()}
                className="px-2.5 py-0.5 border uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 shadow-[0_0_8px_rgba(56,189,248,0.25)]"
                style={{
                  backgroundColor: `${theme.accentColor}24`,
                  borderColor: theme.accentColor,
                  color: theme.accentColor,
                }}
                title="Open Mira Narrative Director [G]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                Mira Director [G]
              </button>

              <button
                onClick={() => resetWorld()}
                className="px-2.5 py-0.5 border uppercase tracking-wider font-bold transition-colors hover:border-red-400"
                style={{
                  backgroundColor: theme.buttonBg,
                  color: theme.buttonText,
                  borderColor: theme.panelBorder,
                }}
              >
                Reset
              </button>

              <button
                onClick={() => setActiveScreen("create")}
                className="px-2.5 py-0.5 border uppercase tracking-wider font-bold transition-colors"
                style={{
                  backgroundColor: theme.buttonBg,
                  color: theme.buttonText,
                  borderColor: theme.panelBorder,
                }}
              >
                New World
              </button>

              <button
                onClick={(e) => {
                  e.currentTarget.blur();
                  toggleAudioUnlock();
                }}
                className="px-2.5 py-0.5 border uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: audioActive ? `${theme.accentColor}28` : "rgba(0,0,0,0.45)",
                  borderColor: `${theme.panelBorder}88`,
                  color: theme.accentText,
                }}
              >
                {audioActive ? "Audio: On" : "Audio: Off"}
              </button>
            </div>
          </header>

          {/* compact world manifestation banner */}
          {(isCompilingWorld || diffusionProgress < 98) && (
            <div className="fixed top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none w-full max-w-sm px-4">
              <div
                className="p-2 border shadow-xl text-center backdrop-blur-md"
                style={{
                  backgroundColor: "rgba(10, 10, 12, 0.82)",
                  borderColor: theme.panelBorder,
                }}
              >
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.2em] mb-1"
                  style={{ color: theme.accentColor }}
                >
                  Entering World : {diffusionProgress}%
                </div>
                <div className="w-full h-1.5 bg-black/70 border overflow-hidden" style={{ borderColor: theme.panelBorder }}>
                  <div
                    className="h-full transition-all duration-150"
                    style={{
                      width: `${diffusionProgress}%`,
                      backgroundColor: theme.accentColor,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* left floating quick story creator button */}
          <div className="absolute top-12 left-4 z-20 pointer-events-auto">
            <button
              onClick={() => toggleGodModeDirector()}
              className="px-3 py-1.5 border text-xs uppercase tracking-wider font-bold transition-all shadow-xl backdrop-blur-md flex items-center gap-2 hover:scale-[1.02]"
              style={{
                backgroundColor: "rgba(10, 10, 14, 0.85)",
                borderColor: theme.accentColor,
                color: theme.accentColor,
              }}
              title="Open Mira Story & World Creator [Key G]"
            >
              <span className="w-2 h-2 rounded-full animate-ping bg-sky-400" />
              <span>Mira Story Creator [G]</span>
            </button>
          </div>

          {/* top-right minimap topology */}
          <div className="absolute top-12 right-4 z-20 pointer-events-auto hidden md:block">
            <MinimapTopology />
          </div>



          {/* dialogue modal (only appears when clicking an NPC) */}
          <DialogueModal />

          {/* God Mode Narrative Director Panel (Mira & Nemotron 70B Knowledge Graph) */}
          <GodModeNarrativeDirector />

          {/* Guide Live Guidance & In-Character Stalling Beacon */}
          {guideState && (
            <div
              className="fixed bottom-11 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-2.5 px-3.5 py-1 border shadow-xl backdrop-blur-md max-w-xl cursor-pointer hover:scale-[1.01] transition-all"
              onClick={() => toggleGodModeDirector()}
              style={{
                backgroundColor: guideState.isStalling ? "rgba(25, 10, 10, 0.9)" : "rgba(10, 25, 15, 0.9)",
                borderColor: guideState.isStalling ? "#ef4444" : "#22c55e",
              }}
              title="Click to open Mira Director"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_5px]"
                style={{
                  backgroundColor: guideState.isStalling ? "#ef4444" : "#22c55e",
                  color: guideState.isStalling ? "#ef4444" : "#22c55e",
                }}
              />
              <span className="text-[11px] font-bold" style={{ color: guideState.isStalling ? "#fca5a5" : "#86efac" }}>
                {guideState.name}:
              </span>
              <span className="text-[11px] truncate text-white/90 italic">
                &ldquo;{guideState.instructionText}&rdquo;
              </span>
            </div>
          )}

          {/* slim bottom chamber & continuous walk strip */}
          <footer
            className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-1 border-t pointer-events-auto backdrop-blur-md"
            style={{
              backgroundColor: "rgba(10, 10, 12, 0.72)",
              borderColor: `${theme.panelBorder}66`,
            }}
          >
            <div className="text-[11px] italic hidden sm:block" style={{ color: theme.mutedText }}>
              Explore: <strong style={{ color: theme.accentColor }}>WASD / Arrows</strong> (Shift Sprint) • Drag to Look • Click Characters to Talk
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span
                className="text-[10px] uppercase tracking-widest font-bold"
                style={{ color: theme.accentColor }}
              >
                Location:
              </span>
              <span className="font-semibold text-white/90 truncate max-w-[280px]">
                {rooms[currentRoomId]?.name || "Active Chamber"}
              </span>
            </div>
          </footer>
        </>
      )}
    </main>
  );
}
