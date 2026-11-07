// inverted panorama sphere mesh with 16-bit vertex depth displacement and anonymous cors textures
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { loadPanoramaTexture } from "./loaders/TextureLoader";
import { createDisplacementMaterial } from "./shaders/displacementShader";

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

  useEffect(() => {
    let isMounted = true;

    // load primary equirectangular texture
    loadPanoramaTexture(panoramaUrl).then((loadedTex) => {
      if (isMounted) {
        setTexture(loadedTex);
      }
    });

    // load depth displacement map if provided
    if (depthUrl) {
      loadPanoramaTexture(depthUrl, "/cached_worlds/cyberpunk_alley/depth.png").then((loadedDepth) => {
        if (isMounted) {
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

  // construct shader material when both textures are ready
  const shaderMaterial = useMemo(() => {
    if (!texture) return null;
    if (depthTexture) {
      return createDisplacementMaterial(texture, depthTexture, displacementScale, mutationFactor);
    }
    return new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });
  }, [texture, depthTexture, displacementScale, mutationFactor]);

  // explicitly update mesh material on three.js instance
  useEffect(() => {
    if (meshRef.current && shaderMaterial) {
      meshRef.current.material = shaderMaterial;
      meshRef.current.material.needsUpdate = true;
    }
  }, [shaderMaterial]);

  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]} key={texture ? "loaded" : "loading"}>
      {/* 500 radius sphere with 128x64 segments per specification */}
      <sphereGeometry args={[500, 128, 64]} />
      {shaderMaterial ? (
        <primitive object={shaderMaterial} attach="material" />
      ) : (
        <meshBasicMaterial color="#0a0a14" wireframe={true} side={THREE.DoubleSide} />
      )}
    </mesh>
  );
}
