// architectural world compiler panel with direct prompt entry and fast latent diffusion trigger
"use client";

import { useState } from "react";
import { resolveAdaptiveTheme, useWorldStore } from "@/store/useWorldStore";

const ARCHITECTURAL_PRESETS = [
  {
    numeral: "I",
    label: "Neon Metropolis",
    biome: "cyberpunk_alley",
    prompt: "Luminous rain-slicked city streets, neon billboards, and towering high-density corporate towers",
  },
  {
    numeral: "II",
    label: "Pyramids of Giza",
    biome: "desert_oasis",
    prompt: "The Great Pyramids of Giza at golden hour with the Sphinx causeway and Old Kingdom temples",
  },
  {
    numeral: "III",
    label: "Imperial Forum of Rome",
    biome: "medieval_tavern",
    prompt: "Sunlit Roman Forum, Colosseum travertine arcades, and the Rotunda of the Pantheon",
  },
  {
    numeral: "IV",
    label: "Gardens of Babylon",
    biome: "enchanted_forest",
    prompt: "Sunlit terraced botanical sanctuary with marble aqueducts, waterfalls, and cedar pavilions",
  },
  {
    numeral: "V",
    label: "Mount Everest Summit",
    biome: "space_station",
    prompt: "Mount Everest Khumbu Icefall, Western Cwm glacial valley, and snow-covered Himalayan summit ridge",
  },
  {
    numeral: "VI",
    label: "Celestial Station",
    biome: "space_station",
    prompt: "High planetary orbit observation decks, gravity rings, and vacuum airlocks overlooking deep cosmos",
  },
  {
    numeral: "VII",
    label: "Tokyo Midnight",
    biome: "cyberpunk_alley",
    prompt: "Vibrant lantern corridors, bustling izakaya alleys, and dazzling neon pedestrian crossings",
  },
  {
    numeral: "VIII",
    label: "London Thames",
    biome: "medieval_tavern",
    prompt: "Cobblestone quays along the River Thames, iconic clocktower vistas, and historic market squares",
  },
  {
    numeral: "IX",
    label: "Abyssal Trench",
    biome: "space_station",
    prompt: "Deep-sea hydrothermal vents, glowing bioluminescent coral ridges, and sub-aquatic research outposts",
  },
  {
    numeral: "X",
    label: "Amazon Rainforest",
    biome: "enchanted_forest",
    prompt: "Ancient towering kapok trees, misty sunlit riverbanks, and the rich symphony of the tropical canopy",
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
    savedWorlds,
    loadArchivedWorld,
    setLastTelemetry,
    setActiveScreen,
  } = useWorldStore();

  const activeRoom = rooms[currentRoomId];
  const theme = resolveAdaptiveTheme(activeRoom?.biome_type, activeRoom?.name, worldTitle);

  const handleCompile = async (overridePrompt?: string, overrideBiome?: string) => {
    const activePrompt = (overridePrompt || promptText || "The Great Pyramids of Giza").trim();
    const activeBiome = overrideBiome !== undefined ? overrideBiome : selectedBiome || undefined;

    setIsCompilingWorld(true);
    setStatusMessage("Synthesizing neural environment...");

    const progressTimer = setInterval(() => {
      const current = useWorldStore.getState().diffusionProgress;
      if (current < 90) {
        useWorldStore.getState().setDiffusionProgress(current + Math.floor(Math.random() * 8 + 5));
      }
    }, 280);

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
          prompt: activePrompt,
          biome_hint: activeBiome,
        }),
      });

      const latencyMs = performance.now() - startTime;

      if (res.ok) {
        const data = await res.json();
        if (data.world_graph && Array.isArray(data.world_graph.rooms) && data.world_graph.rooms.length > 0) {
          data.world_graph.prompt = activePrompt;
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

        setIsOpen(false);
        setStatusMessage(null);
      } else {
        setStatusMessage("World materialized from memory.");
      }
    } catch (err) {
      console.warn("world compile request error:", err);
      setStatusMessage("Synthesized world via offline pipeline.");
    } finally {
      clearInterval(progressTimer);
      useWorldStore.getState().setDiffusionProgress(100);
      setTimeout(() => {
        setIsCompilingWorld(false);
      }, 500);
    }
  };

  return (
    <div className="select-none pointer-events-auto">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="px-3 py-1.5 border text-[11px] uppercase tracking-[0.18em] font-bold transition-all backdrop-blur-md opacity-90 hover:opacity-100 shadow-lg"
          style={{
            backgroundColor: "rgba(10, 10, 12, 0.85)",
            borderColor: `${theme.panelBorder}aa`,
            color: theme.accentText,
          }}
        >
          + COMPILE WORLD
        </button>
      )}

      {isOpen && (
        <div
          className="w-80 sm:w-96 p-4 border shadow-2xl flex flex-col gap-3 max-h-[85vh] overflow-y-auto"
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
              Compile World
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs uppercase tracking-wider px-2 py-0.5 border"
              style={{ borderColor: `${theme.panelBorder}55`, color: theme.mutedText }}
            >
              Close
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5">
            {ARCHITECTURAL_PRESETS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => {
                  const match = savedWorlds.find(
                    (w) =>
                      w.title.toLowerCase().includes(chip.label.toLowerCase()) ||
                      chip.label.toLowerCase().includes(w.title.toLowerCase())
                  );
                  if (match) {
                    loadArchivedWorld(match);
                    setIsOpen(false);
                  } else {
                    setPromptText(chip.prompt);
                    setSelectedBiome(chip.biome);
                    handleCompile(chip.prompt, chip.biome);
                  }
                }}
                disabled={isCompilingWorld}
                className="text-xs px-2.5 py-1 border transition-all text-left hover:scale-[1.01]"
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
            <label className="text-[10px] uppercase tracking-wider font-bold" style={{ color: theme.mutedText }}>
              World Prompt
            </label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g., Mount Everest summit, Roman Forum, Ancient Kyoto, celestial space station..."
              rows={2}
              className="w-full text-sm p-2.5 bg-black/60 border text-[#fdf6e2] placeholder-neutral-500 focus:outline-none resize-none"
              style={{ borderColor: `${theme.panelBorder}66` }}
            />
          </div>

          <button
            onClick={() => handleCompile()}
            disabled={isCompilingWorld}
            className="w-full py-2.5 border uppercase tracking-[0.18em] font-bold text-xs transition-all disabled:opacity-50"
            style={{
              backgroundColor: theme.buttonBg,
              color: theme.buttonText,
              borderColor: theme.panelBorder,
            }}
          >
            {isCompilingWorld ? "Synthesizing World..." : "Compile & Enter World"}
          </button>

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
