import {
  COLLECTIBLE_GRACE_PERIOD,
  COLLECTIBLE_MAX_INTERVAL_REDUCTION_PER_STAGE,
  COLLECTIBLE_OBSTACLE_CLEARANCE,
  COLLECTIBLE_PATTERN_LENGTH_MAX,
  COLLECTIBLE_PATTERN_LENGTH_MIN,
  COLLECTIBLE_SPAWN_INTERVAL_MAX,
  COLLECTIBLE_SPAWN_INTERVAL_MIN,
  COLLECTIBLE_SPAWN_Z,
  SAFE_LANE_REWARD_CHANCE,
  SLIDE_TRAIL_PATTERN_LENGTH_MAX,
  SLIDE_TRAIL_PATTERN_LENGTH_MIN,
  TOKEN_HEIGHT_JUMP_PEAK,
  TOKEN_HEIGHT_SLIDE,
  TOKEN_HEIGHT_STANDING,
  TOKEN_SPACING,
  TWO_LANE_PATTERN_Z_MATCH_EPSILON,
} from '../config/gameConfig';
import { NEUTRAL_MODIFIERS, type DirectorModifiers } from '../config/adaptiveDifficultyConfig';
import { pickWeightedIndex } from '../utils/math';
import { ObstacleBehavior } from '../obstacles/ObstacleType';
import type { Obstacle } from '../obstacles/Obstacle';
import { CollectibleTypeId } from './CollectibleType';
import type { CollectiblePool } from './CollectiblePool';

const LANE_COUNT = 3;

type PatternKind = 'STRAIGHT_LINE' | 'LANE_TRANSITION' | 'JUMP_ARC' | 'SLIDE_TRAIL' | 'SAFE_LANE_REWARD';
/** Base weight 25 each (uniform, matching the previous plain-random pick). Lane Transition and
 *  Slide Trail are the two patterns that require lane discipline / a synced slide, so they're
 *  the ones the Director's complexPatternWeightModifier scales. */
const RANDOM_PATTERN_BASE_WEIGHTS: ReadonlyArray<{ kind: PatternKind; weight: number; complex: boolean }> = [
  { kind: 'STRAIGHT_LINE', weight: 25, complex: false },
  { kind: 'LANE_TRANSITION', weight: 25, complex: true },
  { kind: 'JUMP_ARC', weight: 25, complex: false },
  { kind: 'SLIDE_TRAIL', weight: 25, complex: true },
];

/**
 * Controlled collectible spawner. Never places a pattern through active obstacle geometry
 * (with one deliberate exception: a Slide Trail may run through a Security Barrier's lane,
 * since sliding is exactly how the player is meant to clear both at once). Skips a spawn
 * attempt cleanly whenever a safe placement cannot be found, rather than forcing one.
 */
export class CollectibleSpawner {
  private readonly pool: CollectiblePool;
  private timeSinceLastPattern = 0;
  private nextInterval = COLLECTIBLE_SPAWN_INTERVAL_MIN;

  constructor(pool: CollectiblePool) {
    this.pool = pool;
    this.rollNextInterval(0);
  }

  update(
    deltaTime: number,
    elapsedActiveTime: number,
    stageIndex: number,
    activeObstacles: ReadonlyArray<Obstacle>,
    modifiers: Readonly<DirectorModifiers> = NEUTRAL_MODIFIERS,
  ): void {
    if (elapsedActiveTime < COLLECTIBLE_GRACE_PERIOD) return;

    this.timeSinceLastPattern += deltaTime;
    if (this.timeSinceLastPattern < this.nextInterval) return;

    this.timeSinceLastPattern = 0;
    this.rollNextInterval(stageIndex, modifiers);
    this.trySpawnPattern(activeObstacles, modifiers);
  }

  reset(): void {
    this.timeSinceLastPattern = 0;
    this.rollNextInterval(0);
  }

