import { INTEGRITY_METER_MAX, INTEGRITY_METER_MIN, INTEGRITY_METER_START } from '../config/gameConfig';
import { clamp } from '../utils/math';

/**
 * Owns the Integrity Meter's value and invincibility window. Deliberately polled rather than
 * event-driven (Game already polls score/distance the same way each frame) to keep state
 * ownership in one obvious place instead of adding an event framework for its own sake.
 */
export class IntegritySystem {
  private value = INTEGRITY_METER_START;
  private invincible = false;
  private invincibleRemaining = 0;
  private depletedTriggered = false;

  reset(): void {
    this.value = INTEGRITY_METER_START;
    this.invincible = false;
    this.invincibleRemaining = 0;
    this.depletedTriggered = false;
  }

  /** Applies damage unless invincible or already depleted. Clamped to the valid range. */
  damage(amount: number): void {
    if (this.invincible || this.depletedTriggered) return;
    this.value = clamp(this.value - amount, INTEGRITY_METER_MIN, INTEGRITY_METER_MAX);
    if (this.value <= INTEGRITY_METER_MIN) {
      this.depletedTriggered = true;
    }
  }

  /** Reserved for future gameplay systems (e.g. Sprint 2B) - not used as a Sprint 2A source. */
  heal(amount: number): void {
    this.value = clamp(this.value + amount, INTEGRITY_METER_MIN, INTEGRITY_METER_MAX);
  }

  getValue(): number {
    return this.value;
  }

  getPercentage(): number {
    return (this.value / INTEGRITY_METER_MAX) * 100;
  }

  isDepleted(): boolean {
    return this.depletedTriggered;
  }

  isInvincible(): boolean {
    return this.invincible;
  }

  startInvincibility(duration: number): void {
    this.invincible = true;
    this.invincibleRemaining = duration;
  }

  /** Counts down the invincibility window. Only call this while PLAYING. */
  update(deltaTime: number): void {
    if (!this.invincible) return;
    this.invincibleRemaining -= deltaTime;
    if (this.invincibleRemaining <= 0) {
      this.invincible = false;
      this.invincibleRemaining = 0;
    }
  }
}
