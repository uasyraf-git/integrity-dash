import {
  INTEGRITY_METER_CRITICAL_THRESHOLD,
  INTEGRITY_METER_WARNING_THRESHOLD,
  SCORE_COUNT_SMOOTH_TIME,
} from '../../config/gameConfig';
import { dampFactor, lerp } from '../../utils/math';

export interface HudHandlers {
  onPauseToggle: () => void;
}

const MULTIPLIER_CALLOUT_DURATION_MS = 900;
const STREAK_LOST_CALLOUT_DURATION_MS = 1100;
const TOKEN_PULSE_DURATION_MS = 260;

export class HUD {
  private readonly root: HTMLElement;
  private readonly scoreEl: HTMLElement;
  private readonly distanceEl: HTMLElement;
  private readonly meterFillEl: HTMLElement;
  private readonly meterValueEl: HTMLElement;
  private readonly meterEl: HTMLElement;
  private readonly tokensEl: HTMLElement;
  private readonly multiplierEl: HTMLElement;
  private readonly multiplierStatEl: HTMLElement;
  private readonly streakEl: HTMLElement;
  private readonly multiplierCalloutEl: HTMLElement;
  private readonly streakLostCalloutEl: HTMLElement;

  private multiplierCalloutTimeout: number | null = null;
  private streakLostCalloutTimeout: number | null = null;
  private tokenPulseTimeout: number | null = null;

  /** Displayed score eases toward the real score; the stored/submitted score is never affected. */
  private displayedScore = 0;
  private lastTokenCount = 0;

  constructor() {
    this.root = document.getElementById('hud') as HTMLElement;
    this.scoreEl = document.getElementById('hud-score') as HTMLElement;
    this.distanceEl = document.getElementById('hud-distance') as HTMLElement;
    this.meterFillEl = document.getElementById('integrity-meter-fill') as HTMLElement;
    this.meterValueEl = document.getElementById('integrity-meter-value') as HTMLElement;
    this.meterEl = this.root.querySelector('.integrity-meter') as HTMLElement;
    this.tokensEl = document.getElementById('hud-tokens') as HTMLElement;
    this.multiplierEl = document.getElementById('hud-multiplier') as HTMLElement;
    this.multiplierStatEl = document.getElementById('hud-multiplier-stat') as HTMLElement;
    this.streakEl = document.getElementById('hud-streak') as HTMLElement;
    this.multiplierCalloutEl = document.getElementById('multiplier-callout') as HTMLElement;
    this.streakLostCalloutEl = document.getElementById('streak-lost-callout') as HTMLElement;
  }

  bind(handlers: HudHandlers): void {
    document.getElementById('btn-pause')?.addEventListener('click', handlers.onPauseToggle);
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  /** Snaps the displayed score immediately to the given value (used on reset). */
  updateScore(score: number): void {
    this.displayedScore = score;
    this.scoreEl.textContent = score.toLocaleString('en-US');
  }

  /** Eases the displayed score toward the real score each frame, for a "counting" feel. The
   *  underlying score value this animates toward is untouched - purely a display effect. */
  animateScoreTo(score: number, deltaTime: number): void {
    const factor = dampFactor(SCORE_COUNT_SMOOTH_TIME, deltaTime);
    this.displayedScore = lerp(this.displayedScore, score, factor);
    // Once within a point, show the exact value so counting never visibly lags forever.
    const rounded = Math.abs(score - this.displayedScore) < 0.5 ? score : Math.round(this.displayedScore);
    this.scoreEl.textContent = rounded.toLocaleString('en-US');
  }

  updateDistance(distanceMeters: number): void {
    this.distanceEl.textContent = `${distanceMeters.toLocaleString('en-US')} m`;
  }

  updateIntegrity(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));
    this.meterFillEl.style.width = `${clamped}%`;
    this.meterValueEl.textContent = `${Math.round(clamped)}%`;
    this.meterEl.setAttribute('aria-valuenow', String(Math.round(clamped)));

