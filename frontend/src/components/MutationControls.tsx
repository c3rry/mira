// in-situ environment mutation slider driving displacement and atmosphere shaders
"use client";

import { useWorldStore } from "@/store/useWorldStore";

export function MutationControls() {
  const { currentRoomId, rooms, setMutationLevel } = useWorldStore();
  const currentRoom = rooms[currentRoomId];
  const mutationLevel = currentRoom?.mutation_level ?? 0.0;

  const handleChange = (val: number) => {
    setMutationLevel(currentRoomId, val);
  };

  return (
    <div className="bg-black/75 backdrop-blur-md rounded-2xl border border-white/10 p-3 shadow-2xl pointer-events-auto flex flex-col gap-2 w-64 select-none">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-cyan-300 font-semibold tracking-wider">
          ATMOSPHERE RESKIN
        </span>
        <span className="font-mono text-[11px] text-neutral-400">
          {(mutationLevel * 100).toFixed(0)}%
        </span>
      </div>

      {/* continuous mutation factor slider */}
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={mutationLevel}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
      />

      {/* quick preset buttons */}
      <div className="flex justify-between gap-1 mt-0.5">
        <button
          onClick={() => handleChange(0.0)}
          className={`px-2 py-0.5 text-[10px] rounded font-mono transition-all ${
            mutationLevel < 0.1
              ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400/50"
              : "bg-white/5 text-neutral-400 hover:text-white"
          }`}
        >
          Base
        </button>
        <button
          onClick={() => handleChange(0.5)}
          className={`px-2 py-0.5 text-[10px] rounded font-mono transition-all ${
            mutationLevel >= 0.4 && mutationLevel <= 0.6
              ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400/50"
              : "bg-white/5 text-neutral-400 hover:text-white"
          }`}
        >
          Distorted
        </button>
        <button
          onClick={() => handleChange(1.0)}
          className={`px-2 py-0.5 text-[10px] rounded font-mono transition-all ${
            mutationLevel > 0.9
              ? "bg-purple-500/30 text-purple-200 border border-purple-400/50"
              : "bg-white/5 text-neutral-400 hover:text-white"
          }`}
        >
          Overgrowth
        </button>
      </div>
    </div>
  );
}
