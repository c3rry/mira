// 2d topological minimap graph displaying active room connections and moving npc pins
"use client";

import { useMemo, useState } from "react";
import { useWorldStore } from "@/store/useWorldStore";

interface NodePosition {
  x: number;
  y: number;
  roomId: string;
  name: string;
}

export function MinimapTopology() {
  const { currentRoomId, rooms, npcs, setCurrentRoom } = useWorldStore();
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

  const roomIds = useMemo(() => Object.keys(rooms), [rooms]);

  // compute radial layout positions for all rooms on 2d canvas
  const nodePositions = useMemo(() => {
    const total = roomIds.length;
    if (total === 0) return {};

    const center = { x: 100, y: 100 };
    const radius = 65;
    const positions: Record<string, NodePosition> = {};

    roomIds.forEach((id, index) => {
      if (total === 1) {
        positions[id] = { x: center.x, y: center.y, roomId: id, name: rooms[id]?.name || id };
        return;
      }
      const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
      positions[id] = {
        x: Math.round(center.x + radius * Math.cos(angle)),
        y: Math.round(center.y + radius * Math.sin(angle)),
        roomId: id,
        name: rooms[id]?.name || id,
      };
    });

    return positions;
  }, [roomIds, rooms]);

  // compute unique graph edges between rooms
  const edges = useMemo(() => {
    const renderedEdges: Array<{ from: NodePosition; to: NodePosition; key: string }> = [];
    const edgeSet = new Set<string>();

    roomIds.forEach((fromId) => {
      const room = rooms[fromId];
      if (!room) return;
      const adjs = room.adjacent_room_ids || [];

      adjs.forEach((toId) => {
        const p1 = nodePositions[fromId];
        const p2 = nodePositions[toId];
        if (!p1 || !p2) return;

        const pairKey = [fromId, toId].sort().join("<->");
        if (!edgeSet.has(pairKey)) {
          edgeSet.add(pairKey);
          renderedEdges.push({ from: p1, to: p2, key: pairKey });
        }
      });
    });

    return renderedEdges;
  }, [roomIds, rooms, nodePositions]);

  // group npcs by room
  const npcsByRoom = useMemo(() => {
    const map: Record<string, string[]> = {};
    Object.values(npcs).forEach((npc) => {
      if (!map[npc.room_id]) map[npc.room_id] = [];
      map[npc.room_id].push(npc.name);
    });
    return map;
  }, [npcs]);

  return (
    <div className="relative w-52 h-52 bg-black/75 backdrop-blur-md rounded-2xl border border-white/10 p-2 shadow-2xl select-none">
      <div className="absolute top-2 left-3 text-[10px] font-mono tracking-wider text-neutral-400">
        MINIMAP TOPOLOGY
      </div>

      <svg className="w-full h-full" viewBox="0 0 200 200">
        {/* render adjacency edges */}
        {edges.map((edge) => (
          <line
            key={edge.key}
            x1={edge.from.x}
            y1={edge.from.y}
            x2={edge.to.x}
            y2={edge.to.y}
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeOpacity="0.4"
            strokeDasharray="3 3"
          />
        ))}

        {/* render room nodes */}
        {Object.entries(nodePositions).map(([rId, pos]) => {
          const isCurrent = rId === currentRoomId;
          const isHovered = hoveredRoom === rId;
          const occupants = npcsByRoom[rId] || [];

          return (
            <g
              key={rId}
              className="cursor-pointer transition-transform"
              onClick={() => setCurrentRoom(rId)}
              onMouseEnter={() => setHoveredRoom(rId)}
              onMouseLeave={() => setHoveredRoom(null)}
            >
              {/* active player room pulse ring */}
              {isCurrent && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="14"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="1.5"
                  className="animate-ping"
                  opacity="0.6"
                />
              )}

              {/* room node circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isCurrent ? "9" : "7"}
                fill={isCurrent ? "#06b6d4" : isHovered ? "#38bdf8" : "#1e293b"}
                stroke={isCurrent ? "#67e8f9" : "#475569"}
                strokeWidth={isCurrent ? "2" : "1"}
              />

              {/* npc occupant indicator dots */}
              {occupants.map((_, i) => (
                <circle
                  key={i}
                  cx={pos.x + 8 + i * 4}
                  cy={pos.y - 6}
                  r="2.5"
                  fill="#f43f5e"
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* room tooltip label on hover */}
      {hoveredRoom && (
        <div className="absolute bottom-2 left-2 right-2 px-2 py-1 bg-black/90 border border-cyan-500/40 rounded text-center text-[10px] font-mono text-cyan-300 truncate">
          {rooms[hoveredRoom]?.name || hoveredRoom}
          {npcsByRoom[hoveredRoom]?.length ? ` (${npcsByRoom[hoveredRoom].join(", ")})` : ""}
        </div>
      )}
    </div>
  );
}
