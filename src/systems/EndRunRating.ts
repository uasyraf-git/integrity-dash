import {
  RATING_REFERENCE_VALUES,
  RATING_TIERS,
  RUN_RATING_WEIGHTS,
  STAR_THRESHOLDS,
} from '../config/runRatingConfig';
import { clamp } from '../utils/math';
import type { RunSummary } from './RunAnalytics';

export interface EndRunRating {
  stars: 1 | 2 | 3 | 4 | 5;
  title: string;
  feedback: string;
  /** The underlying composite score in [0, 1] - not shown to the player, useful for QA/debug. */
  compositeScore: number;
}

/**
 * Pure function: the same RunSummary always produces the same rating (deterministic, no random
 * component, no Three.js/DOM dependency). Combines several normalized (0-1) inputs into one
 * weighted composite score rather than rating on score alone - see runRatingConfig.ts for the
 * exact weights and reasoning. Obstacle hits are normalized per minute of survival so a longer
 * run isn't unfairly penalised just for lasting longer at the same skill level.
 */
export function calculateEndRunRating(summary: RunSummary): EndRunRating {
  const normalized = {
    score: clamp(summary.score / RATING_REFERENCE_VALUES.score, 0, 1),
    survivalDuration: clamp(summary.runDurationSeconds / RATING_REFERENCE_VALUES.survivalDurationSeconds, 0, 1),
    integrityRemaining: clamp(summary.integrityRemaining / 100, 0, 1),
    bestStreak: clamp(summary.bestStreak / RATING_REFERENCE_VALUES.bestStreak, 0, 1),
    tokensCollected: clamp(summary.tokensCollected / RATING_REFERENCE_VALUES.tokensCollected, 0, 1),
    collectionRate: clamp(summary.collectionRate, 0, 1),
    // averageMultiplier ranges [1, 4]; rescale so 1x = 0 credit, 4x = full credit.
    averageMultiplier: clamp((summary.averageMultiplier - 1) / 3, 0, 1),
    nearMissCount: clamp(summary.nearMissCount / RATING_REFERENCE_VALUES.nearMissCount, 0, 1),
  };

  const positiveWeightSum =
    RUN_RATING_WEIGHTS.score +
    RUN_RATING_WEIGHTS.survivalDuration +
    RUN_RATING_WEIGHTS.integrityRemaining +
    RUN_RATING_WEIGHTS.bestStreak +
    RUN_RATING_WEIGHTS.tokensCollected +
    RUN_RATING_WEIGHTS.collectionRate +
    RUN_RATING_WEIGHTS.averageMultiplier +
    RUN_RATING_WEIGHTS.nearMissCount;

  const positiveScore =
    normalized.score * RUN_RATING_WEIGHTS.score +
    normalized.survivalDuration * RUN_RATING_WEIGHTS.survivalDuration +
    normalized.integrityRemaining * RUN_RATING_WEIGHTS.integrityRemaining +
    normalized.bestStreak * RUN_RATING_WEIGHTS.bestStreak +
    normalized.tokensCollected * RUN_RATING_WEIGHTS.tokensCollected +
    normalized.collectionRate * RUN_RATING_WEIGHTS.collectionRate +
    normalized.averageMultiplier * RUN_RATING_WEIGHTS.averageMultiplier +
    normalized.nearMissCount * RUN_RATING_WEIGHTS.nearMissCount;

  const hitsPerMinute =
    summary.runDurationSeconds > 0 ? (summary.obstacleHits / summary.runDurationSeconds) * 60 : 0;
  // Zero hits earns full credit for this component; credit falls linearly to zero as the
  // hits-per-minute rate reaches the reference maximum.
  const hitsCredit =
    (1 - clamp(hitsPerMinute / RATING_REFERENCE_VALUES.hitsPerMinute, 0, 1)) * RUN_RATING_WEIGHTS.obstacleHitsPenalty;

  const totalWeight = positiveWeightSum + RUN_RATING_WEIGHTS.obstacleHitsPenalty;
  const compositeScore = clamp((positiveScore + hitsCredit) / totalWeight, 0, 1);

  const stars = starsForScore(compositeScore);
  const tier = RATING_TIERS[stars];

  return { stars, title: tier.title, feedback: tier.feedback, compositeScore };
}

function starsForScore(score: number): 1 | 2 | 3 | 4 | 5 {
  let stars: 1 | 2 | 3 | 4 | 5 = 1;
  for (let i = 0; i < STAR_THRESHOLDS.length; i++) {
    if (score >= STAR_THRESHOLDS[i]) stars = (i + 2) as 1 | 2 | 3 | 4 | 5;
  }
  return stars;
}