  private rollNextInterval(stageIndex: number, modifiers: Readonly<DirectorModifiers> = NEUTRAL_MODIFIERS): void {
    const reduction = COLLECTIBLE_MAX_INTERVAL_REDUCTION_PER_STAGE * stageIndex;
    const effectiveMax = Math.max(
      COLLECTIBLE_SPAWN_INTERVAL_MIN,
      COLLECTIBLE_SPAWN_INTERVAL_MAX - reduction,
    );
    const baseInterval =
      COLLECTIBLE_SPAWN_INTERVAL_MIN + Math.random() * (effectiveMax - COLLECTIBLE_SPAWN_INTERVAL_MIN);
    // >1 modifier = more collectible opportunities = a shorter interval, floored at the
    // existing minimum so the Director can never spawn tokens faster than the base game allows.
    this.nextInterval = Math.max(
      COLLECTIBLE_SPAWN_INTERVAL_MIN,
      baseInterval / modifiers.collectibleSpawnModifier,
    );
  }

  private trySpawnPattern(activeObstacles: ReadonlyArray<Obstacle>, modifiers: Readonly<DirectorModifiers>): void {
    const safeLaneReward = this.findSafeLaneBesideTwoLanePattern(activeObstacles);
    const useSafeLaneReward = safeLaneReward !== null && Math.random() < SAFE_LANE_REWARD_CHANCE;

    const kind: PatternKind = useSafeLaneReward ? 'SAFE_LANE_REWARD' : this.pickRandomPatternKind(modifiers);

    switch (kind) {
      case 'STRAIGHT_LINE':
        this.spawnStraightLine(activeObstacles);
        break;
      case 'LANE_TRANSITION':
        this.spawnLaneTransition(activeObstacles);
        break;
      case 'JUMP_ARC':
        this.spawnJumpArc(activeObstacles);
        break;
      case 'SLIDE_TRAIL':
        this.spawnSlideTrail(activeObstacles);
        break;
      case 'SAFE_LANE_REWARD':
        // safeLaneReward is guaranteed non-null here since useSafeLaneReward required it.
        this.spawnSafeLaneReward(safeLaneReward as { lane: number; z: number }, activeObstacles);
        break;
    }
  }

  /** Weighted pick among the four random pattern kinds - complexPatternWeightModifier scales
   *  only the two lane-discipline-heavy patterns (see RANDOM_PATTERN_BASE_WEIGHTS), so a value
   *  below 1 makes Assistance Mode favour the simpler patterns without ever forbidding either. */
  private pickRandomPatternKind(modifiers: Readonly<DirectorModifiers>): PatternKind {
    const weights = RANDOM_PATTERN_BASE_WEIGHTS.map((entry) =>
      entry.complex ? entry.weight * modifiers.complexPatternWeightModifier : entry.weight,
    );
    return RANDOM_PATTERN_BASE_WEIGHTS[pickWeightedIndex(weights)].kind;
  }

  // --- Pattern 1: Straight Lane Line ------------------------------------------------------

  private spawnStraightLine(activeObstacles: ReadonlyArray<Obstacle>): void {
    const length = randomIntInRange(COLLECTIBLE_PATTERN_LENGTH_MIN, COLLECTIBLE_PATTERN_LENGTH_MAX);
    const lane = this.pickSafeLane(activeObstacles, length, ObstacleBehavior.JUMP);
    if (lane === null) return;

    for (let i = 0; i < length; i++) {
      this.spawnOne(lane, TOKEN_HEIGHT_STANDING, COLLECTIBLE_SPAWN_Z + i * TOKEN_SPACING);
    }
  }

  // --- Pattern 2: Lane Transition Trail ---------------------------------------------------

