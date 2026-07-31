import { GameState, GameStateManager } from '../core/GameState';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { HowToPlayScreen } from './screens/HowToPlayScreen';
import { HUD } from './screens/HUD';
import { PauseScreen } from './screens/PauseScreen';
import { GameOverScreen, type GameOverStats } from './screens/GameOverScreen';

export interface UIHandlers {
  onStart: () => void;
  onHowToPlay: () => void;
  onBackFromHowToPlay: () => void;
  onPauseToggle: () => void;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

/**
 * Wires every DOM screen once and drives visibility purely from GameState
 * transitions, so no boolean flags get duplicated between UI and gameplay.
 */
export class UIManager {
  private readonly mainMenu = new MainMenuScreen();
  private readonly howToPlay = new HowToPlayScreen();
  private readonly hud = new HUD();
  private readonly pauseScreen = new PauseScreen();
  private readonly gameOverScreen = new GameOverScreen();

  constructor(stateManager: GameStateManager, handlers: UIHandlers) {
    this.mainMenu.bind({ onStart: handlers.onStart, onHowToPlay: handlers.onHowToPlay });
    this.howToPlay.bind({ onBack: handlers.onBackFromHowToPlay });
    this.hud.bind({ onPauseToggle: handlers.onPauseToggle });
    this.pauseScreen.bind({
      onResume: handlers.onResume,
      onRestart: handlers.onRestart,
      onMainMenu: handlers.onMainMenu,
    });
    this.gameOverScreen.bind({ onRestart: handlers.onRestart, onMainMenu: handlers.onMainMenu });

    stateManager.onChange((next) => this.applyState(next));
    this.applyState(stateManager.getState());
  }

  private applyState(next: GameState): void {
    this.mainMenu.hide();
    this.howToPlay.hide();
    this.pauseScreen.hide();

    switch (next) {
      case GameState.MENU:
        this.hud.hide();
        this.gameOverScreen.hide();
        this.mainMenu.show();
        break;
      case GameState.HOW_TO_PLAY:
        this.hud.hide();
        this.gameOverScreen.hide();
        this.howToPlay.show();
        break;
      case GameState.PLAYING:
        this.gameOverScreen.hide();
        this.hud.show();
        break;
      case GameState.PAUSED:
        this.hud.show();
        this.pauseScreen.show();
        break;
      case GameState.GAME_OVER:
        this.hud.hide();
        break;
    }
  }

  /** Shows/hides the HUD independent of GameState - used only by Demo Camera Mode (F9), which
   *  deliberately never transitions GameState. Every normal state transition still drives HUD
   *  visibility through applyState() above, unaffected by this. */
  setHudVisible(visible: boolean): void {
    if (visible) this.hud.show();
    else this.hud.hide();
  }

  updateScore(score: number): void {
    this.hud.updateScore(score);
  }

  /** Eases the displayed score toward the real score each frame, for a "counting" feel. */
  animateScoreTo(score: number, deltaTime: number): void {
    this.hud.animateScoreTo(score, deltaTime);
  }

  updateDistance(distance: number): void {
    this.hud.updateDistance(distance);
  }

  updateIntegrity(percent: number): void {
    this.hud.updateIntegrity(percent);
  }

  updateTokens(count: number): void {
    this.hud.updateTokens(count);
  }

  updateStreak(streak: number): void {
    this.hud.updateStreak(streak);
  }

  updateMultiplier(multiplier: number): void {
    this.hud.updateMultiplier(multiplier);
  }

  showMultiplierIncrease(multiplier: number): void {
    this.hud.showMultiplierIncrease(multiplier);
  }

  showStreakLost(): void {
    this.hud.showStreakLost();
  }

  /** Clears in-flight reward callouts and resets displayed token/streak/multiplier values. */
  resetRewardDisplay(): void {
    this.hud.resetRewardDisplay();
  }

  showGameOver(stats: GameOverStats): void {
    this.gameOverScreen.show(stats);
  }
}
