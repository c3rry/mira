// bird's eye view cartographic island map with merged biome terrain and live agent tracking
"use client";

import { useMemo, useState, useEffect } from "react";
import { resolveAdaptiveTheme, useWorldStore } from "@/store/useWorldStore";

interface SectorCoordinates {
  x: number;
  y: number;
  title: string;
  biome: string;
  code: string;
}

export function MinimapTopology() {
  const { currentRoomId, rooms, npcs, worldTitle, setCurrentRoom } = useWorldStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  const activeRoom = rooms[currentRoomId];
  const theme = resolveAdaptiveTheme(activeRoom?.biome_type, activeRoom?.name, worldTitle);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setIsExpanded((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // dynamically map both canonical sectors and newly compiled world rooms onto the island terrain
  const sectorPositions: Record<string, SectorCoordinates> = useMemo(() => {
    const base: Record<string, SectorCoordinates> = {
      giza_forecourt: { x: 115, y: 290, title: "PYRAMID FORECOURT", biome: "desert", code: "B5" },
      sphinx_causeway: { x: 165, y: 315, title: "GREAT SPHINX", biome: "desert", code: "C5" },
      khufu_gallery: { x: 85, y: 325, title: "KHUFU GALLERY", biome: "desert", code: "A5" },
      solar_barque: { x: 135, y: 345, title: "SOLAR BARQUE", biome: "desert", code: "B6" },
      rome_forum: { x: 200, y: 195, title: "VIA SACRA FORUM", biome: "tavern", code: "C3" },
      rome_pantheon: { x: 175, y: 225, title: "PANTHEON ROTUNDA", biome: "tavern", code: "C4" },
      rome_colosseum: { x: 230, y: 215, title: "COLOSSEUM ARENA", biome: "tavern", code: "D4" },
      babylon_terrace: { x: 295, y: 295, title: "CEDAR TERRACE", biome: "forest", code: "D5" },
      babylon_aqueduct: { x: 325, y: 320, title: "ISHTAR PAVILION", biome: "forest", code: "E5" },
      cyber_lab_01: { x: 110, y: 110, title: "METROPOLIS LAB", biome: "cyber", code: "B2" },
      cyberpunk_alley: { x: 135, y: 140, title: "GRAND ARCADE", biome: "cyber", code: "B3" },
      medieval_tavern: { x: 200, y: 200, title: "HIGHLAND KEEP", biome: "tavern", code: "C3" },
      space_station: { x: 290, y: 110, title: "ORBITAL DOME", biome: "space", code: "D2" },
      desert_oasis: { x: 110, y: 300, title: "GIZA OASIS", biome: "desert", code: "B5" },
      enchanted_forest: { x: 295, y: 295, title: "SYLVAN GROVE", biome: "forest", code: "D5" },
    };

    const roomEntries = Object.values(rooms);
    roomEntries.forEach((r, idx) => {
      if (!base[r.room_id]) {
        const b = (r.biome_type || "").toLowerCase();
        let cx = 200;
        let cy = 200;
        if (b.includes("desert")) {
          cx = 115 + (idx % 3) * 38;
          cy = 285 + Math.floor(idx / 2) * 32;
        } else if (b.includes("forest")) {
          cx = 280 + (idx % 3) * 32;
          cy = 280 + Math.floor(idx / 2) * 32;
        } else if (b.includes("space")) {
          cx = 275 + (idx % 3) * 32;
          cy = 105 + Math.floor(idx / 2) * 30;
        } else if (b.includes("tavern") || b.includes("medieval")) {
          cx = 180 + (idx % 3) * 34;
          cy = 185 + Math.floor(idx / 2) * 30;
        } else {
          cx = 115 + (idx % 3) * 36;
          cy = 120 + Math.floor(idx / 2) * 32;
        }
        base[r.room_id] = {
          x: cx,
          y: cy,
          title: r.name.toUpperCase().slice(0, 18),
          biome: b,
          code: `${String.fromCharCode(65 + (idx % 5))}${idx + 1}`,
        };
      }
    });

    return base;
  }, [rooms]);

  const activeCoord = sectorPositions[currentRoomId] || {
    x: 200,
    y: 200,
    title: rooms[currentRoomId]?.name?.toUpperCase() || currentRoomId,
    biome: "desert",
    code: "C3",
  };

  const npcBlips = useMemo(() => {
    return Object.values(npcs).map((npc) => {
      const coord = sectorPositions[npc.room_id] || { x: 200, y: 200 };
      return {
        npc,
        x: coord.x + 7,
        y: coord.y - 7,
      };
    });
  }, [npcs, sectorPositions]);

  // display active world rooms plus core landmarks on the bird's eye map
  const visibleMarkers = useMemo(() => {
    const activeIds = new Set(Object.keys(rooms));
    const entries = Object.entries(sectorPositions).filter(
      ([id]) => activeIds.has(id) || isExpanded
    );
    return entries.length > 0 ? entries : Object.entries(sectorPositions);
  }, [rooms, sectorPositions, isExpanded]);

  return (
    <div
      className={`transition-all duration-300 pointer-events-auto select-none ${
        isExpanded
          ? "fixed inset-8 z-40 p-6 shadow-2xl flex flex-col border-2"
          : "relative w-60 h-60 p-2 shadow-2xl border-2"
      }`}
      style={{
        backgroundColor: theme.panelBg,
        borderColor: theme.panelBorder,
      }}
    >
      {/* top cartographic header */}
      <div className="absolute top-2.5 left-3 right-3 z-10 flex items-center justify-between text-[11px]">
        <div
          className="px-2 py-0.5 border bg-black/75 uppercase tracking-widest font-bold"
          style={{ borderColor: `${theme.panelBorder}88`, color: theme.accentColor }}
        >
          {isExpanded ? "Cartographic Atlas — Press M to Close" : `Atlas [${activeCoord.code}]`}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-2 py-0.5 border bg-black/75 uppercase tracking-wider text-[10px]"
          style={{ borderColor: `${theme.panelBorder}88`, color: theme.accentText }}
        >
          {isExpanded ? "Minimize [M]" : "Expand [M]"}
        </button>
      </div>

      {/* bird's eye view island terrain */}
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 400 400">
          <defs>
            <radialGradient id="waterGrad" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#0c192c" />
              <stop offset="90%" stopColor="#152c4a" />
              <stop offset="100%" stopColor="#07101d" />
            </radialGradient>

            <linearGradient id="cyberTerrain" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.7" />
            </linearGradient>

            <linearGradient id="desertTerrain" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#b45309" />
              <stop offset="60%" stopColor="#d97706" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#fde68a" stopOpacity="0.5" />
            </linearGradient>

            <linearGradient id="forestTerrain" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#14532d" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.6" />
            </linearGradient>

            <linearGradient id="spaceTerrain" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.6" />
            </linearGradient>

            <linearGradient id="visionCone" x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor={theme.accentColor} stopOpacity="0.6" />
              <stop offset="100%" stopColor={theme.accentColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width="400" height="400" fill="url(#waterGrad)" />

          {/* tactical coordinate grid */}
          <g stroke="rgba(212, 175, 55, 0.16)" strokeWidth="1">
            {[80, 160, 240, 320].map((pos) => (
              <g key={pos}>
                <line x1={pos} y1="0" x2={pos} y2="400" />
                <line x1="0" y1={pos} x2="400" y2={pos} />
              </g>
            ))}
          </g>

          {/* merged island landmass */}
          <path
            d="M 85,70 Q 150,45 230,65 Q 320,55 355,115 Q 375,195 345,275 Q 355,345 280,365 Q 200,375 115,355 Q 45,335 55,255 Q 35,175 65,110 Z"
            fill="#1c1917"
            stroke={theme.panelBorder}
            strokeWidth="2.5"
          />

          {/* northwest metropolis plateau */}
          <path
            d="M 85,80 Q 155,65 195,110 L 185,175 L 85,180 Q 60,135 85,80 Z"
            fill="url(#cyberTerrain)"
          />

          {/* northeast astral observatory */}
          <path
            d="M 225,75 Q 310,65 345,120 Q 350,165 295,175 L 235,155 Z"
            fill="url(#spaceTerrain)"
          />

          {/* central highland keep */}
          <circle cx="200" cy="200" r="46" fill="#78350f" fillOpacity="0.6" stroke="#d97706" strokeDasharray="3 3" />

          {/* southwest giza necropolis & desert dunes */}
          <path
            d="M 65,240 L 175,245 L 180,345 Q 105,355 60,315 Z"
            fill="url(#desertTerrain)"
          />

          {/* southeast hanging gardens & sylvan canopy */}
          <path
            d="M 235,245 L 335,240 Q 355,315 285,355 L 220,335 Z"
            fill="url(#forestTerrain)"
          />

          {/* connecting causeways and trade roads */}
          <g stroke="#d4af37" strokeWidth="2" fill="none" strokeDasharray="4 3" opacity="0.65">
            <path d="M 130,135 L 200,200 L 290,115" />
            <path d="M 200,200 L 115,295" />
            <path d="M 200,200 L 295,295" />
          </g>

          {/* perimeter boundary ring */}
          <circle
            cx="200"
            cy="205"
            r="158"
            fill="none"
            stroke={theme.accentColor}
            strokeWidth="1.5"
            strokeDasharray="6 4"
            opacity="0.55"
          />

          {/* sector pins */}
          {visibleMarkers.map(([rId, sector]) => {
            const isPlayerHere = rId === currentRoomId;
            const isHover = hoveredSector === rId;

            return (
              <g
                key={rId}
                className="cursor-pointer"
                onClick={() => setCurrentRoom(rId)}
                onMouseEnter={() => setHoveredSector(rId)}
                onMouseLeave={() => setHoveredSector(null)}
              >
                <circle
                  cx={sector.x}
                  cy={sector.y}
                  r={isPlayerHere ? "7" : isHover ? "6" : "4.5"}
                  fill={isPlayerHere ? theme.accentColor : isHover ? "#fde68a" : "#cbd5e1"}
                  stroke="#1c1917"
                  strokeWidth="1.5"
                />

                {(isExpanded || isHover || isPlayerHere) && (
                  <text
                    x={sector.x}
                    y={sector.y - 10}
                    textAnchor="middle"
                    fill={isPlayerHere ? theme.accentText : "#ffffff"}
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="'Times New Roman', Times, serif"
                  >
                    {sector.title}
                  </text>
                )}
              </g>
            );
          })}

          {/* live npc blips */}
          {npcBlips.map(({ npc, x, y }) => (
            <g key={npc.npc_id}>
              <circle cx={x} cy={y} r="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
              {isExpanded && (
                <text
                  x={x}
                  y={y + 11}
                  textAnchor="middle"
                  fill="#fca5a5"
                  fontSize="8"
                  fontFamily="'Times New Roman', Times, serif"
                >
                  {npc.name}
                </text>
              )}
            </g>
          ))}

          {/* player indicator with directional vision cone */}
          <g transform={`translate(${activeCoord.x}, ${activeCoord.y})`}>
            <path
              d="M 0,0 L -36,-68 A 76 76 0 0 1 36,-68 Z"
              fill="url(#visionCone)"
              opacity="0.85"
            />
            <polygon
              points="0,-8 6,6 0,2 -6,6"
              fill={theme.accentColor}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          </g>
        </svg>
      </div>

      {/* footer status */}
      <div
        className="absolute bottom-2 left-3 right-3 z-10 flex items-center justify-between text-[10px] bg-black/80 px-2.5 py-1 border"
        style={{ borderColor: `${theme.panelBorder}66`, color: theme.accentText }}
      >
        <span className="font-bold truncate">{activeCoord.title}</span>
        <span className="italic opacity-80">Select Pin to Travel</span>
      </div>
    </div>
  );
}
