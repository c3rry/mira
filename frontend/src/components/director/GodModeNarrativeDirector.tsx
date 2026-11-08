// God Mode Narrative Director : Story creator powered by Mira (Local GPU Nemotron)
"use client";

import { useEffect, useRef, useState } from "react";
import {
  resolveAdaptiveTheme,
  useWorldStore,
} from "@/store/useWorldStore";

const STORY_PRESETS = [
  {
    label: "Alien Invasion",
    biome: "cyberpunk_alley",
    prompt: "A mysterious alien mothership hovering above the city skyline with secret rooftop beacons",
  },
  {
    label: "Pyramids of Giza",
    biome: "desert_oasis",
    prompt: "The Great Pyramids of Giza at golden hour with the Sphinx causeway and Old Kingdom temples",
  },
  {
    label: "Roman Colosseum",
    biome: "medieval_tavern",
    prompt: "Sunlit Roman Forum, Colosseum travertine arcades, and secret catacombs",
  },
  {
    label: "Gardens of Babylon",
    biome: "enchanted_forest",
    prompt: "Sunlit terraced botanical sanctuary with marble aqueducts, crystal waterfalls, and cedar pavilions",
  },
  {
    label: "Secret Guildhall",
    biome: "medieval_tavern",
    prompt: "Grand timber and limestone castle hall with stained glass windows and roaring hearth",
  },
  {
    label: "Mount Everest",
    biome: "space_station",
    prompt: "Mount Everest Khumbu Icefall, Western Cwm glacial valley, and snow-covered Himalayan summit ridge",
  },
  {
    label: "Cyber City",
    biome: "cyberpunk_alley",
    prompt: "Rain-slick neon alleys of Neo-Tokyo with elevated glass skybridges and holographic billboards",
  },
];

