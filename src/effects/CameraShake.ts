import { CAMERA_SHAKE_AMPLITUDE, CAMERA_SHAKE_DURATION } from '../config/gameConfig';

const SHAKE_FREQUENCY = 40; // radians/second, purely a visual jitter rate.

/**
 * Produces a small, short-lived positional offset for CameraSystem to add on top of its
 * normal follow position. Never mutates the camera itself, so the follow logic's smoothing
 * state can never drift because of a shake.
 */
export class CameraShake {
  private active = false;
  private elapsed = 0;
  private duration = CAMERA_SHAKE_DURATION;
  private amplitude = CAMERA_SHAKE_AMPLITUDE;
  private readonly reducedMotion: boolean;
  private readonly offset = { x: 0, y: 0 };

  constructor() {
    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Triggers a decaying shake. Defaults to the collision-hit amplitude/duration (unchanged
   * from Sprint 2A); Sprint 3A's landing impulse passes its own, smaller values so the two
   * feel distinct while sharing the same decay curve and reduced-motion handling.
   */
  trigger(amplitude: number = CAMERA_SHAKE_AMPLITUDE, duration: number = CAMERA_SHAKE_DURATION): void {
    if (this.reducedMotion) return;
    this.active = true;
    this.elapsed = 0;
    this.amplitude = amplitude;
    this.duration = duration;
  }

  update(deltaTime: number): void {
    if (!this.active) {
      this.offset.x = 0;
      this.offset.y = 0;
      return;
    }

    this.elapsed += deltaTime;
    if (this.elapsed >= this.duration) {
      this.active = false;
      this.offset.x = 0;
      this.offset.y = 0;
      return;
    }

    const decay = 1 - this.elapsed / this.duration;
    const magnitude = this.amplitude * decay;
    this.offset.x = Math.sin(this.elapsed * SHAKE_FREQUENCY) * magnitude;
    this.offset.y = Math.cos(this.elapsed * SHAKE_FREQUENCY * 1.3) * magnitude * 0.6;
  }

  getOffset(): Readonly<{ x: number; y: number }> {
    return this.offset;
  }

  reset(): void {
    this.active = false;
    this.elapsed = 0;
    this.offset.x = 0;
    this.offset.y = 0;
  }
}
