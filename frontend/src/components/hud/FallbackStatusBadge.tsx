// classical telemetry status badge without emojis
"use client";

import { useMemo } from "react";
import { resolveAdaptiveTheme, useWorldStore } from "@/store/useWorldStore";

export function FallbackStatusBadge() {
  const { lastTelemetry, isOfflineMode, currentRoomId, rooms, worldTitle } = useWorldStore();
  const activeRoom = rooms[currentRoomId];
  const theme = resolveAdaptiveTheme(activeRoom?.biome_type, activeRoom?.name, worldTitle);

  const isForceCache = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("force_cache") === "true";
  }, []);

  const effectiveProvider =
    isForceCache || isOfflineMode
      ? "offline_mock"
      : lastTelemetry?.provider || "gemini_flash";
  const latency = lastTelemetry?.latency_ms ?? 0.1;

  const providerLabel =
    effectiveProvider === "nemotron_70b"
      ? "Tier I: Nemotron 70B"
      : effectiveProvider === "gemini_flash"
      ? "Live Synthesis: Gemini Flash"
      : "Archive Catalog";

  return (
    <div
      className="flex items-center space-x-2 px-3 py-1 border text-xs uppercase tracking-widest"
      style={{
        backgroundColor: theme.panelBg,
        borderColor: `${theme.panelBorder}88`,
        color: theme.accentText,
      }}
    >
      <span
        className="w-1.5 h-1.5"
        style={{ backgroundColor: theme.accentColor }}
      />
      <span className="font-bold">{providerLabel}</span>
      <span className="italic opacity-80">({latency.toFixed(0)}ms)</span>
    </div>
  );
}
