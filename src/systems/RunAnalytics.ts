/** Immutable snapshot of a completed (or in-progress) run, composed from RunAnalytics' own
 *  tracked counters plus the current values of a few other systems that already track their own
 *  metric correctly (score, distance, tokens collected, best streak/multiplier, Integrity) - see
 *  RunAnalytics.getSummary(). Local to the current run only; never transmitted anywhere. */
export interface RunSummary {
  runDurationSeconds: number;
  distance: number;
  score: number;
  tokensCollected: number;
  tokensMissed: number;
  /** 0-1, or 0 if no token ever spawned this run. */
  collectionRate: number;
  nearMissCount: number;
  obstacleHits: number;
  bestStreak: number;
  bestMultiplier: number;
  /** Time-weighted average of the multiplier over the whole run (a multiplier held for longer
   *  counts proportionally more), not a simple mean of sampled values. */
  averageMultiplier: number;
  jumpCount: number;
  slideCount: number;
  laneChangeCount: number;
  integrityRemaining: number;
  directorAssistanceActivations: number;
  directorChallengeActivations: number;
}

export interface RunSummaryContext {
  score: number;
  distance: number;
  tokensCollected: number;
  bestStreak: number;
  bestMultiplier: number;
  integrityRemaining: number;
}

/**
 * Tracks metrics for the current run only - reset on every Start/Restart, frozen the instant
 * Game Over triggers so nothing recorded after can corrupt the summary shown on screen. Kept
 * completely independent of the UI and of rendering (no Three.js/DOM import anywhere in this
 * file): `Game` calls the `record*`/`update` methods as gameplay events happen and reads
 * `getSummary()` once, at Game Over. No network transmission, no personal information - every
 * value here is derived purely from in-run gameplay counters.
 */
export class RunAnalytics {
  private runDuration = 0;
  private jumpCount = 0;
  private slideCount = 0;
  private laneChangeCount = 0;
  private obstacleHits = 0;
  private nearMissCount = 0;
  private tokensMissed = 0;
  private directorAssistanceActivations = 0;
  private directorChallengeActivations = 0;
  private multiplierTimeSum = 0;
  private frozen = false;

  /** Only ever called from Game.tick() inside the PLAYING (non-demo-camera) gameplay block, the
   *  same gate every other gameplay-tied system uses - so pause time is never counted, with no
   *  internal state check needed here. */
  update(deltaTime: number, currentMultiplier: number): void {
    if (this.frozen) return;
    this.runDuration += deltaTime;
    this.multiplierTimeSum += currentMultiplier * deltaTime;
  }

  recordJump(): void {
    if (!this.frozen) this.jumpCount += 1;
  }

  recordSlide(): void {
    if (!this.frozen) this.slideCount += 1;
  }

  recordLaneChange(): void {
    if (!this.frozen) this.laneChangeCount += 1;
  }

  recordObstacleHit(): void {
    if (!this.frozen) this.obstacleHits += 1;
  }

  recordNearMiss(): void {
    if (!this.frozen) this.nearMissCount += 1;
  }

  recordTokensMissed(count: number): void {
    if (!this.frozen && count > 0) this.tokensMissed += count;
  }

  recordDirectorAssistance(): void {
    if (!this.frozen) this.directorAssistanceActivations += 1;
  }

  recordDirectorChallenge(): void {
    if (!this.frozen) this.directorChallengeActivations += 1;
  }

  /** Stops recording. Called exactly once per run, the instant Game Over triggers. */
  freeze(): void {
    this.frozen = true;
  }

  getSummary(context: RunSummaryContext): RunSummary {
    const totalTokenEvents = context.tokensCollected + this.tokensMissed;
    return {
      runDurationSeconds: this.runDuration,
      distance: context.distance,
      score: context.score,
      tokensCollected: context.tokensCollected,
      tokensMissed: this.tokensMissed,
      collectionRate: totalTokenEvents > 0 ? context.tokensCollected / totalTokenEvents : 0,
      nearMissCount: this.nearMissCount,
      obstacleHits: this.obstacleHits,
      bestStreak: context.bestStreak,
      bestMultiplier: context.bestMultiplier,
      averageMultiplier: this.runDuration > 0 ? this.multiplierTimeSum / this.runDuration : 1,
      jumpCount: this.jumpCount,
      slideCount: this.slideCount,
      laneChangeCount: this.laneChangeCount,
      integrityRemaining: context.integrityRemaining,
      directorAssistanceActivations: this.directorAssistanceActivations,
      directorChallengeActivations: this.directorChallengeActivations,
    };
  }

  reset(): void {
    this.runDuration = 0;
    this.jumpCount = 0;
    this.slideCount = 0;
    this.laneChangeCount = 0;
    this.obstacleHits = 0;
    this.nearMissCount = 0;
    this.tokensMissed = 0;
    this.directorAssistanceActivations = 0;
    this.directorChallengeActivations = 0;
    this.multiplierTimeSum = 0;
    this.frozen = false;
  }
}
