import {
  MINIMUM_REACTION_TIME,
  OBSTACLE_CONFIGS,
  OBSTACLE_GRACE_PERIOD,
  OBSTACLE_SPAWN_Z,
  TWO_LANE_PATTERN_CHANCE,
  TWO_LANE_SPACING_BUFFER,
  type DifficultyStage,
} from '../config/gameConfig';
import { NEUTRAL_MODIFIERS, type DirectorModifiers } from '../config/adaptiveDifficultyConfig';
import { pickWeightedIndex } from '../utils/math';
import { ALL_OBSTACLE_TYPE_IDS, ObstacleBehavior, ObstacleTypeId } from './ObstacleType';
import type { Obstacle } from './Obstacle';
import type { ObstaclePool } from './ObstaclePool';

const LANE_COUNT = 3;
const MAX_SAME_TYPE_STREAK = 2;
/** The one obstacle type the Adaptive Difficulty Director treats as "difficult" - it's the only
 *  SLIDE-behavior type, requiring a different response from every JUMP obstacle around it. */
const DIFFICULT_OBSTACLE_TYPE = ObstacleTypeId.SECURITY_BARRIER;

/**
 * Controlled procedural spawner. Spawns are gated by a fixed interval (never faster than the
 * configured minimum reaction time at the current speed), validated against active obstacle
 * positions before committing, always leave at least one lane open, and never pair a JUMP
 * obstacle with the SLIDE obstacle in the same two-lane pattern.
 */
export class ObstacleSpawner {
  private readonly pool: ObstaclePool;
  private timeSinceLastSpawn = 0;
  private lastTypeId: ObstacleTypeId | null = null;
  private sameTypeStreak = 0;
  private lastSingleLane: number | null = null;
  private lastSpawnWasTwoLane = false;

  constructor(pool: ObstaclePool) {
    this.pool = pool;
  }

  update(
    deltaTime: number,
    elapsedActiveTime: number,
    stage: DifficultyStage,
    currentSpeed: number,
    activeObstacles: ReadonlyArray<Obstacle>,
    modifiers: Readonly<DirectorModifiers> = NEUTRAL_MODIFIERS,
  ): void {
    if (elapsedActiveTime < OBSTACLE_GRACE_PERIOD) return;

    this.timeSinceLastSpawn += deltaTime;
    // The Adaptive Difficulty Director can only ever stretch or shrink this interval - the
    // MINIMUM_REACTION_TIME floor below is always enforced regardless of its modifier, so a
    // Director-influenced spawn can never arrive faster than the existing safety floor allows.
    const effectiveInterval = Math.max(
      stage.spawnInterval * modifiers.obstacleSpawnIntervalModifier,
      MINIMUM_REACTION_TIME,
    );
    if (this.timeSinceLastSpawn < effectiveInterval) return;

    this.timeSinceLastSpawn = 0;
    this.trySpawn(stage, currentSpeed, activeObstacles, modifiers);
  }

  reset(): void {
    this.timeSinceLastSpawn = 0;
    this.lastTypeId = null;
    this.sameTypeStreak = 0;
    this.lastSingleLane = null;
    this.lastSpawnWasTwoLane = false;
  }

  private trySpawn(
    stage: DifficultyStage,
    currentSpeed: number,
    activeObstacles: ReadonlyArray<Obstacle>,
    modifiers: Readonly<DirectorModifiers>,
  ): void {
    const minSpacing =
      currentSpeed * MINIMUM_REACTION_TIME + (this.lastSpawnWasTwoLane ? TWO_LANE_SPACING_BUFFER : 0);
    const safeLanes = this.getSafeLanes(minSpacing, activeObstacles);
    if (safeLanes.length === 0) return; // No lane is safe to spawn into yet - skip cleanly.

    // Clamped to <= 1 so the Director can never push this above a guaranteed probability.
    const twoLaneChance = Math.min(1, TWO_LANE_PATTERN_CHANCE * modifiers.multiLanePatternWeightModifier);
    const useTwoLanePattern =
      stage.twoLanePatternsAllowed && safeLanes.length >= 2 && Math.random() < twoLaneChance;

    if (useTwoLanePattern) {
      this.spawnTwoLanePattern(safeLanes, modifiers);
    } else {
      this.spawnSingleLane(safeLanes, modifiers);
    }
  }

