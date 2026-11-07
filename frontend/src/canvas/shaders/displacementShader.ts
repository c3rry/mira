// 16-bit vertex depth displacement shader definition and material factory
import * as THREE from "three";

export interface DisplacementUniforms {
  uTexture: { value: THREE.Texture | null };
  uDepthMap: { value: THREE.Texture | null };
  uDisplacementScale: { value: number };
  uDisplacementBias: { value: number };
  uMutationFactor: { value: number };
}

export const PanoramaDisplacementShader = {
  uniforms: {
    uTexture: { value: null as THREE.Texture | null },
    uDepthMap: { value: null as THREE.Texture | null },
    uDisplacementScale: { value: 35.0 },
    uDisplacementBias: { value: -5.0 },
    uMutationFactor: { value: 0.0 },
  },

  vertexShader: `
    uniform sampler2D uDepthMap;
    uniform float uDisplacementScale;
    uniform float uDisplacementBias;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vUv = uv;
      vNormal = normal;
      
      // sample normalized radial depth
      vec4 depthTexel = texture2D(uDepthMap, uv);
      float depthVal = depthTexel.r;
      
      // radial displacement along inverted normal
      vec3 displaced = position + normal * (depthVal * uDisplacementScale + uDisplacementBias);
      vPosition = displaced;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D uTexture;
    uniform float uMutationFactor;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vec4 texColor = texture2D(uTexture, vUv);
      
      // subtle in-situ mutation atmosphere tint
      vec3 mutatedColor = mix(texColor.rgb, texColor.rgb * vec3(0.85, 1.15, 1.25), uMutationFactor * 0.4);
      
      gl_FragColor = vec4(mutatedColor, texColor.a);
    }
  `,
};

export function createDisplacementMaterial(
  panoramaTexture: THREE.Texture | null,
  depthTexture: THREE.Texture | null,
  displacementScale: number = 35.0,
  mutationFactor: number = 0.0
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: panoramaTexture },
      uDepthMap: { value: depthTexture },
      uDisplacementScale: { value: displacementScale },
      uDisplacementBias: { value: -5.0 },
      uMutationFactor: { value: mutationFactor },
    },
    vertexShader: PanoramaDisplacementShader.vertexShader,
    fragmentShader: PanoramaDisplacementShader.fragmentShader,
    side: THREE.DoubleSide,
  });
}
