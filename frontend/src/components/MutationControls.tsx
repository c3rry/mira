// collapsible atmosphere lighting and relief depth control pill
"use client";

import { useState } from "react";
import { resolveAdaptiveTheme, useWorldStore } from "@/store/useWorldStore";

export function MutationControls() {
  const [expanded, setExpanded] = useState(false);
  const { currentRoomId, rooms, worldTitle, setMutationLevel } = useWorldStore();
  const currentRoom = rooms[currentRoomId];
  const mutationLevel = currentRoom?.mutation_level ?? 0.0;
  const theme = resolveAdaptiveTheme(currentRoom?.biome_type, currentRoom?.name, worldTitle);

  const handleChange = (val: number) => {
    setMutationLevel(currentRoomId, val);
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="px-3 py-1.5 border text-[10px] uppercase tracking-[0.18em] font-bold pointer-events-auto backdrop-blur-md transition-opacity opacity-80 hover:opacity-100 select-none"
        style={{
          backgroundColor: "rgba(10, 10, 12, 0.72)",
          borderColor: `${theme.panelBorder}88`,
          color: theme.accentText,
        }}
      >
        Atmospheric Light ({(mutationLevel * 100).toFixed(0)}%)
      </button>
    );
  }

  return (
    <div
      className="p-2.5 border shadow-xl pointer-events-auto flex flex-col gap-2 w-56 select-none backdrop-blur-md"
      style={{
        backgroundColor: "rgba(10, 10, 12, 0.84)",
        borderColor: `${theme.panelBorder}88`,
      }}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em]">
        <span className="font-bold" style={{ color: theme.accentColor }}>
          Atmosphere & Illumination
        </span>
        <button
          onClick={() => setExpanded(false)}
          className="px-1.5 py-0.5 border text-[9px]"
          style={{ borderColor: `${theme.panelBorder}55`, color: theme.mutedText }}
        >
          Hide
        </button>
      </div>

      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={mutationLevel}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-black/60 appearance-none cursor-pointer"
        style={{ accentColor: theme.accentColor }}
      />

      <div className="flex justify-between gap-1">
        {[
          { label: "I. Meridian", val: 0.0 },
          { label: "II. Golden", val: 0.5 },
          { label: "III. Dusk", val: 1.0 },
        ].map((preset) => (
          <button
            key={preset.label}
            onClick={() => handleChange(preset.val)}
            className="px-1.5 py-0.5 text-[10px] border transition-all flex-1"
            style={{
              backgroundColor:
                Math.abs(mutationLevel - preset.val) < 0.15
                  ? `${theme.accentColor}33`
                  : "rgba(0,0,0,0.35)",
              borderColor:
                Math.abs(mutationLevel - preset.val) < 0.15
                  ? theme.accentColor
                  : `${theme.panelBorder}44`,
              color: theme.accentText,
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
