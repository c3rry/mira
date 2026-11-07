// slot-filling prompt refinement chat interface with quick-reply preset chips
"use client";

import { useState } from "react";
import { useWorldStore } from "@/store/useWorldStore";

const PRESET_CHIPS = [
  { label: "⚡ Cyberpunk Alley", biome: "cyberpunk_alley", prompt: "Cyberpunk alleyway with neon signs and steam vents" },
  { label: "🏰 Medieval Tavern", biome: "medieval_tavern", prompt: "Cozy timber tavern with roaring hearth and wooden barrels" },
  { label: "🚀 Space Station", biome: "space_station", prompt: "Orbital space station hydroponics bay overlooking starfield" },
  { label: "🌴 Desert Oasis", biome: "desert_oasis", prompt: "Desert oasis ruins surrounding clear spring at dusk" },
  { label: "🌲 Enchanted Forest", biome: "enchanted_forest", prompt: "Ancient mystical forest with glowing bioluminescent fungi" },
];

export function PromptRefinementChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [selectedBiome, setSelectedBiome] = useState<string>("cyberpunk_alley");
  const [isCompiling, setIsCompiling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { hydrateFromMockWorld, setLastTelemetry } = useWorldStore();

  const handleCompile = async (overridePrompt?: string, overrideBiome?: string) => {
    const activePrompt = overridePrompt || promptText || "Cyberpunk underworld lab";
    const activeBiome = overrideBiome || selectedBiome;

    setIsCompiling(true);
    setStatusMessage("Compiling world graph via Gemini 3.8 Flash...");

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
        if (data.world_graph) {
          hydrateFromMockWorld(data.world_graph);
        }

        const source = data.generation_metadata?.source || "cache_fallback";
        setLastTelemetry({
          provider: source === "gemini_generative" ? "gemini_flash" : "offline_mock",
          latency_ms: latencyMs,
          fallback_occurred: source !== "gemini_generative",
          fallback_reason: source !== "gemini_generative" ? "circuit_breaker_cache_fallback" : undefined,
        });

        setStatusMessage(
          source === "gemini_generative"
            ? `Compiled successfully (${latencyMs.toFixed(0)}ms)`
            : `Circuit breaker fallback loaded (${latencyMs.toFixed(0)}ms)`
        );
      } else {
        setStatusMessage("Compiler returned error; fallback loaded.");
      }
    } catch (err) {
      console.warn("world compile request error:", err);
      setStatusMessage("Offline loopback engaged.");
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="select-none">
      {/* toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-full bg-cyan-600/90 hover:bg-cyan-500 text-black font-semibold text-xs shadow-xl shadow-cyan-600/30 transition-all pointer-events-auto"
        >
          <span>✨</span>
          <span>World Compiler</span>
        </button>
      )}

      {/* expanded chat card */}
      {isOpen && (
        <div className="w-84 sm:w-96 bg-black/85 backdrop-blur-md rounded-2xl border border-cyan-500/30 p-4 shadow-2xl pointer-events-auto flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center space-x-2">
              <span className="text-cyan-400 font-bold text-xs tracking-wider">
                WORLD COMPILER CHAT
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300 font-mono">
                9.0s SLA
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          {/* quick suggestion chips */}
          <div className="flex flex-wrap gap-1.5">
            {PRESET_CHIPS.map((chip) => (
              <button
                key={chip.biome}
                onClick={() => {
                  setPromptText(chip.prompt);
                  setSelectedBiome(chip.biome);
                  handleCompile(chip.prompt, chip.biome);
                }}
                disabled={isCompiling}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                  selectedBiome === chip.biome
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm"
                    : "bg-white/5 border-white/10 text-neutral-300 hover:border-white/30"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* natural language input */}
          <div className="flex flex-col gap-1.5">
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Describe an RPG environment to compile..."
              rows={2}
              className="w-full text-xs p-2.5 rounded-lg bg-neutral-900/90 border border-white/15 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400 font-sans resize-none"
            />

            <button
              onClick={() => handleCompile()}
              disabled={isCompiling}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              {isCompiling ? "Compiling World Graph..." : "Generate & Compile 3D World"}
            </button>
          </div>

          {/* status feedback text */}
          {statusMessage && (
            <div className="text-[11px] font-mono text-cyan-300/80 bg-cyan-950/40 p-2 rounded border border-cyan-500/20">
              {statusMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
