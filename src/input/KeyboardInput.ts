import type { InputAction } from './InputManager';

const KEY_ACTION_MAP: Record<string, InputAction> = {
  ArrowLeft: 'moveLeft',
  KeyA: 'moveLeft',
  ArrowRight: 'moveRight',
  KeyD: 'moveRight',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  ArrowDown: 'slide',
  KeyS: 'slide',
  Escape: 'pauseToggle',
  KeyP: 'pauseToggle',
  Enter: 'start',
  KeyG: 'debugGameOver',
  F9: 'demoCameraToggle',
};

/**
 * Translates physical keydown events into InputManager actions.
 * Repeated (auto-repeat) keydown events are ignored so holding a key
 * cannot spam discrete actions like jump or lane change.
 */
export class KeyboardInput {
  private readonly dispatch: (action: InputAction) => void;

  constructor(dispatch: (action: InputAction) => void) {
    this.dispatch = dispatch;
    window.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const action = KEY_ACTION_MAP[event.code];
    if (!action) return;

    event.preventDefault();
    if (event.repeat) return;

    this.dispatch(action);
  };

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
  }
}
