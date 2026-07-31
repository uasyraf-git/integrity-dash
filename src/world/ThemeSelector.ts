import { THEME_DURATION } from '../config/gameConfig';
import { ALL_ENVIRONMENT_THEME_IDS, EnvironmentThemeId } from './EnvironmentThemeId';

/**
 * Tracks which environment theme newly-recycled segments should pick up. Advancing is timer-
 * based (`THEME_DURATION`), not per-segment, so multiple segments that recycle while the timer
 * hasn't elapsed yet all share the current theme - that's what turns a single segment swap into
 * a recognizable multi-segment "zone" rather than a new theme every 24 units. Never repeats the
 * immediately-previous theme when it advances.
 */
export class ThemeSelector {
  private current: EnvironmentThemeId;
  private elapsed = 0;

  constructor(initial: EnvironmentThemeId = EnvironmentThemeId.RECEPTION) {
    this.current = initial;
  }

  getCurrentTheme(): EnvironmentThemeId {
    return this.current;
  }

  /** Only ever called while PLAYING (Game.tick gates this like every other gameplay system), so
   *  the zone timer itself pauses along with everything else. */
  update(deltaTime: number): void {
    this.elapsed += deltaTime;
    if (this.elapsed < THEME_DURATION) return;

    this.elapsed -= THEME_DURATION;
    this.current = this.pickNext(this.current);
  }

  private pickNext(exclude: EnvironmentThemeId): EnvironmentThemeId {
    const candidates = ALL_ENVIRONMENT_THEME_IDS.filter((id) => id !== exclude);
    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index];
  }

  reset(initial: EnvironmentThemeId = EnvironmentThemeId.RECEPTION): void {
    this.current = initial;
    this.elapsed = 0;
  }
}
