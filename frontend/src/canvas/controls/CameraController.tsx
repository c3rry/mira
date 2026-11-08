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
  const expandWorld = useWorldStore((state) => state.expandWorld);
  const isExpanding = useWorldStore((state) => state.isExpanding);
  const lastAutoExpandTime = useRef<number>(0);

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

  const prevTeleportTrigger = useRef(teleportTrigger);
  const dollyRef = useRef<{
    active: boolean;
    startX: number;
    startZ: number;
    targetX: number;
    targetZ: number;
    startTime: number;
    duration: number;
  }>({
    active: false,
    startX: 0,
    startZ: 0,
    targetX: 0,
    targetZ: 0,
    startTime: 0,
    duration: 800,
  });

  // smooth camera fly-through (dolly) to the selected room's 3D coordinates when teleported via HUD / Minimap / Portal
  useEffect(() => {
    if (prevTeleportTrigger.current === teleportTrigger) return;
    prevTeleportTrigger.current = teleportTrigger;

    const state = useWorldStore.getState();
    const targetRoom = state.rooms[state.currentRoomId];
    const rx = targetRoom?.worldX || 0;
    const rz = targetRoom?.worldZ || 0;

    const curTargetX = controlsRef.current ? controlsRef.current.target.x : rx;
    const curTargetZ = controlsRef.current ? controlsRef.current.target.z : rz;
    const dist = Math.hypot(rx - curTargetX, rz - curTargetZ);

    if (dist > 1.5 && controlsRef.current) {
      dollyRef.current = {
        active: true,
        startX: curTargetX,
        startZ: curTargetZ,
        targetX: rx,
        targetZ: rz,
        startTime: performance.now(),
        duration: Math.min(1100, Math.max(650, dist * 3.2)),
      };
    } else {
      dollyRef.current.active = false;
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

      const isMovementKey =
        ["w", "a", "s", "d", "z", "q", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k) ||
        ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code);

      if (isMovementKey) {
        // prevent page scrolling on arrow keys and blur HUD buttons so locomotion is never blocked
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement && document.activeElement.tagName !== "BODY") {
          document.activeElement.blur();
        }
      }

      if (k === "w" || k === "z" || code === "KeyW" || e.key === "ArrowUp") keysRef.current.forward = true;
      if (k === "s" || code === "KeyS" || e.key === "ArrowDown") keysRef.current.backward = true;
      if (k === "a" || k === "q" || code === "KeyA" || e.key === "ArrowLeft") keysRef.current.left = true;
      if (k === "d" || code === "KeyD" || e.key === "ArrowRight") keysRef.current.right = true;
      if (e.key === "Shift" || e.shiftKey) keysRef.current.sprint = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const code = e.code;
      if (k === "w" || k === "z" || code === "KeyW" || e.key === "ArrowUp") keysRef.current.forward = false;
      if (k === "s" || code === "KeyS" || e.key === "ArrowDown") keysRef.current.backward = false;
      if (k === "a" || k === "q" || code === "KeyA" || e.key === "ArrowLeft") keysRef.current.left = false;
      if (k === "d" || code === "KeyD" || e.key === "ArrowRight") keysRef.current.right = false;
      if (e.key === "Shift" || !e.shiftKey) keysRef.current.sprint = false;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        keysRef.current = {
          forward: false,
          backward: false,
          left: false,
          right: false,
          sprint: false,
        };
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useFrame((_, delta) => {
    if (activeScreen !== "game" || !controlsRef.current) return;

    const { forward, backward, left, right, sprint } = keysRef.current;
    const isMoving = forward || backward || left || right;
    const controls = controlsRef.current;

    // smooth cinematic camera dolly fly-through between rooms
    if (dollyRef.current.active) {
      if (isMoving) {
        // Player took manual control via WASD locomotion
        dollyRef.current.active = false;
      } else {
        const elapsed = performance.now() - dollyRef.current.startTime;
        const progress = Math.min(1.0, elapsed / dollyRef.current.duration);
        const t = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const curX = THREE.MathUtils.lerp(dollyRef.current.startX, dollyRef.current.targetX, t);
        const curZ = THREE.MathUtils.lerp(dollyRef.current.startZ, dollyRef.current.targetZ, t);

        const dX = curX - controls.target.x;
        const dZ = curZ - controls.target.z;

        camera.position.x += dX;
        camera.position.z += dZ;
        controls.target.x = curX;
        controls.target.z = curZ;

        if (progress >= 1.0) {
          dollyRef.current.active = false;
        }
      }
    }

    if (isMoving) {
      // brisk, responsive locomotion speed
      const moveSpeed = (sprint ? 58.0 : 36.0) * Math.min(delta, 0.1);

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
        let minX = -120;
        let maxX = 120;
        let minZ = -120;
        let maxZ = 120;
        roomList.forEach((r) => {
          const rx = r.worldX || 0;
          const rz = r.worldZ || 0;
          if (rx - 120 < minX) minX = rx - 120;
          if (rx + 120 > maxX) maxX = rx + 120;
          if (rz - 120 < minZ) minZ = rz - 120;
          if (rz + 120 > maxZ) maxZ = rz + 120;
        });

        const clampedX = Math.max(minX, Math.min(maxX, nextTargetX));
        const clampedZ = Math.max(minZ, Math.min(maxZ, nextTargetZ));
        moveDelta.x = clampedX - controls.target.x;
        moveDelta.z = clampedZ - controls.target.z;

        // translate camera.position and controls.target together before controls.update()
        camera.position.add(moveDelta);
        controls.target.add(moveDelta);

        // check if player physically walked closer into an adjacent sub-room
        const activeRoom = rooms[currentRoomId];
        const distToCurrent = Math.hypot(clampedX - (activeRoom?.worldX || 0), clampedZ - (activeRoom?.worldZ || 0));

        let closestRoomId = currentRoomId;
        let closestDist = distToCurrent;
        roomList.forEach((r) => {
          const d = Math.hypot(clampedX - (r.worldX || 0), clampedZ - (r.worldZ || 0));
          if (d < closestDist) {
            closestDist = d;
            closestRoomId = r.room_id;
          }
        });

        // transition with 12-unit hysteresis to ensure crisp, clean room switching
        if (closestRoomId !== currentRoomId && closestDist < distToCurrent - 12.0) {
          setCurrentRoom(closestRoomId, true);
        }

        // continuously expand environment when walking near boundary of open frontiers
        const now = performance.now();
        if (
          !isExpanding &&
          now - lastAutoExpandTime.current > 4000 &&
          (clampedZ <= minZ + 35 || clampedZ >= maxZ - 35 || clampedX <= minX + 35 || clampedX >= maxX - 35)
        ) {
          lastAutoExpandTime.current = now;
          let dir = "forward";
          if (clampedZ <= minZ + 35) dir = "forward";
          else if (clampedZ >= maxZ - 35) dir = "backward";
          else if (clampedX >= maxX - 35) dir = "east";
          else if (clampedX <= minX + 35) dir = "west";
          expandWorld(closestRoomId, dir);
        }
      }

      walkBobPhase.current += delta * (sprint ? 5.5 : 4.0);
    } else {
      walkBobPhase.current = THREE.MathUtils.lerp(walkBobPhase.current, 0, 0.15);
    }

    // smooth stable FOV (no jarring zoom wobble on key taps)
    const targetFov = sprint ? 76.5 : 75.0;
    if ("fov" in camera && typeof (camera as any).fov === "number") {
      const persCamera = camera as THREE.PerspectiveCamera;
      persCamera.fov = THREE.MathUtils.lerp(persCamera.fov, targetFov, delta * 4.0);
      persCamera.updateProjectionMatrix();
    }

    // ultra-subtle, smooth walking displacement without angular pitch rocking
    const bobOffset = isMoving ? Math.sin(walkBobPhase.current) * 0.008 : 0;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, bobOffset, 0.15);
    controls.target.y = THREE.MathUtils.lerp(controls.target.y, bobOffset, 0.15);

    // anchor skybox sphere at active room origin so walking forward physically moves the player through the 3D space
    const currentRoom = rooms[currentRoomId];
    const roomOriginX = currentRoom?.worldX || 0;
    const roomOriginZ = currentRoom?.worldZ || 0;

    if (skyboxGroupRef?.current) {
      skyboxGroupRef.current.position.x = THREE.MathUtils.lerp(
        skyboxGroupRef.current.position.x,
        roomOriginX,
        0.14
      );
      skyboxGroupRef.current.position.z = THREE.MathUtils.lerp(
        skyboxGroupRef.current.position.z,
        roomOriginZ,
        0.14
      );
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
      minPolarAngle={0.001}
      maxPolarAngle={Math.PI - 0.001}
    />
  );
}
