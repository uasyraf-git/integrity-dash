import { SCORE_PER_SECOND } from '../config/gameConfig';

/** Tracks score and distance for the current run using accumulated delta time. */
export class ScoreSystem {
  private score = 0;
  private distance = 0;

  update(deltaTime: number, currentSpeed: number): void {
    this.score += SCORE_PER_SECOND * deltaTime;
    this.distance += currentSpeed * deltaTime;
  }

  /** Adds an explicit point reward (e.g. a collected token) without touching distance. */
  addPoints(amount: number): void {
    this.score += amount;
  }

  getScore(): number {
    return Math.floor(this.score);
  }

  getDistance(): number {
    return Math.floor(this.distance);
  }

  reset(): void {
    this.score = 0;
    this.distance = 0;
  }
}
