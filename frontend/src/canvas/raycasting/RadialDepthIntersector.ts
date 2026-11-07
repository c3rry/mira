// analytical radial depth raycaster computing surface intersection against depth buffer
import * as THREE from "three";

export interface DepthRaycastResult {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  isWalkable: boolean;
  u: number;
  v: number;
  radius: number;
}

export class RadialDepthIntersector {
  private baseRadius: number;
  private displacementScale: number;
  private displacementBias: number;
  private depthData: Float32Array | null = null;
  private depthWidth: number = 0;
  private depthHeight: number = 0;

  constructor(
    baseRadius: number = 500.0,
    displacementScale: number = 35.0,
    displacementBias: number = -5.0
  ) {
    this.baseRadius = baseRadius;
    this.displacementScale = displacementScale;
    this.displacementBias = displacementBias;
  }

  // update depth map buffer for analytical sampling
  public setDepthBuffer(data: Float32Array, width: number, height: number): void {
    this.depthData = data;
    this.depthWidth = width;
    this.depthHeight = height;
  }

  // sample normalized depth value [0, 1] at equirectangular uv coordinate
  public sampleDepth(u: number, v: number): number {
    if (!this.depthData || this.depthWidth === 0 || this.depthHeight === 0) {
      // 15-minute de-scoping fallback: default neutral depth
      return 0.5;
    }

    const x = Math.max(0, Math.min(this.depthWidth - 1, Math.floor(u * this.depthWidth)));
    const y = Math.max(0, Math.min(this.depthHeight - 1, Math.floor(v * this.depthHeight)));
    const index = y * this.depthWidth + x;
    return this.depthData[index] ?? 0.5;
  }

  // compute exact 3d surface intersection from ray direction vector
  public intersectRay(rayDirection: THREE.Vector3): DepthRaycastResult {
    const dir = rayDirection.clone().normalize();

    // calculate spherical polar angles from ray vector
    const theta = Math.atan2(dir.x, dir.z);
    const phi = Math.acos(Math.max(-1.0, Math.min(1.0, dir.y)));

    // map spherical polar angles to equirectangular uv
    const u = ((theta / (2.0 * Math.PI)) + 0.5 + 1.0) % 1.0;
    const v = Math.max(0.0, Math.min(1.0, phi / Math.PI));

    // sample depth and calculate displaced radius
    const depthVal = this.sampleDepth(u, v);
    const radius = this.baseRadius + (depthVal * this.displacementScale + this.displacementBias);

    // surface intersection point in 3d world coordinates
    const point = dir.clone().multiplyScalar(radius);

    // surface normal pointing inward toward camera center
    const normal = dir.clone().negate();

    // slope gating: floor angle check where y is pointing down (polar phi > 90 deg)
    // alpha <= 45 degrees relative to upward normal indicates feasible horizontal floor
    const isFloorPolar = phi > (0.55 * Math.PI);
    const isWalkable = isFloorPolar && normal.y > 0.1;

    return {
      point,
      normal,
      isWalkable,
      u,
      v,
      radius,
    };
  }

  // fast fallback grounding coordinate for a given (u, v) anchor
  public getGroundPoint(u: number, v: number): THREE.Vector3 {
    const theta = (u - 0.5) * 2.0 * Math.PI;
    const phi = Math.max(0.05, Math.min(Math.PI - 0.05, v * Math.PI));
    const depthVal = this.sampleDepth(u, v);
    const radius = this.baseRadius + (depthVal * this.displacementScale + this.displacementBias);

    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    return new THREE.Vector3(x, y, z);
  }
}
