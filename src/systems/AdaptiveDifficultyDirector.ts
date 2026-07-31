import {
  ADAPTIVE_DIFFICULTY_ENABLED,
  ASSISTANCE_DURATION,
  ASSISTANCE_MODIFIERS,
  CHALLENGE_DURATION,
  CHALLENGE_MODIFIERS,
  type DirectorModifiers,
  DirectorMode,
  EVALUATION_INTERVAL,
  MAXIMUM_MODIFIER,
  MINIMUM_MODIFIER,
  MODE_CHANGE_COOLDOWN,
  NEUTRAL_MODIFIERS,
  PERFORMANCE_RATING_ORDER,
  PerformanceRating,
  type PerformanceSnapshot,
  RATING_HYSTERESIS_MARGIN,
  RATING_THRESHOLDS,
} from '../config/adaptiveDifficultyConfig';
import { clamp } from '../utils/math';

/** Result of one update() call - `evaluated` tells the caller a rating pass just ran (so it can
 *  reset its own rolling-window counters), `newMode` is set only on an actual mode change. */
export interface DirectorUpdateResult {
  evaluated: boolean;
  modeChanged: boolean;
  newMode: DirectorMode | null;
}

const NO_UPDATE: DirectorUpdateResult = { evaluated: false, modeChanged: false, newMode: null };

/**
 * Deterministic, rule-based difficulty director. Observes current-run performance (fed in as a
 * `PerformanceSnapshot` the caller builds each frame) and produces small, bounded modifiers for
 * the existing obstacle/collectible spawners to consume - it never touches the player, physics,
 * damage values, or spawns anything itself. Framework/rendering-independent by design (no
 * Three.js import anywhere in this file), so its logic can be validated in isolation - see
 * scripts/validate.mjs.
 *
 * Evaluation only happens every `EVALUATION_INTERVAL` seconds (not every frame). A new
 * Assistance/Challenge mode can only ever be entered from a neutral state (never interrupting an
 * active one), and only after `MODE_CHANGE_COOLDOWN` seconds have passed since the last mode was
 * entered - together these prevent the difficulty from visibly flapping. Each active mode runs
 * its own fixed duration and then reverts to neutral automatically.
 */
export class AdaptiveDifficultyDirector {
  private readonly enabled: boolean;
  private timeSinceEvaluation = 0;
  private timeSinceModeChange = Number.POSITIVE_INFINITY;
  private modeElapsed = 0;
  private mode: DirectorMode = DirectorMode.NONE;
  private rating: PerformanceRating = PerformanceRating.STABLE;
  private modifiers: DirectorModifiers = { ...NEUTRAL_MODIFIERS };

  constructor(enabled: boolean = ADAPTIVE_DIFFICULTY_ENABLED) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getModifiers(): Readonly<DirectorModifiers> {
    return this.modifiers;
  }

  getMode(): DirectorMode {
    return this.mode;
  }

  /** Seconds until the next evaluation pass. Dev-debug-overlay use only. */
  getTimeUntilNextEvaluation(): number {
    return Math.max(0, EVALUATION_INTERVAL - this.timeSinceEvaluation);
  }

  /** Internal only - never displayed to the player (see Sprint 3C spec: "Do not display the
   *  rating during normal gameplay"). Exposed for the optional dev-only debug overlay. */
  getRating(): PerformanceRating {
    return this.rating;
  }

  update(deltaTime: number, snapshot: PerformanceSnapshot): DirectorUpdateResult {
    if (!this.enabled) return NO_UPDATE;

    this.timeSinceEvaluation += deltaTime;
    this.timeSinceModeChange += deltaTime;

    if (this.mode !== DirectorMode.NONE) {
      this.modeElapsed += deltaTime;
      const duration = this.mode === DirectorMode.ASSISTANCE ? ASSISTANCE_DURATION : CHALLENGE_DURATION;
      if (this.modeElapsed >= duration) {
        this.mode = DirectorMode.NONE;
        this.modifiers = { ...NEUTRAL_MODIFIERS };
      }
    }

    if (this.timeSinceEvaluation < EVALUATION_INTERVAL) return NO_UPDATE;
    this.timeSinceEvaluation = 0;
    this.rating = computeRating(computePerformanceScore(snapshot), this.rating);

    // A new mode can only ever be entered from neutral, and only after the cooldown from the
    // last entry has elapsed - so a mode is never interrupted, and changes stay spaced out.
    if (this.mode !== DirectorMode.NONE || this.timeSinceModeChange < MODE_CHANGE_COOLDOWN) {
      return { evaluated: true, modeChanged: false, newMode: null };
    }

    const desiredMode = ratingToMode(this.rating);
    if (desiredMode === DirectorMode.NONE) {
      return { evaluated: true, modeChanged: false, newMode: null };
    }

    this.mode = desiredMode;
    this.modeElapsed = 0;
    this.timeSinceModeChange = 0;
    this.modifiers = clampModifiers(
      desiredMode === DirectorMode.ASSISTANCE ? ASSISTANCE_MODIFIERS : CHALLENGE_MODIFIERS,
    );

    return { evaluated: true, modeChanged: true, newMode: desiredMode };
  }

