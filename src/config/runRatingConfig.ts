/**
 * Configuration for the End Run Rating (Sprint 3C). Every reference maximum and weight lives
 * here, not inside the calculation logic - see systems/EndRunRating.ts.
 */

/** Weight each normalized (0-1) input contributes to the positive side of the composite score.
 *  Integrity and survival are weighted highest ("Integrity and safe play should contribute
 *  significantly"); Near Miss is deliberately one of the smallest weights ("should not overpower
 *  Integrity or survival"); score alone is under a third of the total, so the rating is never
 *  "just a score readout" ("Do not rate only by score"). */
export const RUN_RATING_WEIGHTS = {
  score: 0.15,
  survivalDuration: 0.15,
  integrityRemaining: 0.25,
  bestStreak: 0.1,
  tokensCollected: 0.1,
  collectionRate: 0.05,
  averageMultiplier: 0.1,
  nearMissCount: 0.05,
  /** Subtracted, not added - see EndRunRating's hits-per-minute normalization. */
  obstacleHitsPenalty: 0.15,
} as const;

/** Reference values a normalized input treats as "full credit" (clamped at 1). Deliberately
 *  generous rather than tuned to a specific skill ceiling, so a solid-but-not-perfect run still
 *  scores reasonably - these are the values to revisit if post-demo playtesting shows the
 *  distribution skews too harshly or too generously. */
export const RATING_REFERENCE_VALUES = {
  score: 2500,
  survivalDurationSeconds: 120,
  bestStreak: 20,
  tokensCollected: 25,
  /** Obstacle hits are normalized per minute of survival (not a raw count), so longer runs
   *  aren't unfairly penalised just for lasting longer at the same skill level. */
  hitsPerMinute: 6,
  nearMissCount: 8,
} as const;

/** Composite-score boundaries between adjacent star counts (1★|2★, 2★|3★, 3★|4★, 4★|5★), each
 *  in [0, 1]. Configurable independently of the weights above. */
export const STAR_THRESHOLDS: ReadonlyArray<number> = [0.2, 0.4, 0.6, 0.8];

export interface RatingTier {
  title: string;
  feedback: string;
}

/** Indexed by star count (1-5). Wording is deliberately encouraging at every tier - even the
 *  lowest rating invites another run rather than criticising the player. */
export const RATING_TIERS: Record<1 | 2 | 3 | 4 | 5, RatingTier> = {
  5: {
    title: 'Integrity Champion',
    feedback: 'Outstanding run - your integrity and consistency set the standard.',
  },
  4: {
    title: 'Ethics Leader',
    feedback: 'Strong performance. Keep building your integrity streak.',
  },
  3: {
    title: 'Compliance Explorer',
    feedback: 'Solid run - a few more clean dodges and tokens will take you further.',
  },
  2: {
    title: 'Learning Professional',
    feedback: 'Good effort. Protect your Integrity a little more to climb higher next run.',
  },
  1: {
    title: 'Needs More Training',
    feedback: 'Every run builds experience - jump back in and beat this score.',
  },
};
