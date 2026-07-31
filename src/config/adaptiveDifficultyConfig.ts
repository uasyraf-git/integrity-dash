/**
 * Configuration for the Adaptive Difficulty Director (Sprint 3C). All values here are the
 * single source of truth for its behaviour - no magic numbers live inside
 * AdaptiveDifficultyDirector.ts itself.
 */

/** Master on/off switch. When false, the Director never evaluates and always reports neutral
 *  modifiers - every consuming system (spawners) behaves exactly as it did before Sprint 3C. */
export const ADAPTIVE_DIFFICULTY_ENABLED = true;

/** How often (seconds of active play time) the Director re-evaluates performance. */
export const EVALUATION_INTERVAL = 18;

/** Minimum time between one mode change and the next being allowed, counted from the moment a
 *  mode is entered. Combined with modes only ever starting from a neutral state, this keeps
 *  changes rare and spaced out - never every evaluation cycle. */
export const MODE_CHANGE_COOLDOWN = 20;

/** How long Assistance/Challenge Mode lasts once entered before automatically reverting to
 *  neutral, regardless of further evaluations. */
export const ASSISTANCE_DURATION = 12;
export const CHALLENGE_DURATION = 12;

/** Hard bounds every modifier is clamped to before being handed to a spawner - defense in depth
 *  on top of the fact that spawners never bypass their own existing safety checks. */
export const MINIMUM_MODIFIER = 0.5;
export const MAXIMUM_MODIFIER = 1.5;

export enum PerformanceRating {
  STRUGGLING = 'STRUGGLING',
  STABLE = 'STABLE',
  SKILLED = 'SKILLED',
  EXCELLENT = 'EXCELLENT',
}

/** Ordered worst-to-best - index order matters for the hysteresis step-limiting logic. */
export const PERFORMANCE_RATING_ORDER: ReadonlyArray<PerformanceRating> = [
  PerformanceRating.STRUGGLING,
  PerformanceRating.STABLE,
  PerformanceRating.SKILLED,
  PerformanceRating.EXCELLENT,
];

/** The performance score boundary between each pair of adjacent ratings (STRUGGLING|STABLE,
 *  STABLE|SKILLED, SKILLED|EXCELLENT) - see AdaptiveDifficultyDirector.computeRating(). */
export const RATING_THRESHOLDS: ReadonlyArray<number> = [0.3, 1.0, 1.5];

/** A rating can only move one step per evaluation, and only once the score clears the relevant
 *  boundary by this much - prevents flapping right at a threshold (hysteresis). */
export const RATING_HYSTERESIS_MARGIN = 0.15;

export enum DirectorMode {
  NONE = 'NONE',
  ASSISTANCE = 'ASSISTANCE',
  CHALLENGE = 'CHALLENGE',
}

export interface DirectorModifiers {
  /** Multiplies the obstacle spawner's effective interval. >1 = fewer obstacles (easier). */
  obstacleSpawnIntervalModifier: number;
  /** Multiplies the weight of the more lane-discipline-heavy collectible patterns (Lane
   *  Transition, Slide Trail) relative to the simpler ones. <1 favours simpler patterns. */
  complexPatternWeightModifier: number;
  /** Multiplies the chance a two-lane obstacle pattern is used. <1 = less multi-lane pressure. */
  multiLanePatternWeightModifier: number;
  /** Multiplies collectible spawn frequency (inversely scales the spawner's interval). >1 =
   *  more collectible opportunities. */
  collectibleSpawnModifier: number;
  /** Multiplies the Security Barrier's obstacle spawn weight - the one obstacle type that
   *  requires a different response (slide, not jump) from everything else. */
  difficultObstacleWeightModifier: number;
}

export const NEUTRAL_MODIFIERS: Readonly<DirectorModifiers> = {
  obstacleSpawnIntervalModifier: 1,
  complexPatternWeightModifier: 1,
  multiLanePatternWeightModifier: 1,
  collectibleSpawnModifier: 1,
  difficultObstacleWeightModifier: 1,
};

/** All within [MINIMUM_MODIFIER, MAXIMUM_MODIFIER] - see clampModifiers(). Subtle by design:
 *  none of these come close to doubling or halving anything gameplay-critical. */
export const ASSISTANCE_MODIFIERS: Readonly<DirectorModifiers> = {
  obstacleSpawnIntervalModifier: 1.15,
  complexPatternWeightModifier: 0.6,
  multiLanePatternWeightModifier: 0.5,
  collectibleSpawnModifier: 1.2,
  difficultObstacleWeightModifier: 0.6,
};

export const CHALLENGE_MODIFIERS: Readonly<DirectorModifiers> = {
  obstacleSpawnIntervalModifier: 0.9,
  complexPatternWeightModifier: 1.3,
  multiLanePatternWeightModifier: 1.25,
  collectibleSpawnModifier: 0.9,
  difficultObstacleWeightModifier: 1.3,
};

/**
 * Snapshot Game.ts builds every frame and passes to `AdaptiveDifficultyDirector.update()`. All
 * fields are cheaply, reliably measurable from systems Game.ts already owns. Not every field is
 * currently read by `computePerformanceScore()` - see the per-field notes below. The unused
 * fields are kept as reserved inputs (Sprint 3C+ intentionally shipped a conservative first-pass
 * scoring rule; widening it isn't a hotfix-scope change, and stripping fields Game.ts already
 * has for free simply to shrink the interface isn't worth the churn) rather than removed, so a
 * future difficulty-tuning pass can start from a snapshot that already carries them - the
 * Director's actual behaviour is fully described by `computePerformanceScore()`, not by this
 * interface's field list.
 */
export interface PerformanceSnapshot {
  integrityPercent: number;
  /** Reserved input - not currently read by computePerformanceScore() (only `bestMultiplier`
   *  is). Kept for a future tuning pass; changing that would be a balancing change, out of
   *  scope for this hotfix. */
  currentMultiplier: number;
  bestMultiplier: number;
  currentStreak: number;
  /** Reserved input - not currently read by computePerformanceScore() (only `currentStreak`
   *  is). Kept for a future tuning pass; changing that would be a balancing change, out of
   *  scope for this hotfix. */
  bestStreak: number;
  /** Reserved input - not currently read by computePerformanceScore(). Kept for a future tuning
   *  pass; changing that would be a balancing change, out of scope for this hotfix. */
  tokensCollected: number;
  /** Near misses recorded since the previous evaluation only (a rolling window), not lifetime -
   *  keeps the rating responsive to recent play rather than punishing/rewarding forever. */
  nearMissCountSinceLastEvaluation: number;
  /** Obstacle hits since the previous evaluation only - same rolling-window reasoning. */
  obstacleHitsSinceLastEvaluation: number;
  /** Reserved input - not currently read by computePerformanceScore(). Kept for a future tuning
   *  pass; changing that would be a balancing change, out of scope for this hotfix. */
  timeSinceLastHit: number;
  /** Reserved input - not currently read by computePerformanceScore(). Kept for a future tuning
   *  pass; changing that would be a balancing change, out of scope for this hotfix. */
  survivalDuration: number;
}