export function GodModeNarrativeDirector() {
  const {
    worldTitle,
    currentRoomId,
    rooms,
    isGodModeDirectorOpen,
    setGodModeDirectorOpen,
    toggleGodModeDirector,
    storyGraph,
    narrativeMessages,
    isNarrativeLoading,
    sendNarrativeTurn,
    compileAndManifestFromMira,
    isCompilingWorld,
    resetWorld,
  } = useWorldStore();

  const [inputText, setInputText] = useState("");
  const [selectedBiome, setSelectedBiome] = useState<string>("");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const activeRoom = rooms[currentRoomId];
  const theme = resolveAdaptiveTheme(activeRoom?.biome_type, activeRoom?.name, worldTitle);

  // Auto-scroll chat to bottom on new message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [narrativeMessages, isNarrativeLoading]);

  // Keyboard shortcut: Key 'G' toggles Story Creator
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return;
      }
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        toggleGodModeDirector();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleGodModeDirector]);

  if (!isGodModeDirectorOpen) return null;

  const handleSendMessage = (textToSend?: string) => {
    const msg = textToSend !== undefined ? textToSend : inputText.trim();
    if (!msg && narrativeMessages.length > 0) return;
    setInputText("");
    sendNarrativeTurn(msg || undefined);
  };

  const userAnswersCount = narrativeMessages.filter((m) => m.role === "player").length;
  const confidence = Math.min(100, Math.round(25 + userAnswersCount * 25));
  const isConfident = confidence >= 75 || userAnswersCount >= 2;

  const stage = storyGraph ? storyGraph.interview_stage : "ask_core_story";
  const stageStep = Math.min(4, Math.max(1, userAnswersCount + 1));

  const lastDirectorMsg = [...narrativeMessages].reverse().find((m) => m.role !== "player");
  const chips = lastDirectorMsg?.chips || [];

  const handleManifestWorld = async () => {
    const finalPrompt = (inputText || lastDirectorMsg?.compilationPrompt || worldTitle).trim();
    const finalBiome = selectedBiome || lastDirectorMsg?.suggestedBiome || undefined;
    await compileAndManifestFromMira(finalPrompt, finalBiome);
    setGodModeDirectorOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 md:p-6 pointer-events-auto select-none">
      <div
        className="w-full max-w-4xl h-[88vh] border-2 shadow-2xl flex flex-col overflow-hidden transition-all rounded-lg"
        style={{
          backgroundColor: theme.panelBg,
          borderColor: theme.panelBorder,
        }}
      >
        {/* Top Header Bar */}
        <header
          className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: `${theme.panelBorder}66` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-3.5 h-3.5 rounded-full animate-pulse shadow-[0_0_10px_#38bdf8]"
              style={{ backgroundColor: theme.accentColor }}
            />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.2em]" style={{ color: theme.accentColor }}>
                MIRA : STORY CREATOR
              </h2>
              <p className="text-[11px]" style={{ color: theme.mutedText }}>
                Interactive Story Creator : An Ancient Mystery Adventure
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="px-2.5 py-0.5 border text-[10px] uppercase font-bold tracking-wider rounded"
              style={{
                borderColor: isConfident ? "#22c55e" : `${theme.panelBorder}77`,
                color: isConfident ? "#4ade80" : theme.mutedText,
                backgroundColor: isConfident ? "rgba(34, 197, 94, 0.15)" : "transparent",
              }}
            >
              Confidence: {confidence}% {isConfident ? "[READY]" : "[BUILDING]"}
            </div>

            <button
              onClick={() => resetWorld()}
              title="Reset world and clear history to start fresh"
              className="px-2.5 py-1 text-xs uppercase tracking-wider border font-bold hover:bg-red-950/40 hover:border-red-500/60 transition-all rounded flex items-center gap-1.5"
              style={{ borderColor: `${theme.panelBorder}88`, color: theme.mutedText }}
            >
              <span>↺</span>
              <span>Reset</span>
            </button>

            <button
              onClick={() => setGodModeDirectorOpen(false)}
              className="px-3 py-1 text-xs uppercase tracking-wider border font-bold hover:opacity-80 transition-opacity rounded"
              style={{ borderColor: theme.panelBorder, color: theme.buttonText, backgroundColor: theme.buttonBg }}
            >
              Close [G]
            </button>
          </div>
        </header>

        {/* Step Progression Bar */}
        <div
          className="flex items-center justify-between px-5 py-2 border-b text-xs shrink-0"
          style={{ borderColor: `${theme.panelBorder}44`, backgroundColor: "rgba(0,0,0,0.35)" }}
        >
          <span className="text-[11px] font-bold" style={{ color: theme.mutedText }}>
            Creation Step:
          </span>
          <div className="flex items-center gap-2 text-xs">
            {[
              { num: 1, label: "Core Idea" },
              { num: 2, label: "Secret Rooms" },
              { num: 3, label: "Allies & Clues" },
              { num: 4, label: "Explore in 3D" },
            ].map((st) => (
              <span
                key={st.num}
                className={`px-2 py-0.5 border rounded font-bold transition-all ${
                  stageStep >= st.num ? "opacity-100" : "opacity-40"
                }`}
                style={{
                  borderColor: stageStep >= st.num ? theme.accentColor : `${theme.panelBorder}55`,
                  color: stageStep >= st.num ? theme.accentColor : theme.mutedText,
                  backgroundColor: stageStep === st.num ? `${theme.accentColor}25` : "transparent",
                }}
              >
                {st.num}. {st.label}
              </span>
            ))}
          </div>
        </div>

        {/* Story Presets Bar */}
        <div
          className="px-5 py-2 border-b flex items-center gap-2 overflow-x-auto shrink-0"
          style={{ borderColor: `${theme.panelBorder}33`, backgroundColor: "rgba(0,0,0,0.25)" }}
        >
          <span className="text-[10px] uppercase tracking-wider font-bold shrink-0 mr-1" style={{ color: theme.mutedText }}>
            Presets:
          </span>
          {STORY_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setInputText(preset.prompt);
                setSelectedBiome(preset.biome);
                handleSendMessage(preset.prompt);
              }}
              disabled={isNarrativeLoading || isCompilingWorld}
              className="text-xs px-2.5 py-1 border rounded transition-all hover:scale-[1.03] shrink-0 flex items-center gap-1.5 shadow-sm"
              style={{
                borderColor: `${theme.panelBorder}88`,
                backgroundColor: "rgba(15, 23, 42, 0.8)",
                color: theme.accentText,
              }}
            >
              <span className="font-semibold">{preset.label}</span>
            </button>
          ))}
        </div>

        {/* Scrollable Message History */}
        <div ref={chatScrollRef} className="flex-1 p-5 overflow-y-auto space-y-4">
          {narrativeMessages.length === 0 && (
            <div
              className="p-6 border text-center my-6 space-y-3 backdrop-blur-sm rounded-lg"
              style={{ borderColor: `${theme.panelBorder}66`, backgroundColor: "rgba(0,0,0,0.4)" }}
            >
              <div className="text-base font-bold flex items-center justify-center gap-2" style={{ color: theme.accentColor }}>
                <span>Welcome to Mira</span>
              </div>
              <p className="text-xs md:text-sm max-w-lg mx-auto leading-relaxed" style={{ color: theme.accentText }}>
                What kind of secret world or adventure do you want to explore today? Describe an idea below (such as an alien encounter, a hidden labyrinth, or a high-tech espionage outpost) or choose a preset above.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => handleSendMessage("Create a thrilling mystery adventure with secret mechanisms and hidden vaults")}
                  className="px-5 py-2 border text-xs uppercase tracking-wider font-bold rounded shadow-lg transition-transform hover:scale-105"
                  style={{
                    borderColor: theme.accentColor,
                    color: theme.buttonText,
                    backgroundColor: theme.buttonBg,
                  }}
                >
                  Generate Discovery Premise
                </button>
              </div>
            </div>
          )}

          {narrativeMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col max-w-[85%] ${
                msg.role === "player" ? "ml-auto items-end" : "mr-auto items-start"
              }`}
            >
              <div className="flex items-center gap-2 mb-1 text-[11px] font-bold">
                <span style={{ color: msg.role === "player" ? theme.accentColor : "#38bdf8" }}>
                  {msg.role === "player" ? "You" : "Mira"}
                </span>
                <span className="text-[10px] font-normal" style={{ color: theme.mutedText }}>{msg.timestamp}</span>
              </div>
              <div
                className="p-3.5 border text-xs leading-relaxed shadow-lg backdrop-blur-sm rounded-lg"
                style={{
                  backgroundColor: msg.role === "player" ? `${theme.accentColor}18` : "rgba(15, 23, 42, 0.85)",
                  borderColor: msg.role === "player" ? theme.accentColor : `${theme.panelBorder}77`,
                  color: theme.accentText,
                }}
              >
                {msg.content}
                {msg.followUp && (
                  <div
                    className="mt-2.5 pt-2 border-t font-semibold"
                    style={{ borderColor: `${theme.panelBorder}55`, color: theme.accentColor }}
                  >
                    Question: {msg.followUp}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isNarrativeLoading && (
            <div className="flex items-center gap-2.5 p-3 text-xs italic" style={{ color: theme.accentColor }}>
              <div className="w-2.5 h-2.5 rounded-full animate-ping bg-sky-400" />
              <span>Mira is preparing your next discovery...</span>
            </div>
          )}
        </div>

        {/* Quick-Reply Recommendation Chips */}
        {chips.length > 0 && !isNarrativeLoading && (
          <div
            className="px-5 py-2.5 border-t flex flex-wrap items-center gap-2 shrink-0"
            style={{ borderColor: `${theme.panelBorder}44`, backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: theme.mutedText }}>
              Ideas:
            </span>
            {chips.map((chip, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleSendMessage(chip)}
                className="text-xs px-3 py-1.5 border rounded transition-all hover:scale-[1.02] text-left shadow-sm"
                style={{
                  borderColor: `${theme.panelBorder}88`,
                  backgroundColor: "rgba(20, 25, 35, 0.85)",
                  color: theme.accentText,
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3.5 border-t flex items-center gap-3 shrink-0"
          style={{ borderColor: `${theme.panelBorder}66`, backgroundColor: "rgba(10, 10, 14, 0.9)" }}
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              stageStep === 1
                ? "Describe your adventure or mystery..."
                : stageStep === 2
                ? "Define the chambers or secret rooms..."
                : "Specify key guides, allies, or rival factions..."
            }
            className="flex-1 px-4 py-2 text-xs border rounded bg-black/70 focus:outline-none transition-colors"
            style={{
              borderColor: `${theme.panelBorder}88`,
              color: "#ffffff",
            }}
          />
          <button
            type="submit"
            disabled={isNarrativeLoading}
            className="px-5 py-2 border text-xs uppercase tracking-wider font-bold rounded transition-all disabled:opacity-40"
            style={{
              borderColor: theme.accentColor,
              color: theme.buttonText,
              backgroundColor: theme.buttonBg,
            }}
          >
            Send
          </button>
        </form>

        {/* Adaptive Biome Selector & Manifest Realm Action Bar */}
        <div
          className="px-5 py-2.5 border-t flex flex-wrap items-center justify-between gap-3 shrink-0"
          style={{ borderColor: `${theme.panelBorder}55`, backgroundColor: "rgba(10, 12, 18, 0.95)" }}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: theme.mutedText }}>
              Biome:
            </span>
            {[
              { id: "desert_oasis", label: "Desert Oasis" },
              { id: "medieval_tavern", label: "Ancient / Castle" },
              { id: "enchanted_forest", label: "Magic Forest" },
              { id: "space_station", label: "Space Base" },
              { id: "cyberpunk_alley", label: "Neon City" },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBiome(b.id)}
                className="text-[11px] px-2.5 py-1 rounded border transition-all"
                style={{
                  borderColor:
                    (selectedBiome || lastDirectorMsg?.suggestedBiome) === b.id
                      ? theme.accentColor
                      : `${theme.panelBorder}44`,
                  backgroundColor:
                    (selectedBiome || lastDirectorMsg?.suggestedBiome) === b.id
                      ? `${theme.accentColor}28`
                      : "transparent",
                  color:
                    (selectedBiome || lastDirectorMsg?.suggestedBiome) === b.id ? "#ffffff" : theme.mutedText,
                  fontWeight:
                    (selectedBiome || lastDirectorMsg?.suggestedBiome) === b.id ? "bold" : "normal",
                }}
              >
                {b.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleManifestWorld}
            disabled={isCompilingWorld}
            className={`px-6 py-2.5 border rounded text-xs uppercase tracking-widest font-bold transition-all shadow-xl flex items-center gap-2 disabled:opacity-50 hover:scale-105 active:scale-95 ${
              isConfident
                ? "animate-pulse ring-2 ring-emerald-400/80 shadow-[0_0_20px_rgba(34,197,94,0.6)] border-emerald-400 text-white"
                : ""
            }`}
            style={{
              backgroundColor: isConfident ? "rgba(22, 163, 74, 0.95)" : theme.buttonBg,
              borderColor: isConfident ? "#22c55e" : theme.accentColor,
              color: isConfident ? "#ffffff" : theme.buttonText,
            }}
          >
            <span>{isCompilingWorld ? "Opening Realm..." : isConfident ? "Enter 3D World (Ready)" : "Enter 3D World"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
