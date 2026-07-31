import * as THREE from 'three';

const POOL_SIZE = 4;
const RING_SEGMENTS = 24;
// Shared across every pooled ring - identical geometry, only material (color/opacity) differs
// per trigger, so this allocates once for the app's lifetime rather than per effect.
const RING_GEOMETRY = new THREE.RingGeometry(0.7, 1, RING_SEGMENTS);

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface RingSlot {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshBasicMaterial;
  active: boolean;
  elapsed: number;
  duration: number;
  startScale: number;
  endScale: number;
  baseOpacity: number;
}

/**
 * A small pool of flat, additive-style ring meshes used for brief "pulse" feedback - landing
 * dust and the token-pickup ring - reused across both call sites rather than duplicating a
 * ring effect per feature. Fixed pool (POOL_SIZE), round-robin allocation: a trigger while all
 * slots are in use simply reuses the oldest one, which is imperceptible since ring lifetimes
 * are short and pulses this frequent already overlap visually. No geometry or material is ever
 * created after construction.
 */
export class PulseRingEffect {
  readonly group: THREE.Group;
  private readonly rings: RingSlot[] = [];
  private nextIndex = 0;

  constructor() {
    this.group = new THREE.Group();

    for (let i = 0; i < POOL_SIZE; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(RING_GEOMETRY, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({
        mesh,
        material,
        active: false,
        elapsed: 0,
        duration: 1,
        startScale: 0.001,
        endScale: 1,
        baseOpacity: 0,
      });
    }
  }

  trigger(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    startScale: number,
    endScale: number,
    duration: number,
    opacity: number,
  ): void {
    if (REDUCED_MOTION) return;

    const ring = this.rings[this.nextIndex];
    this.nextIndex = (this.nextIndex + 1) % this.rings.length;

    ring.active = true;
    ring.elapsed = 0;
    ring.duration = duration;
    ring.startScale = startScale;
    ring.endScale = endScale;
    ring.baseOpacity = opacity;
    ring.material.color.setHex(colorHex);
    ring.material.opacity = opacity;
    ring.mesh.position.set(x, y, z);
    ring.mesh.scale.setScalar(startScale);
    ring.mesh.visible = true;
  }

  /** Runs every frame regardless of game state, like CameraShake, so an in-flight pulse always
   *  finishes its decay cleanly; callers explicitly reset() on pause/restart/menu instead. */
  update(deltaTime: number): void {
    for (const ring of this.rings) {
      if (!ring.active) continue;

      ring.elapsed += deltaTime;
      const t = Math.min(ring.elapsed / ring.duration, 1);
      const scale = ring.startScale + (ring.endScale - ring.startScale) * t;
      ring.mesh.scale.setScalar(scale);
      ring.material.opacity = ring.baseOpacity * (1 - t);

      if (t >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
      }
    }
  }

  reset(): void {
    for (const ring of this.rings) {
      ring.active = false;
      ring.mesh.visible = false;
      ring.material.opacity = 0;
    }
  }
}
