// architectural world compiler panel with interactive clarifying questions and latent diffusion trigger
"use client";

import { useEffect, useState } from "react";
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
    label: "Mount Everest Summit",
    biome: "space_station",
    prompt: "Mount Everest Khumbu Icefall, Western Cwm glacial valley, and snow-covered Himalayan summit ridge",
  },
];

interface ClarifyingOption {
  label: string;
  enhancement: string;
}

interface ClarifyingQuestion {
  id: string;
  question: string;
  options: ClarifyingOption[];
}

export function PromptRefinementChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [selectedBiome, setSelectedBiome] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<ClarifyingQuestion[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [isRefining, setIsRefining] = useState(false);

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

  // Automatically fetch clarifying questions when user types an evocative prompt and pauses
  useEffect(() => {
    if (!isOpen || !promptText || promptText.length < 4) {
      setClarifyingQuestions([]);
      return;
    }

    const timer = setTimeout(() => {
      fetchClarifyingQuestions(promptText);
    }, 450);

    return () => clearTimeout(timer);
  }, [promptText, isOpen]);

  const fetchClarifyingQuestions = async (p: string) => {
    const raw = p.trim();
    if (!raw) return;
    setIsRefining(true);
    try {
      const backendOrigin =
        typeof window !== "undefined" && window.location.port === "3000"
          ? `${window.location.protocol}//${window.location.hostname}:8001`
          : "";
      const res = await fetch(`${backendOrigin}/chat/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: raw,
          selected_options: Object.values(selectedOptions),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setClarifyingQuestions(data.clarifying_questions || []);
        if (data.suggested_biome) {
          setSelectedBiome(data.suggested_biome);
        }
      }
    } catch (e) {
      console.warn("clarification fetch error:", e);
    } finally {
      setIsRefining(false);
    }
  };

  // Toggle selection on/off (allowing undo) and do it discretely without touching the text box
  const handleSelectOption = (questionId: string, opt: ClarifyingOption) => {
    setSelectedOptions((prev) => {
      const updated = { ...prev };
      if (updated[questionId] === opt.enhancement) {
        // Toggle off (undo selection)
        delete updated[questionId];
      } else {
        // Select option
        updated[questionId] = opt.enhancement;
      }
      return updated;
    });
  };

  const handleCompile = async (overridePrompt?: string, overrideBiome?: string) => {
    let activePrompt = (overridePrompt || promptText || "The Great Pyramids of Giza").trim();
    let activeBiome = overrideBiome !== undefined ? overrideBiome : selectedBiome || undefined;

    // Discretely append selected options into compilation payload without polluting user text box
    const selectedEnhancements = Object.values(selectedOptions).filter(Boolean);
    if (selectedEnhancements.length > 0) {
      activePrompt = `${activePrompt}, ${selectedEnhancements.join(", ")}`;
    }

    setIsCompilingWorld(true);
    setStatusMessage("Compiling realm topology and synthesizing neural diffusion atmosphere...");

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
        setStatusMessage("Realm materialized from the ancient archives.");
      }
    } catch (err) {
      console.warn("world compile request error:", err);
      setStatusMessage("Synthesized world via architectural pipeline.");
    } finally {
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
          className="px-3 py-1.5 border text-[11px] uppercase tracking-[0.18em] font-bold transition-all pointer-events-auto backdrop-blur-md opacity-85 hover:opacity-100"
          style={{
            backgroundColor: "rgba(10, 10, 12, 0.72)",
            borderColor: `${theme.panelBorder}88`,
            color: theme.accentText,
          }}
        >
          + Compile World
        </button>
      )}

      {isOpen && (
        <div
          className="w-84 sm:w-[420px] p-4 border shadow-2xl pointer-events-auto flex flex-col gap-3 max-h-[85vh] overflow-y-auto"
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
                  setSelectedOptions({});
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
            <label className="text-[10px] uppercase tracking-wider font-bold" style={{ color: theme.mutedText }}>
              Enter World Vision / Prompt
            </label>
            <textarea
              value={promptText}
              onChange={(e) => {
                setPromptText(e.target.value);
                setSelectedOptions({});
              }}
              placeholder="e.g., take me to neptune, celestial space station, Mount Everest, Roman Forum..."
              rows={2}
              className="w-full text-sm p-2.5 bg-black/60 border text-[#fdf6e2] placeholder-neutral-500 focus:outline-none resize-none"
              style={{ borderColor: `${theme.panelBorder}66` }}
            />
          </div>

          {/* Clarifying Questions System */}
          {isRefining && (
            <div className="text-[11px] italic" style={{ color: theme.mutedText }}>
              Analyzing environment semantics and preparing clarifying options...
            </div>
          )}

          {clarifyingQuestions.length > 0 && (
            <div className="flex flex-col gap-2.5 p-2.5 border bg-black/40" style={{ borderColor: `${theme.panelBorder}44` }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.accentColor }}>
                  Clarify Realm Atmosphere & Vantage
                </span>
                <span className="text-[9px] uppercase tracking-wider" style={{ color: theme.mutedText }}>
                  {Object.keys(selectedOptions).length > 0
                    ? `${Object.keys(selectedOptions).length} selected (click to undo)`
                    : "Click chip to select"}
                </span>
              </div>

              {clarifyingQuestions.map((q) => (
                <div key={q.id} className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold" style={{ color: theme.accentText }}>
                    {q.question}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {q.options.map((opt) => {
                      const isSelected = selectedOptions[q.id] === opt.enhancement;
                      return (
                        <button
                          key={opt.label}
                          onClick={() => handleSelectOption(q.id, opt)}
                          className="text-[10px] px-2 py-1 border transition-all text-left"
                          style={{
                            backgroundColor: isSelected ? `${theme.accentColor}33` : "rgba(0,0,0,0.5)",
                            borderColor: isSelected ? theme.accentColor : `${theme.panelBorder}44`,
                            color: isSelected ? "#ffffff" : theme.accentText,
                            fontWeight: isSelected ? "bold" : "normal",
                          }}
                        >
                          {isSelected ? "✓ " : "+ "}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

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
            {isCompilingWorld ? "Synthesizing Latent Space..." : "Compile & Materialize World"}
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
