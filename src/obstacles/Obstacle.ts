import * as THREE from 'three';
import { LANE_POSITIONS } from '../config/gameConfig';
import type { ObstacleBehavior, ObstacleTypeId } from './ObstacleType';

/**
 * One pooled obstacle instance: its visual group, a reusable world-space collision box,
 * and the minimal state needed for pooling and collision bookkeeping. Geometry is built once
 * by ObstacleFactory - this class only ever repositions and (de)activates it.
 */
export class Obstacle {
  readonly typeId: ObstacleTypeId;
  readonly behavior: ObstacleBehavior;
  readonly group: THREE.Group;

  /** Local-space collision box (floor-relative), set once at construction. Never mutated. */
  private readonly localBounds: THREE.Box3;
  /** World-space collision box, refreshed every frame this obstacle is active. Reused. */
  readonly worldBounds = new THREE.Box3();

  active = false;
  laneIndex = 0;
  /** True only once a real damaging hit has been resolved for this activation. Permanent
   *  until the obstacle is recycled - this is what stops repeated instant damage. */
  hasHitPlayer = false;
  /** True while currently overlapping the player, whether or not that overlap has been
   *  resolved into damage yet (e.g. blocked by invincibility). Lets a still-overlapping
   *  obstacle become damaging again the instant invincibility ends, without a timer. */
  inContact = false;
  /** True once this activation has already been checked for (and, if eligible, awarded) a
   *  Near Miss. Permanent until the obstacle is recycled - stops the same obstacle from ever
   *  awarding the bonus more than once. See systems/NearMissSystem. */
  nearMissTriggered = false;

  constructor(typeId: ObstacleTypeId, behavior: ObstacleBehavior, group: THREE.Group, localBounds: THREE.Box3) {
    this.typeId = typeId;
    this.behavior = behavior;
    this.group = group;
    this.localBounds = localBounds;
    this.group.visible = false;
  }

  activate(laneIndex: number, spawnZ: number): void {
    this.laneIndex = laneIndex;
    this.active = true;
    this.hasHitPlayer = false;
    this.inContact = false;
    this.nearMissTriggered = false;
    this.group.position.set(LANE_POSITIONS[laneIndex], 0, spawnZ);
    this.group.visible = true;
    this.updateWorldBounds();
  }

  deactivate(): void {
    this.active = false;
    this.group.visible = false;
  }

  /** Returns this obstacle to a clean, inactive state (used on full game reset). */
  reset(): void {
    this.deactivate();
    this.hasHitPlayer = false;
    this.inContact = false;
    this.nearMissTriggered = false;
    this.group.position.set(LANE_POSITIONS[this.laneIndex], 0, 0);
  }

  /** Advances the obstacle toward the player at the current world speed. */
  advance(deltaTime: number, speed: number): void {
    this.group.position.z += speed * deltaTime;
    this.updateWorldBounds();
  }

  private updateWorldBounds(): void {
    this.worldBounds.copy(this.localBounds);
    this.worldBounds.translate(this.group.position);
  }
}
