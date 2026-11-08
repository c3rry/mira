// precise top-down architectural & spatial floorplan radar with live multi-room player tracking
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { resolveAdaptiveTheme, useWorldStore } from "@/store/useWorldStore";
import { isNaturalBiomeContext } from "@/canvas/environment/ReflectiveFloorGrid";

export function MinimapTopology() {
  const [expanded, setExpanded] = useState(false);
  const {
    currentRoomId,
    rooms,
    npcs,
    worldTitle,
    playerPosition,
    setCurrentRoom,
    selectNPC,
  } = useWorldStore();
  const [, startTransition] = useTransition();

  const roomIds = Object.keys(rooms);
  const activeRoom = rooms[currentRoomId];
  const theme = resolveAdaptiveTheme(activeRoom?.biome_type, activeRoom?.name, worldTitle);

  const isNature = useMemo(() => {
    const ctx = `${worldTitle || ""} ${activeRoom?.name || ""} ${activeRoom?.biome_type || ""}`;
    return isNaturalBiomeContext(ctx);
  }, [worldTitle, activeRoom]);

  // toggle expanded top-down blueprint map with 'M' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return;
      }
      if (e.key === "m" || e.key === "M") {
        setExpanded((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // map 3D world coordinates (worldX, worldZ) to precise SVG top-down coordinates
  const spatialLayout = useMemo(() => {
    const list = Object.values(rooms);
    if (list.length === 0) {
      return {
        toSvgX: (wx: number) => 150 + wx * 0.38,
        toSvgY: (wz: number) => 150 + wz * 0.38,
        scale: 0.38,
      };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    list.forEach((r) => {
      const rx = r.worldX || 0;
      const rz = r.worldZ || 0;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (rz < minZ) minZ = rz;
      if (rz > maxZ) maxZ = rz;
    });
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxZ - minZ, 220) + 210;
    const scale = 250 / span;

    return {
      toSvgX: (wx: number) => 150 + (wx - centerX) * scale,
      toSvgY: (wz: number) => 150 + (wz - centerZ) * scale,
      scale,
    };
  }, [rooms]);

  // build exact connecting corridor segments between adjacent rooms
  const corridorEdges = useMemo(() => {
    const edges: Array<{
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      distMeters: number;
    }> = [];
    const seen = new Set<string>();

    roomIds.forEach((idA) => {
      const rA = rooms[idA];
      if (!rA) return;
      (rA.adjacent_room_ids || []).forEach((idB) => {
        const rB = rooms[idB];
        if (!rB) return;
        const pairKey = [idA, idB].sort().join("::");
        if (seen.has(pairKey)) return;
        seen.add(pairKey);

        const ax = rA.worldX || 0;
        const az = rA.worldZ || 0;
        const bx = rB.worldX || 0;
        const bz = rB.worldZ || 0;
        // match the 3d world: only direct neighbors get a physical corridor
        if (Math.hypot(bx - ax, bz - az) > 260) return;

        edges.push({
          key: pairKey,
          x1: spatialLayout.toSvgX(ax),
          y1: spatialLayout.toSvgY(az),
          x2: spatialLayout.toSvgX(bx),
          y2: spatialLayout.toSvgY(bz),
          distMeters: Math.round(Math.hypot(bx - ax, bz - az)),
        });
      });
    });
    return edges;
  }, [roomIds, rooms, spatialLayout]);

  if (roomIds.length === 0) {
    return null;
  }

  const playerSvgX = spatialLayout.toSvgX(playerPosition.x);
  const playerSvgY = spatialLayout.toSvgY(playerPosition.z);
  const playerYawDeg = (playerPosition.yaw * 180) / Math.PI;
  const roomRadiusSvg = Math.max(28, 95 * spatialLayout.scale);
  const corridorWidthSvg = Math.max(10, 28 * spatialLayout.scale);

  return (
    <div
      className={`border shadow-2xl transition-all duration-200 flex flex-col justify-between select-none relative overflow-hidden backdrop-blur-md ${
        expanded ? "w-[440px] h-[440px] p-3" : "w-56 h-56 p-2"
      }`}
      style={{
        backgroundColor: "rgba(8, 11, 16, 0.86)",
        borderColor: `${theme.panelBorder}99`,
      }}
    >
      {/* top CAD / radar header */}
      <div className="flex items-center justify-between z-10 pointer-events-none">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.16em] px-1.5 py-0.5 border bg-black/80"
          style={{ borderColor: `${theme.panelBorder}66`, color: theme.accentColor }}
        >
          {isNature ? "TOPO SURVEY" : "FLOORPLAN CAD"} ({Math.round(playerPosition.x)}, {Math.round(playerPosition.z)})
        </span>
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border bg-black/80 pointer-events-auto hover:opacity-90"
          style={{ borderColor: `${theme.panelBorder}66`, color: theme.accentText }}
        >
          {expanded ? "Compact [M]" : "Expand [M]"}
        </button>
      </div>

      {/* precise top-down architectural / topographical SVG viewport */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 300 300" className="w-full h-full">
          <defs>
            <pattern id="cadGridMinor" width="15" height="15" patternUnits="userSpaceOnUse">
              <path
                d="M 15 0 L 0 0 0 15"
                fill="none"
                stroke={theme.accentColor}
                strokeOpacity="0.08"
                strokeWidth="0.5"
              />
            </pattern>
            <pattern id="cadGridMajor" width="60" height="60" patternUnits="userSpaceOnUse">
              <rect width="60" height="60" fill="url(#cadGridMinor)" />
              <path
                d="M 60 0 L 0 0 0 60"
                fill="none"
                stroke={theme.accentColor}
                strokeOpacity="0.18"
                strokeWidth="0.8"
              />
            </pattern>
            <linearGradient id="fovConeGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor={theme.accentColor} stopOpacity="0.55" />
              <stop offset="100%" stopColor={theme.accentColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* background precision grid */}
          <rect x="0" y="0" width="300" height="300" fill="#070a0f" />
          <rect x="0" y="0" width="300" height="300" fill="url(#cadGridMajor)" />

          {/* cardinal compass crosshairs */}
          <line x1="150" y1="8" x2="150" y2="292" stroke={theme.accentColor} strokeOpacity="0.12" strokeDasharray="2 3" />
          <line x1="8" y1="150" x2="292" y2="150" stroke={theme.accentColor} strokeOpacity="0.12" strokeDasharray="2 3" />
          <text x="150" y="16" textAnchor="middle" fill={theme.accentColor} fontSize="7" opacity="0.6" fontWeight="bold">
            N
          </text>

          {/* 1. physical walkable corridors / causeway bridges between connected rooms */}
          {corridorEdges.map((edge) => (
            <g key={edge.key}>
              {/* outer corridor walls / trail boundaries */}
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke={theme.panelBorder}
                strokeWidth={corridorWidthSvg + 2.5}
                strokeLinecap="butt"
                opacity="0.65"
              />
              {/* inner walkable corridor floor */}
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke="#111827"
                strokeWidth={corridorWidthSvg}
                strokeLinecap="butt"
              />
              {/* centerline navigation guide */}
              <line
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke={theme.accentColor}
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.55"
              />
            </g>
          ))}

          {/* 2. exact top-down room footprints (architectural octagon/chamber vs natural topo contours) */}
          {roomIds.map((rId, idx) => {
            const room = rooms[rId];
            if (!room) return null;
            const cx = spatialLayout.toSvgX(room.worldX || 0);
            const cy = spatialLayout.toSvgY(room.worldZ || 0);
            const isCurrent = rId === currentRoomId;
            const roomNpcs = Object.values(npcs).filter((n) => n.room_id === rId);
            const roomProps = room.props || [];

            // generate octagonal architectural chamber vertices
            const octPoints = Array.from({ length: 8 })
              .map((_, k) => {
                const ang = (k * Math.PI) / 4 + Math.PI / 8;
                const px = cx + roomRadiusSvg * Math.cos(ang);
                const py = cy + roomRadiusSvg * Math.sin(ang);
                return `${px.toFixed(1)},${py.toFixed(1)}`;
              })
              .join(" ");

            return (
              <g
                key={rId}
                className="cursor-pointer"
                onClick={() => {
                  startTransition(() => {
                    setCurrentRoom(rId);
                  });
                }}
              >
                {isNature ? (
                  <>
                    {/* natural topographical elevation contour rings */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={roomRadiusSvg}
                      fill={isCurrent ? `${theme.accentColor}22` : "rgba(15, 23, 42, 0.85)"}
                      stroke={isCurrent ? theme.accentColor : theme.panelBorder}
                      strokeWidth={isCurrent ? "2" : "1.2"}
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={roomRadiusSvg * 0.72}
                      fill="none"
                      stroke={theme.accentColor}
                      strokeWidth="0.7"
                      strokeDasharray="4 2"
                      opacity="0.45"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={roomRadiusSvg * 0.42}
                      fill="none"
                      stroke={theme.accentColor}
                      strokeWidth="0.6"
                      opacity="0.3"
                    />
                  </>
                ) : (
                  <>
                    {/* precision architectural double-walled octagonal chamber floorplan */}
                    <polygon
                      points={octPoints}
                      fill={isCurrent ? `${theme.accentColor}24` : "rgba(14, 18, 26, 0.92)"}
                      stroke={isCurrent ? theme.accentColor : theme.panelBorder}
                      strokeWidth={isCurrent ? "2.2" : "1.3"}
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={roomRadiusSvg * 0.82}
                      fill="none"
                      stroke={theme.accentColor}
                      strokeWidth="0.6"
                      opacity="0.35"
                    />
                    {/* corner structural column piers */}
                    {[0, 1, 2, 3].map((cIdx) => {
                      const a = (cIdx * Math.PI) / 2 + Math.PI / 4;
                      const px = cx + roomRadiusSvg * 0.72 * Math.cos(a);
                      const py = cy + roomRadiusSvg * 0.72 * Math.sin(a);
                      return (
                        <rect
                          key={cIdx}
                          x={px - 1.8}
                          y={py - 1.8}
                          width="3.6"
                          height="3.6"
                          fill={theme.panelBorder}
                          opacity="0.75"
                        />
                      );
                    })}
                  </>
                )}

                {/* room center astrolabe marker */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="2.2"
                  fill={isCurrent ? theme.accentColor : theme.mutedText}
                  opacity="0.7"
                />

                {/* exact 3D prop positions inside room */}
                {roomProps.map((p, pIdx) => {
                  const rawTheta = p.position?.theta ?? 0.48 + pIdx * 0.35;
                  const propDist = 25.0 * spatialLayout.scale;
                  const px = cx + propDist * Math.sin(rawTheta);
                  const py = cy - propDist * Math.cos(rawTheta);
                  return (
                    <rect
                      key={p.prop_id}
                      x={px - 2.2}
                      y={py - 2.2}
                      width="4.4"
                      height="4.4"
                      transform={`rotate(45 ${px} ${py})`}
                      fill="#38bdf8"
                      stroke="#0284c7"
                      strokeWidth="0.8"
                    />
                  );
                })}

                {/* exact NPC positions inside room */}
                {roomNpcs.map((npc, nIdx) => {
                  const rawTheta = npc.position?.theta ?? -0.22 + nIdx * 0.45;
                  const npcDist = 21.0 * spatialLayout.scale;
                  const nx = cx + npcDist * Math.sin(rawTheta);
                  const ny = cy - npcDist * Math.cos(rawTheta);
                  return (
                    <g
                      key={npc.npc_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        startTransition(() => {
                          if (rId !== currentRoomId) setCurrentRoom(rId);
                          selectNPC(npc.npc_id);
                        });
                      }}
                    >
                      <circle
                        cx={nx}
                        cy={ny}
                        r={expanded ? 4.2 : 3.4}
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth="1"
                      />
                      {expanded && (
                        <text
                          x={nx}
                          y={ny - 6}
                          textAnchor="middle"
                          fill="#fde68a"
                          fontSize="6.5"
                          fontWeight="bold"
                        >
                          {npc.name.split(",")[0]}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* room number & structural title */}
                <text
                  x={cx}
                  y={cy + roomRadiusSvg - (expanded ? 8 : 6)}
                  textAnchor="middle"
                  fill={isCurrent ? "#ffffff" : theme.accentText}
                  fontSize={expanded ? "8" : "6.8"}
                  fontWeight="bold"
                  style={{ textShadow: "0px 1px 2px #000" }}
                >
                  {idx + 1}. {room.name.length > 18 ? room.name.slice(0, 16) + ".." : room.name}
                </text>
              </g>
            );
          })}

          {/* 3. live real-time player position & rotating directional FOV cone */}
          <g transform={`translate(${playerSvgX}, ${playerSvgY}) rotate(${playerYawDeg})`}>
            {/* 75-degree camera field-of-view cone */}
            <path
              d="M 0,0 L -22,-42 A 46 46 0 0 1 22,-42 Z"
              fill="url(#fovConeGrad)"
            />
            {/* crisp player directional chevron */}
            <polygon
              points="0,-6.5 5,5 0,2 -5,5"
              fill="#ffffff"
              stroke={theme.accentColor}
              strokeWidth="1.5"
            />
          </g>
        </svg>
      </div>

      {/* bottom legend / active zone bar */}
      <div
        className="z-10 flex items-center justify-between text-[9px] bg-black/80 px-2 py-0.5 border pointer-events-none"
        style={{ borderColor: `${theme.panelBorder}55`, color: theme.accentText }}
      >
        <span className="font-bold truncate max-w-[65%]">
          {activeRoom?.name || currentRoomId}
        </span>
        <span className="opacity-75">Click Zone to Jump</span>
      </div>
    </div>
  );
}
