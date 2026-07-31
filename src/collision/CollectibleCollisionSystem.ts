import * as THREE from 'three';
import type { Player } from '../entities/Player';
import type { Collectible } from '../collectibles/Collectible';
import {
  PLAYER_COLLISION_HALF_DEPTH,
  PLAYER_COLLISION_HALF_WIDTH,
  STANDING_HEIGHT,
  TOKEN_PICKUP_PADDING,
} from '../config/gameConfig';

/**
 * Lightweight, reusable Box3 collision for collectible pickup - a separate system from
 * CollisionSystem (obstacles) so pickup detection never depends on, or complicates, damage
 * handling. The player's box here is the same pose-derived box used for obstacles, padded
 * outward by TOKEN_PICKUP_PADDING for a more forgiving pickup than a damaging collision.
 */
export class CollectibleCollisionSystem {
  private readonly playerBounds = new THREE.Box3();
  private readonly minVec = new THREE.Vector3();
  private readonly maxVec = new THREE.Vector3();
  private readonly pickupScratch: Collectible[] = [];

  updatePlayerBounds(player: Player): void {
    const halfWidth = PLAYER_COLLISION_HALF_WIDTH + TOKEN_PICKUP_PADDING;
    const halfDepth = PLAYER_COLLISION_HALF_DEPTH + TOKEN_PICKUP_PADDING;
    const minY = player.group.position.y - TOKEN_PICKUP_PADDING;
    const maxY = minY + STANDING_HEIGHT * player.currentHeightScale + TOKEN_PICKUP_PADDING * 2;

    this.minVec.set(player.currentX - halfWidth, minY, player.group.position.z - halfDepth);
    this.maxVec.set(player.currentX + halfWidth, maxY, player.group.position.z + halfDepth);
    this.playerBounds.set(this.minVec, this.maxVec);
  }

  /** Every active, uncollected token currently overlapping the player. Reuses one array. */
  findPickups(collectibles: ReadonlyArray<Collectible>): ReadonlyArray<Collectible> {
    this.pickupScratch.length = 0;
    for (const collectible of collectibles) {
      if (!collectible.active || collectible.collected) continue;
      if (this.playerBounds.intersectsBox(collectible.worldBounds)) {
        this.pickupScratch.push(collectible);
      }
    }
    return this.pickupScratch;
  }

  reset(): void {
    this.playerBounds.makeEmpty();
    this.pickupScratch.length = 0;
  }
}
