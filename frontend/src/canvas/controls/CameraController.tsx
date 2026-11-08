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
  const rooms = useWorldStore((state) => state.rooms);
  const activeScreen = useWorldStore((state) => state.activeScreen);
  const teleportTrigger = useWorldStore((state) => state.teleportTrigger);
  const setCurrentRoom = useWorldStore((state) => state.setCurrentRoom);
  const setPlayerPosition = useWorldStore((state) => state.setPlayerPosition);

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

  // move camera to the selected room's 3D world coordinates when explicitly teleported via HUD / Minimap
  useEffect(() => {
    const targetRoom = rooms[currentRoomId];
    const rx = targetRoom?.worldX || 0;
    const rz = targetRoom?.worldZ || 0;

    if (worldGroupRef?.current) {
      worldGroupRef.current.position.set(0, 0, 0);
    }
    if (skyboxGroupRef?.current) {
      skyboxGroupRef.current.position.set(rx, 0, rz);
    }
    if (controlsRef.current) {
      camera.position.set(rx, 0, rz + 0.5);
      controlsRef.current.target.set(rx, 0, rz);
      controlsRef.current.update();
    }
  }, [teleportTrigger, camera, worldGroupRef, skyboxGroupRef]);

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
      const moveSpeed = (sprint ? 34.0 : 19.0) * Math.min(delta, 0.1);

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

        const nextTargetX = controls.target.x + moveDelta.x;
        const nextTargetZ = controls.target.z + moveDelta.z;

        // compute dynamic multi-room bounding box so player can continuously walk across all rooms & bridges
        const roomList = Object.values(rooms);
        let minX = -115;
        let maxX = 115;
        let minZ = -115;
        let maxZ = 115;
        roomList.forEach((r) => {
          const rx = r.worldX || 0;
          const rz = r.worldZ || 0;
          if (rx - 115 < minX) minX = rx - 115;
          if (rx + 115 > maxX) maxX = rx + 115;
          if (rz - 115 < minZ) minZ = rz - 115;
          if (rz + 115 > maxZ) maxZ = rz + 115;
        });

        const clampedX = Math.max(minX, Math.min(maxX, nextTargetX));
        const clampedZ = Math.max(minZ, Math.min(maxZ, nextTargetZ));
        moveDelta.x = clampedX - controls.target.x;
        moveDelta.z = clampedZ - controls.target.z;

        // translate camera.position and controls.target together before controls.update()
        camera.position.add(moveDelta);
        controls.target.add(moveDelta);

        // check if player physically walked into an adjacent sub-room's territory
        let closestRoomId = currentRoomId;
        let closestDist = Infinity;
        roomList.forEach((r) => {
          const d = Math.hypot(clampedX - (r.worldX || 0), clampedZ - (r.worldZ || 0));
          if (d < closestDist) {
            closestDist = d;
            closestRoomId = r.room_id;
          }
        });
        if (closestRoomId !== currentRoomId && closestDist < 98.0) {
          setCurrentRoom(closestRoomId, true);
        }
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

    // keep outer horizon skybox centered around camera
    if (skyboxGroupRef?.current) {
      skyboxGroupRef.current.position.x = camera.position.x;
      skyboxGroupRef.current.position.z = camera.position.z;
    }

    // broadcast live player coordinates and heading to Zustand store for the top-down architectural minimap
    const lookDir = new THREE.Vector3();
    camera.getWorldDirection(lookDir);
    const yawRad = Math.atan2(lookDir.x, -lookDir.z);
    setPlayerPosition({
      x: controls.target.x,
      z: controls.target.z,
      yaw: yawRad,
    });

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
