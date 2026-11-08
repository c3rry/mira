// precise top-down architectural & spatial floorplan radar with live multi-room player tracking, color capture, and continuous expansion
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { resolveAdaptiveTheme, useWorldStore, inferRoomVisualPalette } from "@/store/useWorldStore";
import { isNaturalBiomeContext } from "@/canvas/environment/ReflectiveFloorGrid";

export function MinimapTopology() {
  const [expanded, setExpanded] = useState(false);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  const {
    currentRoomId,
    rooms,
    npcs,
    worldTitle,
    playerPosition,
    topologyType,
    isExpanding,
    setCurrentRoom,
    selectNPC,
    expandWorld,
  } = useWorldStore();
  const [, startTransition] = useTransition();

  const roomIds = Object.keys(rooms);
  const activeRoom = rooms[currentRoomId];
  const theme = resolveAdaptiveTheme(activeRoom?.biome_type, activeRoom?.name, worldTitle);
  const activeTopology = activeRoom?.topology_type || topologyType || "nature_open";

  const isNature = useMemo(() => {
    const ctx = `${worldTitle || ""} ${activeRoom?.name || ""} ${activeRoom?.biome_type || ""}`;
    return isNaturalBiomeContext(ctx) || activeTopology === "nature_open";
  }, [worldTitle, activeRoom, activeTopology]);

  // keyboard shortcuts: 'M' for toggle map expand, 'E' for continuous world expansion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return;
      }
      if (e.key === "m" || e.key === "M") {
        setExpanded((prev) => !prev);
      }
      if ((e.key === "e" || e.key === "E") && !isExpanding) {
        expandWorld(currentRoomId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanding, currentRoomId, expandWorld]);

  // map 3D world coordinates (worldX, worldZ) to dynamic auto-scaling SVG coordinates
  const spatialLayout = useMemo(() => {
    const list = Object.values(rooms);
    if (list.length === 0) {
      return {
        toSvgX: (wx: number) => 150 + wx * 0.38,
        toSvgY: (wz: number) => 150 + wz * 0.38,
        scale: 0.38,
        centerX: 0,
        centerZ: 0,
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
    // pad span so newly expanded rooms fit gracefully without clipping
    const span = Math.max(maxX - minX, maxZ - minZ, 220) + 220;
    const scale = 250 / span;

    return {
      toSvgX: (wx: number) => 150 + (wx - centerX) * scale,
      toSvgY: (wz: number) => 150 + (wz - centerZ) * scale,
      scale,
      centerX,
      centerZ,
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
        // only direct neighbors get a physical corridor
        if (Math.hypot(bx - ax, bz - az) > 280) return;

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

  // determine open frontier positions for active room expansion
  const openFrontiers = useMemo(() => {
    if (!activeRoom) return [];
    const ax = activeRoom.worldX || 0;
    const az = activeRoom.worldZ || 0;

    const candidates: Array<{ dir: string; tx: number; tz: number }> = [];

    if (activeTopology === "linear") {
      // 1D: only forward & backward along track
      candidates.push({ dir: "forward", tx: ax, tz: az - 220 });
      candidates.push({ dir: "backward", tx: ax, tz: az + 220 });
    } else {
      // Nature environment or city grid: NO LIMITS - ALWAYS GIVE ALL 4 DIRECTIONS!
      candidates.push({ dir: "north", tx: ax, tz: az - 220 });
      candidates.push({ dir: "south", tx: ax, tz: az + 220 });
      candidates.push({ dir: "east", tx: ax + 220, tz: az });
      candidates.push({ dir: "west", tx: ax - 220, tz: az });
    }

    return candidates
      .filter(({ tx, tz }) => {
        return !Object.values(rooms).some(
          (r) => Math.hypot((r.worldX || 0) - tx, (r.worldZ || 0) - tz) < 70
        );
      })
      .map(({ dir, tx, tz }) => ({
        dir,
        svgX: spatialLayout.toSvgX(tx),
        svgY: spatialLayout.toSvgY(tz),
        fromRoomId: currentRoomId,
      }));
  }, [activeRoom, rooms, currentRoomId, activeTopology, spatialLayout]);

  if (roomIds.length === 0) {
    return null;
  }

  const playerSvgX = spatialLayout.toSvgX(playerPosition.x);
  const playerSvgY = spatialLayout.toSvgY(playerPosition.z);
  const playerYawDeg = (playerPosition.yaw * 180) / Math.PI;
  const interRoomDistanceSvg = 220 * spatialLayout.scale;
  const roomRadiusSvg = Math.max(7, Math.min(22, interRoomDistanceSvg * 0.35));
  const corridorWidthSvg = Math.max(2.5, Math.min(6, interRoomDistanceSvg * 0.08));
  const originSvgX = spatialLayout.toSvgX(0);
  const originSvgY = spatialLayout.toSvgY(0);
  const unitSpan = Math.max(28, interRoomDistanceSvg);
  const hoveredRoom = hoveredRoomId ? rooms[hoveredRoomId] : null;

  return (
    <div
      className={`border shadow-2xl transition-all duration-200 flex flex-col justify-between select-none relative overflow-hidden backdrop-blur-md ${
        expanded ? "w-[440px] h-[440px] p-3" : "w-60 h-60 p-2"
      }`}
      style={{
        backgroundColor: "rgba(8, 11, 16, 0.88)",
        borderColor: `${theme.panelBorder}99`,
      }}
    >
      {/* top CAD / radar header with live coordinate and continuous expand button */}
      <div className="flex items-center justify-between z-10 pointer-events-none">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 border bg-black/80 truncate max-w-[240px]"
          style={{ borderColor: `${theme.panelBorder}66`, color: theme.accentColor }}
        >
          {activeTopology === "linear" ? "TRANSIT LINE (1D)" : isNature ? "NATURE EXPEDITION (4-WAY)" : "FLOORPLAN CAD (2D)"} • {worldTitle.split("—")[0].trim().toUpperCase()}
        </span>
        <div className="flex items-center gap-1 pointer-events-auto">
          <button
            onClick={() => expandWorld(currentRoomId)}
            disabled={isExpanding}
            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border bg-black/80 hover:opacity-90 transition-all font-bold"
            style={{
              borderColor: `${theme.panelBorder}aa`,
              color: isExpanding ? theme.mutedText : theme.accentColor,
              backgroundColor: isExpanding ? "rgba(0,0,0,0.5)" : "rgba(20,25,35,0.8)",
            }}
            title="Continuously generate new connected room in open directions [E]"
          >
            {isExpanding ? "Synthesizing..." : "+ Expand [E]"}
          </button>
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border bg-black/80 hover:opacity-90"
            style={{ borderColor: `${theme.panelBorder}66`, color: theme.accentText }}
          >
            {expanded ? "Compact [M]" : "Full [M]"}
          </button>
        </div>
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

            {/* continuous 2D procedural world field macro-sector terrain gradients */}
            <radialGradient id="oasisFieldGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#15803d" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#047857" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#064e3b" stopOpacity="0.0" />
            </radialGradient>
            <radialGradient id="dunesFieldGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.65" />
              <stop offset="70%" stopColor="#b45309" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#78350f" stopOpacity="0.0" />
            </radialGradient>
            <radialGradient id="citadelFieldGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7c2d12" stopOpacity="0.7" />
              <stop offset="75%" stopColor="#451a03" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#1c1917" stopOpacity="0.0" />
            </radialGradient>
            <radialGradient id="pyramidPlazaGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ca8a04" stopOpacity="0.6" />
              <stop offset="70%" stopColor="#854d0e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#070a0f" stopOpacity="0.0" />
            </radialGradient>

            {/* dynamic color-capture radial gradients for every single generated room */}
            {roomIds.map((rId) => {
              const rm = rooms[rId];
              const pal =
                rm?.visual_palette ||
                inferRoomVisualPalette(rm?.name, worldTitle, rm?.biome_type);
              return (
                <radialGradient
                  key={`roomGrad_${rId}`}
                  id={`roomGrad_${rId}`}
                  cx="50%"
                  cy="50%"
                  r="68%"
                >
                  <stop offset="0%" stopColor={pal.dominant_color} stopOpacity="0.86" />
                  <stop offset="55%" stopColor={pal.floor_tone} stopOpacity="0.94" />
                  <stop offset="100%" stopColor="#070a0f" stopOpacity="0.98" />
                </radialGradient>
              );
            })}
          </defs>

          {/* background precision grid */}
          <rect x="0" y="0" width="300" height="300" fill="#070a0f" />

          {/* 2D Continuous Procedural World Field Underlay matching infinite continuous geography */}
          <g opacity={expanded ? "0.48" : "0.34"} name="procedural-2d-terrain-underlay">
            {(`${worldTitle || ""} ${activeRoom?.biome_type || ""}`.toLowerCase().includes("noise") || `${worldTitle || ""}`.toLowerCase().includes("latent")) ? (
              /* Continuous Quantum Noise Manifold Underlay */
              <g name="quantum-noise-manifold-underlay">
                {[0.75, 1.4, 2.05, 2.75].map((mult, rIdx) => (
                  <circle
                    key={`harmonic_ring_${rIdx}`}
                    cx={originSvgX}
                    cy={originSvgY}
                    r={unitSpan * mult}
                    fill="none"
                    stroke={rIdx % 2 === 0 ? "#38bdf8" : "#a855f7"}
                    strokeWidth={Math.max(1, unitSpan * 0.04)}
                    strokeDasharray="4 3"
                    opacity="0.65"
                  />
                ))}
                <line x1={originSvgX - unitSpan * 2.8} y1={originSvgY} x2={originSvgX + unitSpan * 2.8} y2={originSvgY} stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
                <line x1={originSvgX} y1={originSvgY - unitSpan * 2.8} x2={originSvgX} y2={originSvgY + unitSpan * 2.8} stroke="#a855f7" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
                <ellipse cx={originSvgX} cy={originSvgY} rx={unitSpan * 0.75} ry={unitSpan * 0.75} fill="url(#oasisFieldGrad)" opacity="0.45" />
                <polygon
                  points={`${originSvgX},${originSvgY - unitSpan * 0.32} ${originSvgX + unitSpan * 0.28},${originSvgY + unitSpan * 0.16} ${originSvgX - unitSpan * 0.28},${originSvgY + unitSpan * 0.16}`}
                  fill="#ffffff"
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  opacity="0.88"
                />
              </g>
            ) : (
              /* Ancient / Desert Biome Underlay */
              <>
                {/* South Oasis Sector: lush date palm grove & freshwater basins */}
                <ellipse
                  cx={originSvgX}
                  cy={originSvgY + unitSpan * 1.75}
                  rx={unitSpan * 1.55}
                  ry={unitSpan * 1.15}
                  fill="url(#oasisFieldGrad)"
                />
                <ellipse
                  cx={originSvgX - unitSpan * 0.25}
                  cy={originSvgY + unitSpan * 1.8}
                  rx={unitSpan * 0.55}
                  ry={unitSpan * 0.32}
                  fill="#0284c7"
                  opacity="0.65"
                />
                {[[-0.6, 1.4], [0.4, 1.5], [-0.3, 2.1], [0.55, 2.2]].map(([ox, oy], i) => (
                  <text
                    key={`palm_${i}`}
                    x={originSvgX + ox * unitSpan}
                    y={originSvgY + oy * unitSpan}
                    fontSize={Math.max(6, unitSpan * 0.16)}
                    opacity="0.8"
                    textAnchor="middle"
                    fill="#4ade80"
                  >
                    🌴
                  </text>
                ))}

                {/* East Nile River Canal Sector: turquoise waterway ribbon */}
                <path
                  d={`M ${originSvgX + unitSpan * 1.45} -20 
                      C ${originSvgX + unitSpan * 1.75} 80, 
                        ${originSvgX + unitSpan * 1.3} 180, 
                        ${originSvgX + unitSpan * 1.6} 320 
                      L ${originSvgX + unitSpan * 2.2} 320 
                      L ${originSvgX + unitSpan * 2.2} -20 Z`}
                  fill="#0284c7"
                  opacity="0.38"
                />
                <path
                  d={`M ${originSvgX + unitSpan * 1.45} -20 
                      C ${originSvgX + unitSpan * 1.75} 80, 
                        ${originSvgX + unitSpan * 1.3} 180, 
                        ${originSvgX + unitSpan * 1.6} 320`}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={Math.max(2, unitSpan * 0.12)}
                  strokeDasharray="4 3"
                  opacity="0.75"
                />

                {/* West Desert Sandcrest & Basalt Gorge: undulating dunes */}
                <ellipse
                  cx={originSvgX - unitSpan * 1.75}
                  cy={originSvgY}
                  rx={unitSpan * 1.45}
                  ry={unitSpan * 1.65}
                  fill="url(#dunesFieldGrad)"
                />
                {[-0.8, -0.2, 0.4, 1.0].map((dy, i) => (
                  <path
                    key={`dune_${i}`}
                    d={`M ${originSvgX - unitSpan * 2.6} ${originSvgY + dy * unitSpan} 
                        Q ${originSvgX - unitSpan * 1.75} ${originSvgY + dy * unitSpan - unitSpan * 0.22}, 
                          ${originSvgX - unitSpan * 0.9} ${originSvgY + dy * unitSpan}`}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={Math.max(1, unitSpan * 0.05)}
                    opacity="0.5"
                  />
                ))}

                {/* North Royal Necropolis & Citadel: corbelled stone terraces */}
                <rect
                  x={originSvgX - unitSpan * 1.35}
                  y={originSvgY - unitSpan * 2.4}
                  width={unitSpan * 2.7}
                  height={unitSpan * 1.5}
                  rx="6"
                  fill="url(#citadelFieldGrad)"
                />
                <rect
                  x={originSvgX - unitSpan * 0.9}
                  y={originSvgY - unitSpan * 2.1}
                  width={unitSpan * 1.8}
                  height={unitSpan * 0.9}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={Math.max(0.8, unitSpan * 0.04)}
                  strokeDasharray="2 3"
                  opacity="0.6"
                />

                {/* Center Great Pyramid Precinct: limestone courtyard & pyramid icons */}
                <rect
                  x={originSvgX - unitSpan * 0.85}
                  y={originSvgY - unitSpan * 0.85}
                  width={unitSpan * 1.7}
                  height={unitSpan * 1.7}
                  rx="8"
                  fill="url(#pyramidPlazaGrad)"
                />
                <polygon
                  points={`${originSvgX},${originSvgY - unitSpan * 0.42} 
                          ${originSvgX - unitSpan * 0.28},${originSvgY + unitSpan * 0.05} 
                          ${originSvgX + unitSpan * 0.28},${originSvgY + unitSpan * 0.05}`}
                  fill="#facc15"
                  stroke="#78350f"
                  strokeWidth="0.8"
                  opacity="0.85"
                />
                <polygon
                  points={`${originSvgX - unitSpan * 0.38},${originSvgY - unitSpan * 0.05} 
                          ${originSvgX - unitSpan * 0.6},${originSvgY + unitSpan * 0.3} 
                          ${originSvgX - unitSpan * 0.16},${originSvgY + unitSpan * 0.3}`}
                  fill="#eab308"
                  stroke="#78350f"
                  strokeWidth="0.7"
                  opacity="0.75"
                />
                <polygon
                  points={`${originSvgX - unitSpan * 0.68},${originSvgY + unitSpan * 0.22} 
                          ${originSvgX - unitSpan * 0.84},${originSvgY + unitSpan * 0.48} 
                          ${originSvgX - unitSpan * 0.52},${originSvgY + unitSpan * 0.48}`}
                  fill="#ca8a04"
                  stroke="#78350f"
                  strokeWidth="0.6"
                  opacity="0.7"
                />
              </>
            )}
          </g>

          <rect x="0" y="0" width="300" height="300" fill="url(#cadGridMajor)" />

          {/* cardinal compass crosshairs */}
          <line x1="150" y1="8" x2="150" y2="292" stroke={theme.accentColor} strokeOpacity="0.12" strokeDasharray="2 3" />
          <line x1="8" y1="150" x2="292" y2="150" stroke={theme.accentColor} strokeOpacity="0.12" strokeDasharray="2 3" />
          <text x="150" y="16" textAnchor="middle" fill={theme.accentColor} fontSize="7" opacity="0.6" fontWeight="bold">
            N
          </text>
          <text x="286" y="153" textAnchor="middle" fill={theme.accentColor} fontSize="7" opacity="0.6" fontWeight="bold">
            E
          </text>
          <text x="150" y="288" textAnchor="middle" fill={theme.accentColor} fontSize="7" opacity="0.6" fontWeight="bold">
            S
          </text>
          <text x="14" y="153" textAnchor="middle" fill={theme.accentColor} fontSize="7" opacity="0.6" fontWeight="bold">
            W
          </text>

          {/* 1. physical walkable corridors / causeway bridges / train couplers between connected rooms */}
          {corridorEdges.map((edge) => (
            <g key={edge.key}>
              {activeTopology === "linear" ? (
                /* accordion train car coupler / pressurized gangway connector */
                <>
                  <line
                    x1={edge.x1}
                    y1={edge.y1}
                    x2={edge.x2}
                    y2={edge.y2}
                    stroke="#475569"
                    strokeWidth={corridorWidthSvg + 2}
                    strokeDasharray="2 2"
                    opacity="0.9"
                  />
                  <line
                    x1={edge.x1}
                    y1={edge.y1}
                    x2={edge.x2}
                    y2={edge.y2}
                    stroke="#1e293b"
                    strokeWidth={corridorWidthSvg - 2}
                  />
                  <line
                    x1={edge.x1}
                    y1={edge.y1}
                    x2={edge.x2}
                    y2={edge.y2}
                    stroke="#f59e0b"
                    strokeWidth="1.2"
                    opacity="0.85"
                  />
                </>
              ) : (
                /* standard architectural corridors */
                <>
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
                  <line
                    x1={edge.x1}
                    y1={edge.y1}
                    x2={edge.x2}
                    y2={edge.y2}
                    stroke="#111827"
                    strokeWidth={corridorWidthSvg}
                    strokeLinecap="butt"
                  />
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
                </>
              )}
            </g>
          ))}

          {/* 2. exact top-down room footprints with color capture & topology-aware geometry */}
          {roomIds.map((rId, idx) => {
            const room = rooms[rId];
            if (!room) return null;
            const cx = spatialLayout.toSvgX(room.worldX || 0);
            const cy = spatialLayout.toSvgY(room.worldZ || 0);
            const isCurrent = rId === currentRoomId;
            const roomNpcs = Object.values(npcs).filter((n) => n.room_id === rId);
            const roomProps = room.props || [];
            const pal =
              room.visual_palette ||
              inferRoomVisualPalette(room.name, worldTitle, room.biome_type);
            const rTopo = room.topology_type || activeTopology;

            // octagonal chamber vertices for hub_spoke
            const octPoints = Array.from({ length: 8 })
              .map((_, k) => {
                const ang = (k * Math.PI) / 4 + Math.PI / 8;
                const px = cx + roomRadiusSvg * Math.cos(ang);
                const py = cy + roomRadiusSvg * Math.sin(ang);
                return `${px.toFixed(1)},${py.toFixed(1)}`;
              })
              .join(" ");

            const isHovered = rId === hoveredRoomId;

            // linear subway/train carriage dimensions
            const carW = Math.max(10, Math.min(36, interRoomDistanceSvg * 0.45));
            const carH = Math.max(16, Math.min(54, interRoomDistanceSvg * 0.75));

            // city grid parcel dimensions
            const blockW = Math.max(12, Math.min(48, interRoomDistanceSvg * 0.65));
            const blockH = Math.max(12, Math.min(48, interRoomDistanceSvg * 0.65));

            return (
              <g
                key={rId}
                className="cursor-pointer"
                onPointerEnter={() => setHoveredRoomId(rId)}
                onPointerLeave={() => setHoveredRoomId(null)}
                onClick={() => {
                  startTransition(() => {
                    setCurrentRoom(rId);
                  });
                }}
              >
                {rTopo === "linear" ? (
                  /* 1. Linear Subway Car / Airplane Cabin Carriage */
                  <>
                    <rect
                      x={cx - carW / 2}
                      y={cy - carH / 2}
                      width={carW}
                      height={carH}
                      rx="7"
                      ry="7"
                      fill={`url(#roomGrad_${rId})`}
                      stroke={isCurrent ? pal.accent_color : pal.dominant_color}
                      strokeWidth={isCurrent ? "2.5" : "1.4"}
                    />
                    {[-1, 1].map((side) =>
                      [-0.32, -0.1, 0.1, 0.32].map((slot, sIdx) => (
                        <rect
                          key={`win_${side}_${sIdx}`}
                          x={cx + side * (carW / 2 - 2.8) - 1.2}
                          y={cy + slot * carH - 3}
                          width="2.4"
                          height="6"
                          rx="1"
                          fill={pal.accent_color}
                          opacity={isCurrent ? "0.95" : "0.55"}
                        />
                      ))
                    )}
                    <rect
                      x={cx - 5}
                      y={cy - carH / 2 - 1.5}
                      width="10"
                      height="3"
                      fill="#f59e0b"
                      opacity="0.8"
                    />
                    <rect
                      x={cx - 5}
                      y={cy + carH / 2 - 1.5}
                      width="10"
                      height="3"
                      fill="#f59e0b"
                      opacity="0.8"
                    />
                  </>
                ) : rTopo === "city_grid" ? (
                  /* 2. 2D City Grid Street Block & Sidewalk Parcel */
                  <>
                    <rect
                      x={cx - blockW / 2}
                      y={cy - blockH / 2}
                      width={blockW}
                      height={blockH}
                      rx="4"
                      ry="4"
                      fill={`url(#roomGrad_${rId})`}
                      stroke={isCurrent ? pal.accent_color : pal.dominant_color}
                      strokeWidth={isCurrent ? "2.4" : "1.4"}
                    />
                    <rect
                      x={cx - blockW / 2 + 3}
                      y={cy - blockH / 2 + 3}
                      width={blockW - 6}
                      height={blockH - 6}
                      rx="2"
                      ry="2"
                      fill="none"
                      stroke={pal.accent_color}
                      strokeWidth="0.8"
                      strokeDasharray="4 2"
                      opacity="0.45"
                    />
                    {[
                      [-1, -1],
                      [1, -1],
                      [-1, 1],
                      [1, 1],
                    ].map(([sx, sy], kIdx) => (
                      <circle
                        key={kIdx}
                        cx={cx + sx * (blockW / 2 - 3)}
                        cy={cy + sy * (blockH / 2 - 3)}
                        r="1.8"
                        fill={pal.accent_color}
                        opacity="0.8"
                      />
                    ))}
                  </>
                ) : rTopo === "nature_open" || isNature ? (
                  /* 3. Open Nature Environment: No Limits - 4-Way Compass Terrain */
                  <>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={roomRadiusSvg}
                      fill={`url(#roomGrad_${rId})`}
                      stroke={isCurrent ? pal.accent_color : pal.dominant_color}
                      strokeWidth={isCurrent ? "2.2" : "1.3"}
                    />
                    {/* multi-tier elevation contour rings */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={roomRadiusSvg * 0.72}
                      fill="none"
                      stroke={pal.accent_color}
                      strokeWidth="0.8"
                      strokeDasharray="4 2"
                      opacity="0.55"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={roomRadiusSvg * 0.42}
                      fill="none"
                      stroke={pal.accent_color}
                      strokeWidth="0.6"
                      opacity="0.4"
                    />
                    {/* 4-way cardinal compass indicators showing open exploration */}
                    {[
                      [0, -roomRadiusSvg],
                      [roomRadiusSvg, 0],
                      [0, roomRadiusSvg],
                      [-roomRadiusSvg, 0],
                    ].map(([dx, dy], dirIdx) => (
                      <line
                        key={`cardinal_${dirIdx}`}
                        x1={cx + dx * 0.75}
                        y1={cy + dy * 0.75}
                        x2={cx + dx * 1.15}
                        y2={cy + dy * 1.15}
                        stroke={pal.accent_color}
                        strokeWidth="1.2"
                        strokeDasharray="1 2"
                        opacity="0.6"
                      />
                    ))}
                  </>
                ) : (
                  /* 4. Colonnaded Octagonal Rotunda Sanctuary */
                  <>
                    <polygon
                      points={octPoints}
                      fill={`url(#roomGrad_${rId})`}
                      stroke={isCurrent ? pal.accent_color : pal.dominant_color}
                      strokeWidth={isCurrent ? "2.4" : "1.4"}
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={roomRadiusSvg * 0.8}
                      fill="none"
                      stroke={pal.accent_color}
                      strokeWidth="0.7"
                      opacity="0.45"
                    />
                    {[0, 1, 2, 3].map((cIdx) => {
                      const a = (cIdx * Math.PI) / 2 + Math.PI / 4;
                      const px = cx + roomRadiusSvg * 0.72 * Math.cos(a);
                      const py = cy + roomRadiusSvg * 0.72 * Math.sin(a);
                      return (
                        <rect
                          key={cIdx}
                          x={px - 2}
                          y={py - 2}
                          width="4"
                          height="4"
                          fill={pal.dominant_color}
                          stroke={pal.accent_color}
                          strokeWidth="0.5"
                          opacity="0.85"
                        />
                      );
                    })}
                  </>
                )}

                {/* room center marker with color accent */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="2.4"
                  fill={isCurrent ? pal.accent_color : pal.dominant_color}
                  opacity="0.9"
                />

                {/* exact 3D prop positions inside room */}
                {roomProps.map((p, pIdx) => {
                  const rawTheta = p.position?.theta ?? 0.48 + pIdx * 0.35;
                  const propDist = 24.0 * spatialLayout.scale;
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
                      fill={pal.accent_color}
                      stroke={pal.dominant_color}
                      strokeWidth="0.8"
                    />
                  );
                })}

                {/* environmental biome glyph badge in room center */}
                <text
                  x={cx}
                  y={cy - (expanded ? 7 : 4)}
                  textAnchor="middle"
                  fill={isCurrent ? "#ffffff" : pal.accent_color}
                  fontSize={expanded ? "13" : "10"}
                  fontWeight="bold"
                  opacity={isCurrent ? "1.0" : "0.85"}
                  style={{ textShadow: `0px 0px 6px ${pal.accent_color}88` }}
                >
                  {(() => {
                    const t = `${room.name} ${room.biome_type || ""}`.toLowerCase();
                    if (t.includes("noise") || t.includes("latent") || t.includes("quantum") || t.includes("manifold")) return "∿";
                    if (t.includes("everest") || t.includes("mountain") || t.includes("glacier") || t.includes("summit") || t.includes("icefall")) return "▲";
                    if (t.includes("giza") || t.includes("pyramid") || t.includes("sphinx") || t.includes("desert") || t.includes("oasis")) return "△";
                    if (t.includes("subway") || t.includes("train") || t.includes("metro")) return "🚆";
                    if (t.includes("plane") || t.includes("flight")) return "✈";
                    if (t.includes("city") || t.includes("broadway") || t.includes("times square") || t.includes("neon") || t.includes("metropolis")) return "✦";
                    if (t.includes("space") || t.includes("orbital") || t.includes("observatory") || t.includes("station")) return "🪐";
                    if (t.includes("rome") || t.includes("colosseum") || t.includes("forum")) return "🏛";
                    if (t.includes("forest") || t.includes("garden") || t.includes("sylvan") || t.includes("grove")) return "🌿";
                    return "◈";
                  })()}
                </text>

                {/* prominent, highly legible room name across center (omitted on dense non-active nodes to avoid clumping) */}
                {(isCurrent || isHovered || expanded || roomRadiusSvg >= 16) && (() => {
                  const clean = room.name.replace(/^The\s+/i, "");
                  const words = clean.split(" ");
                  const line1 = words.slice(0, 2).join(" ");
                  const line2 = words.slice(2, 4).join(" ");
                  return (
                    <g>
                      <text
                        x={cx}
                        y={cy + (expanded ? 4 : 3)}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={expanded ? "7.5" : "6"}
                        fontWeight="bold"
                        letterSpacing="0.02em"
                        style={{ textShadow: "0px 1px 3px #000, 0px 0px 4px #000" }}
                      >
                        {line1}
                      </text>
                      {line2 && (
                        <text
                          x={cx}
                          y={cy + (expanded ? 12 : 9)}
                          textAnchor="middle"
                          fill={pal.accent_color}
                          fontSize={expanded ? "6.5" : "5"}
                          fontWeight="bold"
                          opacity="0.92"
                          style={{ textShadow: "0px 1px 2px #000" }}
                        >
                          {line2}
                        </text>
                      )}
                    </g>
                  );
                })()}

                {/* exact NPC resident beacon pin */}
                {roomNpcs.map((npc, nIdx) => {
                  const rawTheta = npc.position?.theta ?? -0.22 + nIdx * 0.45;
                  const npcDist = 18.0 * spatialLayout.scale;
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
                        r={expanded ? 3.2 : 2.4}
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth="1"
                      />
                      <title>{npc.name}: Click to converse</title>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* 3. clickable pulsing continuous frontier expansion portals */}
          {openFrontiers.slice(0, 4).map((frontier, fIdx) => (
            <g
              key={`frontier_${fIdx}_${frontier.dir}`}
              className="cursor-pointer"
              onClick={() => {
                if (!isExpanding) expandWorld(frontier.fromRoomId, frontier.dir);
              }}
            >
              <circle
                cx={frontier.svgX}
                cy={frontier.svgY}
                r="13"
                fill="none"
                stroke={theme.accentColor}
                strokeWidth="1.1"
                strokeDasharray="3 3"
                opacity="0.65"
              >
                <animate
                  attributeName="r"
                  values="9;15;9"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.3;0.8;0.3"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                cx={frontier.svgX}
                cy={frontier.svgY}
                r="7.5"
                fill="rgba(15, 23, 42, 0.92)"
                stroke={theme.accentColor}
                strokeWidth="1.4"
              />
              <text
                x={frontier.svgX}
                y={frontier.svgY + 3.0}
                textAnchor="middle"
                fill={theme.accentColor}
                fontSize="9.5"
                fontWeight="bold"
              >
                +
              </text>
            </g>
          ))}

          {/* 4. live real-time player position & rotating directional FOV cone */}
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
          {hoveredRoom ? `◈ ${hoveredRoom.name}` : activeRoom?.name || currentRoomId}
        </span>
        <span className="opacity-75">{hoveredRoom ? "Click to Jump" : "Click Zone to Jump"}</span>
      </div>
    </div>
  );
}
