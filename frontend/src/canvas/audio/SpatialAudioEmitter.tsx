// declarative 3d spatial audio emitter with inverse distance hrtf attenuation
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { AudioManager } from "@/audio/AudioManager";

interface SpatialAudioEmitterProps {
  position: [number, number, number] | THREE.Vector3;
  audioUrl?: string;
  refDistance?: number;
  maxDistance?: number;
}

export function SpatialAudioEmitter({
  position,
  audioUrl,
  refDistance = 1.5,
  maxDistance = 15.0,
}: SpatialAudioEmitterProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const soundRef = useRef<THREE.PositionalAudio | null>(null);

  useEffect(() => {
    if (!audioUrl) return;

    const audioMgr = AudioManager.getInstance();
    const audioCtx = audioMgr.getAudioContext();
    if (!audioCtx) return;

    const listener = new THREE.AudioListener();
    const sound = new THREE.PositionalAudio(listener);

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(
      audioUrl,
      (buffer) => {
        sound.setBuffer(buffer);
        sound.setRefDistance(refDistance);
        sound.setMaxDistance(maxDistance);
        sound.setDistanceModel("inverse");
        sound.setLoop(true);
        sound.setVolume(0.5);

        // route into audio manager spatial submix if available
        const submix = audioMgr.getSpatialSubmix();
        if (submix) {
          try {
            sound.getOutput().connect(submix);
          } catch {
            // fallback to default three.js audio routing
          }
        }

        sound.play();
        soundRef.current = sound;
      },
      undefined,
      (err) => {
        // 15-minute de-scoping valve: silent fallback on missing sfx asset
        console.warn("spatial sfx asset could not be loaded:", err);
      }
    );

    return () => {
      if (sound.isPlaying) {
        sound.stop();
      }
    };
  }, [audioUrl, refDistance, maxDistance]);

  const posArray: [number, number, number] = Array.isArray(position)
    ? position
    : [position.x, position.y, position.z];

  return (
    <mesh ref={meshRef} position={posArray} visible={false}>
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
}