  private spawnLaneTransition(activeObstacles: ReadonlyArray<Obstacle>): void {
    const direction = Math.random() < 0.5 ? 1 : -1;
    const start = direction > 0 ? 0 : 2;
    // e.g. left -> centre -> right -> centre -> left (or the mirrored/reversed sequence).
    const lanes = [start, start + direction, start + direction * 2, start + direction, start];
    const zStart = COLLECTIBLE_SPAWN_Z;
    const zEnd = zStart + (lanes.length - 1) * TOKEN_SPACING;

    for (const lane of lanes) {
      if (!this.isLaneClear(lane, zStart, zEnd, activeObstacles)) return; // Skip cleanly.
    }

    lanes.forEach((lane, i) => {
      this.spawnOne(lane, TOKEN_HEIGHT_STANDING, zStart + i * TOKEN_SPACING);
    });
  }

  // --- Pattern 3: Jump Arc -----------------------------------------------------------------

  private spawnJumpArc(activeObstacles: ReadonlyArray<Obstacle>): void {
    const length = randomIntInRange(COLLECTIBLE_PATTERN_LENGTH_MIN, COLLECTIBLE_PATTERN_LENGTH_MAX);
    const lane = this.pickSafeLane(activeObstacles, length, ObstacleBehavior.JUMP);
    if (lane === null) return;

    for (let i = 0; i < length; i++) {
      const progress = length === 1 ? 1 : i / (length - 1);
      // Rises from standing height to the peak at the midpoint, then back down - always
      // within the player's jump reach (JUMP_HEIGHT is comfortably above TOKEN_HEIGHT_JUMP_PEAK).
      const arc = 1 - Math.abs(progress - 0.5) * 2;
      const height = TOKEN_HEIGHT_STANDING + arc * (TOKEN_HEIGHT_JUMP_PEAK - TOKEN_HEIGHT_STANDING);
      this.spawnOne(lane, height, COLLECTIBLE_SPAWN_Z + i * TOKEN_SPACING);
    }
  }

  // --- Pattern 4: Slide Trail --------------------------------------------------------------

  private spawnSlideTrail(activeObstacles: ReadonlyArray<Obstacle>): void {
    const length = randomIntInRange(SLIDE_TRAIL_PATTERN_LENGTH_MIN, SLIDE_TRAIL_PATTERN_LENGTH_MAX);

    // Prefer routing the trail through a lane that currently has an active Security Barrier -
    // the low height is exactly what sliding under it also collects. Falls back to any other
    // obstacle-clear lane if no barrier is currently active.
    const barrierLane = this.findLaneWithBehavior(activeObstacles, ObstacleBehavior.SLIDE);
    const zStart = COLLECTIBLE_SPAWN_Z;
    const zEnd = zStart + (length - 1) * TOKEN_SPACING;

    let lane: number | null = null;
    if (barrierLane !== null && this.isLaneClearAllowingBehavior(barrierLane, zStart, zEnd, activeObstacles, ObstacleBehavior.SLIDE)) {
      lane = barrierLane;
    } else {
      lane = this.pickSafeLane(activeObstacles, length, ObstacleBehavior.JUMP);
    }
    if (lane === null) return;

    for (let i = 0; i < length; i++) {
      this.spawnOne(lane, TOKEN_HEIGHT_SLIDE, zStart + i * TOKEN_SPACING);
    }
  }

  // --- Pattern 5: Safe-Lane Reward ---------------------------------------------------------

  private spawnSafeLaneReward(target: { lane: number; z: number }, activeObstacles: ReadonlyArray<Obstacle>): void {
    const length = randomIntInRange(COLLECTIBLE_PATTERN_LENGTH_MIN, COLLECTIBLE_PATTERN_LENGTH_MAX);
    // Centre the trail on the obstacle pair's current Z so it visually reads as "the open lane
    // beside them" for the whole time they travel together (both move at the same speed).
    const zStart = target.z - ((length - 1) * TOKEN_SPACING) / 2;
    const zEnd = zStart + (length - 1) * TOKEN_SPACING;
    if (!this.isLaneClear(target.lane, zStart, zEnd, activeObstacles)) return;

    for (let i = 0; i < length; i++) {
      this.spawnOne(target.lane, TOKEN_HEIGHT_STANDING, zStart + i * TOKEN_SPACING);
    }
  }

