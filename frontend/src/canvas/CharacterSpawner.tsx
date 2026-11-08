// photorealistic pbr articulated humanoid npc spawner with 100% bespoke prompt-driven silhouettes, zero generic gladiator skirts, and unique space-and-time geometries
"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NPCAgent, RoomVisualPalette, useWorldStore } from "../store/useWorldStore";

export type CharacterArchetype =
  | "modern_urban"
  | "cyberpunk_neon"
  | "sci_fi_space"
  | "ancient_antiquity"
  | "high_fantasy"
  | "wilderness_alpine"
  | "maritime_pirate"
  | "victorian_noir"
  | "nature_mystic";

export interface PromptCharacterStyle {
  archetype: CharacterArchetype;
  roleBadge: string;
  garmentColor: string;
  secondaryColor: string;
  accentColor: string;
  leatherColor: string;
  metalColor: string;
  skinTone: string;
  hairColor: string;
  visorGlow: string;
  heldItemKind: "smartphone" | "datapad" | "astrolabe" | "ice_axe" | "staff" | "spyglass" | "scanner" | "chronicle";
}

/**
 * Derives rich character visual identity, wardrobe, equipment, and PBR palette directly from the user's prompt
 */
export function inferPromptCharacterStyle(
  promptText: string,
  roomText: string = "",
  npcName: string = "",
  personaText: string = "",
  palette?: RoomVisualPalette
): PromptCharacterStyle {
  const combined = `${promptText} ${roomText} ${npcName} ${personaText}`.toLowerCase();

  let modernScore = 0;
  let cyberScore = 0;
  let spaceScore = 0;
  let ancientScore = 0;
  let fantasyScore = 0;
  let alpineScore = 0;
  let pirateScore = 0;
  let victorianScore = 0;
  let natureScore = 0;

  // Modern Urban keywords
  if (/\b(chicago|new york|times square|broadway|manhattan|subway|street|boulevard|avenue|city|urban|tokyo|pedestrian|traffic|taxi|curator|detective|cop|officer|citizen|commuter|fashion|modern|promenade)\b/.test(combined)) {
    modernScore += 6;
  }
  // Cyberpunk keywords
  if (/\b(cyberpunk|cyber|neon|hacker|netrunner|matrix|blade runner|cyborg|android|dystopia|dystopian|synapse|neural|bionic|augment|megacorp|syndicate|arcade)\b/.test(combined)) {
    cyberScore += 7;
  }
  // Space keywords
  if (/\b(space|station|orbital|lunar|moon|mars|astronaut|apollo|artemis|nasa|starship|galaxy|shuttle|cosmic|cosmos|gravity|zero-g|satellite|observatory)\b/.test(combined)) {
    spaceScore += 8;
  }
  // Ancient / Egyptian / Mediterranean keywords
  if (/\b(egypt|giza|pyramid|pharaoh|sphinx|nile|tomb|hieroglyph|alexandria|athens|rome|roman|colosseum|forum|pantheon|parthenon|temple|monument|alabaster|papyrus|oasis)\b/.test(combined)) {
    ancientScore += 8;
  }
  // Medieval / Fantasy keywords
  if (/\b(medieval|tavern|inn|castle|dungeon|knight|paladin|rogue|sorcerer|wizard|mage|magic|dragon|gothic|cathedral|sword|armor|blacksmith)\b/.test(combined)) {
    fantasyScore += 7;
  }
  // Alpine / Mountain keywords
  if (/\b(everest|himalaya|mountain|glacier|icefall|snow|alpine|summit|k2|ridge|tundra|arctic|scout|sherpa|mountaineer|cwm|col|ice)\b/.test(combined)) {
    alpineScore += 8;
  }
  // Pirate / Maritime keywords
  if (/\b(pirate|ship|ocean|sea|bay|caribbean|harbor|port|tortuga|captain|sailor|nautical|buccaneer|galleon|corsair)\b/.test(combined)) {
    pirateScore += 7;
  }
  // Victorian / Noir keywords
  if (/\b(victorian|london|steampunk|1888|1890|gaslight|cobblestone|inspector|investigator|sleuth|greatcoat|trenchcoat|fedora)\b/.test(combined)) {
    victorianScore += 7;
  }
  // Nature / Mystic keywords
  if (/\b(forest|jungle|sylvan|botanical|garden|grove|woods|enchanted|druid|canopy|rainforest)\b/.test(combined)) {
    natureScore += 6;
  }

  const maxScore = Math.max(
    modernScore,
    cyberScore,
    spaceScore,
    ancientScore,
    fantasyScore,
    alpineScore,
    pirateScore,
    victorianScore,
    natureScore
  );

  let archetype: CharacterArchetype = "modern_urban";
  if (maxScore > 0) {
    if (maxScore === cyberScore) archetype = "cyberpunk_neon";
    else if (maxScore === spaceScore) archetype = "sci_fi_space";
    else if (maxScore === ancientScore) archetype = "ancient_antiquity";
    else if (maxScore === fantasyScore) archetype = "high_fantasy";
    else if (maxScore === alpineScore) archetype = "wilderness_alpine";
    else if (maxScore === pirateScore) archetype = "maritime_pirate";
    else if (maxScore === victorianScore) archetype = "victorian_noir";
    else if (maxScore === natureScore) archetype = "nature_mystic";
    else archetype = "modern_urban";
  }

  const roomAccent = palette?.accent_color || "#38bdf8";

  switch (archetype) {
    case "modern_urban":
      return {
        archetype,
        roleBadge: "URBAN RESIDENT",
        garmentColor: "#1e293b",       // Tailored dark jacket
        secondaryColor: "#0284c7",     // Modern blue inner tee/accent
        accentColor: roomAccent,       // Captures ambient city billboards
        leatherColor: "#0f172a",       // Dark denim jeans & leather
        metalColor: "#e2e8f0",         // Clean sneaker rubber & hardware
        skinTone: "#d4a37f",
        hairColor: "#171717",
        visorGlow: "#38bdf8",
        heldItemKind: "smartphone",
      };

    case "cyberpunk_neon":
      return {
        archetype,
        roleBadge: "NETRUNNER OPERATIVE",
        garmentColor: "#09090b",       // Matte obsidian tech-chassis
        secondaryColor: "#18181b",     // Carbon fiber weave
        accentColor: roomAccent || "#06b6d4", // Electric cyan / hot pink
        leatherColor: "#18181b",       // Tactical leg armor
        metalColor: "#38bdf8",         // Chrome bionic arm & pistons
        skinTone: "#e2e8f0",
        hairColor: "#0284c7",
        visorGlow: roomAccent || "#22d3ee",
        heldItemKind: "datapad",
      };

    case "sci_fi_space":
      return {
        archetype,
        roleBadge: "EVA FLIGHT SPECIALIST",
        garmentColor: "#f8fafc",       // Pressurized aerospace white suit
        secondaryColor: "#64748b",     // Joint thermal baffles
        accentColor: "#f97316",        // High-vis orange telemetry
        leatherColor: "#334155",       // Mag-seal lunar boots
        metalColor: "#f59e0b",         // Gold-mirrored reflection visor
        skinTone: "#e2e8f0",
        hairColor: "#38bdf8",
        visorGlow: "#fbbf24",
        heldItemKind: "scanner",
      };

    case "ancient_antiquity":
      return {
        archetype,
        roleBadge: "ROYAL CHRONICLER",
        garmentColor: "#fdf6e2",       // Pleated alabaster linen
        secondaryColor: "#1e3a8a",     // Lapis lazuli sash
        accentColor: "#fbbf24",        // Electrum gold jewelry
        leatherColor: "#451a03",       // Leather gladiator sandals
        metalColor: "#f59e0b",         // Polished bronze greaves
        skinTone: "#c2824f",
        hairColor: "#1a130f",
        visorGlow: "#fbbf24",
        heldItemKind: "astrolabe",
      };

    case "high_fantasy":
      return {
        archetype,
        roleBadge: "VANGUARD PALADIN",
        garmentColor: "#334155",       // Fluted steel plate armor
        secondaryColor: "#7f1d1d",     // Royal crimson cape
        accentColor: "#f59e0b",        // Brass heraldry
        leatherColor: "#291809",       // Heavy weapon belt
        metalColor: "#cbd5e1",         // Burnished steel
        skinTone: "#d8a278",
        hairColor: "#2b1d14",
        visorGlow: "#34d399",
        heldItemKind: "staff",
      };

    case "wilderness_alpine":
      return {
        archetype,
        roleBadge: "SUMMIT EXPEDITION SCOUT",
        garmentColor: "#1d4ed8",       // Quilted puffy down parka
        secondaryColor: "#ea580c",     // High-vis storm baffles
        accentColor: "#7dd3fc",        // Polarized UV lens tint
        leatherColor: "#1e293b",       // Double mountaineering boots
        metalColor: "#94a3b8",         // Aircraft alloy carabiners
        skinTone: "#cf966d",
        hairColor: "#1e1b18",
        visorGlow: "#38bdf8",
        heldItemKind: "ice_axe",
      };

    case "maritime_pirate":
      return {
        archetype,
        roleBadge: "BUCCANEER CAPTAIN",
        garmentColor: "#0f172a",       // Wool frock coat
        secondaryColor: "#0d9488",     // Seafoam jabot
        accentColor: "#b45309",        // Brass buttons
        leatherColor: "#3b1e0d",       // Cuffed sea boots
        metalColor: "#d97706",         // Brass spyglass
        skinTone: "#b8764a",
        hairColor: "#1c1512",
        visorGlow: "#facc15",
        heldItemKind: "spyglass",
      };

    case "victorian_noir":
      return {
        archetype,
        roleBadge: "CHIEF INVESTIGATOR",
        garmentColor: "#18181b",       // Tailored wool overcoat
        secondaryColor: "#451a03",     // Waistcoat
        accentColor: "#d97706",        // Gold watch chain
        leatherColor: "#1c1917",       // Polished Oxford shoes
        metalColor: "#eab308",         // Brass watch case
        skinTone: "#d4a37f",
        hairColor: "#262626",
        visorGlow: "#facc15",
        heldItemKind: "chronicle",
      };

    case "nature_mystic":
    default:
      return {
        archetype: "nature_mystic",
        roleBadge: "SYLVAN WAYFINDER",
        garmentColor: "#14532d",       // Forest emerald tunic
        secondaryColor: "#1c1917",     // Weathered bark brown
        accentColor: "#4ade80",        // Luminous runic focus
        leatherColor: "#3d2616",       // Ranger boots
        metalColor: "#ca8a04",         // Antique bronze clasp
        skinTone: "#cf966d",
        hairColor: "#1c1917",
        visorGlow: "#4ade80",
        heldItemKind: "staff",
      };
  }
}

