import { FLOATING_REWARD_DURATION, FLOATING_REWARD_POOL_SIZE } from '../config/gameConfig';

const NEAR_MISS_VARIANT_CLASS = 'floating-reward-near-miss';

/**
 * A small pool of reusable DOM elements for floating "+25" style reward text. Fixed pool,
 * built once - no DOM nodes are created or destroyed during gameplay. Each element tracks at
 * most one pending removal timer at a time (cleared before starting a new one), so repeated
 * pickups can never accumulate unmanaged timers or grow the DOM.
 *
 * Positioned near the player's on-screen position with a small random horizontal jitter
 * (rather than projecting the collected token's exact 3D position), which keeps this a plain
 * DOM component with no camera/Three.js coupling.
 */
export class FloatingRewardText {
  private readonly pool: HTMLElement[] = [];
  private readonly timers: Map<HTMLElement, number> = new Map();

  constructor() {
    const container = document.getElementById('floating-reward-container') as HTMLElement;
    for (let i = 0; i < FLOATING_REWARD_POOL_SIZE; i++) {
      const element = document.createElement('div');
      element.className = 'floating-reward hidden';
      element.setAttribute('aria-hidden', 'true');
      container.appendChild(element);
      this.pool.push(element);
    }
  }

  /** Shows a token pickup reward, e.g. "+25". */
  show(amount: number): void {
    this.display(`+${amount}`);
  }

  /** Shows a Near Miss bonus, reusing the same pool/animation with a distinct accent color. */
  showNearMiss(bonus: number): void {
    this.display(`Near Miss! +${bonus}`, NEAR_MISS_VARIANT_CLASS);
  }

  private display(text: string, variantClass?: string): void {
    const element = this.pool.find((el) => el.classList.contains('hidden'));
    if (!element) return; // Pool exhausted - skip gracefully rather than growing it.

    const pendingTimeout = this.timers.get(element);
    if (pendingTimeout !== undefined) {
      window.clearTimeout(pendingTimeout);
      this.timers.delete(element);
    }

    element.textContent = text;
    element.classList.remove(NEAR_MISS_VARIANT_CLASS); // Clear any previous variant first.
    if (variantClass) element.classList.add(variantClass);

    const jitterPercent = (Math.random() - 0.5) * 16;
    element.style.left = `calc(50% + ${jitterPercent}%)`;

    element.classList.remove('hidden', 'floating-reward-active');
    element.style.animationDuration = `${FLOATING_REWARD_DURATION}s`;
    void element.offsetWidth; // Force reflow so re-triggering the animation class works.
    element.classList.add('floating-reward-active');

    const timeout = window.setTimeout(() => {
      element.classList.remove('floating-reward-active', NEAR_MISS_VARIANT_CLASS);
      element.classList.add('hidden');
      this.timers.delete(element);
    }, FLOATING_REWARD_DURATION * 1000);
    this.timers.set(element, timeout);
  }

  /** Immediately hides every floating text and cancels all pending timers. */
  clear(): void {
    for (const element of this.pool) {
      const pendingTimeout = this.timers.get(element);
      if (pendingTimeout !== undefined) window.clearTimeout(pendingTimeout);
      element.classList.remove('floating-reward-active', NEAR_MISS_VARIANT_CLASS);
      element.classList.add('hidden');
    }
    this.timers.clear();
  }
}
