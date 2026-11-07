// clamped panoramic camera controller with polar angle limits preventing gimbal lock
"use client";

import { useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

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
  // u maps horizontally around 360 degrees: [-PI, PI]
  const theta = (u - 0.5) * 2 * Math.PI;
  // v maps vertically from top pole to bottom pole: [0, PI]
  const phi = (1.0 - v) * Math.PI;
  return { theta, phi };
}

interface CameraControllerProps {
  enableZoom?: boolean;
  rotateSpeed?: number;
}

export function CameraController({
  enableZoom = false,
  rotateSpeed = -0.35,
}: CameraControllerProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <OrbitControls
      ref={controlsRef}
      enableZoom={enableZoom}
      enablePan={false}
      rotateSpeed={rotateSpeed}
      enableDamping={true}
      dampingFactor={0.06}
      // clamp polar angle to [0.1, PI - 0.1] to eliminate pole flipping and gimbal lock
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI - 0.1}
    />
  );
}
