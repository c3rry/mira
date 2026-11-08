// seamless infinite-distance 360 sky panorama with room-to-room crossfade and latent denoise reveal
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { loadPanoramaTexture } from "./loaders/TextureLoader";
import { useWorldStore } from "@/store/useWorldStore";

interface PanoramaSphereProps {
  panoramaUrl: string;
  // same-world panorama shown while a background sub-room is still synthesizing
  fallbackUrl?: string;
  mutationFactor?: number;
  radius?: number;
}

const skyVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// crossfades two equirect textures and overlays latent diffusion noise while compiling
const skyFragmentShader = `
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform float uMix;
  uniform float uNoise;
  uniform float uMutation;
  uniform float uTime;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  void main() {
    vec3 a = texture2D(uTexA, vUv).rgb;
    vec3 b = texture2D(uTexB, vUv).rgb;
    float blend = smoothstep(0.0, 1.0, uMix);
    vec3 col = max(mix(a, b, blend), vec3(0.04, 0.05, 0.08));
    vec3 grain = vec3(hash21(vUv * 512.0 + uTime), hash21(vUv * 512.0 + uTime + 1.3), hash21(vUv * 512.0 + uTime + 2.9));
    col = mix(col, grain, clamp(uNoise * 0.9, 0.0, 0.92));
    col = mix(col, col * vec3(1.12, 0.95, 0.82), uMutation * 0.45);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function PanoramaSphere({
  panoramaUrl,
  fallbackUrl,
  mutationFactor = 0.0,
  radius = 900,
}: PanoramaSphereProps) {
  const [targetTex, setTargetTex] = useState<THREE.Texture | null>(null);
  const noiseRef = useRef<number>(0.65);
  const mixRef = useRef<number>(1.0);
  const isCompilingWorld = useWorldStore((state) => state.isCompilingWorld);
  const setDiffusionProgress = useWorldStore((state) => state.setDiffusionProgress);

  const material = useMemo(
    () => {
      // Create baseline non-null placeholder texture so WebGL never renders black before targetTex resolves
      let baselineTex: THREE.Texture | null = null;
      if (typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(0, 0, 64, 32);
        }
        baselineTex = new THREE.CanvasTexture(canvas);
        baselineTex.colorSpace = THREE.SRGBColorSpace;
      }

      return new THREE.ShaderMaterial({
        uniforms: {
          uTexA: { value: baselineTex },
          uTexB: { value: baselineTex },
          uMix: { value: 1.0 },
          uNoise: { value: 0.65 },
          uMutation: { value: 0.0 },
          uTime: { value: 0.0 },
        },
        vertexShader: skyVertexShader,
        fragmentShader: skyFragmentShader,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
    },
    []
  );

  // load target texture, polling while a background sub-room is still being synthesized
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const attempt = (n: number) => {
      loadPanoramaTexture(panoramaUrl, fallbackUrl).then((tex) => {
        if (!alive) return;
        setTargetTex(tex);
        if (tex.userData?.isFallback && n < 20) {
          timer = setTimeout(() => alive && attempt(n + 1), 3000);
        }
      });
    };
    attempt(0);

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [panoramaUrl, fallbackUrl]);

  // start a crossfade from the previous sky to the new one
  useEffect(() => {
    if (!targetTex) return;
    const u = material.uniforms;
    const current = mixRef.current >= 0.5 ? u.uTexB.value : u.uTexA.value;
    u.uTexA.value = current || targetTex;
    u.uTexB.value = targetTex;
    mixRef.current = current ? 0.0 : 1.0;
    u.uMix.value = mixRef.current;
  }, [targetTex, material]);

  useEffect(() => {
    if (isCompilingWorld) noiseRef.current = 0.98;
  }, [isCompilingWorld]);

  useFrame(({ clock }, delta) => {
    const u = material.uniforms;
    u.uTime.value = clock.getElapsedTime();
    u.uMutation.value = mutationFactor;

    if (mixRef.current < 1.0) {
      mixRef.current = Math.min(1.0, mixRef.current + delta * 1.1);
      u.uMix.value = mixRef.current;
    }

    if (isCompilingWorld) {
      noiseRef.current = Math.min(0.98, noiseRef.current + delta * 1.8);
    } else if (noiseRef.current > 0.001) {
      noiseRef.current = Math.max(0.0, noiseRef.current - delta * 0.34);
    }
    u.uNoise.value = noiseRef.current;
    setDiffusionProgress(Math.round((1.0 - noiseRef.current) * 100));
  });

  return (
    <mesh renderOrder={-1} frustumCulled={false} scale={[-1, 1, 1]}>
      <sphereGeometry args={[radius, 96, 48]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
