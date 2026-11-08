// classical atmosphere lighting and relief depth control panel
"use client";

import { resolveAdaptiveTheme, useWorldStore } from "@/store/useWorldStore";

export function MutationControls() {
  const { currentRoomId, rooms, worldTitle, setMutationLevel } = useWorldStore();
  const currentRoom = rooms[currentRoomId];
  const mutationLevel = currentRoom?.mutation_level ?? 0.0;
  const theme = resolveAdaptiveTheme(currentRoom?.biome_type, currentRoom?.name, worldTitle);

  const handleChange = (val: number) => {
    setMutationLevel(currentRoomId, val);
  };

  return (
    <div
      className="p-3 border shadow-2xl pointer-events-auto flex flex-col gap-2 w-60 select-none"
      style={{
        backgroundColor: theme.panelBg,
        borderColor: theme.panelBorder,
      }}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em]">
        <span className="font-bold" style={{ color: theme.accentColor }}>
          Solar & Patina Relief
        </span>
        <span className="italic" style={{ color: theme.mutedText }}>
          {(mutationLevel * 100).toFixed(0)}%
        </span>
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

      <div className="flex justify-between gap-1 mt-0.5">
        {[
          { label: "I. Meridian", val: 0.0 },
          { label: "II. Golden Hour", val: 0.5 },
          { label: "III. Antiquity", val: 1.0 },
        ].map((preset) => (
          <button
            key={preset.label}
            onClick={() => handleChange(preset.val)}
            className="px-2 py-0.5 text-[11px] border transition-all"
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
