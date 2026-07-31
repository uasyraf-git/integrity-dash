import { Renderer } from './Renderer';
import { SceneManager } from './SceneManager';
import { GameState, GameStateManager } from './GameState';
import { GameLoop } from './GameLoop';
import { Player } from '../entities/Player';
import {
  requestJump,
  requestLaneChange,
  requestSlide,
  updatePlayerMovement,
} from '../systems/MovementSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { StorageSystem } from '../systems/StorageSystem';
import { CorporateHQ } from '../world/CorporateHQ';
import { InputManager } from '../input/InputManager';
import { UIManager } from '../ui/UIManager';
import { ObstacleManager } from '../obstacles/ObstacleManager';
import { CollisionSystem } from '../collision/CollisionSystem';
import { CollectibleCollisionSystem } from '../collision/CollectibleCollisionSystem';
import { IntegritySystem } from '../integrity/IntegritySystem';
import { ScreenFlash } from '../effects/ScreenFlash';
import { CameraShake } from '../effects/CameraShake';
import { PulseRingEffect } from '../effects/PulseRingEffect';
import { CollectibleManager } from '../collectibles/CollectibleManager';
import { RewardSystem } from '../rewards/RewardSystem';
import { FloatingRewardText } from '../rewards/FloatingRewardText';
import { NearMissSystem } from '../systems/NearMissSystem';
import { DemoCameraSystem } from '../systems/DemoCameraSystem';
import { AmbientAnimationSystem } from '../effects/AmbientAnimationSystem';
import { AdaptiveDifficultyDirector } from '../systems/AdaptiveDifficultyDirector';
import { RunAnalytics } from '../systems/RunAnalytics';
import { calculateEndRunRating } from '../systems/EndRunRating';
import { DirectorMode, type PerformanceSnapshot } from '../config/adaptiveDifficultyConfig';
import { QualityManager } from '../config/qualityConfig';
import { DebugOverlay } from '../ui/DebugOverlay';
import { THEME } from '../config/theme';
import {
  OBSTACLE_DAMAGE,
  INVINCIBILITY_DURATION,
  STREAK_LOST_DISPLAY_THRESHOLD,
  getDifficultyStage,
  LANDING_IMPULSE_AMPLITUDE,
  LANDING_IMPULSE_DURATION,
  LANDING_RING_START_SCALE,
  LANDING_RING_END_SCALE,
  LANDING_RING_DURATION,
  LANDING_RING_OPACITY,
  COLLECT_RING_START_SCALE,
  COLLECT_RING_END_SCALE,
  COLLECT_RING_DURATION,
  COLLECT_RING_OPACITY,
  NEAR_MISS_SCORE,
} from '../config/gameConfig';

/**
 * Composition root: owns every subsystem and is the only place that drives
 * state transitions, so gameplay and UI can never fall out of sync.
 */
export class Game {
  private readonly renderer: Renderer;
  private readonly sceneManager: SceneManager;
  private readonly stateManager = new GameStateManager();
  private readonly player = new Player();
  private readonly cameraSystem: CameraSystem;
  private readonly scoreSystem = new ScoreSystem();
  private readonly storageSystem = new StorageSystem();
  private readonly qualityManager = new QualityManager();
  private readonly qualitySettings = this.qualityManager.getSettings();
  private readonly ambientAnimationSystem = new AmbientAnimationSystem();
  private readonly corporateHQ: CorporateHQ;
  private readonly obstacleManager = new ObstacleManager();
  private readonly collisionSystem = new CollisionSystem();
  private readonly collectibleManager = new CollectibleManager();
  private readonly collectibleCollisionSystem = new CollectibleCollisionSystem();
  private readonly rewardSystem = new RewardSystem();
  private readonly floatingRewardText = new FloatingRewardText();
  private readonly integritySystem = new IntegritySystem();
  private readonly screenFlash = new ScreenFlash();
  private readonly cameraShake = new CameraShake();
  private readonly pulseRingEffect = new PulseRingEffect();
  private readonly nearMissSystem = new NearMissSystem();
  private readonly demoCameraSystem = new DemoCameraSystem();
  private readonly adaptiveDifficultyDirector = new AdaptiveDifficultyDirector();
  private readonly runAnalytics = new RunAnalytics();
  private readonly debugOverlay = new DebugOverlay();
  private readonly inputManager: InputManager;
  private readonly uiManager: UIManager;
  private readonly gameLoop: GameLoop;

