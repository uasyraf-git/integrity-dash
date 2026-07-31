import { MAX_DELTA_TIME } from '../config/gameConfig';

type TickCallback = (deltaTime: number) => void;

/**
 * Wraps requestAnimationFrame with delta-time clamping and a start/stop guard
 * so restarts or repeated calls never spawn a second concurrent loop.
 */
export class GameLoop {
  private readonly tick: TickCallback;
  private rafHandle: number | null = null;
  private lastTimestamp: number | null = null;

  constructor(tick: TickCallback) {
    this.tick = tick;
  }

  start(): void {
    if (this.rafHandle !== null) return;
    this.lastTimestamp = null;
    this.rafHandle = requestAnimationFrame(this.step);
  }

  stop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.lastTimestamp = null;
  }

  get isRunning(): boolean {
    return this.rafHandle !== null;
  }

  private step = (timestamp: number): void => {
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
    }
    const rawDelta = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    const deltaTime = Math.min(Math.max(rawDelta, 0), MAX_DELTA_TIME);
    this.tick(deltaTime);

    this.rafHandle = requestAnimationFrame(this.step);
  };
}
