// cinematic bottom-screen movie subtitle overlay and character dialogue bar
"use client";

import { useState } from "react";
import { resolveAdaptiveTheme, useWorldStore } from "@/store/useWorldStore";

export function DialogueModal() {
  const {
    selectedNpcId,
    npcs,
    currentRoomId,
    rooms,
    worldTitle,
    selectNPC,
    simulatedProvider,
    setLastTelemetry,
    appendThoughtLog,
    activeSubtitle,
    setActiveSubtitle,
  } = useWorldStore();

  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCognitiveTrace, setShowCognitiveTrace] = useState(false);

  const activeRoom = rooms[currentRoomId];
  const theme = resolveAdaptiveTheme(activeRoom?.biome_type, activeRoom?.name, worldTitle);

  // resolve active npc from selection or current room resident
  const roomNpcs = Object.values(npcs).filter((n) => n.room_id === currentRoomId);
  const selectedNpc = (selectedNpcId && npcs[selectedNpcId]) || roomNpcs[0] || null;

  if (!selectedNpc && !activeSubtitle) {
    return null;
  }

  const speakerName = activeSubtitle?.speaker || selectedNpc?.name || "Chronicler";
  const subtitleText =
    activeSubtitle?.text ||
    (selectedNpc
      ? `Welcome to ${activeRoom?.name || "this chamber"}. ${selectedNpc.persona_description}`
      : "");
  const thoughtTrace =
    activeSubtitle?.thoughtLog ||
    (selectedNpc?.thought_log && selectedNpc.thought_log.length > 0
      ? selectedNpc.thought_log[selectedNpc.thought_log.length - 1]
      : null);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || isLoading || !selectedNpc) return;

    setInputMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/npc/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npc_id: selectedNpc.npc_id,
          player_message: textToSend,
          room_id: currentRoomId,
          simulate_provider: simulatedProvider || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveSubtitle({
          npcId: selectedNpc.npc_id,
          speaker: selectedNpc.name,
          persona: selectedNpc.persona_description,
          text: data.utterance,
          thoughtLog: data.thought_log,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });

        if (data.thought_log) {
          appendThoughtLog(selectedNpc.npc_id, data.thought_log);
        }
        if (data.telemetry) {
          setLastTelemetry(data.telemetry);
        }
      }
    } catch (err) {
      console.warn("dialogue interaction failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const quickInquiries = [
    { numeral: "I", text: "Speak of the history and architecture of this place." },
    { numeral: "II", text: "What task or mystery lies before us here?" },
    { numeral: "III", text: "Where do the adjacent passages lead?" },
  ];

  return (
    <div className="fixed bottom-16 left-0 right-0 z-30 flex flex-col items-center px-6 pointer-events-none select-none">
      {/* cinematic movie subtitle display */}
      <div className="max-w-3xl w-full text-center mb-3 pointer-events-auto">
        <div className="inline-block px-6 py-3 bg-black/75 backdrop-blur-sm border-t border-b border-white/15">
          <div
            className="text-xs uppercase tracking-[0.25em] font-bold mb-1 subtitle-shadow"
            style={{ color: theme.accentColor }}
          >
            {speakerName}
          </div>
          <p className="text-lg sm:text-xl leading-relaxed text-[#fdf8ed] italic subtitle-shadow">
            &ldquo;{isLoading ? "Contemplating your words..." : subtitleText}&rdquo;
          </p>
        </div>
      </div>

      {/* compact classical response & inquiry bar */}
      {selectedNpc && (
        <div
          className="max-w-2xl w-full px-4 py-2.5 border pointer-events-auto flex flex-col gap-2"
          style={{
            backgroundColor: theme.panelBg,
            borderColor: theme.panelBorder,
          }}
        >
          {/* roman numeral quick inquiries */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-1.5" style={{ borderColor: `${theme.panelBorder}44` }}>
            <div className="flex flex-wrap gap-3">
              {quickInquiries.map((q) => (
                <button
                  key={q.numeral}
                  disabled={isLoading}
                  onClick={() => handleSendMessage(q.text)}
                  className="text-xs hover:underline transition-opacity disabled:opacity-40 text-left"
                  style={{ color: theme.accentText }}
                >
                  <span className="font-bold mr-1" style={{ color: theme.accentColor }}>
                    {q.numeral}.
                  </span>
                  <span>{q.text}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-3">
              {roomNpcs.length > 1 && (
                <button
                  onClick={() => {
                    const idx = roomNpcs.findIndex((n) => n.npc_id === selectedNpc.npc_id);
                    const nextNpc = roomNpcs[(idx + 1) % roomNpcs.length];
                    selectNPC(nextNpc.npc_id);
                  }}
                  className="text-[11px] uppercase tracking-wider underline"
                  style={{ color: theme.accentColor }}
                >
                  Switch Companion
                </button>
              )}
            </div>
          </div>

          {/* direct speech input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              disabled={isLoading}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendMessage();
              }}
              placeholder={`Address ${selectedNpc.name}...`}
              className="flex-1 px-3 py-1 bg-black/50 border text-sm text-[#fdf6e2] placeholder-neutral-500 focus:outline-none"
              style={{ borderColor: `${theme.panelBorder}66` }}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputMessage.trim()}
              className="px-4 py-1 text-xs uppercase tracking-[0.18em] font-bold border transition-opacity disabled:opacity-40"
              style={{
                backgroundColor: theme.buttonBg,
                color: theme.buttonText,
                borderColor: theme.panelBorder,
              }}
            >
              Speak
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