  private elapsedPlayTime = 0;
  private currentSpeed = 0;
  /** Rolling counters fed to the Director's PerformanceSnapshot, reset every time it actually
   *  evaluates (not every frame) - see tick() and PerformanceSnapshot's own doc comment for why
   *  these are windowed rather than lifetime totals. */
  private hitsSinceLastEvaluation = 0;
  private nearMissesSinceLastEvaluation = 0;
  private timeSinceLastHit = Number.POSITIVE_INFINITY;

  constructor(container: HTMLElement) {
    const quality = this.qualitySettings;
    this.renderer = new Renderer(container, quality.maxPixelRatio, quality.shadowsEnabled);
    this.sceneManager = new SceneManager(this.renderer.aspect);
    this.corporateHQ = new CorporateHQ(this.ambientAnimationSystem, quality);
    this.sceneManager.scene.add(
      this.corporateHQ.group,
      this.obstacleManager.group,
      this.collectibleManager.group,
      this.player.group,
      this.pulseRingEffect.group,
    );

    this.cameraSystem = new CameraSystem(this.sceneManager.camera);
    this.cameraSystem.snapTo(this.player);

    this.inputManager = new InputManager(container);
    this.bindInput();

    this.uiManager = new UIManager(this.stateManager, {
      onStart: () => this.startGame(),
      onHowToPlay: () => this.openHowToPlay(),
      onBackFromHowToPlay: () => this.closeHowToPlay(),
      onPauseToggle: () => this.togglePause(),
      onResume: () => this.resumeGame(),
      onRestart: () => this.restartGame(),
      onMainMenu: () => this.goToMainMenu(),
    });

    this.gameLoop = new GameLoop((deltaTime) => this.tick(deltaTime));
    this.gameLoop.start();
  }

  private bindInput(): void {
    // Each request*() call reports whether it actually started a new action (true) or was
    // rejected (mid-transition, sliding, already jumping, at a lane boundary, etc.) - Run
    // Analytics only ever records actions that were genuinely accepted, never rejected attempts.
    this.inputManager.on('moveLeft', () => {
      if (!this.canReceiveGameplayInput()) return;
      if (requestLaneChange(this.player, -1)) this.runAnalytics.recordLaneChange();
    });
    this.inputManager.on('moveRight', () => {
      if (!this.canReceiveGameplayInput()) return;
      if (requestLaneChange(this.player, 1)) this.runAnalytics.recordLaneChange();
    });
    this.inputManager.on('jump', () => {
      if (!this.canReceiveGameplayInput()) return;
      if (requestJump(this.player)) this.runAnalytics.recordJump();
    });
    this.inputManager.on('slide', () => {
      if (!this.canReceiveGameplayInput()) return;
      if (requestSlide(this.player)) this.runAnalytics.recordSlide();
    });
    this.inputManager.on('pauseToggle', () => {
      // Demo Camera Mode deliberately ignores every input except F9 itself while active - see
      // toggleDemoCamera().
      if (this.demoCameraSystem.isActive()) return;
      this.togglePause();
    });
    this.inputManager.on('start', () => {
      if (this.stateManager.is(GameState.MENU)) this.startGame();
    });
    this.inputManager.on('debugGameOver', () => {
      // Development-only shortcut: routes through the real damage path so it exercises
      // the same Game Over flow a genuine collision would, rather than bypassing it.
      if (this.canReceiveGameplayInput()) this.integritySystem.damage(9999);
    });
    this.inputManager.on('demoCameraToggle', () => {
      // Developer/showcase feature: only reachable while actually PLAYING, so it can never be
      // entered from - or leak into - Menu, How to Play, Paused, or Game Over.
      if (!this.stateManager.is(GameState.PLAYING) && !this.demoCameraSystem.isActive()) return;
      this.toggleDemoCamera();
    });
  }

  /** True only while PLAYING and Demo Camera Mode is not showcasing the scene - Demo Camera
   *  Mode deliberately ignores every other input, isolating it as a dev/showcase feature. */
  private canReceiveGameplayInput(): boolean {
    return this.stateManager.is(GameState.PLAYING) && !this.demoCameraSystem.isActive();
  }

