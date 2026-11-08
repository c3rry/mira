// architect ledger and inference cascade controller without emojis
"use client";

import { useEffect } from "react";
import { resolveAdaptiveTheme, useWorldStore } from "@/store/useWorldStore";

export function GodModePalette() {
  const {
    isGodModeOpen,
    toggleGodMode,
    simulatedProvider,
    setSimulatedProvider,
    lastTelemetry,
    currentRoomId,
    setCurrentRoom,
    rooms,
    worldTitle,
    isOfflineMode,
  } = useWorldStore();

  const activeRoom = rooms[currentRoomId];
  const theme = resolveAdaptiveTheme(activeRoom?.biome_type, activeRoom?.name, worldTitle);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        toggleGodMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleGodMode]);

  if (!isGodModeOpen) {
    return null;
  }

  const providerOptions: Array<{
    id: "nemotron_70b" | "gemini_flash" | "offline_mock" | null;
    numeral: string;
    label: string;
    desc: string;
  }> = [
    {
      id: null,
      numeral: "I",
      label: "Autonomous Three-Tier Cascade",
      desc: "NVIDIA NIM Nemotron 70B -> Gemini Flash -> Local Archive Catalog",
    },
    {
      id: "nemotron_70b",
      numeral: "II",
      label: "Tier One: NVIDIA NIM Nemotron 70B",
      desc: "Primary 70B parameter cognitive inference engine",
    },
    {
      id: "gemini_flash",
      numeral: "III",
      label: "Tier Two: Gemini Flash Synthesis",
      desc: "High-speed structured topological and conversational synthesis",
    },
    {
      id: "offline_mock",
      numeral: "IV",
      label: "Tier Three: Local Archive Catalog",
      desc: "Zero-latency deterministic historical persona ledger",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pointer-events-auto select-none">
      <div
        className="w-full max-w-2xl border-2 shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: theme.panelBg,
          borderColor: theme.panelBorder,
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: `${theme.panelBorder}66` }}
        >
          <div>
            <h2
              className="text-lg font-bold uppercase tracking-[0.22em]"
              style={{ color: theme.accentColor }}
            >
              Architect Diagnostic Ledger
            </h2>
            <p className="text-xs italic" style={{ color: theme.mutedText }}>
              Inference Cascade Governance & Chamber Navigation (Shortcut: Key G)
            </p>
          </div>
          <button
            onClick={toggleGodMode}
            className="px-3 py-1 border text-xs uppercase tracking-widest"
            style={{ borderColor: theme.panelBorder, color: theme.accentText }}
          >
            Close Ledger
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          <div>
            <h3
              className="text-xs font-bold uppercase tracking-[0.2em] mb-3"
              style={{ color: theme.accentColor }}
            >
              Section I :  Inference Cascade Selection
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {providerOptions.map((opt) => (
                <button
                  key={String(opt.id)}
                  onClick={() => setSimulatedProvider(opt.id)}
                  className="p-3.5 border text-left transition-all"
                  style={{
                    backgroundColor:
                      simulatedProvider === opt.id ? `${theme.accentColor}25` : "rgba(0,0,0,0.45)",
                    borderColor:
                      simulatedProvider === opt.id ? theme.accentColor : `${theme.panelBorder}44`,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color: theme.accentText }}>
                      {opt.numeral}. {opt.label}
                    </span>
                  </div>
                  <p className="text-xs italic" style={{ color: theme.mutedText }}>
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div
            className="bg-black/50 p-4 border text-xs"
            style={{ borderColor: `${theme.panelBorder}55` }}
          >
            <h3
              className="text-xs font-bold uppercase tracking-[0.2em] mb-3"
              style={{ color: theme.accentColor }}
            >
              Section II :  Diagnostic Telemetry
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-2.5 border" style={{ borderColor: `${theme.panelBorder}33` }}>
                <span className="text-[11px] italic block mb-1" style={{ color: theme.mutedText }}>
                  Active Engine
                </span>
                <span className="font-bold uppercase" style={{ color: theme.accentText }}>
                  {lastTelemetry?.provider || "gemini_flash"}
                </span>
              </div>

              <div className="p-2.5 border" style={{ borderColor: `${theme.panelBorder}33` }}>
                <span className="text-[11px] italic block mb-1" style={{ color: theme.mutedText }}>
                  Turnaround
                </span>
                <span className="font-bold" style={{ color: theme.accentText }}>
                  {lastTelemetry ? `${lastTelemetry.latency_ms.toFixed(0)} ms` : "120 ms"}
                </span>
              </div>

              <div className="p-2.5 border" style={{ borderColor: `${theme.panelBorder}33` }}>
                <span className="text-[11px] italic block mb-1" style={{ color: theme.mutedText }}>
                  Theme Palette
                </span>
                <span className="font-bold uppercase" style={{ color: theme.accentColor }}>
                  {theme.id}
                </span>
              </div>

              <div className="p-2.5 border" style={{ borderColor: `${theme.panelBorder}33` }}>
                <span className="text-[11px] italic block mb-1" style={{ color: theme.mutedText }}>
                  Network State
                </span>
                <span className="font-bold uppercase" style={{ color: theme.accentText }}>
                  {isOfflineMode ? "Archive Cache" : "Online"}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3
              className="text-xs font-bold uppercase tracking-[0.2em] mb-3"
              style={{ color: theme.accentColor }}
            >
              Section III :  Chamber Index & Direct Passage
            </h3>

            <div className="flex flex-wrap gap-2">
              {Object.keys(rooms).map((rId, idx) => (
                <button
                  key={rId}
                  onClick={() => {
                    setCurrentRoom(rId);
                    toggleGodMode();
                  }}
                  className="px-3 py-1.5 text-xs border transition-all"
                  style={{
                    backgroundColor:
                      rId === currentRoomId ? theme.buttonBg : "rgba(0,0,0,0.45)",
                    color: rId === currentRoomId ? theme.buttonText : theme.accentText,
                    borderColor: theme.panelBorder,
                  }}
                >
                  Chamber {idx + 1}: {rooms[rId]?.name || rId}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
