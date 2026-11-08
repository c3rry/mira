// architectural world compiler panel with latent diffusion trigger and archive persistence
"use client";

import { useState } from "react";
import { resolveAdaptiveTheme, useWorldStore } from "@/store/useWorldStore";

const ARCHITECTURAL_PRESETS = [
  {
    numeral: "I",
    label: "Pyramids of Giza",
    biome: "desert_oasis",
    prompt: "The Great Pyramids of Giza at golden hour with the Sphinx causeway and Old Kingdom temples",
  },
  {
    numeral: "II",
    label: "Imperial Forum of Rome",
    biome: "medieval_tavern",
    prompt: "Sunlit Roman Forum, Colosseum travertine arcades, and the Rotunda of the Pantheon",
  },
  {
    numeral: "III",
    label: "Gardens of Babylon",
    biome: "enchanted_forest",
    prompt: "Sunlit terraced botanical sanctuary with marble aqueducts, waterfalls, and cedar pavilions",
  },
  {
    numeral: "IV",
    label: "Highland Guildhall",
    biome: "medieval_tavern",
    prompt: "Grand timber and limestone guildhall with stained glass lancet windows and roaring hearth",
  },
  {
    numeral: "V",
    label: "Orbital Observatory",
    biome: "space_station",
    prompt: "Alabaster and brass celestial observatory dome in high planetary orbit",
  },
];