  private toggleDemoCamera(): void {
    if (this.demoCameraSystem.isActive()) {
      this.exitDemoCameraMode();
      return;
    }
    this.demoCameraSystem.activate();
    this.uiManager.setHudVisible(false);
  }

  /**
   * Single, central exit path for Demo Camera Mode - restores gameplay camera, HUD, and UI, and
   * clears every Demo Camera flag. Used by every flow that can leave Demo Camera Mode active
   * (F9 toggle-off, Restart, Main Menu, Pause, Game Over, New Game) so none of them can leak a
   * frozen camera or hidden HUD into the next state. Safe to call even when Demo Camera Mode is
   * already inactive.
   */
  private exitDemoCameraMode(): void {
    this.demoCameraSystem.reset();
    this.uiManager.setHudVisible(true);
    // "Camera must restore its exact normal state when exiting" - snapTo() re-anchors both
    // CameraSystem's follow-smoothing state and the camera's own transform in one call.
    this.cameraSystem.snapTo(this.player);
  }

  private togglePause(): void {
    if (this.stateManager.is(GameState.PLAYING)) this.pauseGame();
    else if (this.stateManager.is(GameState.PAUSED)) this.resumeGame();
  }

  startGame(): void {
    this.resetRun();
    this.stateManager.transition(GameState.PLAYING);
  }

  pauseGame(): void {
    if (!this.stateManager.is(GameState.PLAYING)) return;
    this.cameraShake.reset();
    this.pulseRingEffect.reset();
    this.exitDemoCameraMode();
    this.stateManager.transition(GameState.PAUSED);
  }

  resumeGame(): void {
    if (!this.stateManager.is(GameState.PAUSED)) return;
    this.stateManager.transition(GameState.PLAYING);
  }

  restartGame(): void {
    this.resetRun();
    this.stateManager.transition(GameState.PLAYING);
  }

  goToMainMenu(): void {
    // Gameplay simulation already stops the instant the state is no longer PLAYING (Game.tick
    // gates every gameplay system behind that check). This clears the visible/gameplay state
    // left over from the abandoned run - deliberately NOT score, best score, or the reward
    // system's run totals, since those belong to a run that either already ended (Game Over
    // already submitted the best score) or is being abandoned without finishing. Starting a
    // fresh game still goes through the complete resetRun() flow regardless.
    this.corporateHQ.reset();
    this.obstacleManager.reset();
    this.collisionSystem.reset();
    this.collectibleManager.reset();
    this.collectibleCollisionSystem.reset();
    this.floatingRewardText.clear();
    this.uiManager.resetRewardDisplay();
    this.screenFlash.reset();
    this.cameraShake.reset();
    this.pulseRingEffect.reset();
    this.ambientAnimationSystem.reset();
    this.exitDemoCameraMode(); // Defensive: applyState(MENU) below also hides the HUD.
    this.adaptiveDifficultyDirector.reset();
    this.runAnalytics.reset();
    this.resetEvaluationCounters();
    this.player.reset(); // Clears hit/invincibility visuals and restores the centre lane.
    this.cameraSystem.snapTo(this.player);

    this.stateManager.transition(GameState.MENU);
  }

  openHowToPlay(): void {
    if (!this.stateManager.is(GameState.MENU)) return;
    this.stateManager.transition(GameState.HOW_TO_PLAY);
  }

  closeHowToPlay(): void {
    if (!this.stateManager.is(GameState.HOW_TO_PLAY)) return;
    this.stateManager.transition(GameState.MENU);
  }

