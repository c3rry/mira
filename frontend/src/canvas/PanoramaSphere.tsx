// seamless infinite-distance 360 sky panorama with room-to-room crossfade and latent denoise reveal
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { loadPanoramaTexture } from "./loaders/TextureLoader";
import { RoomVisualPalette, useWorldStore } from "@/store/useWorldStore";

interface PanoramaSphereProps {
  panoramaUrl: string;
  // same-world panorama shown while a background sub-room is still synthesizing
  fallbackUrl?: string;
  mutationFactor?: number;
  radius?: number;
  transitionDirection?: [number, number, number];
  visualPalette?: RoomVisualPalette;
}

const skyVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// directional forward-warp shader providing physical optical expansion into adjacent room
const skyFragmentShader = `
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform float uMix;
  uniform float uNoise;
  uniform float uMutation;
  uniform float uTime;
  uniform float uRainbowFog;
  uniform vec3 uTransitionDir;
  uniform vec3 uEnvSky;
  uniform vec3 uEnvDominant;
  uniform vec3 uEnvAccent;
  uniform vec3 uEnvFloor;
  varying vec2 vUv;

  const float PI = 3.141592653589793;
  const float TWO_PI = 6.283185307179586;

  vec3 spectralRainbow(float t) {
    return 0.5 + 0.5 * cos(TWO_PI * (t + vec3(0.0, 0.3333333, 0.6666667)));
  }

  vec3 uvToDir(vec2 uv) {
    float theta = (uv.x - 0.5) * TWO_PI;
    float phi = (1.0 - uv.y) * PI;
    return vec3(sin(phi) * sin(theta), cos(phi), sin(phi) * cos(theta));
  }

  vec2 dirToUv(vec3 dir) {
    float theta = atan(dir.x, dir.z);
    float phi = acos(clamp(dir.y, -1.0, 1.0));
    float u = fract(theta / TWO_PI + 0.5);
    float v = 1.0 - phi / PI;
    return vec2(u, v);
  }

  // 3D continuous Simplex Noise on unit sphere (zero polar distortion & zero seam artifacts)
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // Multi-octave continuous fractal Brownian motion (fbm)
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 4; ++i) {
      v += a * snoise(p);
      p = p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float blend = smoothstep(0.0, 1.0, uMix);
    vec3 dir = uvToDir(vUv);
    vec3 a;
    vec3 b;

    float lenDir = length(uTransitionDir);
    if (lenDir > 0.05 && blend > 0.001 && blend < 0.999) {
      vec3 dirNorm = normalize(uTransitionDir);
      // Outgoing texture warps/expands forward in direction of travel
      vec3 dirA = normalize(dir + dirNorm * (blend * 0.42));
      // Incoming destination texture smoothly zooms in from distance
      vec3 dirB = normalize(dir - dirNorm * ((1.0 - blend) * 0.42));
      a = texture2D(uTexA, dirToUv(dirA)).rgb;
      b = texture2D(uTexB, dirToUv(dirB)).rgb;
    } else {
      a = texture2D(uTexA, vUv).rgb;
      b = texture2D(uTexB, vUv).rgb;
    }

    vec3 col = max(mix(a, b, blend), vec3(0.04, 0.05, 0.08));

    // Volumetric dynamic atmospheric fog reflecting the environmental palette
    if (uRainbowFog > 0.001) {
      float fogSpeed = uTime * 0.32;
      vec3 p1 = dir * 2.8 + vec3(fogSpeed * 0.35, sin(fogSpeed * 0.6) * 0.25, fogSpeed * 0.45);
      vec3 p2 = dir * 5.6 - vec3(fogSpeed * 0.25, cos(fogSpeed * 0.5) * 0.3, fogSpeed * 0.15);
      vec3 p3 = dir * 11.0 + vec3(0.0, fogSpeed * 0.75, 0.0);
      float n1 = snoise(p1);
      float n2 = snoise(p2);
      float n3 = snoise(p3);

      float combinedNoise = (n1 * 0.5 + 0.5) * 0.52 + (n2 * 0.5 + 0.5) * 0.32 + (n3 * 0.5 + 0.5) * 0.16;

      // Dynamic atmospheric vertical elevation gradient with subtle fluid undulation
      float yNorm = clamp(dir.y * 0.5 + 0.5 + sin(dir.x * 2.5 + fogSpeed * 0.75) * 0.07, 0.0, 1.0);
      vec3 envGradient = yNorm < 0.5
        ? mix(uEnvFloor, uEnvDominant, yNorm * 2.0)
        : mix(uEnvDominant, uEnvSky, (yNorm - 0.5) * 2.0);

      // Dynamic luminous veins and glints reflecting environment accent
      float glint = pow(clamp(n3 * 0.5 + 0.5, 0.0, 1.0), 3.0) * 0.65;
      vec3 dynamicEnvMist = mix(envGradient, uEnvAccent, clamp(combinedNoise * 0.6 + glint * 0.4, 0.0, 1.0));
      dynamicEnvMist = dynamicEnvMist * (0.82 + glint * 0.45) + uEnvAccent * (glint * 0.5);

      // Deep atmospheric grounding mist at horizon/nadir
      vec3 deepMist = mix(uEnvFloor * 0.65, uEnvDominant * 0.65, dir.y * 0.5 + 0.5);
      vec3 fullEnvFog = mix(deepMist, dynamicEnvMist, clamp(combinedNoise * 1.35, 0.25, 1.0));

      float fogWeight = smoothstep(0.0, 1.0, uRainbowFog);
      col = mix(col, fullEnvFog, clamp(fogWeight * 0.3, 0.0, 0.3));
    }

    // Dynamic continuous procedural 3D noise modulation reflecting environmental tones
    if (uNoise > 0.005) {
      float n = fbm(dir * 3.2 + vec3(0.0, uTime * 0.12, uTime * 0.08));
      float n2 = fbm(dir * 6.5 - vec3(uTime * 0.07, 0.0, uTime * 0.05));
      vec3 noiseCol = mix(uEnvDominant, uEnvSky, n * 0.5 + 0.5);
      noiseCol = mix(noiseCol, uEnvAccent, clamp(n2 * 0.6 + 0.2, 0.0, 1.0));
      col = mix(col, noiseCol, clamp(uNoise * 0.25, 0.0, 0.25));
    }

    col = mix(col, col * vec3(1.12, 0.95, 0.82), uMutation * 0.45);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function PanoramaSphere({
  panoramaUrl,
  fallbackUrl,
  mutationFactor = 0.0,
  radius = 900,
  transitionDirection = [0, 0, -1],
  visualPalette,
}: PanoramaSphereProps) {
  const [targetTex, setTargetTex] = useState<THREE.Texture | null>(null);
  const noiseRef = useRef<number>(0.0);
  const rainbowFogRef = useRef<number>(0.0);
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
          uNoise: { value: 0.0 },
          uRainbowFog: { value: 0.0 },
          uMutation: { value: 0.0 },
          uTime: { value: 0.0 },
          uTransitionDir: { value: new THREE.Vector3(0, 0, -1) },
          uEnvSky: { value: new THREE.Color("#0284c7") },
          uEnvDominant: { value: new THREE.Color("#d97706") },
          uEnvAccent: { value: new THREE.Color("#fbbf24") },
          uEnvFloor: { value: new THREE.Color("#1e293b") },
        },
        vertexShader: skyVertexShader,
        fragmentShader: skyFragmentShader,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
    },
    []
  );

  // Synchronize environmental atmospheric uniforms with active room visual palette
  useEffect(() => {
    const u = material.uniforms;
    if (visualPalette) {
      if (visualPalette.sky_tone) {
        try { u.uEnvSky.value.set(visualPalette.sky_tone); } catch {}
      }
      if (visualPalette.dominant_color) {
        try { u.uEnvDominant.value.set(visualPalette.dominant_color); } catch {}
      }
      if (visualPalette.accent_color) {
        try { u.uEnvAccent.value.set(visualPalette.accent_color); } catch {}
      }
      if (visualPalette.floor_tone) {
        try { u.uEnvFloor.value.set(visualPalette.floor_tone); } catch {}
      }
    }
  }, [visualPalette, material]);

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

  // start a directional forward-warp crossfade from the previous sky to the new one
  useEffect(() => {
    if (!targetTex) return;
    const u = material.uniforms;
    const current = mixRef.current >= 0.5 ? u.uTexB.value : u.uTexA.value;
    u.uTexA.value = current || targetTex;
    u.uTexB.value = targetTex;
    if (transitionDirection) {
      u.uTransitionDir.value.set(transitionDirection[0], transitionDirection[1], transitionDirection[2]);
    }
    mixRef.current = current ? 0.0 : 1.0;
    u.uMix.value = mixRef.current;
  }, [targetTex, material, transitionDirection]);

  useEffect(() => {
    if (isCompilingWorld) {
      noiseRef.current = 0.2;
      rainbowFogRef.current = 0.3;
    }
  }, [isCompilingWorld]);

  useFrame(({ clock }, delta) => {
    const u = material.uniforms;
    u.uTime.value = clock.getElapsedTime();
    u.uMutation.value = mutationFactor;

    if (mixRef.current < 1.0) {
      mixRef.current = Math.min(1.0, mixRef.current + delta * 1.5);
      u.uMix.value = mixRef.current;
    }

    if (isCompilingWorld) {
      rainbowFogRef.current = Math.min(0.35, rainbowFogRef.current + delta * 0.8);
      noiseRef.current = Math.min(0.25, noiseRef.current + delta * 0.8);
      const currentProg = useWorldStore.getState().diffusionProgress;
      if (currentProg < 92) {
        setDiffusionProgress(Math.min(92, currentProg + Math.max(1, Math.round(delta * 16))));
      }
    } else {
      rainbowFogRef.current = Math.max(0.0, rainbowFogRef.current - delta * 4.0);
      noiseRef.current = Math.max(0.0, noiseRef.current - delta * 4.0);
      setDiffusionProgress(100);
    }
    u.uRainbowFog.value = rainbowFogRef.current;
    u.uNoise.value = noiseRef.current;
  });

  return (
    <mesh renderOrder={-1} frustumCulled={false} scale={[-1, 1, 1]}>
      <sphereGeometry args={[radius, 96, 48]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
