import * as THREE from 'three';
import { TOKEN_POOL_SIZE } from '../config/gameConfig';
import { createCollectible } from './CollectibleFactory';
import { Collectible } from './Collectible';
import { ALL_COLLECTIBLE_TYPE_IDS, CollectibleTypeId } from './CollectibleType';

/**
 * A fixed pool of pre-built Collectible instances, structured the same way as ObstaclePool
 * (a map keyed by type, even though only one type exists this sprint) so a second collectible
 * type could be added later without reshaping this class. Instances are created exactly once
 * here and only ever activated/deactivated afterward - no meshes are created or destroyed
 * during gameplay.
 */
export class CollectiblePool {
  private readonly pools: Map<CollectibleTypeId, Collectible[]> = new Map();
  private readonly activeScratch: Collectible[] = [];

  constructor(parent: THREE.Group) {
    for (const typeId of ALL_COLLECTIBLE_TYPE_IDS) {
      const instances: Collectible[] = [];
      for (let i = 0; i < TOKEN_POOL_SIZE; i++) {
        const collectible = createCollectible(typeId);
        parent.add(collectible.group);
        instances.push(collectible);
      }
      this.pools.set(typeId, instances);
    }
  }

  acquire(typeId: CollectibleTypeId): Collectible | null {
    const instances = this.pools.get(typeId);
    if (!instances) return null;
    return instances.find((collectible) => !collectible.active) ?? null;
  }

  /** Returns every currently active collectible. The backing array is reused across calls. */
  getActive(): ReadonlyArray<Collectible> {
    this.activeScratch.length = 0;
    for (const instances of this.pools.values()) {
      for (const collectible of instances) {
        if (collectible.active) this.activeScratch.push(collectible);
      }
    }
    return this.activeScratch;
  }

  releaseAll(): void {
    for (const instances of this.pools.values()) {
      for (const collectible of instances) collectible.reset();
    }
  }
}