  private triggerGameOver(): void {
    // Defensive: Demo Camera Mode already halts gameplay simulation (see tick()), so a genuine
    // collision can't trigger Game Over while it's active - but routing through the same central
    // exit path here guarantees the Game Over screen can never appear with a frozen camera or a
    // hidden HUD, regardless of how Game Over ends up being reached in the future.
    this.exitDemoCameraMode();
    const bestScore = this.storageSystem.submitScore(this.scoreSystem.getScore());
    const rewardStats = this.rewardSystem.getStatistics();
    // Freezes the instant Game Over triggers, before anything else can be recorded - guarantees
    // the summary below can never be corrupted by a stray post-Game-Over event.
    this.runAnalytics.freeze();
    const integrityRemaining = Math.round(this.integritySystem.getPercentage());
    const summary = this.runAnalytics.getSummary({
      score: this.scoreSystem.getScore(),
      distance: this.scoreSystem.getDistance(),
      tokensCollected: rewardStats.tokenCount,
      bestStreak: rewardStats.bestStreak,
      bestMultiplier: rewardStats.maxMultiplierReached,
      integrityRemaining,
    });
    const rating = calculateEndRunRating(summary);

    this.stateManager.transition(GameState.GAME_OVER);
    this.uiManager.showGameOver({
      score: this.scoreSystem.getScore(),
      distance: this.scoreSystem.getDistance(),
      bestScore,
      integrity: integrityRemaining,
      tokenCount: rewardStats.tokenCount,
      bestStreak: rewardStats.bestStreak,
      maxMultiplierReached: rewardStats.maxMultiplierReached,
      summary,
      rating,
    });
  }

  private resetRun(): void {
    this.elapsedPlayTime = 0;
    this.currentSpeed = getDifficultyStage(0).speed;
    this.player.reset();
    this.corporateHQ.reset();
    this.obstacleManager.reset();
    this.collisionSystem.reset();
    this.collectibleManager.reset();
    this.collectibleCollisionSystem.reset();
    this.rewardSystem.reset();
    this.floatingRewardText.clear();
    this.integritySystem.reset();
    this.screenFlash.reset();
    this.cameraShake.reset();
    this.pulseRingEffect.reset();
    this.ambientAnimationSystem.reset();
    this.exitDemoCameraMode();
    this.adaptiveDifficultyDirector.reset();
    this.runAnalytics.reset();
    this.resetEvaluationCounters();
    this.scoreSystem.reset();
    this.cameraSystem.snapTo(this.player);
    this.uiManager.updateScore(this.scoreSystem.getScore());
    this.uiManager.updateDistance(this.scoreSystem.getDistance());
    this.uiManager.updateIntegrity(this.integritySystem.getPercentage());
    this.uiManager.resetRewardDisplay();
  }

  private resetEvaluationCounters(): void {
    this.hitsSinceLastEvaluation = 0;
    this.nearMissesSinceLastEvaluation = 0;
    this.timeSinceLastHit = Number.POSITIVE_INFINITY;
  }

  private tick(deltaTime: number): void {
    const demoActive = this.demoCameraSystem.isActive();

    // Demo Camera Mode pauses gameplay simulation the same way Pause does (by simply not
    // calling any of it this frame) without ever touching GameStateManager - see
    // toggleDemoCamera() and canReceiveGameplayInput().
    if (this.stateManager.is(GameState.PLAYING) && !demoActive) {
      this.elapsedPlayTime += deltaTime;
      this.currentSpeed = getDifficultyStage(this.elapsedPlayTime).speed;
      this.timeSinceLastHit += deltaTime;

      this.evaluateAdaptiveDifficulty(deltaTime);
      const modifiers = this.adaptiveDifficultyDirector.getModifiers();

      updatePlayerMovement(this.player, deltaTime);
      this.corporateHQ.update(deltaTime, this.currentSpeed);
      this.obstacleManager.update(deltaTime, this.currentSpeed, this.elapsedPlayTime, modifiers);
      const missedTokens = this.collectibleManager.update(
        deltaTime,
        this.currentSpeed,
        this.elapsedPlayTime,
        this.obstacleManager.getActiveObstacles(),
        modifiers,
      );
      this.runAnalytics.recordTokensMissed(missedTokens);
      if (this.qualitySettings.ambientAnimationEnabled) {
        this.ambientAnimationSystem.update(deltaTime);
      }
      this.scoreSystem.update(deltaTime, this.currentSpeed);
      this.integritySystem.update(deltaTime);
      this.player.setInvincible(this.integritySystem.isInvincible());
      this.runAnalytics.update(deltaTime, this.rewardSystem.getMultiplier());

      const hadCollision = this.processCollisions();
      this.processPickups();
      this.processNearMisses();
      this.processLandingEvent(hadCollision);

      this.sceneManager.followTarget(this.player.currentX, 0);

      this.uiManager.animateScoreTo(this.scoreSystem.getScore(), deltaTime);
      this.uiManager.updateDistance(this.scoreSystem.getDistance());
      this.uiManager.updateIntegrity(this.integritySystem.getPercentage());
      this.uiManager.updateTokens(this.rewardSystem.getTokenCount());
      this.uiManager.updateStreak(this.rewardSystem.getCurrentStreak());
      this.uiManager.updateMultiplier(this.rewardSystem.getMultiplier());

      if (this.integritySystem.isDepleted()) {
        this.triggerGameOver();
      }

      if (this.debugOverlay.isEnabled()) {
        this.updateDebugOverlay();
      }
    }

    this.cameraShake.update(deltaTime);
    this.pulseRingEffect.update(deltaTime);

    if (demoActive) {
      this.demoCameraSystem.update(deltaTime, this.player, this.sceneManager.camera);
    } else {
      this.cameraSystem.update(this.player, this.currentSpeed, deltaTime, this.cameraShake.getOffset());
    }

    this.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
  }

