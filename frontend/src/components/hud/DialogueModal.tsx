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

  const activeRoom = rooms[currentRoomId];
  const theme = resolveAdaptiveTheme(activeRoom?.biome_type, activeRoom?.name, worldTitle);

  // only show dialogue modal when an NPC is explicitly clicked/selected by the user
  const roomNpcs = Object.values(npcs).filter((n) => n.room_id === currentRoomId);
  const selectedNpc = (selectedNpcId && npcs[selectedNpcId]) || null;

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
      const backendOrigin =
        typeof window !== "undefined" && window.location.port === "3000"
          ? `${window.location.protocol}//${window.location.hostname}:8001`
          : "";
      const res = await fetch(`${backendOrigin}/npc/interact`, {
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
    <div className="fixed bottom-12 left-0 right-0 z-30 flex flex-col items-center px-4 pointer-events-none select-none">
      {/* compact cinematic subtitle & dialogue bar */}
      <div
        className="max-w-xl w-full px-4 py-2.5 border pointer-events-auto flex flex-col gap-2 backdrop-blur-md shadow-xl"
        style={{
          backgroundColor: "rgba(10, 10, 12, 0.84)",
          borderColor: `${theme.panelBorder}88`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div
              className="text-[10px] uppercase tracking-[0.22em] font-bold mb-0.5"
              style={{ color: theme.accentColor }}
            >
              {speakerName}
            </div>
            <p className="text-sm leading-snug text-[#fdf8ed] italic">
              &ldquo;{isLoading ? "Contemplating your words..." : subtitleText}&rdquo;
            </p>
          </div>

          <button
            onClick={() => selectNPC(null)}
            className="text-[10px] uppercase tracking-wider px-2 py-0.5 border opacity-75 hover:opacity-100 shrink-0"
            style={{ borderColor: `${theme.panelBorder}66`, color: theme.mutedText }}
          >
            Dismiss [Esc]
          </button>
        </div>

        {selectedNpc && (
          <>
            <div
              className="flex flex-wrap items-center justify-between gap-1.5 border-t pt-1.5"
              style={{ borderColor: `${theme.panelBorder}33` }}
            >
              <div className="flex flex-wrap gap-2.5">
                {quickInquiries.map((q) => (
                  <button
                    key={q.numeral}
                    disabled={isLoading}
                    onClick={() => handleSendMessage(q.text)}
                    className="text-[11px] hover:underline transition-opacity disabled:opacity-40 text-left"
                    style={{ color: theme.accentText }}
                  >
                    <span className="font-bold mr-1" style={{ color: theme.accentColor }}>
                      {q.numeral}.
                    </span>
                    <span>{q.text}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={inputMessage}
                disabled={isLoading}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                  if (e.key === "Escape") selectNPC(null);
                }}
                placeholder={`Address ${selectedNpc.name}...`}
                className="flex-1 px-2.5 py-1 bg-black/55 border text-xs text-[#fdf6e2] placeholder-neutral-500 focus:outline-none"
                style={{ borderColor: `${theme.panelBorder}55` }}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputMessage.trim()}
                className="px-3 py-1 text-[11px] uppercase tracking-[0.16em] font-bold border transition-opacity disabled:opacity-40"
                style={{
                  backgroundColor: theme.buttonBg,
                  color: theme.buttonText,
                  borderColor: theme.panelBorder,
                }}
              >
                Speak
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
