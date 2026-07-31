import * as THREE from 'three';
import type { Player } from '../entities/Player';
import type { Obstacle } from '../obstacles/Obstacle';
import { PLAYER_COLLISION_HALF_DEPTH, PLAYER_COLLISION_HALF_WIDTH, STANDING_HEIGHT } from '../config/gameConfig';

/**
 * Lightweight axis-aligned bounding-box collision, built entirely on reused THREE.Box3
 * instances - no physics engine, no per-frame raycasting, no allocations in the hot path.
 * The player's box is derived from actual pose (position, height scale) every frame, so
 * jump/slide clearance comes from real overlap math rather than checking state names.
 */
export class CollisionSystem {
  private readonly playerBounds = new THREE.Box3();
  private readonly minVec = new THREE.Vector3();
  private readonly maxVec = new THREE.Vector3();

  updatePlayerBounds(player: Player): void {
    const minY = player.group.position.y;
    const maxY = minY + STANDING_HEIGHT * player.currentHeightScale;

    this.minVec.set(
      player.currentX - PLAYER_COLLISION_HALF_WIDTH,
      minY,
      player.group.position.z - PLAYER_COLLISION_HALF_DEPTH,
    );
    this.maxVec.set(
      player.currentX + PLAYER_COLLISION_HALF_WIDTH,
      maxY,
      player.group.position.z + PLAYER_COLLISION_HALF_DEPTH,
    );
    this.playerBounds.set(this.minVec, this.maxVec);
  }

  /**
   * Scans every active, not-yet-resolved obstacle exactly once, updating each one's
   * `inContact` flag (so a contact that ends without damage - e.g. blocked by invincibility -
   * is cleanly forgotten rather than lingering), and returns the one obstacle that should
   * apply damage this frame, if any.
   *
   * An obstacle is only ever returned while the player is NOT invincible. This means an
   * obstacle merely grazed during invincibility is never marked as resolved by the caller -
   * if the player is still overlapping it once invincibility ends, it becomes damaging again
   * on the very next frame, which is the physically reasonable outcome for staying in contact.
   */
  findCollision(obstacles: ReadonlyArray<Obstacle>, isInvincible: boolean): Obstacle | null {
    let hit: Obstacle | null = null;

    for (const obstacle of obstacles) {
      if (!obstacle.active || obstacle.hasHitPlayer) continue;

      const overlapping = this.playerBounds.intersectsBox(obstacle.worldBounds);
      if (!overlapping) {
        obstacle.inContact = false;
        continue;
      }

      obstacle.inContact = true;
      if (!isInvincible && !hit) {
        hit = obstacle;
      }
    }

    return hit;
  }

  reset(): void {
    this.playerBounds.makeEmpty();
  }
}
