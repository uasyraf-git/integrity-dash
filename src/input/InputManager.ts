import { KeyboardInput } from './KeyboardInput';
import { TouchInput } from './TouchInput';

export type InputAction =
  | 'moveLeft'
  | 'moveRight'
  | 'jump'
  | 'slide'
  | 'pauseToggle'
  | 'start'
  | 'debugGameOver'
  | 'demoCameraToggle';

type ActionHandler = () => void;

/**
 * Fans out keyboard and touch gestures into a single set of gameplay actions.
 * Created once for the app's lifetime; restarting the game never re-attaches listeners.
 */
export class InputManager {
  private readonly keyboard: KeyboardInput;
  private readonly touch: TouchInput;
  private readonly handlers: Map<InputAction, ActionHandler[]> = new Map();

  constructor(touchTarget: HTMLElement) {
    this.keyboard = new KeyboardInput(this.dispatch);
    this.touch = new TouchInput(touchTarget, this.dispatch);
  }

  on(action: InputAction, handler: ActionHandler): void {
    const existing = this.handlers.get(action) ?? [];
    existing.push(handler);
    this.handlers.set(action, existing);
  }

  private dispatch = (action: InputAction): void => {
    const handlers = this.handlers.get(action);
    if (!handlers) return;
    for (const handler of handlers) handler();
  };

  destroy(): void {
    this.keyboard.destroy();
    this.touch.destroy();
    this.handlers.clear();
  }
}