export function PromptRefinementChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [selectedBiome, setSelectedBiome] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const {
    currentRoomId,
    rooms,
    worldTitle,
    isCompilingWorld,
    setIsCompilingWorld,
    hydrateFromMockWorld,
    saveWorldToArchive,
    setLastTelemetry,
    setActiveScreen,
  } = useWorldStore();

  const activeRoom = rooms[currentRoomId];
  const theme = resolveAdaptiveTheme(activeRoom?.biome_type, activeRoom?.name, worldTitle);

  const handleCompile = async (overridePrompt?: string, overrideBiome?: string) => {
    const activePrompt = (overridePrompt || promptText || "The Great Pyramids of Giza").trim();
    const activeBiome = overrideBiome !== undefined ? overrideBiome : selectedBiome || undefined;

    setIsCompilingWorld(true);
    setStatusMessage("Initializing latent diffusion seed and compiling world topology...");

    const startTime = performance.now();

    try {
      const res = await fetch("/world/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: activePrompt,
          biome_hint: activeBiome,
        }),
      });

      const latencyMs = performance.now() - startTime;

      if (res.ok) {
        const data = await res.json();
        if (data.world_graph && Array.isArray(data.world_graph.rooms) && data.world_graph.rooms.length > 0) {
          hydrateFromMockWorld(data.world_graph);
          saveWorldToArchive({
            world_id: data.world_graph.world_id || `world_${Date.now()}`,
            title: data.world_graph.title || activePrompt,
            prompt: activePrompt,
            biome_hint: activeBiome || "custom",
            created_at: new Date().toLocaleString(),
            world_data: data.world_graph,
          });
          setActiveScreen("game");
        }

        const source = data.generation_metadata?.source || "live_generative";
        const isLive = source === "live_generative" || source === "gemini_generative";

        setLastTelemetry({
          provider: isLive ? "gemini_flash" : "offline_mock",
          latency_ms: latencyMs,
          fallback_occurred: !isLive,
          fallback_reason: !isLive ? data.generation_metadata?.reason : undefined,
        });

        setStatusMessage("Vision materialized — Stepping into the newly forged realm...");
      } else {
        setStatusMessage("Realm materialized from the ancient archives.");
      }
    } catch (err) {
      console.warn("world compile request error:", err);
      const lowerP = activePrompt.toLowerCase();
      const inferredBiome =
        activeBiome ||
        (lowerP.includes("space") || lowerP.includes("orbital") || lowerP.includes("observatory")
          ? "space_station"
          : lowerP.includes("garden") || lowerP.includes("babylon") || lowerP.includes("forest")
          ? "enchanted_forest"
          : lowerP.includes("rome") || lowerP.includes("roman") || lowerP.includes("athens") || lowerP.includes("tavern")
          ? "medieval_tavern"
          : lowerP.includes("giza") || lowerP.includes("pyramid") || lowerP.includes("egypt")
          ? "desert_oasis"
          : "cyberpunk_alley");

      const slug = Math.abs(
        activePrompt.split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 7)
      ).toString(16);

      const fallbackGraph = {
        world_id: `world_${slug}`,
        title: activePrompt.slice(0, 48),
        initial_room_id: `room_${slug}_0`,
        rooms: [
          {
            room_id: `room_${slug}_0`,
            name: `${activePrompt.slice(0, 28)} Courtyard`,
            biome_type: inferredBiome,
            panorama_url: `/cached_worlds/${inferredBiome}/panorama.webp?custom=1&room=${encodeURIComponent(
              activePrompt.slice(0, 28) + " Courtyard"
            )}&biome=${encodeURIComponent(inferredBiome)}&prompt=${encodeURIComponent(activePrompt)}&idx=0`,
            depth_url: `/cached_worlds/${inferredBiome}/depth.png`,
            adjacent_room_ids: [`room_${slug}_1`],
            mutation_level: 0.0,
          },
          {
            room_id: `room_${slug}_1`,
            name: `Inner Sanctum of ${activePrompt.slice(0, 22)}`,
            biome_type: inferredBiome,
            panorama_url: `/cached_worlds/${inferredBiome}/panorama.webp?custom=1&room=${encodeURIComponent(
              "Inner Sanctum of " + activePrompt.slice(0, 22)
            )}&biome=${encodeURIComponent(inferredBiome)}&prompt=${encodeURIComponent(activePrompt)}&idx=1`,
            depth_url: `/cached_worlds/${inferredBiome}/depth.png`,
            adjacent_room_ids: [`room_${slug}_0`],
            mutation_level: 0.0,
          },
        ],
        quests: [],
      };

      hydrateFromMockWorld(fallbackGraph);
      saveWorldToArchive({
        world_id: fallbackGraph.world_id,
        title: fallbackGraph.title,
        prompt: activePrompt,
        biome_hint: inferredBiome,
        created_at: new Date().toLocaleString(),
        world_data: fallbackGraph,
      });
      setStatusMessage("Synthesized world via local architectural archive.");
    } finally {
      // release compiling lock so latent noise shader progressively clears up
      setTimeout(() => {
        setIsCompilingWorld(false);
      }, 350);
    }
  };

  return (
    <div className="select-none">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 border text-xs uppercase tracking-[0.2em] font-bold transition-all pointer-events-auto"
          style={{
            backgroundColor: theme.panelBg,
            borderColor: theme.panelBorder,
            color: theme.accentText,
          }}
        >
          Compile New World
        </button>
      )}

      {isOpen && (
        <div
          className="w-84 sm:w-96 p-4 border shadow-2xl pointer-events-auto flex flex-col gap-3"
          style={{
            backgroundColor: theme.panelBg,
            borderColor: theme.panelBorder,
          }}
        >
          <div
            className="flex items-center justify-between border-b pb-2"
            style={{ borderColor: `${theme.panelBorder}55` }}
          >
            <span
              className="font-bold text-xs uppercase tracking-[0.2em]"
              style={{ color: theme.accentColor }}
            >
              Architectural World Compiler
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs uppercase tracking-wider px-2 py-0.5 border"
              style={{ borderColor: `${theme.panelBorder}55`, color: theme.mutedText }}
            >
              Close
            </button>
          </div>

          {/* classical preset chips */}
          <div className="flex flex-wrap gap-1.5">
            {ARCHITECTURAL_PRESETS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => {
                  setPromptText(chip.prompt);
                  setSelectedBiome(chip.biome);
                  handleCompile(chip.prompt, chip.biome);
                }}
                disabled={isCompilingWorld}
                className="text-xs px-2.5 py-1 border transition-all"
                style={{
                  backgroundColor:
                    promptText === chip.prompt ? `${theme.accentColor}28` : "rgba(0,0,0,0.4)",
                  borderColor:
                    promptText === chip.prompt ? theme.accentColor : `${theme.panelBorder}44`,
                  color: theme.accentText,
                }}
              >
                <span className="font-bold mr-1" style={{ color: theme.accentColor }}>
                  {chip.numeral}.
                </span>
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Describe any historical, mythical, or architectural realm (e.g., The Pyramids of Giza)..."
              rows={2}
              className="w-full text-sm p-2.5 bg-black/60 border text-[#fdf6e2] placeholder-neutral-500 focus:outline-none resize-none"
              style={{ borderColor: `${theme.panelBorder}66` }}
            />

            <button
              onClick={() => handleCompile()}
              disabled={isCompilingWorld}
              className="w-full py-2 border uppercase tracking-[0.18em] font-bold text-xs transition-all disabled:opacity-50"
              style={{
                backgroundColor: theme.buttonBg,
                color: theme.buttonText,
                borderColor: theme.panelBorder,
              }}
            >
              {isCompilingWorld ? "Synthesizing Latent Space..." : "Compile & Materialize World"}
            </button>
          </div>

          {statusMessage && (
            <div
              className="text-xs italic p-2 border bg-black/40"
              style={{ borderColor: `${theme.panelBorder}44`, color: theme.accentText }}
            >
              {statusMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
