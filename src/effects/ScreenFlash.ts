import { SCREEN_FLASH_DURATION } from '../config/gameConfig';

// Fade-out gets the larger share of the total duration; fade-in is quick and punchy.
const FADE_IN_RATIO = 0.35;

/**
 * A single reusable HTML overlay for the red collision flash. Only one timer is ever pending
 * at a time - triggering again while a flash is active clears the previous timer first, so
 * rapid repeated hits never stack up unmanaged timeouts.
 */
export class ScreenFlash {
  private readonly element: HTMLElement;
  private fadeOutTimeout: number | null = null;

  constructor() {
    this.element = document.getElementById('screen-flash') as HTMLElement;
  }

  trigger(): void {
    if (this.fadeOutTimeout !== null) {
      window.clearTimeout(this.fadeOutTimeout);
      this.fadeOutTimeout = null;
    }

    this.element.classList.add('active');
    this.fadeOutTimeout = window.setTimeout(
      () => {
        this.element.classList.remove('active');
        this.fadeOutTimeout = null;
      },
      SCREEN_FLASH_DURATION * FADE_IN_RATIO * 1000,
    );
  }

  reset(): void {
    if (this.fadeOutTimeout !== null) {
      window.clearTimeout(this.fadeOutTimeout);
      this.fadeOutTimeout = null;
    }
    this.element.classList.remove('active');
  }
}