  /** Every lane with no active obstacle within minSpacing world units of the spawn point. */
  private getSafeLanes(minSpacing: number, activeObstacles: ReadonlyArray<Obstacle>): number[] {
    const safe: number[] = [];
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      if (this.isLaneSafe(lane, minSpacing, activeObstacles)) safe.push(lane);
    }
    return safe;
  }

  private isLaneSafe(lane: number, minSpacing: number, activeObstacles: ReadonlyArray<Obstacle>): boolean {
    for (const obstacle of activeObstacles) {
      if (!obstacle.active || obstacle.laneIndex !== lane) continue;
      const distance = Math.abs(OBSTACLE_SPAWN_Z - obstacle.group.position.z);
      if (distance < minSpacing) return false;
    }
    return true;
  }

  private spawnSingleLane(safeLanes: number[], modifiers: Readonly<DirectorModifiers>): void {
    const lane = this.pickLaneFrom(safeLanes, this.lastSingleLane);
    const typeId = this.pickType(undefined, modifiers);
    this.spawnAt(typeId, lane);
    this.lastSingleLane = lane;
    this.lastSpawnWasTwoLane = false;
  }

  private spawnTwoLanePattern(safeLanes: number[], modifiers: Readonly<DirectorModifiers>): void {
    // safeLanes.length >= 2 is guaranteed by the caller.
    const lanes = [...safeLanes].sort(() => Math.random() - 0.5).slice(0, 2);
    for (const lane of lanes) {
      // Two-lane patterns only ever use JUMP obstacles, so a SLIDE and JUMP obstacle never
      // land at the same reaction point.
      const typeId = this.pickType(ObstacleBehavior.JUMP, modifiers);
      this.spawnAt(typeId, lane);
    }
    this.lastSingleLane = null;
    this.lastSpawnWasTwoLane = true;
  }

  private spawnAt(typeId: ObstacleTypeId, lane: number): void {
    const obstacle = this.pool.acquire(typeId);
    if (!obstacle) return; // Pool exhausted for this type - skip this attempt cleanly.

    obstacle.activate(lane, OBSTACLE_SPAWN_Z);

    if (typeId === this.lastTypeId) {
      this.sameTypeStreak += 1;
    } else {
      this.lastTypeId = typeId;
      this.sameTypeStreak = 1;
    }
  }

  /**
   * Weighted random obstacle type. Once the same type has been chosen
   * `MAX_SAME_TYPE_STREAK` times in a row, it is excluded from this pick entirely, so no type
   * can ever appear more than `MAX_SAME_TYPE_STREAK` times consecutively. The Director's
   * `difficultObstacleWeightModifier` only ever scales DIFFICULT_OBSTACLE_TYPE's weight within
   * this same weighted pick - it cannot force or forbid any type outright.
   */
  private pickType(requiredBehavior: ObstacleBehavior | undefined, modifiers: Readonly<DirectorModifiers>): ObstacleTypeId {
    let candidates = requiredBehavior
      ? ALL_OBSTACLE_TYPE_IDS.filter((id) => OBSTACLE_CONFIGS[id].behavior === requiredBehavior)
      : ALL_OBSTACLE_TYPE_IDS;

    if (this.lastTypeId !== null && this.sameTypeStreak >= MAX_SAME_TYPE_STREAK) {
      const withoutLastType = candidates.filter((id) => id !== this.lastTypeId);
      if (withoutLastType.length > 0) {
        candidates = withoutLastType;
      }
    }

    const weights = candidates.map((id) =>
      id === DIFFICULT_OBSTACLE_TYPE
        ? OBSTACLE_CONFIGS[id].spawnWeight * modifiers.difficultObstacleWeightModifier
        : OBSTACLE_CONFIGS[id].spawnWeight,
    );
    return candidates[pickWeightedIndex(weights)];
  }

  /**
   * Picks a lane directly from the given candidates, excluding `avoid` outright whenever
   * that leaves at least one option - no retry loop, so the result can never equal `avoid`
   * unless doing so is unavoidable given the candidate set.
   */
  private pickLaneFrom(candidates: number[], avoid: number | null): number {
    const preferred = avoid === null ? candidates : candidates.filter((lane) => lane !== avoid);
    const pool = preferred.length > 0 ? preferred : candidates;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
