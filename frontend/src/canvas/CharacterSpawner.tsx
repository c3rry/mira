// photorealistic pbr articulated humanoid npc spawner with normal/roughness material maps, natural facial anatomy, and draped cloth
"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NPCAgent, useWorldStore } from "../store/useWorldStore";

interface SingleNPCProps {
  npc: NPCAgent;
  index: number;
  total: number;
  biome: string;
  onSelect?: (npcId: string) => void;
}

function SingleNPC({ npc, index, total, biome, onSelect }: SingleNPCProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const capeRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const selectedNpcId = useWorldStore((state) => state.selectedNpcId);
  const isSelected = selectedNpcId === npc.npc_id;

  // ground character directly on the eye-level floor plane (y = -4.25 so boots rest at y = -6.0)
  const basePosition = useMemo(() => {
    const spread = total > 1 ? (index - (total - 1) / 2) * 0.55 : -0.22;
    const rawTheta = npc.position?.theta;
    const angle =
      typeof rawTheta === "number" && Math.abs(rawTheta) <= 1.2 ? rawTheta : spread;
    const distance = 21.0;
    const x = distance * Math.sin(angle);
    const z = -distance * Math.cos(angle);
    return new THREE.Vector3(x, -4.25, z);
  }, [npc.position, index, total]);

  const walkPhaseRef = useRef<number>(index * 2.1);

  const morphology = useMemo(() => {
    const text = `${npc.name} ${npc.persona_description || ""} ${biome}`.toLowerCase();
    if (
      text.includes("angler") ||
      text.includes("fish") ||
      text.includes("ocean") ||
      text.includes("abyss") ||
      text.includes("benthic") ||
      text.includes("trench") ||
      text.includes("creature") ||
      text.includes("manta") ||
      text.includes("crustacean")
    ) {
      return "aquatic_abyssal";
    }
    if (
      text.includes("alien") ||
      text.includes("droid") ||
      text.includes("rover") ||
      text.includes("drone") ||
      text.includes("automaton") ||
      text.includes("golem") ||
      text.includes("synthet")
    ) {
      return "construct_automaton";
    }
    if (
      text.includes("astronaut") ||
      text.includes("commander") ||
      text.includes("pilot") ||
      text.includes("sol") ||
      text.includes("chang'e") ||
      text.includes("collins") ||
      text.includes("armstrong") ||
      text.includes("lunar") ||
      text.includes("moon") ||
      text.includes("mars")
    ) {
      return "space_explorer";
    }
    if (
      text.includes("sherpa") ||
      text.includes("yeti") ||
      text.includes("beast") ||
      text.includes("wolf") ||
      text.includes("falcon") ||
      text.includes("ranger") ||
      text.includes("pathfinder")
    ) {
      return "wilderness_scout";
    }
    return "humanoid_scholar";
  }, [npc.name, npc.persona_description, biome]);

  const palette = useMemo(() => {
    const b = biome.toLowerCase();
    if (morphology === "aquatic_abyssal") {
      return {
        garment: "#0f172a",
        secondaryGarment: "#0284c7",
        trim: "#06b6d4",
        mantle: "#0369a1",
        skin: "#0284c7",
        hair: "#0c4a6e",
        headpiece: "#22d3ee",
        leather: "#082f49",
      };
    }
    if (morphology === "space_explorer") {
      return {
        garment: "#f8fafc",
        secondaryGarment: "#94a3b8",
        trim: "#e2e8f0",
        mantle: "#0284c7",
        skin: "#e2e8f0",
        hair: "#38bdf8",
        headpiece: "#f59e0b",
        leather: "#334155",
      };
    }
    if (morphology === "construct_automaton") {
      return {
        garment: "#334155",
        secondaryGarment: "#64748b",
        trim: "#f59e0b",
        mantle: "#0f172a",
        skin: "#94a3b8",
        hair: "#e2e8f0",
        headpiece: "#10b981",
        leather: "#1e293b",
      };
    }
    if (b.includes("desert") || b.includes("giza") || b.includes("pyramid") || b.includes("ruin")) {
      return {
        garment: "#efe3c8",
        secondaryGarment: "#d6c299",
        trim: "#c59b27",
        mantle: "#6b3e16",
        skin: "#c2824f",
        hair: "#1c1512",
        headpiece: "#c59b27",
        leather: "#4a2c11",
      };
    }
    if (b.includes("tavern") || b.includes("medieval") || b.includes("roman") || b.includes("rome") || b.includes("athens")) {
      return {
        garment: "#6e1e14",
        secondaryGarment: "#e8dec8",
        trim: "#c8963e",
        mantle: "#3d140a",
        skin: "#d8a278",
        hair: "#2b1d14",
        headpiece: "#b8860b",
        leather: "#3b2313",
      };
    }
    if (b.includes("forest") || b.includes("cavern") || b.includes("garden") || b.includes("babylon")) {
      return {
        garment: "#18452b",
        secondaryGarment: "#d8cbb0",
        trim: "#c59b27",
        mantle: "#0f2e1c",
        skin: "#c98e62",
        hair: "#211712",
        headpiece: "#b8860b",
        leather: "#3d2616",
      };
    }
    if (b.includes("space") || b.includes("station") || b.includes("spire") || b.includes("orbital")) {
      return {
        garment: "#cbd5e1",
        secondaryGarment: "#475569",
        trim: "#38bdf8",
        mantle: "#1e293b",
        skin: "#d4a37f",
        hair: "#1e293b",
        headpiece: "#94a3b8",
        leather: "#0f172a",
      };
    }
    return {
      garment: "#27303f",
      secondaryGarment: "#94a3b8",
      trim: "#d4af37",
      mantle: "#111827",
      skin: "#cf966d",
      hair: "#1f1815",
      headpiece: "#475569",
      leather: "#1f1610",
    };
  }, [biome, morphology]);

  // high-resolution woven cloth PBR albedo + bump texture
  const { clothAlbedo, clothBump } = useMemo(() => {
    if (typeof document === "undefined") return { clothAlbedo: null, clothBump: null };
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    const bumpCanvas = document.createElement("canvas");
    bumpCanvas.width = 512;
    bumpCanvas.height = 512;
    const bCtx = bumpCanvas.getContext("2d");

    if (!ctx || !bCtx) return { clothAlbedo: null, clothBump: null };

    // base fabric shade with vertical drapery folds
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0.0, palette.garment);
    grad.addColorStop(0.25, palette.secondaryGarment);
    grad.addColorStop(0.5, palette.garment);
    grad.addColorStop(0.75, palette.secondaryGarment);
    grad.addColorStop(1.0, palette.garment);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // soft vertical drapery shadow pleats
    for (let x = 0; x < 512; x += 32) {
      const pGrad = ctx.createLinearGradient(x, 0, x + 32, 0);
      pGrad.addColorStop(0, "rgba(0,0,0,0.18)");
      pGrad.addColorStop(0.5, "rgba(255,255,255,0.06)");
      pGrad.addColorStop(1, "rgba(0,0,0,0.18)");
      ctx.fillStyle = pGrad;
      ctx.fillRect(x, 0, 32, 512);
    }

    // fine linen/brocade micro-weave on bump canvas
    bCtx.fillStyle = "#808080";
    bCtx.fillRect(0, 0, 512, 512);
    bCtx.strokeStyle = "#9a9a9a";
    bCtx.lineWidth = 1;
    for (let i = 0; i < 512; i += 4) {
      bCtx.beginPath();
      bCtx.moveTo(0, i);
      bCtx.lineTo(512, i);
      bCtx.stroke();
      bCtx.beginPath();
      bCtx.moveTo(i, 0);
      bCtx.lineTo(i, 512);
      bCtx.stroke();
    }

    // embroidered gold/bronze brocade border
    ctx.fillStyle = palette.trim;
    ctx.fillRect(232, 0, 48, 512);
    ctx.fillRect(0, 0, 512, 34);
    ctx.fillRect(0, 468, 512, 44);

    // geometric key pattern on border
    ctx.strokeStyle = "rgba(20, 14, 8, 0.55)";
    ctx.lineWidth = 3;
    for (let x = 8; x < 512; x += 24) {
      ctx.strokeRect(x, 476, 14, 24);
    }

    const albedo = new THREE.CanvasTexture(canvas);
    albedo.colorSpace = THREE.SRGBColorSpace;
    const bump = new THREE.CanvasTexture(bumpCanvas);
    return { clothAlbedo: albedo, clothBump: bump };
  }, [palette]);

  // refined floating nameplate
  const nametagTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 140;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "rgba(14, 11, 8, 0.90)";
    ctx.fillRect(10, 10, 620, 120);

    ctx.strokeStyle = isSelected || hovered ? "#facc15" : palette.trim;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 620, 120);
    ctx.lineWidth = 1;
    ctx.strokeRect(18, 18, 604, 104);

    ctx.fillStyle = "#fdf6e2";
    ctx.font = "bold 30px 'Times New Roman', Times, serif";
    ctx.textAlign = "center";
    ctx.fillText(npc.name.toUpperCase(), 320, 60);

    ctx.fillStyle = palette.trim;
    ctx.font = "italic 21px 'Times New Roman', Times, serif";
    ctx.fillText("Click to Converse", 320, 100);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [npc.name, isSelected, hovered, palette.trim]);

  useFrame(({ clock, camera }, delta) => {
    const elapsed = clock.getElapsedTime();
    if (!groupRef.current) return;

    const isPaused = hovered;
    if (!isPaused) {
      walkPhaseRef.current += delta * 0.65;
    }

    const t = walkPhaseRef.current;
    const patrolRadiusX = 11.0;
    const patrolRadiusZ = 6.5;
    const offsetX = Math.sin(t) * patrolRadiusX;
    const offsetZ = Math.sin(t * 2.0) * patrolRadiusZ;

    const targetX = basePosition.x + offsetX;
    const targetZ = basePosition.z + offsetZ;

    const strideCycle = t * 7.5;
    const bobY = isPaused
      ? Math.sin(elapsed * 2.2) * 0.04
      : Math.abs(Math.sin(strideCycle)) * 0.22;

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.12);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.12);
    groupRef.current.position.y = basePosition.y + bobY;

    let desiredYaw: number;
    if (isPaused) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      desiredYaw = Math.atan2(
        camera.position.x - worldPos.x,
        camera.position.z - worldPos.z
      );
    } else {
      const vx = Math.cos(t) * patrolRadiusX;
      const vz = Math.cos(t * 2.0) * 2.0 * patrolRadiusZ;
      desiredYaw = Math.atan2(vx, vz);
    }

    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      desiredYaw,
      0.12
    );

    // articulated multi-joint human gait animation
    const swing = isPaused ? 0 : Math.sin(strideCycle);
    if (torsoRef.current) {
      torsoRef.current.rotation.y = swing * 0.08;
      torsoRef.current.rotation.z = Math.cos(strideCycle) * 0.03;
    }
    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = -swing * 0.06 + Math.sin(elapsed * 1.3) * 0.08;
      headGroupRef.current.rotation.x = Math.sin(elapsed * 1.8) * 0.04;
    }
    if (leftArmRef.current && leftForearmRef.current) {
      leftArmRef.current.rotation.x = swing * 0.34;
      leftForearmRef.current.rotation.x = -0.25 - Math.max(0, -swing) * 0.25;
    }
    if (rightArmRef.current && rightForearmRef.current) {
      rightArmRef.current.rotation.x = -0.2 - swing * 0.18;
      rightForearmRef.current.rotation.x = -0.35;
    }
    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = -swing * 0.36;
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = swing * 0.36;
    }
    if (capeRef.current) {
      capeRef.current.rotation.x = 0.14 + Math.abs(swing) * 0.12 + Math.sin(elapsed * 3.2) * 0.04;
    }
    if (auraRef.current) {
      auraRef.current.rotation.z = elapsed * 0.45;
    }
  });

  return (
    <group
      ref={groupRef}
      position={basePosition}
      scale={[0.27, 0.27, 0.27]}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) {
          onSelect(npc.npc_id);
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        if (typeof document !== "undefined") {
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        if (typeof document !== "undefined") {
          document.body.style.cursor = "default";
        }
      }}
    >
      {/* overhead nameplate */}
      {nametagTexture && (
        <sprite position={[0, 42.5, 0]} scale={[23, 5.0, 1]}>
          <spriteMaterial map={nametagTexture} depthTest={false} />
        </sprite>
      )}

      {/* articulated upper body & head */}
      <group ref={torsoRef}>
        <group ref={headGroupRef} position={[0, 29.2, 0]}>
          {morphology === "aquatic_abyssal" ? (
            /* Abyssal Angler / Deep Sea Chimera Entity */
            <group>
              <mesh position={[0, 0, 0]} scale={[1.2, 1.0, 1.4]}>
                <sphereGeometry args={[4.2, 24, 24]} />
                <meshPhysicalMaterial color="#0e7490" roughness={0.2} transmission={0.2} clearcoat={0.9} />
              </mesh>
              {/* Luminous Bioluminescent Angler Esca Lure */}
              <mesh position={[0, 5.5, 3.8]} rotation={[-0.4, 0, 0]}>
                <cylinderGeometry args={[0.18, 0.35, 6.5, 12]} />
                <meshStandardMaterial color="#06b6d4" metalness={0.8} />
              </mesh>
              <mesh position={[0, 8.8, 5.8]}>
                <sphereGeometry args={[1.2, 16, 16]} />
                <meshPhysicalMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={1.8} roughness={0.1} />
              </mesh>
              {/* Large bioluminescent eyes */}
              <mesh position={[-2.4, 0.8, 2.2]}>
                <sphereGeometry args={[1.4, 16, 16]} />
                <meshPhysicalMaterial color="#fef08a" emissive="#eab308" emissiveIntensity={1.2} />
              </mesh>
              <mesh position={[2.4, 0.8, 2.2]}>
                <sphereGeometry args={[1.4, 16, 16]} />
                <meshPhysicalMaterial color="#fef08a" emissive="#eab308" emissiveIntensity={1.2} />
              </mesh>
              {/* Dorsal fin crest */}
              <mesh position={[0, 3.5, -2.5]} rotation={[0.4, 0, 0]}>
                <coneGeometry args={[2.5, 5.5, 4]} />
                <meshPhysicalMaterial color="#0284c7" transmission={0.5} roughness={0.15} />
              </mesh>
            </group>
          ) : morphology === "space_explorer" ? (
            /* Apollo / Artemis Astronaut Pressure Helmet with Gold Solar Visor */
            <group>
              <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[4.6, 32, 32]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.2} metalness={0.1} />
              </mesh>
              {/* Reflective gold visor shield */}
              <mesh position={[0, 0.2, 1.8]} rotation={[0.1, 0, 0]}>
                <sphereGeometry args={[3.8, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
                <meshStandardMaterial color="#f59e0b" metalness={0.96} roughness={0.06} />
              </mesh>
              {/* Helmet audio & telemetry communicators */}
              <mesh position={[-4.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[1.2, 1.2, 0.8, 16]} />
                <meshStandardMaterial color="#64748b" metalness={0.8} />
              </mesh>
              <mesh position={[4.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[1.2, 1.2, 0.8, 16]} />
                <meshStandardMaterial color="#64748b" metalness={0.8} />
              </mesh>
            </group>
          ) : morphology === "construct_automaton" ? (
            /* Cybernetic / Ancient Golem Automaton Core Head */
            <group>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[5.2, 5.8, 5.0]} />
                <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.25} />
              </mesh>
              {/* Optical horizontal sensor bar */}
              <mesh position={[0, 0.6, 2.6]}>
                <boxGeometry args={[4.2, 0.9, 0.5]} />
                <meshPhysicalMaterial color="#10b981" emissive="#34d399" emissiveIntensity={1.5} />
              </mesh>
            </group>
          ) : (
            /* Classical Humanoid Scholar Cranium & Face */
            <group>
              <mesh position={[0, 0.4, 0]} scale={[0.92, 1.08, 0.98]}>
                <sphereGeometry args={[4.1, 32, 32]} />
                <meshPhysicalMaterial
                  color={palette.skin}
                  roughness={0.48}
                  metalness={0.02}
                  clearcoat={0.08}
                  clearcoatRoughness={0.6}
                />
              </mesh>

              {/* sculpted jawline & chin */}
              <mesh position={[0, -1.6, 0.6]} scale={[0.82, 0.75, 0.85]}>
                <cylinderGeometry args={[3.4, 2.2, 3.6, 24]} />
                <meshPhysicalMaterial color={palette.skin} roughness={0.48} />
              </mesh>

              {/* anatomical nose bridge */}
              <mesh position={[0, -0.1, 3.95]} rotation={[0.18, 0, 0]}>
                <coneGeometry args={[0.68, 2.1, 12]} />
                <meshPhysicalMaterial color={palette.skin} roughness={0.45} />
              </mesh>

              {/* brow ridge */}
              <mesh position={[0, 1.35, 3.55]} scale={[1.0, 0.35, 0.45]}>
                <boxGeometry args={[4.6, 1.2, 1.6]} />
                <meshPhysicalMaterial color={palette.skin} roughness={0.5} />
              </mesh>

              {/* sclera & iris eyes */}
              <group position={[-1.35, 0.6, 3.55]}>
                <mesh scale={[1.1, 0.85, 0.6]}>
                  <sphereGeometry args={[0.62, 16, 16]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.2} />
                </mesh>
                <mesh position={[0, 0, 0.32]}>
                  <sphereGeometry args={[0.32, 14, 14]} />
                  <meshStandardMaterial color="#1e1b18" roughness={0.1} />
                </mesh>
              </group>
              <group position={[1.35, 0.6, 3.55]}>
                <mesh scale={[1.1, 0.85, 0.6]}>
                  <sphereGeometry args={[0.62, 16, 16]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.2} />
                </mesh>
                <mesh position={[0, 0, 0.32]}>
                  <sphereGeometry args={[0.32, 14, 14]} />
                  <meshStandardMaterial color="#1e1b18" roughness={0.1} />
                </mesh>
              </group>

              {/* sculpted hair & beard / coiffure */}
              <mesh position={[0, 1.2, -0.5]} scale={[0.98, 1.05, 1.04]}>
                <sphereGeometry args={[4.25, 24, 24]} />
                <meshStandardMaterial color={palette.hair} roughness={0.85} />
              </mesh>

              {/* ornate metallic diadem / klaft / laurels */}
              <mesh position={[0, 2.3, 0.1]} rotation={[0.08, 0, 0]}>
                <torusGeometry args={[3.95, 0.48, 16, 36]} />
                <meshStandardMaterial
                  color={palette.headpiece}
                  metalness={0.88}
                  roughness={0.22}
                />
              </mesh>
              {/* diadem front crest */}
              <mesh position={[0, 3.1, 3.9]}>
                <octahedronGeometry args={[0.85, 1]} />
                <meshStandardMaterial
                  color={palette.trim}
                  metalness={0.92}
                  roughness={0.15}
                />
              </mesh>
            </group>
          )}
        </group>

        {/* anatomical neck */}
        <mesh position={[0, 25.0, 0]}>
          <cylinderGeometry args={[2.1, 2.5, 3.2, 20]} />
          <meshPhysicalMaterial color={palette.skin} roughness={0.5} />
        </mesh>

        {/* broad layered ceremonial collar / pauldrons */}
        <mesh position={[0, 23.8, 0]} scale={[1.25, 1.0, 0.92]}>
          <cylinderGeometry args={[5.8, 7.2, 2.6, 32]} />
          <meshStandardMaterial
            color={palette.trim}
            metalness={0.82}
            roughness={0.24}
          />
        </mesh>

        {/* sculpted chest & pleated tunic */}
        <mesh position={[0, 16.8, 0]} scale={[1.18, 1.0, 0.82]}>
          <cylinderGeometry args={[5.4, 4.6, 13.5, 32]} />
          <meshStandardMaterial
            map={clothAlbedo}
            bumpMap={clothBump}
            bumpScale={0.15}
            roughness={0.62}
            metalness={0.08}
          />
        </mesh>

        {/* flowing royal mantle / cloak draped down the back */}
        <mesh
          ref={capeRef}
          position={[0, 13.2, -3.6]}
          rotation={[0.14, 0, 0]}
        >
          <boxGeometry args={[12.4, 21.5, 0.8]} />
          <meshStandardMaterial
            color={palette.mantle}
            bumpMap={clothBump}
            bumpScale={0.12}
            roughness={0.72}
          />
        </mesh>

        {/* embossed leather & gold waist belt */}
        <mesh position={[0, 10.2, 0]} scale={[1.15, 1.0, 0.85]}>
          <cylinderGeometry args={[4.9, 5.1, 2.4, 32]} />
          <meshStandardMaterial
            color={palette.leather}
            roughness={0.4}
            metalness={0.25}
          />
        </mesh>
        {/* belt buckle medallion */}
        <mesh position={[0, 10.2, 4.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.4, 1.4, 0.6, 20]} />
          <meshStandardMaterial color={palette.trim} metalness={0.9} roughness={0.2} />
        </mesh>

        {/* articulated left shoulder, upper arm, elbow, forearm, and hand */}
        <group ref={leftArmRef} position={[-6.8, 22.4, 0]} rotation={[0, 0, 0.12]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[2.1, 20, 20]} />
            <meshStandardMaterial color={palette.trim} metalness={0.75} roughness={0.28} />
          </mesh>
          <mesh position={[0, -3.2, 0]}>
            <cylinderGeometry args={[1.75, 1.45, 6.2, 20]} />
            <meshStandardMaterial map={clothAlbedo} bumpMap={clothBump} roughness={0.6} />
          </mesh>
          <group ref={leftForearmRef} position={[0, -6.2, 0]} rotation={[-0.25, 0, 0]}>
            <mesh position={[0, -2.8, 0]}>
              <cylinderGeometry args={[1.4, 1.15, 5.4, 18]} />
              <meshPhysicalMaterial color={palette.skin} roughness={0.48} />
            </mesh>
            {/* bronze vambrace */}
            <mesh position={[0, -3.2, 0]}>
              <cylinderGeometry args={[1.48, 1.25, 3.2, 20]} />
              <meshStandardMaterial color={palette.trim} metalness={0.82} roughness={0.25} />
            </mesh>
            <mesh position={[0, -6.0, 0]}>
              <sphereGeometry args={[1.25, 16, 16]} />
              <meshPhysicalMaterial color={palette.skin} roughness={0.48} />
            </mesh>
          </group>
        </group>

        {/* articulated right shoulder, upper arm, forearm, and ceremonial staff */}
        <group ref={rightArmRef} position={[6.8, 22.4, 0]} rotation={[-0.2, 0, -0.12]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[2.1, 20, 20]} />
            <meshStandardMaterial color={palette.trim} metalness={0.75} roughness={0.28} />
          </mesh>
          <mesh position={[0, -3.2, 0]}>
            <cylinderGeometry args={[1.75, 1.45, 6.2, 20]} />
            <meshStandardMaterial map={clothAlbedo} bumpMap={clothBump} roughness={0.6} />
          </mesh>
          <group ref={rightForearmRef} position={[0, -6.2, 0]} rotation={[-0.35, 0, 0]}>
            <mesh position={[0, -2.8, 0]}>
              <cylinderGeometry args={[1.4, 1.15, 5.4, 18]} />
              <meshPhysicalMaterial color={palette.skin} roughness={0.48} />
            </mesh>
            <mesh position={[0, -3.2, 0]}>
              <cylinderGeometry args={[1.48, 1.25, 3.2, 20]} />
              <meshStandardMaterial color={palette.trim} metalness={0.82} roughness={0.25} />
            </mesh>
            <mesh position={[0, -6.0, 0]}>
              <sphereGeometry args={[1.25, 16, 16]} />
              <meshPhysicalMaterial color={palette.skin} roughness={0.48} />
            </mesh>

            {/* Biome-adaptive hand-held artifact/tool */}
            {morphology === "aquatic_abyssal" ? (
              <group position={[0, -5.8, 1.2]} rotation={[0.45, 0, 0]}>
                <mesh position={[0, 4.0, 0]}>
                  <cylinderGeometry args={[0.3, 0.45, 34, 12]} />
                  <meshStandardMaterial color="#0e7490" roughness={0.3} metalness={0.7} />
                </mesh>
                <mesh position={[0, 21.0, 0]}>
                  <octahedronGeometry args={[2.2, 0]} />
                  <meshPhysicalMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={1.4} roughness={0.1} />
                </mesh>
              </group>
            ) : morphology === "space_explorer" ? (
              <group position={[0, -5.8, 1.2]} rotation={[0.35, 0, 0]}>
                <mesh position={[0, 2.0, 0]}>
                  <boxGeometry args={[1.5, 7.0, 2.5]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} />
                </mesh>
                <mesh position={[0, 6.0, 0]}>
                  <cylinderGeometry args={[0.2, 0.3, 12.0, 8]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
                </mesh>
                <mesh position={[0, 12.2, 0]}>
                  <sphereGeometry args={[0.6, 12, 12]} />
                  <meshPhysicalMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={1.5} />
                </mesh>
              </group>
            ) : (
              <group position={[0, -5.8, 1.2]} rotation={[0.45, 0, 0]}>
                <mesh position={[0, 4.0, 0]}>
                  <cylinderGeometry args={[0.38, 0.32, 36, 16]} />
                  <meshStandardMaterial color={palette.trim} metalness={0.9} roughness={0.18} />
                </mesh>
                <mesh position={[0, 22.5, 0]}>
                  <torusGeometry args={[2.2, 0.28, 14, 32]} />
                  <meshStandardMaterial color={palette.trim} metalness={0.92} roughness={0.15} />
                </mesh>
                <mesh position={[0, 22.5, 0]}>
                  <octahedronGeometry args={[1.25, 1]} />
                  <meshStandardMaterial
                    color="#fef08a"
                    emissive={palette.trim}
                    emissiveIntensity={0.65}
                    roughness={0.15}
                  />
                </mesh>
              </group>
            )}
          </group>
        </group>
      </group>

      {/* lower pleated skirt / robe */}
      <mesh position={[0, 4.0, 0]} scale={[1.14, 1.0, 0.88]}>
        <cylinderGeometry args={[5.2, 6.8, 11.5, 32]} />
        <meshStandardMaterial
          map={clothAlbedo}
          bumpMap={clothBump}
          bumpScale={0.16}
          roughness={0.65}
        />
      </mesh>

      {/* articulated left and right legs + boots */}
      <group ref={leftLegRef} position={[-2.5, 4.0, 0]}>
        <mesh position={[0, -5.5, 0]}>
          <cylinderGeometry args={[1.7, 1.35, 8.5, 20]} />
          <meshStandardMaterial color={palette.leather} roughness={0.5} metalness={0.15} />
        </mesh>
        <mesh position={[0, -9.2, 0.9]}>
          <boxGeometry args={[2.5, 2.4, 4.8]} />
          <meshStandardMaterial color={palette.leather} roughness={0.45} metalness={0.2} />
        </mesh>
      </group>

      <group ref={rightLegRef} position={[2.5, 4.0, 0]}>
        <mesh position={[0, -5.5, 0]}>
          <cylinderGeometry args={[1.7, 1.35, 8.5, 20]} />
          <meshStandardMaterial color={palette.leather} roughness={0.5} metalness={0.15} />
        </mesh>
        <mesh position={[0, -9.2, 0.9]}>
          <boxGeometry args={[2.5, 2.4, 4.8]} />
          <meshStandardMaterial color={palette.leather} roughness={0.45} metalness={0.2} />
        </mesh>
      </group>

      {/* soft ground contact shadow */}
      <mesh position={[0, -6.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[8.5, 32]} />
        <meshBasicMaterial color="#000000" transparent={true} opacity={0.42} />
      </mesh>

      {/* subtle selection ring on floor */}
      <mesh ref={auraRef} position={[0, -6.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[9.2, 10.6, 48]} />
        <meshBasicMaterial
          color={isSelected || hovered ? "#facc15" : palette.trim}
          side={THREE.DoubleSide}
          transparent={true}
          opacity={isSelected ? 0.9 : hovered ? 0.75 : 0.35}
        />
      </mesh>
    </group>
  );
}

interface CharacterSpawnerProps {
  npcs: NPCAgent[];
  roomContext?: string;
  onNPCSelect?: (npcId: string) => void;
}

export function CharacterSpawner({ npcs, roomContext, onNPCSelect }: CharacterSpawnerProps) {
  const selectNPC = useWorldStore((state) => state.selectNPC);
  const currentRoomId = useWorldStore((state) => state.currentRoomId);
  const rooms = useWorldStore((state) => state.rooms);
  const worldTitle = useWorldStore((state) => state.worldTitle);
  const activeBiome =
    roomContext ||
    `${rooms[currentRoomId]?.biome_type || ""} ${rooms[currentRoomId]?.name || ""} ${worldTitle || ""}`;

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
          biome={activeBiome}
          onSelect={handleSelect}
        />
      ))}
    </group>
  );
}