interface SingleNPCProps {
  npc: NPCAgent;
  index: number;
  total: number;
  worldPrompt: string;
  roomContext: string;
  visualPalette?: RoomVisualPalette;
  onSelect?: (npcId: string) => void;
}

function SingleNPC({
  npc,
  index,
  total,
  worldPrompt,
  roomContext,
  visualPalette,
  onSelect,
}: SingleNPCProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const backPropRef = useRef<THREE.Group>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const datapadHoloRef = useRef<THREE.Mesh>(null);

  const [hovered, setHovered] = useState(false);
  const selectedNpcId = useWorldStore((state) => state.selectedNpcId);
  const isSelected = selectedNpcId === npc.npc_id;

  // Derive style strictly from the prompt and room context
  const style = useMemo(
    () =>
      inferPromptCharacterStyle(
        worldPrompt,
        roomContext,
        npc.name,
        npc.persona_description,
        visualPalette
      ),
    [worldPrompt, roomContext, npc.name, npc.persona_description, visualPalette]
  );

  // Eye-level placement: floor is at y = -6.0; standing character base rests exactly at y = -6.0
  const basePosition = useMemo(() => {
    const spread = total > 1 ? (index - (total - 1) / 2) * 0.45 : -0.25;
    const rawTheta = npc.position?.theta;
    const angle =
      typeof rawTheta === "number" && Math.abs(rawTheta) <= 1.4 ? rawTheta : spread;
    const distance = 17.5; // Natural conversational distance
    const x = distance * Math.sin(angle);
    const z = -distance * Math.cos(angle);
    return new THREE.Vector3(x, -6.0, z);
  }, [npc.position, index, total]);

  const walkPhaseRef = useRef<number>(index * 1.8);

  const guideState = useWorldStore((s) => s.guideState);
  const isGuide = Boolean(guideState && (guideState.agentId === npc.npc_id || npc.name.toLowerCase().includes("tariq") || npc.name.toLowerCase().includes("guide")));
  const isStalling = isGuide && Boolean(guideState?.isStalling);

  // Floating holographic HUD nameplate matching prompt style
  const nametagTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Sleek frosted glass dark pill
    ctx.fillStyle = "rgba(10, 14, 22, 0.92)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 624, 144, 20);
    ctx.fill();

    // Glowing border matching room accent or guide status
    const borderCol = isStalling
      ? "#ef4444"
      : isGuide
      ? "#22c55e"
      : isSelected || hovered
      ? "#facc15"
      : style.accentColor;

    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(8, 8, 624, 144, 20);
    ctx.stroke();

    // Inhabitant badge header
    const badgeText = isGuide
      ? isStalling
        ? "[ INVESTIGATING ANCIENT RUNES ]"
        : "[ GUIDE ]"
      : `[ ${style.roleBadge} ]`;

    const badgeColor = isGuide ? (isStalling ? "#ef4444" : "#22c55e") : style.accentColor;

    ctx.fillStyle = badgeColor;
    ctx.font = "bold 19px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(badgeText, 320, 42);

    // Character Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px 'Segoe UI', sans-serif";
    ctx.fillText(npc.name.toUpperCase(), 320, 84);

    // Interaction hint
    ctx.fillStyle = isStalling ? "#fca5a5" : isSelected || hovered ? "#fde047" : "#94a3b8";
    ctx.font = "italic 18px 'Segoe UI', sans-serif";
    ctx.fillText(
      isStalling ? "Studying the ancient archway..." : "Click to Converse",
      320,
      124
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [npc.name, style, isSelected, hovered, isGuide, isStalling]);

  useFrame(({ clock, camera }, delta) => {
    const elapsed = clock.getElapsedTime();
    if (!groupRef.current) return;

    const isPaused = hovered || isSelected;
    if (!isPaused) {
      walkPhaseRef.current += delta * 0.45;
    }

    const t = walkPhaseRef.current;
    const patrolRadiusX = 5.5;
    const patrolRadiusZ = 3.2;
    const offsetX = Math.sin(t) * patrolRadiusX;
    const offsetZ = Math.sin(t * 2.0) * patrolRadiusZ;

    const targetX = basePosition.x + offsetX;
    const targetZ = basePosition.z + offsetZ;

    const strideCycle = t * 6.0;
    const bobY = isPaused
      ? Math.sin(elapsed * 2.0) * 0.03
      : Math.abs(Math.sin(strideCycle)) * 0.16;

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.1);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.1);
    groupRef.current.position.y = basePosition.y + bobY;

    // Smooth head & body turning to look directly at the player
    let desiredYaw: number;
    if (isPaused) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      desiredYaw = Math.atan2(camera.position.x - worldPos.x, camera.position.z - worldPos.z);
    } else {
      const vx = Math.cos(t) * patrolRadiusX;
      const vz = Math.cos(t * 2.0) * 2.0 * patrolRadiusZ;
      desiredYaw = Math.atan2(vx, vz);
    }

    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, desiredYaw, 0.1);

    // Natural multi-joint human gait
    const swing = isPaused ? 0 : Math.sin(strideCycle);
    if (torsoRef.current) {
      torsoRef.current.rotation.y = swing * 0.06;
      torsoRef.current.rotation.z = Math.cos(strideCycle) * 0.02;
    }
    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = -swing * 0.05 + Math.sin(elapsed * 1.2) * 0.05;
      headGroupRef.current.rotation.x = Math.sin(elapsed * 1.5) * 0.03;
    }
    if (leftArmRef.current && leftForearmRef.current) {
      leftArmRef.current.rotation.x = swing * 0.28;
      leftForearmRef.current.rotation.x = -0.2 - Math.max(0, -swing) * 0.2;
    }
    if (rightArmRef.current && rightForearmRef.current) {
      rightArmRef.current.rotation.x = -0.25 - swing * 0.15;
      rightForearmRef.current.rotation.x = -0.4;
    }
    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = -swing * 0.32;
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = swing * 0.32;
    }
    if (auraRef.current) {
      auraRef.current.rotation.z = elapsed * 0.4;
    }
    if (datapadHoloRef.current) {
      datapadHoloRef.current.rotation.y = elapsed * 0.8;
      const mat = datapadHoloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.65 + Math.sin(elapsed * 4.0) * 0.2;
    }
  });

  const charScale = 0.165;
  const isModernOrCyber = style.archetype === "modern_urban" || style.archetype === "cyberpunk_neon";
  const isSpace = style.archetype === "sci_fi_space";
  const isAlpine = style.archetype === "wilderness_alpine";
  const isAncient = style.archetype === "ancient_antiquity";
  const isVictorian = style.archetype === "victorian_noir";
  const isFantasy = style.archetype === "high_fantasy";

  return (
    <group
      ref={groupRef}
      position={basePosition}
      scale={[charScale, charScale, charScale]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(npc.npc_id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        if (typeof document !== "undefined") document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        if (typeof document !== "undefined") document.body.style.cursor = "default";
      }}
    >
      {/* 1. Floating Holographic Telemetry Nameplate */}
      {nametagTexture && (
        <sprite position={[0, 44.0, 0]} scale={[24, 6.0, 1]}>
          <spriteMaterial map={nametagTexture} depthTest={false} />
        </sprite>
      )}

      {/* 2. Torso & Upper Anatomy */}
      <group ref={torsoRef}>
        {/* Head assembly */}
        <group ref={headGroupRef} position={[0, 29.5, 0]}>
          {isSpace ? (
            /* NASA/Artemis Spherical Bubble Helmet with Neck Locking Collar & Gold Solar Shield */
            <group>
              <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[5.2, 32, 32]} />
                <meshStandardMaterial color={style.garmentColor} roughness={0.15} metalness={0.1} />
              </mesh>
              {/* Gold curved solar visor shield */}
              <mesh position={[0, 0.1, 2.1]} rotation={[0.08, 0, 0]}>
                <sphereGeometry args={[4.3, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
                <meshStandardMaterial color={style.metalColor} metalness={0.96} roughness={0.05} />
              </mesh>
              {/* Neck clamp ring */}
              <mesh position={[0, -4.5, 0]}>
                <cylinderGeometry args={[4.2, 4.4, 1.2, 28]} />
                <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.2} />
              </mesh>
              {/* Helmet floodlights */}
              <mesh position={[-5.0, 1.2, 1.0]} rotation={[0, -0.2, 0]}>
                <boxGeometry args={[0.8, 0.8, 1.4]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
              </mesh>
              <mesh position={[5.0, 1.2, 1.0]} rotation={[0, 0.2, 0]}>
                <boxGeometry args={[0.8, 0.8, 1.4]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
              </mesh>
            </group>
          ) : isAlpine ? (
            /* Alpine Beanie + Heavy Tinted Spherical Glacier Goggles with Elastic Strap */
            <group>
              <mesh position={[0, 0, 0]} scale={[0.92, 1.05, 0.96]}>
                <sphereGeometry args={[4.0, 32, 32]} />
                <meshPhysicalMaterial color={style.skinTone} roughness={0.45} />
              </mesh>
              {/* Knit Beanie */}
              <mesh position={[0, 1.8, -0.2]} scale={[1.05, 1.15, 1.08]}>
                <sphereGeometry args={[4.1, 24, 24]} />
                <meshStandardMaterial color={style.secondaryColor} roughness={0.9} />
              </mesh>
              <mesh position={[0, 5.8, -0.2]}>
                <sphereGeometry args={[1.1, 16, 16]} />
                <meshStandardMaterial color={style.garmentColor} roughness={0.95} />
              </mesh>
              {/* Spherical Glacier Goggles */}
              <group position={[0, 0.6, 3.8]}>
                <mesh>
                  <boxGeometry args={[4.6, 1.6, 0.6]} />
                  <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.08} />
                </mesh>
                <mesh position={[0, 0, -3.8]}>
                  <torusGeometry args={[4.3, 0.35, 12, 32]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.8} />
                </mesh>
              </group>
            </group>
          ) : style.archetype === "cyberpunk_neon" ? (
            /* Cyberpunk Angular Augmented Faceplate & Retinal Sensor Visor */
            <group>
              <mesh position={[0, 0, 0]} scale={[0.92, 1.05, 0.96]}>
                <sphereGeometry args={[4.0, 32, 32]} />
                <meshPhysicalMaterial color={style.skinTone} roughness={0.4} />
              </mesh>
              {/* Asymmetric cyber-hair */}
              <mesh position={[0, 1.6, -0.3]} scale={[0.98, 1.1, 1.02]}>
                <sphereGeometry args={[4.2, 24, 24]} />
                <meshStandardMaterial color={style.hairColor} roughness={0.65} />
              </mesh>
              {/* Angular glowing quad-optic cyber-visor */}
              <group position={[0, 0.7, 3.8]}>
                <mesh>
                  <boxGeometry args={[4.8, 1.4, 0.6]} />
                  <meshPhysicalMaterial
                    color={style.visorGlow}
                    emissive={style.visorGlow}
                    emissiveIntensity={1.8}
                    roughness={0.1}
                    metalness={0.8}
                  />
                </mesh>
                <mesh position={[-1.2, 0, 0.35]}>
                  <cylinderGeometry args={[0.3, 0.3, 0.4, 16]} />
                  <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.0} />
                </mesh>
                <mesh position={[1.2, 0, 0.35]}>
                  <cylinderGeometry args={[0.3, 0.3, 0.4, 16]} />
                  <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.0} />
                </mesh>
              </group>
            </group>
          ) : isVictorian ? (
            /* Victorian Detective Fedora with Textured Brim & Spectacles */
            <group>
              <mesh position={[0, 0, 0]} scale={[0.92, 1.05, 0.96]}>
                <sphereGeometry args={[4.0, 32, 32]} />
                <meshPhysicalMaterial color={style.skinTone} roughness={0.45} />
              </mesh>
              {/* Fedora */}
              <group position={[0, 2.5, 0.2]} rotation={[-0.08, 0, 0]}>
                <mesh position={[0, 1.0, 0]}>
                  <cylinderGeometry args={[3.2, 3.6, 2.8, 24]} />
                  <meshStandardMaterial color={style.garmentColor} roughness={0.7} />
                </mesh>
                <mesh position={[0, -0.4, 0]}>
                  <cylinderGeometry args={[5.8, 5.8, 0.35, 24]} />
                  <meshStandardMaterial color={style.garmentColor} roughness={0.7} />
                </mesh>
                <mesh position={[0, 0.05, 0]}>
                  <cylinderGeometry args={[3.65, 3.65, 0.5, 24]} />
                  <meshStandardMaterial color={style.accentColor} roughness={0.5} />
                </mesh>
              </group>
              {/* Wireframe Spectacles */}
              <group position={[0, 0.6, 3.8]}>
                <mesh position={[-1.2, 0, 0]}>
                  <torusGeometry args={[0.7, 0.1, 8, 20]} />
                  <meshStandardMaterial color="#d97706" metalness={0.9} />
                </mesh>
                <mesh position={[1.2, 0, 0]}>
                  <torusGeometry args={[0.7, 0.1, 8, 20]} />
                  <meshStandardMaterial color="#d97706" metalness={0.9} />
                </mesh>
                <mesh position={[0, 0.15, 0]}>
                  <boxGeometry args={[0.8, 0.1, 0.1]} />
                  <meshStandardMaterial color="#d97706" metalness={0.9} />
                </mesh>
              </group>
            </group>
          ) : (
            /* Modern Urban Human Silhouette: Sculpted Hair, Defined Face, Aviator Shades, Wireless Headphones */
            <group>
              {/* Anatomical Cranium */}
              <mesh position={[0, 0, 0]} scale={[0.92, 1.05, 0.96]}>
                <sphereGeometry args={[4.0, 32, 32]} />
                <meshPhysicalMaterial color={style.skinTone} roughness={0.42} />
              </mesh>
              {/* Modern Swept-Back Hair */}
              <mesh position={[0, 1.4, -0.3]} scale={[0.98, 1.1, 1.02]}>
                <sphereGeometry args={[4.2, 24, 24]} />
                <meshStandardMaterial color={style.hairColor} roughness={0.8} />
              </mesh>
              {/* Dark Designer Acetate Sunglasses */}
              <group position={[0, 0.6, 3.8]}>
                <mesh position={[-1.3, 0, 0]}>
                  <boxGeometry args={[1.8, 1.1, 0.2]} />
                  <meshStandardMaterial color="#09090b" roughness={0.05} metalness={0.9} />
                </mesh>
                <mesh position={[1.3, 0, 0]}>
                  <boxGeometry args={[1.8, 1.1, 0.2]} />
                  <meshStandardMaterial color="#09090b" roughness={0.05} metalness={0.9} />
                </mesh>
                <mesh position={[0, 0.15, 0]}>
                  <boxGeometry args={[0.9, 0.15, 0.15]} />
                  <meshStandardMaterial color="#d4af37" metalness={0.95} />
                </mesh>
              </group>
              {/* Wireless Over-Ear Headphones Resting Around the Neck */}
              <group position={[0, -3.2, 0.2]} rotation={[0.2, 0, 0]}>
                <mesh>
                  <torusGeometry args={[3.4, 0.35, 12, 32]} />
                  <meshStandardMaterial color="#09090b" roughness={0.4} metalness={0.7} />
                </mesh>
                {/* Left headphone ear cup */}
                <mesh position={[-3.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[1.1, 1.1, 0.8, 16]} />
                  <meshStandardMaterial color="#1e293b" metalness={0.8} />
                </mesh>
                {/* Right headphone ear cup */}
                <mesh position={[3.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[1.1, 1.1, 0.8, 16]} />
                  <meshStandardMaterial color="#1e293b" metalness={0.8} />
                </mesh>
              </group>
            </group>
          )}
        </group>

        {/* Anatomical Neck Column */}
        <mesh position={[0, 24.8, 0]}>
          <cylinderGeometry args={[1.9, 2.3, 3.0, 20]} />
          <meshPhysicalMaterial color={style.skinTone} roughness={0.45} />
        </mesh>

        {/* ============================================================ */}
        {/* BESPOKE TORSO ARCHITECTURE: NO SHARED GLADIATOR SKIRT/COLLAR */}
        {/* ============================================================ */}
        {isSpace ? (
          /* Bulky Pressurized Aerospace Chest Unit with Umbilical Hoses & PLSS Backpack */
          <group position={[0, 16.5, 0]}>
            <mesh>
              <boxGeometry args={[9.4, 13.0, 6.2]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.3} metalness={0.1} />
            </mesh>
            {/* Chest-Mounted Primary Life Support Control Box */}
            <mesh position={[0, 0.8, 3.2]}>
              <boxGeometry args={[5.2, 6.0, 1.4]} />
              <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Pressure Gauges & Status LEDs */}
            <mesh position={[-1.3, 1.8, 4.0]}>
              <cylinderGeometry args={[0.7, 0.7, 0.2, 16]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={1.2} />
            </mesh>
            <mesh position={[1.3, 1.8, 4.0]}>
              <cylinderGeometry args={[0.7, 0.7, 0.2, 16]} />
              <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={1.2} />
            </mesh>
            {/* Dual Oxygen Scrubber Hoses curving into suit */}
            <mesh position={[-2.2, -1.8, 3.2]} rotation={[0, 0, 0.4]}>
              <cylinderGeometry args={[0.45, 0.45, 3.8, 12]} />
              <meshStandardMaterial color="#1e293b" roughness={0.6} />
            </mesh>
            <mesh position={[2.2, -1.8, 3.2]} rotation={[0, 0, -0.4]}>
              <cylinderGeometry args={[0.45, 0.45, 3.8, 12]} />
              <meshStandardMaterial color="#1e293b" roughness={0.6} />
            </mesh>
            {/* Giant PLSS Backpack with Dual Oxygen Tanks & Thruster Nozzles */}
            <group ref={backPropRef} position={[0, 1.0, -4.5]}>
              <mesh>
                <boxGeometry args={[8.8, 13.5, 4.2]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.5} />
              </mesh>
              {/* Dual O2 Cylinders */}
              <mesh position={[-2.4, 1.5, -2.2]}>
                <cylinderGeometry args={[1.4, 1.4, 9.5, 16]} />
                <meshStandardMaterial color={style.accentColor} metalness={0.7} />
              </mesh>
              <mesh position={[2.4, 1.5, -2.2]}>
                <cylinderGeometry args={[1.4, 1.4, 9.5, 16]} />
                <meshStandardMaterial color={style.accentColor} metalness={0.7} />
              </mesh>
              {/* Thruster Nozzles */}
              <mesh position={[-3.6, 5.0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.6, 0.9, 1.2, 12]} />
                <meshPhysicalMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={1.5} />
              </mesh>
              <mesh position={[3.6, 5.0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <cylinderGeometry args={[0.6, 0.9, 1.2, 12]} />
                <meshPhysicalMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={1.5} />
              </mesh>
            </group>
          </group>
        ) : isAlpine ? (
          /* Bulky Quilted Down Parka with Stacked Horizontal Down Baffles & Expedition Backpack */
          <group position={[0, 16.5, 0]}>
            {/* Stacked Down Baffles (Voluminous Puffy Jacket) */}
            <mesh position={[0, 3.5, 0]} scale={[1.25, 0.85, 1.0]}>
              <cylinderGeometry args={[5.2, 5.6, 3.2, 24]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.5, 0]} scale={[1.28, 0.85, 1.02]}>
              <cylinderGeometry args={[5.6, 5.8, 3.2, 24]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.6} />
            </mesh>
            <mesh position={[0, -2.5, 0]} scale={[1.26, 0.85, 1.0]}>
              <cylinderGeometry args={[5.7, 5.5, 3.2, 24]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.6} />
            </mesh>
            {/* Center Storm Flap Zipper */}
            <mesh position={[0, 0.5, 3.0]}>
              <boxGeometry args={[0.9, 10.0, 0.3]} />
              <meshStandardMaterial color={style.secondaryColor} />
            </mesh>
            {/* 80L Expedition Backpack with Rolled Sleeping Mat & Climbing Rope */}
            <group position={[0, 1.5, -4.2]}>
              <mesh>
                <boxGeometry args={[8.2, 14.5, 4.6]} />
                <meshStandardMaterial color={style.secondaryColor} roughness={0.8} />
              </mesh>
              {/* Rolled Sleeping Mat on Top */}
              <mesh position={[0, 8.2, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[1.5, 1.5, 8.8, 16]} />
                <meshStandardMaterial color="#facc15" roughness={0.9} />
              </mesh>
              {/* Climbing Rope Coil on Side */}
              <mesh position={[-4.5, -1.0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[1.8, 0.5, 10, 24]} />
                <meshStandardMaterial color="#eab308" roughness={0.9} />
              </mesh>
            </group>
          </group>
        ) : style.archetype === "cyberpunk_neon" ? (
          /* Angular Segmented Carbon-Fiber Cyber-Chassis with Sternum Power Reactor & Mechanical Spine */
          <group position={[0, 16.5, 0]}>
            <mesh>
              <boxGeometry args={[7.8, 12.8, 4.6]} />
              <meshStandardMaterial color={style.garmentColor} metalness={0.85} roughness={0.2} />
            </mesh>
            {/* Glowing Sternum Power Reactor */}
            <mesh position={[0, 2.0, 2.4]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[1.4, 1.4, 0.5, 6]} />
              <meshPhysicalMaterial
                color={style.visorGlow}
                emissive={style.visorGlow}
                emissiveIntensity={2.5}
                roughness={0.1}
              />
            </mesh>
            {/* Segmented Cyber-Spine down the back */}
            {[-4.0, -2.0, 0.0, 2.0, 4.0].map((yOff, i) => (
              <mesh key={i} position={[0, yOff, -2.5]}>
                <boxGeometry args={[2.0, 1.2, 0.8]} />
                <meshStandardMaterial color={style.metalColor} metalness={0.9} roughness={0.15} />
              </mesh>
            ))}
            {/* Tactical Webbing & Buckles */}
            <mesh position={[0, -5.5, 0]}>
              <boxGeometry args={[8.0, 1.4, 4.8]} />
              <meshStandardMaterial color="#0f172a" roughness={0.5} />
            </mesh>
            <mesh position={[0, -5.5, 2.5]}>
              <boxGeometry args={[1.6, 1.6, 0.3]} />
              <meshStandardMaterial color={style.accentColor} metalness={0.9} />
            </mesh>
          </group>
        ) : isVictorian ? (
          /* Victorian Double-Breasted Waistcoat with Tailcoat Tails Hanging in the BACK ONLY */
          <group position={[0, 16.5, 0]}>
            <mesh>
              <boxGeometry args={[7.2, 12.5, 4.2]} />
              <meshStandardMaterial color={style.secondaryColor} roughness={0.6} />
            </mesh>
            {/* Formal Lapels */}
            <mesh position={[-1.8, 2.5, 2.2]} rotation={[0, 0, -0.2]}>
              <boxGeometry args={[1.8, 6.0, 0.4]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.5} />
            </mesh>
            <mesh position={[1.8, 2.5, 2.2]} rotation={[0, 0, 0.2]}>
              <boxGeometry args={[1.8, 6.0, 0.4]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.5} />
            </mesh>
            {/* Gold Pocket Watch Chain */}
            <mesh position={[1.2, -2.5, 2.2]} rotation={[0, 0, 0.4]}>
              <cylinderGeometry args={[0.08, 0.08, 3.2, 8]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.95} />
            </mesh>
            {/* Tailcoat Tails (BACK ONLY - FRONT IS COMPLETELY OPEN TO SHOW TROUSERS!) */}
            <mesh position={[-1.8, -10.0, -2.1]} rotation={[0.08, 0, 0]}>
              <boxGeometry args={[2.8, 9.0, 0.3]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.6} />
            </mesh>
            <mesh position={[1.8, -10.0, -2.1]} rotation={[0.08, 0, 0]}>
              <boxGeometry args={[2.8, 9.0, 0.3]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.6} />
            </mesh>
          </group>
        ) : isAncient ? (
          /* Classical Draped Linen Toga / Royal Sash (ONLY when prompt is ancient) */
          <group position={[0, 16.5, 0]}>
            <mesh scale={[1.15, 1.0, 0.85]}>
              <cylinderGeometry args={[5.2, 4.6, 13.0, 32]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.6} />
            </mesh>
            {/* Royal sash across chest */}
            <mesh position={[0, 1.2, 0.2]} rotation={[0, 0, 0.6]} scale={[1.2, 0.3, 0.9]}>
              <cylinderGeometry args={[5.3, 5.3, 3.0, 24]} />
              <meshStandardMaterial color={style.secondaryColor} roughness={0.5} />
            </mesh>
            {/* Gold Pectoral Collar */}
            <mesh position={[0, 6.2, 0]} scale={[1.2, 1.0, 0.9]}>
              <cylinderGeometry args={[5.4, 6.8, 2.0, 32]} />
              <meshStandardMaterial color={style.accentColor} metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ) : (
          /* Modern Urban Contemporary: Open Tailored Streetwear Jacket / Hoodie + Inner Tee + Belt */
          <group position={[0, 16.5, 0]}>
            {/* Inner T-Shirt / Mockneck Layer */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[6.8, 12.8, 4.0]} />
              <meshStandardMaterial color={style.secondaryColor} roughness={0.7} />
            </mesh>
            {/* Open Left Jacket Flap */}
            <mesh position={[-2.4, 0, 0.3]}>
              <boxGeometry args={[2.6, 13.2, 4.2]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.5} />
            </mesh>
            {/* Open Right Jacket Flap */}
            <mesh position={[2.4, 0, 0.3]}>
              <boxGeometry args={[2.6, 13.2, 4.2]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.5} />
            </mesh>
            {/* Jacket Back */}
            <mesh position={[0, 0, -2.0]}>
              <boxGeometry args={[7.4, 13.2, 0.8]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.5} />
            </mesh>
            {/* Folded Jacket Collar Lapels */}
            <mesh position={[-2.2, 5.0, 2.3]} rotation={[0, 0, -0.25]}>
              <boxGeometry args={[1.6, 3.5, 0.4]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.4} />
            </mesh>
            <mesh position={[2.2, 5.0, 2.3]} rotation={[0, 0, 0.25]}>
              <boxGeometry args={[1.6, 3.5, 0.4]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.4} />
            </mesh>
            {/* Visible Belt & Buckle at Waist (NO SKIRT HIDING IT!) */}
            <mesh position={[0, -5.6, 0]}>
              <boxGeometry args={[7.0, 1.2, 4.2]} />
              <meshStandardMaterial color="#09090b" roughness={0.4} />
            </mesh>
            <mesh position={[0, -5.6, 2.2]}>
              <boxGeometry args={[1.5, 1.4, 0.3]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
            </mesh>
          </group>
        )}

        {/* Arms: Tailored to Archetype */}
        {/* Left Arm */}
        <group ref={leftArmRef} position={[-5.6, 21.0, 0]} rotation={[0, 0, 0.1]}>
          <mesh position={[0, -2.8, 0]}>
            <cylinderGeometry args={[1.4, 1.2, 5.8, 16]} />
            <meshStandardMaterial color={style.garmentColor} roughness={0.5} />
          </mesh>
          <group ref={leftForearmRef} position={[0, -5.8, 0]} rotation={[-0.2, 0, 0]}>
            <mesh position={[0, -2.5, 0]}>
              <cylinderGeometry args={[1.15, 0.95, 5.0, 16]} />
              <meshStandardMaterial color={style.garmentColor} roughness={0.5} />
            </mesh>
            {/* Wrist Cuff / Watch */}
            <mesh position={[0, -4.6, 0]}>
              <cylinderGeometry args={[1.05, 1.05, 0.6, 16]} />
              <meshStandardMaterial color={style.metalColor} metalness={0.9} />
            </mesh>
            {/* Hand */}
            <mesh position={[0, -5.6, 0]}>
              <sphereGeometry args={[0.95, 16, 16]} />
              <meshPhysicalMaterial color={style.skinTone} roughness={0.45} />
            </mesh>
          </group>
        </group>

        {/* Right Arm: Holding Prompt Gear */}
        <group ref={rightArmRef} position={[5.6, 21.0, 0]} rotation={[-0.25, 0, -0.1]}>
          <mesh position={[0, -2.8, 0]}>
            <cylinderGeometry args={[1.4, 1.2, 5.8, 16]} />
            <meshStandardMaterial
              color={style.archetype === "cyberpunk_neon" ? style.metalColor : style.garmentColor}
              metalness={style.archetype === "cyberpunk_neon" ? 0.9 : 0.2}
              roughness={0.4}
            />
          </mesh>
          <group ref={rightForearmRef} position={[0, -5.8, 0]} rotation={[-0.35, 0, 0]}>
            <mesh position={[0, -2.5, 0]}>
              <cylinderGeometry args={[1.15, 0.95, 5.0, 16]} />
              <meshStandardMaterial
                color={style.archetype === "cyberpunk_neon" ? style.metalColor : style.garmentColor}
                metalness={style.archetype === "cyberpunk_neon" ? 0.9 : 0.2}
              />
            </mesh>
            <mesh position={[0, -5.6, 0]}>
              <sphereGeometry args={[0.95, 16, 16]} />
              <meshPhysicalMaterial color={style.skinTone} roughness={0.45} />
            </mesh>

            {/* Held Item Based Directly On Prompt */}
            {style.heldItemKind === "smartphone" ? (
              /* Modern Glass Touchscreen Smartphone with Bright Display */
              <group position={[0, -5.2, 1.0]} rotation={[0.45, 0, 0]}>
                <mesh>
                  <boxGeometry args={[1.6, 3.2, 0.2]} />
                  <meshStandardMaterial color="#09090b" metalness={0.95} roughness={0.1} />
                </mesh>
                <mesh position={[0, 0, 0.12]}>
                  <boxGeometry args={[1.45, 2.9, 0.05]} />
                  <meshPhysicalMaterial
                    color="#38bdf8"
                    emissive={style.accentColor}
                    emissiveIntensity={1.5}
                  />
                </mesh>
              </group>
            ) : style.heldItemKind === "datapad" ? (
              /* Cyberpunk Holographic Terminal */
              <group position={[0, -5.2, 1.0]} rotation={[0.45, 0, 0]}>
                <mesh>
                  <boxGeometry args={[2.2, 3.4, 0.25]} />
                  <meshStandardMaterial color="#18181b" metalness={0.85} />
                </mesh>
                <mesh position={[0, 0, 0.15]}>
                  <boxGeometry args={[1.9, 2.9, 0.05]} />
                  <meshPhysicalMaterial color="#06b6d4" emissive={style.accentColor} emissiveIntensity={1.8} />
                </mesh>
                <mesh ref={datapadHoloRef} position={[0, 1.6, 1.0]}>
                  <octahedronGeometry args={[1.1, 0]} />
                  <meshBasicMaterial color={style.accentColor} wireframe transparent opacity={0.7} />
                </mesh>
              </group>
            ) : style.heldItemKind === "ice_axe" ? (
              /* Mountaineering Ice Axe */
              <group position={[0, -5.2, 1.0]} rotation={[0.45, 0, 0]}>
                <mesh position={[0, 3.0, 0]}>
                  <cylinderGeometry args={[0.25, 0.22, 20, 12]} />
                  <meshStandardMaterial color={style.metalColor} metalness={0.9} />
                </mesh>
                <mesh position={[0, 13.0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <boxGeometry args={[1.1, 6.0, 0.3]} />
                  <meshStandardMaterial color={style.metalColor} metalness={0.95} />
                </mesh>
              </group>
            ) : (
              /* Telemetry Scanner / Focus */
              <group position={[0, -5.2, 1.0]} rotation={[0.4, 0, 0]}>
                <mesh position={[0, 1.5, 0]}>
                  <boxGeometry args={[1.5, 6.0, 2.0]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} />
                </mesh>
                <mesh position={[0, 5.0, 0]}>
                  <cylinderGeometry args={[0.2, 0.25, 8.0, 8]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
                </mesh>
                <mesh position={[0, 9.5, 0]}>
                  <sphereGeometry args={[0.6, 12, 12]} />
                  <meshPhysicalMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={1.6} />
                </mesh>
              </group>
            )}
          </group>
        </group>
      </group>

      {/* ============================================================ */}
      {/* 3. TWO DISTINCT INDEPENDENT LEGS: ZERO GLADIATOR SKIRT!      */}
      {/* ============================================================ */}
      {/* LEFT LEG */}
      <group ref={leftLegRef} position={[-2.1, 9.5, 0]}>
        {/* Left Thigh (Independent pant leg) */}
        <mesh position={[0, -4.5, 0]}>
          <cylinderGeometry
            args={[
              isSpace ? 1.8 : isAlpine ? 1.9 : 1.4,
              isSpace ? 1.6 : isAlpine ? 1.7 : 1.25,
              9.0,
              20,
            ]}
          />
          <meshStandardMaterial color={style.leatherColor} roughness={0.55} />
        </mesh>
        {/* Left Knee Guard / Articulation */}
        <mesh position={[0, -9.2, 0.8]}>
          <boxGeometry args={[isSpace ? 2.8 : 2.2, 1.8, 0.5]} />
          <meshStandardMaterial
            color={isModernOrCyber ? "#18181b" : style.secondaryColor}
            roughness={0.4}
            metalness={style.archetype === "cyberpunk_neon" ? 0.8 : 0.2}
          />
        </mesh>
        {/* Left Lower Calf */}
        <mesh position={[0, -13.5, 0]}>
          <cylinderGeometry
            args={[
              isSpace ? 1.6 : isAlpine ? 1.7 : 1.2,
              isSpace ? 1.5 : isAlpine ? 1.6 : 1.1,
              7.5,
              20,
            ]}
          />
          <meshStandardMaterial color={style.leatherColor} roughness={0.55} />
        </mesh>
        {/* Left Foot: Contemporary Designer Sneaker / Space Boot / Lugged Boot */}
        <group position={[0, -18.2, 0.8]}>
          {/* Main Shoe Body */}
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[2.3, 1.8, 4.6]} />
            <meshStandardMaterial
              color={isModernOrCyber ? style.garmentColor : style.leatherColor}
              roughness={0.4}
            />
          </mesh>
          {/* Thick Sculpted Sneaker Midsole/Outsole */}
          <mesh position={[0, -0.6, 0]}>
            <boxGeometry args={[2.5, 0.7, 5.0]} />
            <meshStandardMaterial color={style.metalColor} roughness={0.7} />
          </mesh>
          {/* Sneaker Toe Box Accent */}
          <mesh position={[0, 0.2, 1.8]}>
            <boxGeometry args={[2.1, 1.2, 1.2]} />
            <meshStandardMaterial color={style.secondaryColor} />
          </mesh>
        </group>
      </group>

      {/* RIGHT LEG */}
      <group ref={rightLegRef} position={[2.1, 9.5, 0]}>
        {/* Right Thigh (Independent pant leg) */}
        <mesh position={[0, -4.5, 0]}>
          <cylinderGeometry
            args={[
              isSpace ? 1.8 : isAlpine ? 1.9 : 1.4,
              isSpace ? 1.6 : isAlpine ? 1.7 : 1.25,
              9.0,
              20,
            ]}
          />
          <meshStandardMaterial color={style.leatherColor} roughness={0.55} />
        </mesh>
        {/* Right Knee Guard / Articulation */}
        <mesh position={[0, -9.2, 0.8]}>
          <boxGeometry args={[isSpace ? 2.8 : 2.2, 1.8, 0.5]} />
          <meshStandardMaterial
            color={isModernOrCyber ? "#18181b" : style.secondaryColor}
            roughness={0.4}
            metalness={style.archetype === "cyberpunk_neon" ? 0.8 : 0.2}
          />
        </mesh>
        {/* Right Lower Calf */}
        <mesh position={[0, -13.5, 0]}>
          <cylinderGeometry
            args={[
              isSpace ? 1.6 : isAlpine ? 1.7 : 1.2,
              isSpace ? 1.5 : isAlpine ? 1.6 : 1.1,
              7.5,
              20,
            ]}
          />
          <meshStandardMaterial color={style.leatherColor} roughness={0.55} />
        </mesh>
        {/* Right Foot: Contemporary Designer Sneaker / Space Boot / Lugged Boot */}
        <group position={[0, -18.2, 0.8]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[2.3, 1.8, 4.6]} />
            <meshStandardMaterial
              color={isModernOrCyber ? style.garmentColor : style.leatherColor}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0, -0.6, 0]}>
            <boxGeometry args={[2.5, 0.7, 5.0]} />
            <meshStandardMaterial color={style.metalColor} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.2, 1.8]}>
            <boxGeometry args={[2.1, 1.2, 1.2]} />
            <meshStandardMaterial color={style.secondaryColor} />
          </mesh>
        </group>
      </group>

      {/* 4. Soft Ground Contact Shadow Disc (grounds character into the floor) */}
      <mesh position={[0, -9.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7.2, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.45} depthWrite={false} />
      </mesh>

      {/* 5. Selection / Hover Ring */}
      <mesh ref={auraRef} position={[0, -9.7, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.5, 8.8, 48]} />
        <meshBasicMaterial
          color={isSelected || hovered ? "#facc15" : style.accentColor}
          side={THREE.DoubleSide}
          transparent
          opacity={isSelected ? 0.95 : hovered ? 0.8 : 0.3}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

interface CharacterSpawnerProps {
  npcs: NPCAgent[];
  worldPrompt?: string;
  roomContext?: string;
  visualPalette?: RoomVisualPalette;
  onNPCSelect?: (npcId: string) => void;
}

export function CharacterSpawner({
  npcs,
  worldPrompt = "",
  roomContext = "",
  visualPalette,
  onNPCSelect,
}: CharacterSpawnerProps) {
  const selectNPC = useWorldStore((state) => state.selectNPC);
  const currentRoomId = useWorldStore((state) => state.currentRoomId);
  const rooms = useWorldStore((state) => state.rooms);
  const worldTitle = useWorldStore((state) => state.worldTitle);
  const storePrompt = useWorldStore((state) => state.worldPrompt);

  const activePrompt = worldPrompt || storePrompt || worldTitle || "";
  const activeRoom = rooms[currentRoomId];
  const activeContext =
    roomContext ||
    `${activeRoom?.biome_type || ""} ${activeRoom?.name || ""} ${worldTitle || ""}`;
  const activePalette = visualPalette || activeRoom?.visual_palette;

  const handleSelect = (npcId: string) => {
    selectNPC(npcId);
    if (onNPCSelect) onNPCSelect(npcId);
  };

  if (!npcs || npcs.length === 0) {
    return null;
  }

  return (
    <group name="character-spawner-layer">
      {npcs.map((npc, idx) => (
        <SingleNPC
          key={npc.npc_id}
          npc={npc}
          index={idx}
          total={npcs.length}
          worldPrompt={activePrompt}
          roomContext={activeContext}
          visualPalette={activePalette}
          onSelect={handleSelect}
        />
      ))}
    </group>
  );
}
