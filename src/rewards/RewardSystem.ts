import { TOKEN_BASE_SCORE, getMultiplierForStreak } from '../config/gameConfig';

export interface RewardStatistics {
  tokenCount: number;
  bestStreak: number;
  maxMultiplierReached: number;
}

/**
 * Owns the collection streak, score multiplier, and token count for the current run. Polled
 * by Game.ts the same way ScoreSystem and IntegritySystem already are - no event framework.
 * Only ever mutated from PLAYING (Game gates every call), so Pause and Main Menu naturally
 * cannot alter reward state just by existing; reset() is the only thing that clears it.
 */
export class RewardSystem {
  private tokenCount = 0;
  private currentStreak = 0;
  private bestStreak = 0;
  private multiplier = 1;
  private maxMultiplierReached = 1;

  reset(): void {
    this.tokenCount = 0;
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.multiplier = 1;
    this.maxMultiplierReached = 1;
  }

  /**
   * Registers one token pickup: increments the token count and streak, updates the multiplier
   * from the new streak (so the token that crosses a threshold is itself scored at the new
   * rate), and returns the score reward this pickup earned.
   */
  collectToken(): number {
    this.tokenCount += 1;
    this.currentStreak += 1;
    if (this.currentStreak > this.bestStreak) this.bestStreak = this.currentStreak;

    this.multiplier = getMultiplierForStreak(this.currentStreak);
    if (this.multiplier > this.maxMultiplierReached) this.maxMultiplierReached = this.multiplier;

    return TOKEN_BASE_SCORE * this.multiplier;
  }

  /** Registers a valid damaging obstacle hit: resets the streak and multiplier only. Token
   *  count and best streak are untouched. */
  registerObstacleHit(): void {
    this.currentStreak = 0;
    this.multiplier = 1;
  }

  getTokenCount(): number {
    return this.tokenCount;
  }

  getCurrentStreak(): number {
    return this.currentStreak;
  }

  getBestStreak(): number {
    return this.bestStreak;
  }

  getMultiplier(): number {
    return this.multiplier;
  }

  /** The score a single token is currently worth, at the active multiplier. */
  getTokenReward(): number {
    return TOKEN_BASE_SCORE * this.multiplier;
  }

  getStatistics(): RewardStatistics {
    return {
      tokenCount: this.tokenCount,
      bestStreak: this.bestStreak,
      maxMultiplierReached: this.maxMultiplierReached,
    };
  }
}
