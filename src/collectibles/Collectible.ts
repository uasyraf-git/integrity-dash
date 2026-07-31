import * as THREE from 'three';
import {
  LANE_POSITIONS,
  TOKEN_BOB_AMPLITUDE,
  TOKEN_BOB_FREQUENCY,
  TOKEN_IDLE_ROTATION_SPEED,
  TOKEN_PICKUP_ANIMATION_DURATION,
  TOKEN_PICKUP_GLOW_INTENSITY,
  TOKEN_PICKUP_SPIN_ACCEL,
} from '../config/gameConfig';
import { clamp, easeOutBack } from '../utils/math';
import type { CollectibleTypeId } from './CollectibleType';

let nextRuntimeId = 1;

const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Reduced-motion multiplier applied to bob amplitude and the pickup's rise/scale delta. */
const REDUCED_MOTION_SCALE = 0.25;

/**
 * One pooled collectible instance. Unlike Obstacle (floor-relative origin), a Collectible's
 * local origin is its own centre, since tokens float rather than sit on the floor. Materials
 * are owned per-instance (not shared like ObstacleFactory's cache) because the pickup
 * animation fades opacity and boosts emissive independently per token - sharing materials
 * across the pool would make one token's pickup flash/fade every other active token too.
 */
export class Collectible {
  readonly id: number;
  readonly typeId: CollectibleTypeId;
  readonly group: THREE.Group;

  /** Local-space collision box (centre-relative), set once at construction. Never mutated. */
  private readonly localBounds: THREE.Box3;
  /** World-space collision box, refreshed every frame this token is active. Reused. */
  readonly worldBounds = new THREE.Box3();
  private readonly materials: ReadonlyArray<THREE.MeshStandardMaterial>;
  private readonly baseEmissiveIntensities: ReadonlyArray<number>;

  active = false;
  collected = false;
  laneIndex = 0;

  private baseY = 0;
  private idleTime = 0;
  private pickupElapsed = 0;
  private pickupActive = false;

  constructor(
    typeId: CollectibleTypeId,
    group: THREE.Group,
    localBounds: THREE.Box3,
    materials: ReadonlyArray<THREE.MeshStandardMaterial>,
  ) {
    this.id = nextRuntimeId++;
    this.typeId = typeId;
    this.group = group;
    this.localBounds = localBounds;
    this.materials = materials;
    this.baseEmissiveIntensities = materials.map((material) => material.emissiveIntensity);
    this.group.visible = false;
  }

  activate(laneIndex: number, baseY: number, z: number): void {
    this.laneIndex = laneIndex;
    this.baseY = baseY;
    this.active = true;
    this.collected = false;
    this.pickupActive = false;
    this.pickupElapsed = 0;
    // Randomised so pooled tokens don't all bob/rotate in perfect lockstep.
    this.idleTime = Math.random() * Math.PI * 2;

    this.group.position.set(LANE_POSITIONS[laneIndex], baseY, z);
    this.group.rotation.y = 0;
    this.group.scale.setScalar(1);
    this.setOpacity(1);
    this.setEmissiveBoost(0);
    this.group.visible = true;
    this.updateWorldBounds();
  }

  deactivate(): void {
    this.active = false;
    this.group.visible = false;
  }

  /** Returns this token to a clean, inactive state (used on full game reset). */
  reset(): void {
    this.deactivate();
    this.collected = false;
    this.pickupActive = false;
    this.pickupElapsed = 0;
    this.group.scale.setScalar(1);
    this.setOpacity(1);
    this.setEmissiveBoost(0);
    this.group.position.set(LANE_POSITIONS[this.laneIndex], this.baseY, 0);
  }

  /** Marks this token collected and starts its brief pickup animation. Pickup happens once
   *  per activation - the caller is expected to check `collected` before calling this. */
  markCollected(): void {
    this.collected = true;
    this.pickupActive = true;
    this.pickupElapsed = 0;
  }

  /**
   * Advances position and animation by one frame. Returns true once the pickup animation has
   * fully finished, signalling the caller (CollectibleManager) to deactivate this token.
   */
  advance(deltaTime: number, speed: number): boolean {
    this.group.position.z += speed * deltaTime;

    if (this.pickupActive) {
      this.pickupElapsed += deltaTime;
      const t = clamp(this.pickupElapsed / TOKEN_PICKUP_ANIMATION_DURATION, 0, 1);
      const motionScale = PREFERS_REDUCED_MOTION ? REDUCED_MOTION_SCALE : 1;

      // Ease-out-back gives the scale pop a slight overshoot before the token fades away,
      // instead of a flat linear grow.
      const scaleT = easeOutBack(t);
      this.group.scale.setScalar(1 + scaleT * 0.6 * motionScale);
      this.group.position.y = this.baseY + t * 0.5 * motionScale;

      // A brief spin acceleration on top of the idle rotation speed, purely for pickup flair.
      this.group.rotation.y +=
        TOKEN_IDLE_ROTATION_SPEED * (1 + t * TOKEN_PICKUP_SPIN_ACCEL) * motionScale * deltaTime;

      this.setOpacity(1 - t);
      // Glow pulse: rises then falls (a flash), rather than a monotonic decay from full boost.
      const glowPulse = Math.sin(Math.PI * t) * motionScale;
      this.setEmissiveBoost(glowPulse * TOKEN_PICKUP_GLOW_INTENSITY);

      this.updateWorldBounds();
      return t >= 1;
    }

    this.idleTime += deltaTime;
    this.group.rotation.y = this.idleTime * TOKEN_IDLE_ROTATION_SPEED;
    const bobAmplitude = PREFERS_REDUCED_MOTION ? TOKEN_BOB_AMPLITUDE * REDUCED_MOTION_SCALE : TOKEN_BOB_AMPLITUDE;
    this.group.position.y = this.baseY + Math.sin(this.idleTime * TOKEN_BOB_FREQUENCY) * bobAmplitude;
    this.updateWorldBounds();
    return false;
  }

  private setOpacity(opacity: number): void {
    for (const material of this.materials) {
      material.opacity = opacity;
    }
  }

  private setEmissiveBoost(boost: number): void {
    for (let i = 0; i < this.materials.length; i++) {
      this.materials[i].emissiveIntensity = this.baseEmissiveIntensities[i] + boost;
    }
  }

  private updateWorldBounds(): void {
    this.worldBounds.copy(this.localBounds);
    this.worldBounds.translate(this.group.position);
  }
}
