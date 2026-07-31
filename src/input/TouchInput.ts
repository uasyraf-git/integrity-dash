import type { InputAction } from './InputManager';

const MIN_SWIPE_DISTANCE = 32;
const MAX_SWIPE_TIME = 700;

/**
 * Converts single-finger swipes over the game surface into InputManager actions.
 * Taps (movement below the swipe threshold) are ignored deliberately.
 */
export class TouchInput {
  private readonly target: HTMLElement;
  private readonly dispatch: (action: InputAction) => void;

  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private tracking = false;

  constructor(target: HTMLElement, dispatch: (action: InputAction) => void) {
    this.target = target;
    this.dispatch = dispatch;
    this.target.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.target.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.target.addEventListener('touchend', this.handleTouchEnd, { passive: true });
  }

  private handleTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startTime = performance.now();
    this.tracking = true;
  };

  private handleTouchMove = (event: TouchEvent): void => {
    if (!this.tracking) return;
    event.preventDefault();
  };

  private handleTouchEnd = (event: TouchEvent): void => {
    if (!this.tracking) return;
    this.tracking = false;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - this.startX;
    const dy = touch.clientY - this.startY;
    const elapsed = performance.now() - this.startTime;
    if (elapsed > MAX_SWIPE_TIME) return;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < MIN_SWIPE_DISTANCE) return;

    if (absX > absY) {
      this.dispatch(dx > 0 ? 'moveRight' : 'moveLeft');
    } else {
      this.dispatch(dy > 0 ? 'slide' : 'jump');
    }
  };

  destroy(): void {
    this.target.removeEventListener('touchstart', this.handleTouchStart);
    this.target.removeEventListener('touchmove', this.handleTouchMove);
    this.target.removeEventListener('touchend', this.handleTouchEnd);
  }
}
