// telemetry status pill displaying active model tier and turnaround latency
"use client";

import { useMemo } from "react";
import { useWorldStore } from "@/store/useWorldStore";

export function FallbackStatusBadge() {
  const { lastTelemetry, isOfflineMode } = useWorldStore();

  // check query string for forced cache mode
  const isForceCache = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("force_cache") === "true";
  }, []);

  const effectiveProvider = isForceCache || isOfflineMode ? "offline_mock" : lastTelemetry?.provider || "offline_mock";
  const latency = lastTelemetry?.latency_ms ?? 0.1;

  if (isForceCache) {
    return (
      <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-200 text-xs shadow-lg shadow-cyan-950/50">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="font-semibold tracking-wide">⚡ Instant Preset Loaded</span>
        <span className="font-mono text-neutral-400 text-[10px]">(&lt;1ms)</span>
      </div>
    );
  }

  if (effectiveProvider === "nemotron_70b") {
    return (
      <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-400/40 text-emerald-200 text-xs shadow-lg shadow-emerald-950/50">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="font-semibold">⚡ NVIDIA NIM: Nemotron 70B</span>
        <span className="font-mono text-emerald-300 text-[10px]">({latency.toFixed(1)}ms)</span>
      </div>
    );
  }

  if (effectiveProvider === "gemini_flash") {
    return (
      <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-400/40 text-amber-200 text-xs shadow-lg shadow-amber-950/50">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="font-semibold">⚠️ Gemini 3.8 Flash Fallback</span>
        <span className="font-mono text-amber-300 text-[10px]">({latency.toFixed(1)}ms)</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-neutral-900/80 border border-white/20 text-neutral-300 text-xs">
      <span className="w-2 h-2 rounded-full bg-neutral-400" />
      <span className="font-semibold">⚪ Target 1B Offline Mock</span>
      <span className="font-mono text-neutral-400 text-[10px]">(&lt;1ms)</span>
    </div>
  );
}
