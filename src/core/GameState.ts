export enum GameState {
  MENU = 'MENU',
  HOW_TO_PLAY = 'HOW_TO_PLAY',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

type StateChangeListener = (next: GameState, previous: GameState) => void;

/**
 * Single source of truth for the current game state.
 * All transitions flow through here so UI and gameplay never fall out of sync.
 */
export class GameStateManager {
  private current: GameState = GameState.MENU;
  private listeners: StateChangeListener[] = [];

  getState(): GameState {
    return this.current;
  }

  is(state: GameState): boolean {
    return this.current === state;
  }

  transition(next: GameState): void {
    if (this.current === next) return;
    const previous = this.current;
    this.current = next;
    for (const listener of this.listeners) {
      listener(next, previous);
    }
  }

  onChange(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}
