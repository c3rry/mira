// clamped panoramic camera controller with true walkable OrbitControls camera+target rig and WASD locomotion
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
  skyboxGroupRef?: RefObject<THREE.Group | null>;
}

export function CameraController({
  enableZoom = false,
  rotateSpeed = -0.35,
  worldGroupRef,
  skyboxGroupRef,
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

  const walkBobPhase = useRef<number>(0);

  // reset player camera and target to center of chamber when changing rooms
  useEffect(() => {
    if (worldGroupRef?.current) {
      worldGroupRef.current.position.set(0, 0, 0);
    }
    if (skyboxGroupRef?.current) {
      skyboxGroupRef.current.position.set(0, 0, 0);
    }
    if (controlsRef.current) {
      camera.position.set(0, 0, 0.5);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [currentRoomId, camera, worldGroupRef, skyboxGroupRef]);

  useEffect(() => {
    const isInputFocused = (e: KeyboardEvent) => {
      const el = (e.target || document.activeElement) as HTMLElement | null;
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
      const code = e.code;

      // blur focused HUD buttons automatically so WASD/arrow keys always drive movement
      if (
        document.activeElement instanceof HTMLButtonElement &&
        ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)
      ) {
        document.activeElement.blur();
      }

      if (k === "w" || code === "KeyW" || e.key === "ArrowUp") keysRef.current.forward = true;
      if (k === "s" || code === "KeyS" || e.key === "ArrowDown") keysRef.current.backward = true;
      if (k === "a" || code === "KeyA" || e.key === "ArrowLeft") keysRef.current.left = true;
      if (k === "d" || code === "KeyD" || e.key === "ArrowRight") keysRef.current.right = true;
      if (e.key === "Shift") keysRef.current.sprint = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const code = e.code;
      if (k === "w" || code === "KeyW" || e.key === "ArrowUp") keysRef.current.forward = false;
      if (k === "s" || code === "KeyS" || e.key === "ArrowDown") keysRef.current.backward = false;
      if (k === "a" || code === "KeyA" || e.key === "ArrowLeft") keysRef.current.left = false;
      if (k === "d" || code === "KeyD" || e.key === "ArrowRight") keysRef.current.right = false;
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
    if (activeScreen !== "game" || !controlsRef.current) return;

    const { forward, backward, left, right, sprint } = keysRef.current;
    const isMoving = forward || backward || left || right;
    const controls = controlsRef.current;

    if (isMoving) {
      const moveSpeed = (sprint ? 26.0 : 15.0) * Math.min(delta, 0.1);

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

        // clamp walkable radius inside the architectural floor bounds (max 110 units)
        const nextTargetX = controls.target.x + moveDelta.x;
        const nextTargetZ = controls.target.z + moveDelta.z;
        const maxWalkRadius = 110.0;
        const dist = Math.hypot(nextTargetX, nextTargetZ);
        if (dist > maxWalkRadius) {
          const clampedX = (nextTargetX / dist) * maxWalkRadius;
          const clampedZ = (nextTargetZ / dist) * maxWalkRadius;
          moveDelta.x = clampedX - controls.target.x;
          moveDelta.z = clampedZ - controls.target.z;
        }

        // translate camera.position and controls.target together before controls.update()
        camera.position.add(moveDelta);
        controls.target.add(moveDelta);
      }

      walkBobPhase.current += delta * (sprint ? 12.5 : 8.5);
    } else {
      walkBobPhase.current = THREE.MathUtils.lerp(walkBobPhase.current, 0, 0.15);
    }

    // apply subtle vertical footstep head-bob to world floor while keeping horizon steady
    const bobOffset = isMoving ? Math.sin(walkBobPhase.current) * 0.22 : 0;
    if (worldGroupRef?.current) {
      worldGroupRef.current.position.y = THREE.MathUtils.lerp(
        worldGroupRef.current.position.y,
        -bobOffset,
        0.25
      );
    }

    // keep PanoramaSphere centered around camera with 0.88x follow (0.12x subtle parallax)
    if (skyboxGroupRef?.current) {
      skyboxGroupRef.current.position.x = camera.position.x * 0.88;
      skyboxGroupRef.current.position.z = camera.position.z * 0.88;
    }

    controls.update();
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
