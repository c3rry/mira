// inverted panorama sphere mesh with 16-bit depth displacement and latent diffusion denoising
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { loadPanoramaTexture } from "./loaders/TextureLoader";
import { createDisplacementMaterial } from "./shaders/displacementShader";
import { useWorldStore } from "@/store/useWorldStore";

interface PanoramaSphereProps {
  panoramaUrl: string;
  depthUrl?: string;
  displacementScale?: number;
  mutationFactor?: number;
}

export function PanoramaSphere({
  panoramaUrl,
  depthUrl,
  displacementScale = 25.0,
  mutationFactor = 0.0,
}: PanoramaSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [depthTexture, setDepthTexture] = useState<THREE.Texture | null>(null);
  const noiseRef = useRef<number>(0.85);

  const isCompilingWorld = useWorldStore((state) => state.isCompilingWorld);
  const setDiffusionProgress = useWorldStore((state) => state.setDiffusionProgress);

  useEffect(() => {
    let isMounted = true;
    // trigger latent diffusion noise burst when room texture changes
    noiseRef.current = panoramaUrl.includes("custom=1") ? 0.94 : 0.65;

    loadPanoramaTexture(panoramaUrl).then((loadedTex) => {
      if (isMounted) {
        loadedTex.needsUpdate = true;
        setTexture(loadedTex);
      }
    });

    if (depthUrl) {
      loadPanoramaTexture(depthUrl, "/cached_worlds/desert_oasis/depth.png").then((loadedDepth) => {
        if (isMounted) {
          loadedDepth.needsUpdate = true;
          setDepthTexture(loadedDepth);
        }
      });
    } else {
      setDepthTexture(null);
    }

    return () => {
      isMounted = false;
    };
  }, [panoramaUrl, depthUrl]);

  useEffect(() => {
    if (isCompilingWorld) {
      noiseRef.current = 0.98;
    }
  }, [isCompilingWorld]);

  const shaderMaterial = useMemo(() => {
    if (!texture) return null;
    if (depthTexture) {
      return createDisplacementMaterial(
        texture,
        depthTexture,
        displacementScale,
        mutationFactor,
        noiseRef.current
      );
    }
    return new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });
  }, [texture, depthTexture]);

  useEffect(() => {
    if (!shaderMaterial) return;
    if ("uniforms" in shaderMaterial) {
      shaderMaterial.uniforms.uTexture.value = texture;
      shaderMaterial.uniforms.uDepthMap.value = depthTexture;
      shaderMaterial.uniforms.uDisplacementScale.value = displacementScale;
      shaderMaterial.uniforms.uMutationFactor.value = mutationFactor;
      shaderMaterial.needsUpdate = true;
    } else if ("map" in shaderMaterial) {
      (shaderMaterial as THREE.MeshBasicMaterial).map = texture;
      shaderMaterial.needsUpdate = true;
    }
    if (meshRef.current) {
      meshRef.current.material = shaderMaterial;
    }
  }, [shaderMaterial, texture, depthTexture, displacementScale, mutationFactor]);

  useFrame(({ clock }, delta) => {
    if (!shaderMaterial || !("uniforms" in shaderMaterial)) return;
    shaderMaterial.uniforms.uTime.value = clock.getElapsedTime();

    if (isCompilingWorld) {
      noiseRef.current = Math.min(0.98, noiseRef.current + delta * 1.8);
    } else if (noiseRef.current > 0.001) {
      // progressively denoise latent space to clear image over ~3 seconds
      noiseRef.current = Math.max(0.0, noiseRef.current - delta * 0.34);
    }

    shaderMaterial.uniforms.uDiffusionNoise.value = noiseRef.current;
    if (setDiffusionProgress) {
      const pct = Math.round((1.0 - noiseRef.current) * 100);
      setDiffusionProgress(pct);
    }
  });

  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]} key={panoramaUrl}>
      {/* 500 radius sphere with 128x64 segments per specification */}
      <sphereGeometry args={[500, 128, 64]} />
      {shaderMaterial ? (
        <primitive object={shaderMaterial} attach="material" />
      ) : (
        <meshBasicMaterial color="#1c1610" wireframe={true} side={THREE.DoubleSide} />
      )}
    </mesh>
  );
}
