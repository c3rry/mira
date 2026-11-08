// clamped panoramic camera controller with polar angle limits and WASD / arrow key world-space walking locomotion
"use client";

import { RefObject, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { useWorldStore } from "@/store/useWorldStore";

// convert spherical polar coordinates (r, theta, phi) to three.js cartesian (x, y, z)
export function sphericalToCartesian(
  r: number,
  theta: number,
  phi: number,
  isDegrees: boolean = false
): THREE.Vector3 {
  const thetaRad = isDegrees ? (theta * Math.PI) / 180 : theta;
  const phiRad = isDegrees ? (phi * Math.PI) / 180 : phi;

  const x = r * Math.sin(phiRad) * Math.sin(thetaRad);
  const y = r * Math.cos(phiRad);
  const z = r * Math.sin(phiRad) * Math.cos(thetaRad);

  return new THREE.Vector3(x, y, z);
}

// convert 2d equirectangular uv [0, 1] to spherical angles (theta, phi)
export function uvToSpherical(u: number, v: number): { theta: number; phi: number } {
  const theta = (u - 0.5) * 2 * Math.PI;
  const phi = (1.0 - v) * Math.PI;
  return { theta, phi };
}

interface CameraControllerProps {
  enableZoom?: boolean;
  rotateSpeed?: number;
  worldGroupRef?: RefObject<THREE.Group | null>;
}

export function CameraController({
  enableZoom = false,
  rotateSpeed = -0.35,
  worldGroupRef,
}: CameraControllerProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const currentRoomId = useWorldStore((state) => state.currentRoomId);
  const activeScreen = useWorldStore((state) => state.activeScreen);

  const keysRef = useRef<{
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    sprint: boolean;
  }>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });

  const playerOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const walkBobPhase = useRef<number>(0);

  // reset player position to center of chamber when changing rooms
  useEffect(() => {
    playerOffsetRef.current.set(0, 0, 0);
    if (worldGroupRef?.current) {
      worldGroupRef.current.position.set(0, 0, 0);
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      camera.position.set(0, 0, 0.1);
      controlsRef.current.update();
    }
  }, [currentRoomId, camera, worldGroupRef]);

  useEffect(() => {
    const isInputFocused = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused(e)) return;
      const k = e.key.toLowerCase();
      if (k === "w" || e.key === "ArrowUp") keysRef.current.forward = true;
      if (k === "s" || e.key === "ArrowDown") keysRef.current.backward = true;
      if (k === "a" || e.key === "ArrowLeft") keysRef.current.left = true;
      if (k === "d" || e.key === "ArrowRight") keysRef.current.right = true;
      if (e.key === "Shift") keysRef.current.sprint = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w" || e.key === "ArrowUp") keysRef.current.forward = false;
      if (k === "s" || e.key === "ArrowDown") keysRef.current.backward = false;
      if (k === "a" || e.key === "ArrowLeft") keysRef.current.left = false;
      if (k === "d" || e.key === "ArrowRight") keysRef.current.right = false;
      if (e.key === "Shift") keysRef.current.sprint = false;
    };

    const handleBlur = () => {
      keysRef.current = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
      };
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useFrame((_, delta) => {
    if (activeScreen !== "game" || !worldGroupRef?.current) return;

    const { forward, backward, left, right, sprint } = keysRef.current;
    const isMoving = forward || backward || left || right;

    if (isMoving) {
      const moveSpeed = (sprint ? 72.0 : 44.0) * Math.min(delta, 0.1);

      // compute horizontal forward and right vectors from camera look direction
      const forwardVec = new THREE.Vector3();
      camera.getWorldDirection(forwardVec);
      forwardVec.y = 0;
      if (forwardVec.lengthSq() > 0.0001) {
        forwardVec.normalize();
      } else {
        forwardVec.set(0, 0, -1);
      }

      const rightVec = new THREE.Vector3(-forwardVec.z, 0, forwardVec.x).normalize();

      const moveDelta = new THREE.Vector3();
      if (forward) moveDelta.add(forwardVec);
      if (backward) moveDelta.sub(forwardVec);
      if (right) moveDelta.add(rightVec);
      if (left) moveDelta.sub(rightVec);

      if (moveDelta.lengthSq() > 0) {
        moveDelta.normalize().multiplyScalar(moveSpeed);
        playerOffsetRef.current.add(moveDelta);

        // clamp player walking radius inside chamber bounds so player stays inside the 500-unit sphere
        const maxWalkRadius = 175.0;
        const horizLen = Math.hypot(playerOffsetRef.current.x, playerOffsetRef.current.z);
        if (horizLen > maxWalkRadius) {
          const clampRatio = maxWalkRadius / horizLen;
          playerOffsetRef.current.x *= clampRatio;
          playerOffsetRef.current.z *= clampRatio;
        }
      }

      walkBobPhase.current += delta * (sprint ? 13.0 : 9.0);
    } else {
      // smoothly settle head-bob back to zero when standing still
      walkBobPhase.current = THREE.MathUtils.lerp(walkBobPhase.current, 0, 0.15);
    }

    const bobOffset = isMoving ? Math.sin(walkBobPhase.current) * 0.65 : 0;

    // translate the world root oppositely to player offset so player walks through the 3D room
    worldGroupRef.current.position.x = THREE.MathUtils.lerp(
      worldGroupRef.current.position.x,
      -playerOffsetRef.current.x,
      0.18
    );
    worldGroupRef.current.position.z = THREE.MathUtils.lerp(
      worldGroupRef.current.position.z,
      -playerOffsetRef.current.z,
      0.18
    );
    worldGroupRef.current.position.y = THREE.MathUtils.lerp(
      worldGroupRef.current.position.y,
      -bobOffset,
      0.22
    );
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableZoom={enableZoom}
      enablePan={false}
      rotateSpeed={rotateSpeed}
      enableDamping={true}
      dampingFactor={0.06}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI - 0.1}
    />
  );
}
