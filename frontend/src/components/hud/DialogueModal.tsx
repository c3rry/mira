// interactive npc dialogue modal with 4-phase cognitive thought inspection
"use client";

import { useState } from "react";
import { useWorldStore } from "@/store/useWorldStore";

interface MessageEntry {
  sender: "player" | "npc";
  text: string;
  thoughtLog?: string;
  timestamp: string;
}

export function DialogueModal() {
  const {
    selectedNpcId,
    npcs,
    currentRoomId,
    selectNPC,
    simulatedProvider,
    setLastTelemetry,
    appendThoughtLog,
  } = useWorldStore();

  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [activeThoughtView, setActiveThoughtView] = useState<string | null>(null);

  const selectedNpc = selectedNpcId ? npcs[selectedNpcId] : null;

  if (!selectedNpc) {
    return null;
  }

  // parse 4-phase cognitive trace into structured segments
  const parseCognitivePhases = (log: string) => {
    const memoryMatch = log.match(/\[MEMORY\]([\s\S]*?)(?=\[REFLECTION\]|\[PLANNING\]|\[ACTION\]|$)/);
    const reflectionMatch = log.match(/\[REFLECTION\]([\s\S]*?)(?=\[PLANNING\]|\[ACTION\]|$)/);
    const planningMatch = log.match(/\[PLANNING\]([\s\S]*?)(?=\[ACTION\]|$)/);
    const actionMatch = log.match(/\[ACTION\]([\s\S]*?)$/);

    return {
      memory: memoryMatch ? memoryMatch[1].trim() : null,
      reflection: reflectionMatch ? reflectionMatch[1].trim() : null,
      planning: planningMatch ? planningMatch[1].trim() : null,
      action: actionMatch ? actionMatch[1].trim() : null,
      raw: log,
    };
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || isLoading) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userEntry: MessageEntry = {
      sender: "player",
      text: textToSend,
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, userEntry]);
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
        const npcEntry: MessageEntry = {
          sender: "npc",
          text: data.utterance,
          thoughtLog: data.thought_log,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, npcEntry]);
        setActiveThoughtView(data.thought_log);

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

  const quickPrompts = [
    "Who are you and what is your role here?",
    "What secrets does this sector hold?",
    "How do we unlock the terminal keys?",
  ];

  const currentThoughtPhases = activeThoughtView
    ? parseCognitivePhases(activeThoughtView)
    : selectedNpc.thought_log && selectedNpc.thought_log.length > 0
    ? parseCognitivePhases(selectedNpc.thought_log[selectedNpc.thought_log.length - 1])
    : null;

  return (
    <div className="absolute top-16 right-6 z-30 w-96 bg-black/85 backdrop-blur-xl border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-200">
      {/* modal header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-950/80 to-black/80 border-b border-cyan-500/30">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 font-bold text-sm shadow-inner">
            {selectedNpc.name.slice(0, 1)}
          </div>
          <div>
            <h3 className="text-sm font-bold text-cyan-300 leading-tight">{selectedNpc.name}</h3>
            <span className="text-[10px] text-neutral-400 font-mono">
              HP {selectedNpc.hp}/100 • {selectedNpc.room_id}
            </span>
          </div>
        </div>

        <button
          onClick={() => selectNPC(null)}
          className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          title="Close dialogue"
        >
          ✕
        </button>
      </div>

      {/* persona description banner */}
      <div className="px-4 py-2 bg-black/40 border-b border-white/5 text-[11px] text-neutral-300 italic">
        &ldquo;{selectedNpc.persona_description}&rdquo;
      </div>

      {/* dialogue conversation history */}
      <div className="flex-1 p-4 overflow-y-auto max-h-56 space-y-3 font-sans text-xs">
        {messages.length === 0 ? (
          <div className="text-center py-6 text-neutral-500 italic">
            Initiate communication with {selectedNpc.name}...
          </div>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                m.sender === "player" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  m.sender === "player"
                    ? "bg-cyan-600 text-white rounded-br-none shadow-md shadow-cyan-900/30"
                    : "bg-neutral-800/90 text-neutral-200 border border-white/10 rounded-bl-none"
                }`}
              >
                <p>{m.text}</p>
                <div className="text-[9px] text-white/50 text-right mt-1 font-mono">
                  {m.timestamp}
                </div>
              </div>

              {/* clickable thought trace pill for npc utterances */}
              {m.thoughtLog && (
                <button
                  onClick={() => setActiveThoughtView(m.thoughtLog!)}
                  className="mt-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center space-x-1"
                >
                  <span>🧠 Inspect Cognitive Thought</span>
                </button>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center space-x-2 text-cyan-400 text-xs italic">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Formulating cognitive response...</span>
          </div>
        )}
      </div>

      {/* 4-phase cognitive thought inspection drawer */}
      {currentThoughtPhases && (
        <div className="px-4 py-3 bg-cyan-950/40 border-t border-cyan-500/30 text-[11px] font-mono">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-cyan-300 flex items-center space-x-1.5">
              <span>🧠 Nemotron Cognitive Loop</span>
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded bg-cyan-900/80 text-cyan-200 border border-cyan-500/30">
              4-Phase
            </span>
          </div>

          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {currentThoughtPhases.memory && (
              <div className="bg-black/50 p-1.5 rounded border border-white/5">
                <span className="text-amber-400 font-semibold">[MEMORY]</span>{" "}
                <span className="text-neutral-300">{currentThoughtPhases.memory}</span>
              </div>
            )}
            {currentThoughtPhases.reflection && (
              <div className="bg-black/50 p-1.5 rounded border border-white/5">
                <span className="text-purple-400 font-semibold">[REFLECTION]</span>{" "}
                <span className="text-neutral-300">{currentThoughtPhases.reflection}</span>
              </div>
            )}
            {currentThoughtPhases.planning && (
              <div className="bg-black/50 p-1.5 rounded border border-white/5">
                <span className="text-emerald-400 font-semibold">[PLANNING]</span>{" "}
                <span className="text-neutral-300">{currentThoughtPhases.planning}</span>
              </div>
            )}
            {currentThoughtPhases.action && (
              <div className="bg-black/50 p-1.5 rounded border border-white/5">
                <span className="text-cyan-400 font-semibold">[ACTION]</span>{" "}
                <span className="text-neutral-300">{currentThoughtPhases.action}</span>
              </div>
            )}
            {!currentThoughtPhases.memory && (
              <div className="bg-black/50 p-1.5 rounded text-neutral-400">
                {currentThoughtPhases.raw}
              </div>
            )}
          </div>
        </div>
      )}

      {/* quick suggestion prompts */}
      <div className="px-3 py-2 bg-black/60 border-t border-white/10 flex flex-wrap gap-1.5">
        {quickPrompts.map((q, i) => (
          <button
            key={i}
            disabled={isLoading}
            onClick={() => handleSendMessage(q)}
            className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-cyan-900/40 border border-white/10 hover:border-cyan-500/40 text-neutral-300 hover:text-cyan-200 transition-colors truncate max-w-full"
          >
            {q}
          </button>
        ))}
      </div>

      {/* message input bar */}
      <div className="p-3 bg-black/80 border-t border-cyan-500/30 flex items-center space-x-2">
        <input
          type="text"
          value={inputMessage}
          disabled={isLoading}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSendMessage();
          }}
          placeholder="Speak to character..."
          className="flex-1 px-3 py-1.5 bg-neutral-900/90 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400"
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={isLoading || !inputMessage.trim()}
          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-black font-bold rounded-lg text-xs transition-colors shadow-lg shadow-cyan-600/30"
        >
          Send
        </button>
      </div>
    </div>
  );
}
