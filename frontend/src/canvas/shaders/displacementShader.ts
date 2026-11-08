// 16-bit vertex depth displacement and latent diffusion denoising shader
import * as THREE from "three";

export interface DisplacementUniforms {
  uTexture: { value: THREE.Texture | null };
  uDepthMap: { value: THREE.Texture | null };
  uDisplacementScale: { value: number };
  uDisplacementBias: { value: number };
  uMutationFactor: { value: number };
  uDiffusionNoise: { value: number };
  uTime: { value: number };
  uOpacity: { value: number };
}

export const PanoramaDisplacementShader = {
  uniforms: {
    uTexture: { value: null as THREE.Texture | null },
    uDepthMap: { value: null as THREE.Texture | null },
    uDisplacementScale: { value: 35.0 },
    uDisplacementBias: { value: -5.0 },
    uMutationFactor: { value: 0.0 },
    uDiffusionNoise: { value: 0.0 },
    uTime: { value: 0.0 },
    uOpacity: { value: 1.0 },
  },

  vertexShader: `
    uniform sampler2D uDepthMap;
    uniform float uDisplacementScale;
    uniform float uDisplacementBias;
    uniform float uDiffusionNoise;
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vUv = uv;
      vNormal = normal;
      
      vec4 depthTexel = texture2D(uDepthMap, uv);
      float depthVal = depthTexel.r;

      // add subtle latent spatial wave during diffusion denoising
      float latentWave = sin(uv.x * 28.0 + uTime * 3.0) * cos(uv.y * 18.0 - uTime * 2.2) * uDiffusionNoise * 18.0;
      
      vec3 displaced = position + normal * (depthVal * uDisplacementScale + uDisplacementBias + latentWave);
      vPosition = displaced;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D uTexture;
    uniform float uMutationFactor;
    uniform float uDiffusionNoise;
    uniform float uTime;
    uniform float uOpacity;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    // pseudo-random hash for stochastic gaussian grain
    float hash21(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }

    // smooth 2d value noise for early stable diffusion latent color blobs
    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      // quantize uv into coarse latent blocks when diffusion noise is high
      float blockRes = mix(2048.0, 42.0, pow(uDiffusionNoise, 0.75));
      vec2 latentUv = floor(vUv * blockRes) / blockRes;

      // warp uv slightly during early denoising steps
      vec2 warp = vec2(
        valueNoise(latentUv * 14.0 + uTime * 0.8) - 0.5,
        valueNoise(latentUv * 14.0 - uTime * 0.8 + 7.3) - 0.5
      ) * uDiffusionNoise * 0.09;

      vec4 texColor = texture2D(uTexture, clamp(mix(vUv, latentUv, uDiffusionNoise * 0.65) + warp, 0.001, 0.999));

      // multi-channel latent gaussian color patches (characteristic early stable diffusion palette)
      vec3 latentBlob = vec3(
        valueNoise(latentUv * 9.0 + vec2(uTime * 0.6, 1.2)),
        valueNoise(latentUv * 9.0 + vec2(-uTime * 0.5, 4.7)),
        valueNoise(latentUv * 9.0 + vec2(uTime * 0.4, 9.1))
      );

      // high-frequency stochastic diffusion grain
      vec3 fineGrain = vec3(
        hash21(vUv * 512.0 + uTime),
        hash21(vUv * 512.0 + uTime + 1.37),
        hash21(vUv * 512.0 + uTime + 2.91)
      );

      vec3 noisyLatent = mix(latentBlob, fineGrain, 0.42);
      vec3 denoisedColor = mix(texColor.rgb, noisyLatent, clamp(uDiffusionNoise * 0.94, 0.0, 0.96));

      // in-situ mutation atmosphere tint
      vec3 mutatedColor = mix(denoisedColor, denoisedColor * vec3(1.12, 0.95, 0.82), uMutationFactor * 0.45);

      gl_FragColor = vec4(mutatedColor, texColor.a * uOpacity);
    }
  `,
};

export function createDisplacementMaterial(
  panoramaTexture: THREE.Texture | null,
  depthTexture: THREE.Texture | null,
  displacementScale: number = 35.0,
  mutationFactor: number = 0.0,
  diffusionNoise: number = 0.0
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: panoramaTexture },
      uDepthMap: { value: depthTexture },
      uDisplacementScale: { value: displacementScale },
      uDisplacementBias: { value: -5.0 },
      uMutationFactor: { value: mutationFactor },
      uDiffusionNoise: { value: diffusionNoise },
      uTime: { value: 0.0 },
      uOpacity: { value: 1.0 },
    },
    vertexShader: PanoramaDisplacementShader.vertexShader,
    fragmentShader: PanoramaDisplacementShader.fragmentShader,
    side: THREE.DoubleSide,
    transparent: true,
  });
}
