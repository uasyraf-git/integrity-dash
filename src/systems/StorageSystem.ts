import { STORAGE_KEY_BEST_SCORE } from '../utils/constants';

/** Thin, failure-safe wrapper around localStorage for the best-score record. */
export class StorageSystem {
  getBestScore(): number {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_BEST_SCORE);
      const value = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  /** Persists the score only if it beats the stored best. Returns the resulting best. */
  submitScore(score: number): number {
    const currentBest = this.getBestScore();
    if (score <= currentBest) return currentBest;

    try {
      localStorage.setItem(STORAGE_KEY_BEST_SCORE, String(score));
    } catch {
      // Storage unavailable (e.g. private browsing) - best score just won't persist.
    }
    return score;
  }
}
