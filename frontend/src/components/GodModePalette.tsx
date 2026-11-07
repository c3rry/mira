// god mode developer and judge telemetry drawer with provider simulation override
"use client";

import { useEffect } from "react";
import { useWorldStore } from "@/store/useWorldStore";

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
    isOfflineMode,
  } = useWorldStore();

  // global key listener for keyg shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ignore when typing in input or textarea
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
    label: string;
    desc: string;
    badge: string;
    badgeColor: string;
  }> = [
    {
      id: null,
      label: "Autonomous 3-Tier Cascade",
      desc: "NVIDIA NIM (4.5s) → Gemini Flash (1.0s) → Offline Mock",
      badge: "LIVE CASCADE",
      badgeColor: "bg-cyan-950 text-cyan-300 border-cyan-500/40",
    },
    {
      id: "nemotron_70b",
      label: "Force Tier 1: NVIDIA NIM",
      desc: "nvidia/llama-3.1-nemotron-70b-instruct cloud inference",
      badge: "TIER 1",
      badgeColor: "bg-emerald-950 text-emerald-300 border-emerald-500/40",
    },
    {
      id: "gemini_flash",
      label: "Force Tier 2: Gemini 3.8 Flash",
      desc: "Simulate NIM circuit-breaker trip to Gemini Flash fallback",
      badge: "TIER 2",
      badgeColor: "bg-amber-950 text-amber-300 border-amber-500/40",
    },
    {
      id: "offline_mock",
      label: "Force Tier 3: Offline Mock",
      desc: "Zero-network in-memory static persona catalog (<1ms)",
      badge: "TIER 3",
      badgeColor: "bg-neutral-800 text-neutral-300 border-neutral-600",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 pointer-events-auto">
      <div className="w-full max-w-2xl bg-neutral-950/95 border border-cyan-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans animate-in fade-in zoom-in-95 duration-200">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-cyan-950/90 via-black to-purple-950/90 border-b border-cyan-500/30">
          <div className="flex items-center space-x-3">
            <span className="text-xl">🛠️</span>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                GOD MODE ARCHITECT DRAWER
              </h2>
              <p className="text-xs text-cyan-400 font-mono">
                Simulation Override & Diagnostic Telemetry (Press &lsquo;G&rsquo; to toggle)
              </p>
            </div>
          </div>
          <button
            onClick={toggleGodMode}
            className="text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 font-mono text-sm"
          >
            ✕ Close
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* section 1: ai inference provider override */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center space-x-2">
              <span>⚡ Inference Cascade Controller</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {providerOptions.map((opt) => (
                <button
                  key={String(opt.id)}
                  onClick={() => setSimulatedProvider(opt.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    simulatedProvider === opt.id
                      ? "bg-cyan-950/70 border-cyan-400 ring-1 ring-cyan-400/50 shadow-lg shadow-cyan-950/50"
                      : "bg-neutral-900/60 border-white/10 hover:border-white/20 hover:bg-neutral-900"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">{opt.label}</span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-mono border ${opt.badgeColor}`}
                    >
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* section 2: live telemetry telemetry inspection */}
          <div className="bg-black/60 p-4 rounded-xl border border-white/10 font-mono text-xs">
            <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2 flex items-center space-x-2">
              <span>📊 Real-Time Diagnostic Telemetry</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
              <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-white/5">
                <span className="text-[10px] text-neutral-400 block mb-1">Active Provider</span>
                <span className="font-bold text-cyan-300">
                  {lastTelemetry?.provider || "offline_mock"}
                </span>
              </div>

              <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-white/5">
                <span className="text-[10px] text-neutral-400 block mb-1">Latency</span>
                <span className="font-bold text-emerald-400">
                  {lastTelemetry ? `${lastTelemetry.latency_ms.toFixed(1)}ms` : "0.0ms"}
                </span>
              </div>

              <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-white/5">
                <span className="text-[10px] text-neutral-400 block mb-1">Fallback Tripped</span>
                <span
                  className={`font-bold ${
                    lastTelemetry?.fallback_occurred ? "text-amber-400" : "text-neutral-400"
                  }`}
                >
                  {lastTelemetry?.fallback_occurred ? "YES (Tripped)" : "NO (Direct)"}
                </span>
              </div>

              <div className="bg-neutral-900/80 p-2.5 rounded-lg border border-white/5">
                <span className="text-[10px] text-neutral-400 block mb-1">Network Mode</span>
                <span className="font-bold text-purple-300">
                  {isOfflineMode ? "OFFLINE CACHE" : "LIVE NETWORK"}
                </span>
              </div>
            </div>

            {lastTelemetry?.fallback_reason && (
              <div className="mt-3 text-[11px] text-amber-300/90 bg-amber-950/30 p-2 rounded border border-amber-500/30">
                <span className="font-bold">Circuit Breaker Reason:</span>{" "}
                {lastTelemetry.fallback_reason}
              </div>
            )}
          </div>

          {/* section 3: instant room teleporter */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center space-x-2">
              <span>🚀 Instant Room Teleporter</span>
            </h3>

            <div className="flex flex-wrap gap-2">
              {Object.keys(rooms).map((rId) => (
                <button
                  key={rId}
                  onClick={() => setCurrentRoom(rId)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-mono transition-all ${
                    rId === currentRoomId
                      ? "bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/30"
                      : "bg-neutral-900 border border-white/10 text-neutral-300 hover:border-cyan-500/50 hover:text-white"
                  }`}
                >
                  {rooms[rId]?.name || rId}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="px-6 py-3 bg-neutral-900/80 border-t border-white/10 flex items-center justify-between text-xs text-neutral-400 font-mono">
          <span>HackUTD 2026: Zero Day • Target 1B + Target 2 Parity</span>
          <span className="text-cyan-400">All Systems Operational</span>
        </div>
      </div>
    </div>
  );
}