  /**
   * Builds the current PerformanceSnapshot and feeds it to the Director. Only actually
   * re-evaluates every EVALUATION_INTERVAL seconds (see AdaptiveDifficultyDirector) - this is
   * called every frame, but almost every call is a cheap no-op inside the Director itself.
   */
  private evaluateAdaptiveDifficulty(deltaTime: number): void {
    const snapshot: PerformanceSnapshot = {
      integrityPercent: this.integritySystem.getPercentage(),
      currentMultiplier: this.rewardSystem.getMultiplier(),
      bestMultiplier: this.rewardSystem.getStatistics().maxMultiplierReached,
      currentStreak: this.rewardSystem.getCurrentStreak(),
      bestStreak: this.rewardSystem.getStatistics().bestStreak,
      tokensCollected: this.rewardSystem.getTokenCount(),
      nearMissCountSinceLastEvaluation: this.nearMissesSinceLastEvaluation,
      obstacleHitsSinceLastEvaluation: this.hitsSinceLastEvaluation,
      timeSinceLastHit: this.timeSinceLastHit,
      survivalDuration: this.elapsedPlayTime,
    };

    const result = this.adaptiveDifficultyDirector.update(deltaTime, snapshot);
    if (result.evaluated) {
      this.hitsSinceLastEvaluation = 0;
      this.nearMissesSinceLastEvaluation = 0;
    }
    if (result.modeChanged) {
      if (result.newMode === DirectorMode.ASSISTANCE) this.runAnalytics.recordDirectorAssistance();
      else if (result.newMode === DirectorMode.CHALLENGE) this.runAnalytics.recordDirectorChallenge();
    }
  }

  /** Dev-only (`?debug=1`); a no-op call site otherwise skipped entirely. See ui/DebugOverlay. */
  private updateDebugOverlay(): void {
    const modifiers = this.adaptiveDifficultyDirector.getModifiers();
    const rewardStats = this.rewardSystem.getStatistics();
    const summary = this.runAnalytics.getSummary({
      score: this.scoreSystem.getScore(),
      distance: this.scoreSystem.getDistance(),
      tokensCollected: rewardStats.tokenCount,
      bestStreak: rewardStats.bestStreak,
      bestMultiplier: rewardStats.maxMultiplierReached,
      integrityRemaining: Math.round(this.integritySystem.getPercentage()),
    });

    this.debugOverlay.setText(
      [
        `Director: ${this.adaptiveDifficultyDirector.getMode()} (${this.adaptiveDifficultyDirector.getRating()})`,
        `next eval: ${this.adaptiveDifficultyDirector.getTimeUntilNextEvaluation().toFixed(1)}s`,
        `modifiers: interval=${modifiers.obstacleSpawnIntervalModifier.toFixed(2)} ` +
          `multiLane=${modifiers.multiLanePatternWeightModifier.toFixed(2)} ` +
          `complex=${modifiers.complexPatternWeightModifier.toFixed(2)} ` +
          `collect=${modifiers.collectibleSpawnModifier.toFixed(2)} ` +
          `difficult=${modifiers.difficultObstacleWeightModifier.toFixed(2)}`,
        `analytics: hits=${summary.obstacleHits} nearMiss=${summary.nearMissCount} ` +
          `jumps=${summary.jumpCount} slides=${summary.slideCount} laneChanges=${summary.laneChangeCount}`,
        `avgMultiplier=${summary.averageMultiplier.toFixed(2)} assist=${summary.directorAssistanceActivations} ` +
          `challenge=${summary.directorChallengeActivations}`,
      ].join('\n'),
    );
  }

