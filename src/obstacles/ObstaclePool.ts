import * as THREE from 'three';
import { OBSTACLE_POOL_SIZE_PER_TYPE } from '../config/gameConfig';
import { createObstacle } from './ObstacleFactory';
import { Obstacle } from './Obstacle';
import { ALL_OBSTACLE_TYPE_IDS, ObstacleTypeId } from './ObstacleType';

/**
 * A fixed pool of pre-built Obstacle instances per type. Instances are created exactly once
 * (here) and only ever activated/deactivated afterward - no meshes are created or destroyed
 * during gameplay. If a type's pool is exhausted, acquire() simply returns null and the
 * spawner skips that attempt rather than growing the pool unbounded.
 */
export class ObstaclePool {
  private readonly pools: Map<ObstacleTypeId, Obstacle[]> = new Map();
  private readonly activeScratch: Obstacle[] = [];

  constructor(parent: THREE.Group) {
    for (const typeId of ALL_OBSTACLE_TYPE_IDS) {
      const instances: Obstacle[] = [];
      for (let i = 0; i < OBSTACLE_POOL_SIZE_PER_TYPE; i++) {
        const obstacle = createObstacle(typeId);
        parent.add(obstacle.group);
        instances.push(obstacle);
      }
      this.pools.set(typeId, instances);
    }
  }

  acquire(typeId: ObstacleTypeId): Obstacle | null {
    const instances = this.pools.get(typeId);
    if (!instances) return null;
    return instances.find((obstacle) => !obstacle.active) ?? null;
  }

  /** Returns every currently active obstacle. The backing array is reused across calls. */
  getActive(): ReadonlyArray<Obstacle> {
    this.activeScratch.length = 0;
    for (const instances of this.pools.values()) {
      for (const obstacle of instances) {
        if (obstacle.active) this.activeScratch.push(obstacle);
      }
    }
    return this.activeScratch;
  }

  releaseAll(): void {
    for (const instances of this.pools.values()) {
      for (const obstacle of instances) obstacle.reset();
    }
  }
}