  reset(): void {
    this.timeSinceEvaluation = 0;
    this.timeSinceModeChange = Number.POSITIVE_INFINITY;
    this.modeElapsed = 0;
    this.mode = DirectorMode.NONE;
    this.rating = PerformanceRating.STABLE;
    this.modifiers = { ...NEUTRAL_MODIFIERS };
  }
}

function ratingToMode(rating: PerformanceRating): DirectorMode {
  if (rating === PerformanceRating.STRUGGLING) return DirectorMode.ASSISTANCE;
  if (rating === PerformanceRating.EXCELLENT) return DirectorMode.CHALLENGE;
  return DirectorMode.NONE;
}

/**
 * Combines a handful of reliably-measurable signals into one bounded score, roughly in
 * [-2.1, 1.8]. Integrity and streak reward steady, safe play; recent hits (this evaluation
 * window only, not lifetime) penalise it; a high best multiplier and recent near misses give a
 * modest bonus for skilled, active play without ever dominating the score on their own.
 *
 * Reads exactly five `PerformanceSnapshot` fields: `integrityPercent`, `currentStreak`,
 * `bestMultiplier`, `nearMissCountSinceLastEvaluation`, `obstacleHitsSinceLastEvaluation`. The
 * remaining snapshot fields (`currentMultiplier`, `bestStreak`, `tokensCollected`,
 * `timeSinceLastHit`, `survivalDuration`) are reserved inputs the snapshot already carries but
 * this score does not yet weigh - see the field-level notes on `PerformanceSnapshot`.
 */
export function computePerformanceScore(snapshot: PerformanceSnapshot): number {
  let score = 0;
  score += snapshot.integrityPercent / 100;
  score += clamp(snapshot.currentStreak / 20, 0, 1);
  score += clamp(snapshot.bestMultiplier / 4, 0, 1) * 0.5;
  score += clamp(snapshot.nearMissCountSinceLastEvaluation / 3, 0, 1) * 0.3;
  score -= clamp(snapshot.obstacleHitsSinceLastEvaluation, 0, 3) * 0.7;
  return score;
}

/**
 * Maps a score to one of the four ratings, with hysteresis: the rating can move at most one
 * step per call, and only once the score clears the relevant boundary by
 * RATING_HYSTERESIS_MARGIN - not merely touches it. This is what stops the rating (and
 * therefore the Director's mode) from oscillating right at a threshold.
 */
export function computeRating(score: number, current: PerformanceRating): PerformanceRating {
  const currentIndex = PERFORMANCE_RATING_ORDER.indexOf(current);

  let targetIndex = 0;
  for (let i = 0; i < RATING_THRESHOLDS.length; i++) {
    if (score >= RATING_THRESHOLDS[i]) targetIndex = i + 1;
  }

  if (targetIndex === currentIndex) return current;

  if (targetIndex > currentIndex) {
    const boundary = RATING_THRESHOLDS[currentIndex];
    return score >= boundary + RATING_HYSTERESIS_MARGIN
      ? PERFORMANCE_RATING_ORDER[currentIndex + 1]
      : current;
  }

  const boundary = RATING_THRESHOLDS[targetIndex];
  return score < boundary - RATING_HYSTERESIS_MARGIN
    ? PERFORMANCE_RATING_ORDER[currentIndex - 1]
    : current;
}

/** Defense in depth: every modifier the Director ever hands out is clamped into
 *  [MINIMUM_MODIFIER, MAXIMUM_MODIFIER], even though ASSISTANCE_MODIFIERS/CHALLENGE_MODIFIERS
 *  are already authored within that range. */
export function clampModifiers(modifiers: Readonly<DirectorModifiers>): DirectorModifiers {
  return {
    obstacleSpawnIntervalModifier: clamp(modifiers.obstacleSpawnIntervalModifier, MINIMUM_MODIFIER, MAXIMUM_MODIFIER),
    complexPatternWeightModifier: clamp(modifiers.complexPatternWeightModifier, MINIMUM_MODIFIER, MAXIMUM_MODIFIER),
    multiLanePatternWeightModifier: clamp(modifiers.multiLanePatternWeightModifier, MINIMUM_MODIFIER, MAXIMUM_MODIFIER),
    collectibleSpawnModifier: clamp(modifiers.collectibleSpawnModifier, MINIMUM_MODIFIER, MAXIMUM_MODIFIER),
    difficultObstacleWeightModifier: clamp(
      modifiers.difficultObstacleWeightModifier,
      MINIMUM_MODIFIER,
      MAXIMUM_MODIFIER,
    ),
  };
}