    const critical = clamped <= INTEGRITY_METER_CRITICAL_THRESHOLD;
    const warning = !critical && clamped <= INTEGRITY_METER_WARNING_THRESHOLD;
    this.meterEl.classList.toggle('critical', critical);
    this.meterEl.classList.toggle('warning', warning);
  }

  updateTokens(count: number): void {
    if (count > this.lastTokenCount) {
      this.pulseTokenStat();
    }
    this.lastTokenCount = count;
    this.tokensEl.textContent = count.toLocaleString('en-US');
  }

  /** Brief scale-pop on the Tokens stat box, played whenever the count increases. */
  private pulseTokenStat(): void {
    const statEl = this.tokensEl.closest('.hud-stat') as HTMLElement | null;
    if (!statEl) return;

    if (this.tokenPulseTimeout !== null) {
      window.clearTimeout(this.tokenPulseTimeout);
    }
    statEl.classList.remove('token-pulse');
    void statEl.offsetWidth; // Force reflow so re-triggering the animation class works.
    statEl.classList.add('token-pulse');

    this.tokenPulseTimeout = window.setTimeout(() => {
      statEl.classList.remove('token-pulse');
      this.tokenPulseTimeout = null;
    }, TOKEN_PULSE_DURATION_MS);
  }

  updateStreak(streak: number): void {
    this.streakEl.textContent = String(streak);
  }

  updateMultiplier(multiplier: number): void {
    this.multiplierEl.textContent = `x${multiplier}`;
    this.multiplierStatEl.classList.toggle('multiplier-active', multiplier > 1);
  }

  /** Briefly emphasizes the multiplier HUD and shows "Multiplier x2" style text. */
  showMultiplierIncrease(multiplier: number): void {
    if (this.multiplierCalloutTimeout !== null) {
      window.clearTimeout(this.multiplierCalloutTimeout);
    }
    this.multiplierCalloutEl.textContent = `Multiplier x${multiplier}`;
    this.multiplierCalloutEl.classList.remove('hidden', 'callout-active');
    void this.multiplierCalloutEl.offsetWidth;
    this.multiplierCalloutEl.classList.add('callout-active');
    this.multiplierStatEl.classList.remove('multiplier-pulse');
    void this.multiplierStatEl.offsetWidth;
    this.multiplierStatEl.classList.add('multiplier-pulse');

    this.multiplierCalloutTimeout = window.setTimeout(() => {
      this.multiplierCalloutEl.classList.remove('callout-active');
      this.multiplierCalloutEl.classList.add('hidden');
      this.multiplierCalloutTimeout = null;
    }, MULTIPLIER_CALLOUT_DURATION_MS);
  }

  /** Shows a brief "Streak Lost" message. Only call this for a qualifying lost streak. */
  showStreakLost(): void {
    if (this.streakLostCalloutTimeout !== null) {
      window.clearTimeout(this.streakLostCalloutTimeout);
    }
    this.streakLostCalloutEl.classList.remove('hidden', 'callout-active');
    void this.streakLostCalloutEl.offsetWidth;
    this.streakLostCalloutEl.classList.add('callout-active');

    this.streakLostCalloutTimeout = window.setTimeout(() => {
      this.streakLostCalloutEl.classList.remove('callout-active');
      this.streakLostCalloutEl.classList.add('hidden');
      this.streakLostCalloutTimeout = null;
    }, STREAK_LOST_CALLOUT_DURATION_MS);
  }

  /** Clears any in-flight callouts and resets displayed reward values (Restart / Main Menu). */
  resetRewardDisplay(): void {
    if (this.multiplierCalloutTimeout !== null) {
      window.clearTimeout(this.multiplierCalloutTimeout);
      this.multiplierCalloutTimeout = null;
    }
    if (this.streakLostCalloutTimeout !== null) {
      window.clearTimeout(this.streakLostCalloutTimeout);
      this.streakLostCalloutTimeout = null;
    }
    if (this.tokenPulseTimeout !== null) {
      window.clearTimeout(this.tokenPulseTimeout);
      this.tokenPulseTimeout = null;
    }
    this.multiplierCalloutEl.classList.remove('callout-active');
    this.multiplierCalloutEl.classList.add('hidden');
    this.streakLostCalloutEl.classList.remove('callout-active');
    this.streakLostCalloutEl.classList.add('hidden');
    this.multiplierStatEl.classList.remove('multiplier-pulse', 'multiplier-active');
    this.tokensEl.closest('.hud-stat')?.classList.remove('token-pulse');

    // Reset the tracked count first so the upcoming updateTokens(0) never misreads a legitimate
    // reset-to-zero as a decrease-then-pulse.
    this.lastTokenCount = 0;
    this.updateTokens(0);
    this.updateStreak(0);
    this.updateMultiplier(1);
  }
}