  /** Returns true if a genuine damaging hit was resolved this frame. */
  private processCollisions(): boolean {
    this.collisionSystem.updatePlayerBounds(this.player);
    const hitObstacle = this.collisionSystem.findCollision(
      this.obstacleManager.getActiveObstacles(),
      this.integritySystem.isInvincible(),
    );
    // findCollision only ever returns an obstacle while NOT invincible, so reaching here
    // always means a genuine damaging hit - safe to mark it resolved right here.
    if (!hitObstacle) return false;

    hitObstacle.hasHitPlayer = true;

    const lostStreak = this.rewardSystem.getCurrentStreak();
    this.rewardSystem.registerObstacleHit();
    if (lostStreak >= STREAK_LOST_DISPLAY_THRESHOLD) {
      this.uiManager.showStreakLost();
    }

    this.integritySystem.damage(OBSTACLE_DAMAGE);
    this.integritySystem.startInvincibility(INVINCIBILITY_DURATION);
    this.player.triggerHit();
    this.screenFlash.trigger();
    this.cameraShake.trigger();
    this.runAnalytics.recordObstacleHit();
    this.hitsSinceLastEvaluation += 1;
    this.timeSinceLastHit = 0;
    return true;
  }

  private processPickups(): void {
    this.collectibleCollisionSystem.updatePlayerBounds(this.player);
    const pickups = this.collectibleCollisionSystem.findPickups(
      this.collectibleManager.getActiveCollectibles(),
    );

    for (const token of pickups) {
      token.markCollected();

      const previousMultiplier = this.rewardSystem.getMultiplier();
      const reward = this.rewardSystem.collectToken();
      this.scoreSystem.addPoints(reward);
      this.floatingRewardText.show(reward);
      this.pulseRingEffect.trigger(
        token.group.position.x,
        token.group.position.y,
        token.group.position.z,
        THEME.gold,
        COLLECT_RING_START_SCALE,
        COLLECT_RING_END_SCALE,
        COLLECT_RING_DURATION,
        COLLECT_RING_OPACITY,
      );

      if (this.rewardSystem.getMultiplier() > previousMultiplier) {
        this.uiManager.showMultiplierIncrease(this.rewardSystem.getMultiplier());
      }
    }
  }

  /**
   * Awards a small score bonus for a clean jump-over/slide-under, detected by NearMissSystem.
   * Deliberately never touches Integrity or the reward streak/multiplier - see NEAR_MISS_SCORE.
   */
  private processNearMisses(): void {
    const nearMisses = this.nearMissSystem.detect(this.player, this.obstacleManager.getActiveObstacles());
    for (let i = 0; i < nearMisses.length; i++) {
      this.scoreSystem.addPoints(NEAR_MISS_SCORE);
      this.floatingRewardText.showNearMiss(NEAR_MISS_SCORE);
      this.runAnalytics.recordNearMiss();
      this.nearMissesSinceLastEvaluation += 1;
    }
  }

  /**
   * Fires the landing camera impulse and dust ring exactly once per landing. If a genuine
   * collision was also resolved this same frame, the (much larger) collision shake already
   * triggered this frame is left alone rather than being overwritten by the smaller landing
   * impulse - the dust ring still plays regardless, since it doesn't compete with anything.
   */
  private processLandingEvent(suppressCameraImpulse: boolean): void {
    if (!this.player.consumeLandingEvent()) return;

    if (!suppressCameraImpulse) {
      this.cameraShake.trigger(LANDING_IMPULSE_AMPLITUDE, LANDING_IMPULSE_DURATION);
    }
    this.pulseRingEffect.trigger(
      this.player.currentX,
      0.05,
      this.player.group.position.z,
      THEME.white,
      LANDING_RING_START_SCALE,
      LANDING_RING_END_SCALE,
      LANDING_RING_DURATION,
      LANDING_RING_OPACITY,
    );
  }
}