  // --- Shared helpers ----------------------------------------------------------------------

  private spawnOne(lane: number, height: number, z: number): void {
    const token = this.pool.acquire(CollectibleTypeId.INTEGRITY_TOKEN);
    if (!token) return; // Pool exhausted - skip this token cleanly.
    token.activate(lane, height, z);
  }

  /** Picks a random lane whose Z-span (relative to the pattern length) is clear of obstacles. */
  private pickSafeLane(
    activeObstacles: ReadonlyArray<Obstacle>,
    length: number,
    allowedBehaviorThrough?: ObstacleBehavior,
  ): number | null {
    const zStart = COLLECTIBLE_SPAWN_Z;
    const zEnd = zStart + (length - 1) * TOKEN_SPACING;
    const safeLanes: number[] = [];
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const clear = allowedBehaviorThrough
        ? this.isLaneClearAllowingBehavior(lane, zStart, zEnd, activeObstacles, allowedBehaviorThrough)
        : this.isLaneClear(lane, zStart, zEnd, activeObstacles);
      if (clear) safeLanes.push(lane);
    }
    if (safeLanes.length === 0) return null;
    return safeLanes[Math.floor(Math.random() * safeLanes.length)];
  }

  private isLaneClear(lane: number, zStart: number, zEnd: number, activeObstacles: ReadonlyArray<Obstacle>): boolean {
    return this.isLaneClearAllowingBehavior(lane, zStart, zEnd, activeObstacles, null);
  }

  /**
   * A lane is clear if no active obstacle sits in it within the pattern's Z-span (plus a
   * clearance margin) - except obstacles matching `allowedBehavior`, which the pattern is
   * deliberately allowed to route through (e.g. a Slide Trail under a Security Barrier).
   */
  private isLaneClearAllowingBehavior(
    lane: number,
    zStart: number,
    zEnd: number,
    activeObstacles: ReadonlyArray<Obstacle>,
    allowedBehavior: ObstacleBehavior | null,
  ): boolean {
    for (const obstacle of activeObstacles) {
      if (!obstacle.active || obstacle.laneIndex !== lane) continue;
      if (allowedBehavior !== null && obstacle.behavior === allowedBehavior) continue;

      const z = obstacle.group.position.z;
      if (z >= zStart - COLLECTIBLE_OBSTACLE_CLEARANCE && z <= zEnd + COLLECTIBLE_OBSTACLE_CLEARANCE) {
        return false;
      }
    }
    return true;
  }

  private findLaneWithBehavior(activeObstacles: ReadonlyArray<Obstacle>, behavior: ObstacleBehavior): number | null {
    for (const obstacle of activeObstacles) {
      if (obstacle.active && obstacle.behavior === behavior) return obstacle.laneIndex;
    }
    return null;
  }

  /** Detects two obstacles spawned together as a two-lane pattern (identical Z, different
   *  lanes) and returns the third, untouched lane plus their shared Z, or null if none found. */
  private findSafeLaneBesideTwoLanePattern(
    activeObstacles: ReadonlyArray<Obstacle>,
  ): { lane: number; z: number } | null {
    for (let i = 0; i < activeObstacles.length; i++) {
      const a = activeObstacles[i];
      if (!a.active) continue;
      for (let j = i + 1; j < activeObstacles.length; j++) {
        const b = activeObstacles[j];
        if (!b.active || b.laneIndex === a.laneIndex) continue;
        if (Math.abs(a.group.position.z - b.group.position.z) < TWO_LANE_PATTERN_Z_MATCH_EPSILON) {
          const used = new Set([a.laneIndex, b.laneIndex]);
          const openLane = [0, 1, 2].find((lane) => !used.has(lane));
          if (openLane !== undefined) {
            return { lane: openLane, z: a.group.position.z };
          }
        }
      }
    }
    return null;
  }
}

function randomIntInRange(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
