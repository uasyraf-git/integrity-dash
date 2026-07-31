import * as THREE from 'three';
import { OBSTACLE_DESPAWN_Z, getDifficultyStage } from '../config/gameConfig';
import { NEUTRAL_MODIFIERS, type DirectorModifiers } from '../config/adaptiveDifficultyConfig';
import { ObstaclePool } from './ObstaclePool';
import { ObstacleSpawner } from './ObstacleSpawner';
import type { Obstacle } from './Obstacle';

/**
 * Owns the obstacle pool and spawner. Only ever called while PLAYING (Game.tick gates this,
 * the same way it already gates the environment and score systems) - MENU, PAUSED and
 * GAME_OVER simply never invoke update(), which is what stops spawning/movement/collision.
 */
export class ObstacleManager {
  readonly group: THREE.Group;
  private readonly pool: ObstaclePool;
  private readonly spawner: ObstacleSpawner;

  constructor() {
    this.group = new THREE.Group();
    this.pool = new ObstaclePool(this.group);
    this.spawner = new ObstacleSpawner(this.pool);
  }

  update(
    deltaTime: number,
    speed: number,
    elapsedActiveTime: number,
    modifiers: Readonly<DirectorModifiers> = NEUTRAL_MODIFIERS,
  ): void {
    const stage = getDifficultyStage(elapsedActiveTime);
    const active = this.pool.getActive();
    this.spawner.update(deltaTime, elapsedActiveTime, stage, speed, active, modifiers);

    for (const obstacle of active) {
      obstacle.advance(deltaTime, speed);
      if (obstacle.group.position.z > OBSTACLE_DESPAWN_Z) {
        obstacle.deactivate();
      }
    }
  }

  getActiveObstacles(): ReadonlyArray<Obstacle> {
    return this.pool.getActive();
  }

  reset(): void {
    this.pool.releaseAll();
    this.spawner.reset();
  }
}
