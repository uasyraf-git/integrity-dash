import type { Player } from '../entities/Player';
import type { Obstacle } from '../obstacles/Obstacle';

/** The player's world Z never changes - see entities/Player.ts and MovementSystem, which only
 *  ever write to group.position.x/y. Used as the "the obstacle has reached the player" line. */
const PLAYER_Z = 0;

/**
 * Detects a Near Miss: an obstacle that shares the player's current lane and has reached the
 * player's Z position without ever colliding - i.e. a successful jump-over or slide-under.
 * Obstacles in a different lane are never a "near miss" here (the player was never actually at
 * risk from them), and an obstacle that ever overlapped the player - even a graze blocked by
 * invincibility (`inContact`), not just a genuine damaging hit (`hasHitPlayer`) - is excluded,
 * so only a genuinely clean dodge counts. Each obstacle can only ever trigger once
 * (`Obstacle.nearMissTriggered`), cleared automatically when the obstacle is recycled.
 *
 * Purely a detection pass - it never touches Integrity, the reward streak/multiplier, or score
 * itself; the caller (Game) decides what a detected near miss awards.
 */
export class NearMissSystem {
  private readonly resultScratch: Obstacle[] = [];

  detect(player: Player, obstacles: ReadonlyArray<Obstacle>): ReadonlyArray<Obstacle> {
    this.resultScratch.length = 0;

    for (const obstacle of obstacles) {
      if (!obstacle.active || obstacle.nearMissTriggered) continue;
      if (obstacle.hasHitPlayer || obstacle.inContact) continue;
      if (obstacle.laneIndex !== player.laneIndex) continue;
      if (obstacle.group.position.z < PLAYER_Z) continue;

      obstacle.nearMissTriggered = true;
      this.resultScratch.push(obstacle);
    }

    return this.resultScratch;
  }
}
