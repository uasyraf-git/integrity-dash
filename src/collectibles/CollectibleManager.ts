import * as THREE from 'three';
import { COLLECTIBLE_DESPAWN_Z, getDifficultyStage, DIFFICULTY_STAGES } from '../config/gameConfig';
import { NEUTRAL_MODIFIERS, type DirectorModifiers } from '../config/adaptiveDifficultyConfig';
import { CollectiblePool } from './CollectiblePool';
import { CollectibleSpawner } from './CollectibleSpawner';
import type { Collectible } from './Collectible';
import type { Obstacle } from '../obstacles/Obstacle';

/**
 * Owns the collectible pool and spawner. Only ever called while PLAYING (Game.tick gates this
 * the same way it gates the environment, obstacles and score) - MENU, PAUSED and GAME_OVER
 * simply never invoke update(), which is what stops spawning/movement/pickup animation.
 */
export class CollectibleManager {
  readonly group: THREE.Group;
  private readonly pool: CollectiblePool;
  private readonly spawner: CollectibleSpawner;

  constructor() {
    this.group = new THREE.Group();
    this.pool = new CollectiblePool(this.group);
    this.spawner = new CollectibleSpawner(this.pool);
  }

  /** Returns how many tokens despawned uncollected this frame (almost always 0) - the only
   *  reliable "missed token" signal, fed into RunAnalytics.recordTokensMissed(). */
  update(
    deltaTime: number,
    speed: number,
    elapsedActiveTime: number,
    activeObstacles: ReadonlyArray<Obstacle>,
    modifiers: Readonly<DirectorModifiers> = NEUTRAL_MODIFIERS,
  ): number {
    const stageIndex = DIFFICULTY_STAGES.indexOf(getDifficultyStage(elapsedActiveTime));
    this.spawner.update(deltaTime, elapsedActiveTime, Math.max(stageIndex, 0), activeObstacles, modifiers);

    let missed = 0;
    for (const collectible of this.pool.getActive()) {
      const pickupFinished = collectible.advance(deltaTime, speed);
      const despawned = collectible.group.position.z > COLLECTIBLE_DESPAWN_Z;
      if (despawned && !collectible.collected) missed += 1;
      if (pickupFinished || despawned) {
        collectible.deactivate();
      }
    }
    return missed;
  }

  getActiveCollectibles(): ReadonlyArray<Collectible> {
    return this.pool.getActive();
  }

  reset(): void {
    this.pool.releaseAll();
    this.spawner.reset();
  }
}
