import type { RunSummary } from '../../systems/RunAnalytics';
import type { EndRunRating } from '../../systems/EndRunRating';

export interface GameOverHandlers {
  onRestart: () => void;
  onMainMenu: () => void;
}

export interface GameOverStats {
  score: number;
  distance: number;
  bestScore: number;
  /** Final Integrity Meter percentage (0-100) at the moment of Game Over. */
  integrity: number;
  tokenCount: number;
  bestStreak: number;
  maxMultiplierReached: number;
  summary: RunSummary;
  rating: EndRunRating;
}

const FULL_STAR = '★';
const EMPTY_STAR = '☆';
const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class GameOverScreen {
  private readonly root: HTMLElement;
  private readonly scoreEl: HTMLElement;
  private readonly distanceEl: HTMLElement;
  private readonly bestScoreEl: HTMLElement;
  private readonly integrityEl: HTMLElement;
  private readonly tokensEl: HTMLElement;
  private readonly bestStreakEl: HTMLElement;
  private readonly maxMultiplierEl: HTMLElement;
  private readonly runTimeEl: HTMLElement;
  private readonly nearMissesEl: HTMLElement;
  private readonly obstacleHitsEl: HTMLElement;
  private readonly ratingStarsEl: HTMLElement;
  private readonly ratingTitleEl: HTMLElement;
  private readonly ratingFeedbackEl: HTMLElement;
  private readonly statRows: HTMLElement[];

  constructor() {
    this.root = document.getElementById('screen-game-over') as HTMLElement;
    this.scoreEl = document.getElementById('final-score') as HTMLElement;
    this.distanceEl = document.getElementById('final-distance') as HTMLElement;
    this.bestScoreEl = document.getElementById('final-best-score') as HTMLElement;
    this.integrityEl = document.getElementById('final-integrity') as HTMLElement;
    this.tokensEl = document.getElementById('final-tokens') as HTMLElement;
    this.bestStreakEl = document.getElementById('final-best-streak') as HTMLElement;
    this.maxMultiplierEl = document.getElementById('final-max-multiplier') as HTMLElement;
    this.runTimeEl = document.getElementById('final-run-time') as HTMLElement;
    this.nearMissesEl = document.getElementById('final-near-misses') as HTMLElement;
    this.obstacleHitsEl = document.getElementById('final-obstacle-hits') as HTMLElement;
    this.ratingStarsEl = document.getElementById('rating-stars') as HTMLElement;
    this.ratingTitleEl = document.getElementById('rating-title') as HTMLElement;
    this.ratingFeedbackEl = document.getElementById('rating-feedback') as HTMLElement;
    this.statRows = Array.from(this.root.querySelectorAll('.stat-row'));
  }

  bind(handlers: GameOverHandlers): void {
    document
      .getElementById('btn-restart-from-game-over')
      ?.addEventListener('click', handlers.onRestart);
    document
      .getElementById('btn-menu-from-game-over')
      ?.addEventListener('click', handlers.onMainMenu);
  }

  show(stats: GameOverStats): void {
    this.scoreEl.textContent = stats.score.toLocaleString('en-US');
    this.distanceEl.textContent = `${stats.distance.toLocaleString('en-US')} m`;
    this.bestScoreEl.textContent = stats.bestScore.toLocaleString('en-US');
    this.integrityEl.textContent = `${stats.integrity}%`;
    this.tokensEl.textContent = stats.tokenCount.toLocaleString('en-US');
    this.bestStreakEl.textContent = String(stats.bestStreak);
    this.maxMultiplierEl.textContent = `x${stats.maxMultiplierReached}`;
    this.runTimeEl.textContent = formatRunTime(stats.summary.runDurationSeconds);
    this.nearMissesEl.textContent = String(stats.summary.nearMissCount);
    this.obstacleHitsEl.textContent = String(stats.summary.obstacleHits);

    // Stars are text characters, not colour-only - readable in any theme/contrast setting.
    this.ratingStarsEl.textContent = FULL_STAR.repeat(stats.rating.stars) + EMPTY_STAR.repeat(5 - stats.rating.stars);
    this.ratingStarsEl.setAttribute('aria-label', `${stats.rating.stars} out of 5 stars`);
    this.ratingTitleEl.textContent = stats.rating.title;
    this.ratingFeedbackEl.textContent = stats.rating.feedback;

    this.root.classList.remove('hidden');
    this.playEntranceSequence();
  }

  /** Rating and stat rows fade/rise in briefly staggered, for a touch of "run complete"
   *  ceremony - skipped entirely under prefers-reduced-motion, where everything just appears. */
  private playEntranceSequence(): void {
    const ratingBlock = document.getElementById('game-over-rating');
    const animatedEls = ratingBlock ? [ratingBlock, ...this.statRows] : this.statRows;

    for (const el of animatedEls) {
      el.classList.remove('stat-reveal');
    }
    if (REDUCED_MOTION) return;

    animatedEls.forEach((el, index) => {
      el.style.animationDelay = `${index * 40}ms`;
      void el.offsetWidth; // Force reflow so re-triggering the animation class works.
      el.classList.add('stat-reveal');
    });
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}

function formatRunTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}
