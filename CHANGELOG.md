# Changelog

All notable changes to Integrity Dash are documented in this file.

## [0.5.1-alpha-demo] - Alpha Demo Stabilisation Hotfix

A small, targeted hotfix on top of Sprint 3C - the final stabilisation pass before external Alpha
Demo playtesting. No new gameplay mechanics, no UI redesign, no gameplay rebalancing - only the
five confirmed issues below, plus a full restart-lifecycle review.

### Fixed

- **Player action analytics now only record accepted actions**: `requestJump()`, `requestSlide()`,
  and `requestLaneChange()` (`src/systems/MovementSystem.ts`) now return `true` only when they
  actually start a new action, `false` when rejected (mid-lane-transition, sliding, already
  jumping, an in-flight buffered jump request, or a lane change at the lane boundary).
  `Game.bindInput()` now only calls the matching `RunAnalytics.record*()` when the request
  returned `true`. Applies uniformly to keyboard, touch, and mobile controls, since all three
  dispatch through the same `InputManager` → `Game.bindInput()` channel - no per-input-device
  changes were needed.
- **Demo Camera Mode now has one central exit path**: a new `Game.exitDemoCameraMode()` restores
  the gameplay camera, HUD, and UI, and clears every Demo Camera flag in one place. It's now used
  everywhere Demo Camera Mode can end - `F9` toggle-off, Restart, Main Menu, Pause, Game Over, and
  New Game - replacing the previous scattered `demoCameraSystem.reset()` calls (some of which
  didn't restore the HUD or camera). Fixes a case where Pause/Restart/Main Menu could leave the
  HUD hidden after Demo Camera Mode.
- **Adaptive Difficulty documentation now matches implementation**: `PerformanceSnapshot`
  (`src/config/adaptiveDifficultyConfig.ts`) is now documented field-by-field, calling out that
  `currentMultiplier`, `bestStreak`, `tokensCollected`, `timeSinceLastHit`, and `survivalDuration`
  are reserved inputs not yet read by `computePerformanceScore()` - kept for a future tuning pass
  rather than removed, per this hotfix's no-rebalancing scope. `computePerformanceScore()` itself
  is unchanged; only its documentation was clarified.
- **Near Miss documentation confirmed accurate**: re-verified that `NearMissSystem` is a clean-
  dodge (lane-match) detector, not a distance-based measurement, and that this was already
  correctly documented (`docs/SPRINT_03A.md`, README `Known limitations`). No code or gameplay
  change; the "Near Miss! +50" popup text is unchanged.
- **Restart lifecycle reviewed end-to-end**: audited every reset path (Player, Camera, Demo
  Camera, HUD, Score, Integrity, Multiplier, Tokens, Streak, Near Miss, Run Analytics, Adaptive
  Difficulty, Rating, floating text, landing effects, environment themes, pause state) across
  Restart, Main Menu, Game Over, and Pause/Resume. No stale data, duplicated listeners/timers, or
  growing scene objects found beyond the Demo Camera gap fixed above.

## [0.5.0-alpha-demo] - Sprint 3C: Adaptive Experience and Demo Readiness

The first Alpha Demo milestone build. Adds a deterministic, rule-based Adaptive Difficulty
Director, a local-only Run Analytics system, an End Run Rating, an enhanced Game Over statistics
panel, a documented balancing review, and a demo-readiness pass. Preserves every Sprint 1-3B
gameplay mechanic, visual polish system, and performance characteristic unchanged.

### Added

- **Adaptive Difficulty Director** (`src/systems/AdaptiveDifficultyDirector.ts`,
  `src/config/adaptiveDifficultyConfig.ts`): a small, deterministic rule engine - no machine
  learning, no external services, no data collection - that evaluates a bounded Performance
  Rating (Struggling/Stable/Skilled/Excellent, never shown to the player) every
  `EVALUATION_INTERVAL` (18s) from reliably-measurable signals (Integrity, streak, best
  multiplier, and a rolling window of recent Near Misses/obstacle hits). With hysteresis
  (a rating can only move one step per evaluation, and only once it clears a threshold by a
  margin) to prevent flapping. May enter a 10-15s Assistance or Challenge window - only ever
  from a neutral state, and only after a 20s cooldown since the last mode change - producing five
  small, clamped modifiers (`DirectorModifiers`) that the existing obstacle and collectible
  spawners consume through their own, unchanged safety checks. Never touches player movement,
  physics, damage values, invincibility, collision boxes, or the existing speed cap. Fully
  disable-able via `ADAPTIVE_DIFFICULTY_ENABLED`.
- **`ObstacleSpawner`/`CollectibleSpawner` now accept an optional `DirectorModifiers`** (default
  neutral, so every existing call site behaves exactly as before): spawn interval, two-lane
  pattern chance, the Security Barrier's spawn weight, collectible spawn interval, and the weight
  of the two lane-discipline-heavy collectible patterns (Lane Transition, Slide Trail) can all be
  nudged within `[MINIMUM_MODIFIER, MAXIMUM_MODIFIER]` - the `MINIMUM_REACTION_TIME` floor and
  every existing lane-safety check are still always enforced regardless.
- **Run Analytics** (`src/systems/RunAnalytics.ts`): tracks run duration (excluding paused time),
  jumps, slides, lane changes, obstacle hits, Near Misses, missed tokens (despawned uncollected),
  and a time-weighted average multiplier - current run only, reset on every Start/Restart/Main
  Menu, frozen the instant Game Over triggers. No network transmission, no personal data.
- **End Run Rating** (`src/systems/EndRunRating.ts`, `src/config/runRatingConfig.ts`): a
  deterministic 1-5 star rating with a title (Integrity Champion / Ethics Leader / Compliance
  Explorer / Learning Professional / Needs More Training) and an encouraging feedback line,
  computed from a weighted composite of score, survival duration, Integrity remaining, best
  streak, tokens collected, collection rate, average multiplier, and Near Misses - obstacle hits
  are normalized per minute of survival so longer runs aren't unfairly penalised. Integrity and
  survival are weighted most heavily; score alone is under a third of the total.
- **Enhanced Game Over screen**: the End Run Rating (stars, title, feedback) plus five additional
  Run Statistics (Run Time, Near Misses, Obstacle Hits, alongside the existing Score/Distance/
  Best Score/Integrity/Tokens/Best Streak/Best Multiplier), with a brief staggered entrance
  animation disabled entirely under `prefers-reduced-motion`.
- **Developer-only debug overlay** (`src/ui/DebugOverlay.ts`): shows the Director's live mode/
  rating, current modifiers, evaluation countdown, and a Run Analytics summary. Never created at
  all unless the page is loaded with `?debug=1` - no console output, nothing visible by default.
- **`npm run validate`**: a lightweight, dependency-free deterministic validation harness
  (`scripts/validate.mjs`) exercising the Director's rating/hysteresis/cooldown/mode-duration
  logic, modifier clamping, Run Analytics recording/reset/freeze, the time-weighted average
  multiplier calculation, and End Run Rating determinism/boundary cases - no new test framework
  dependency, per the sprint's own guidance.

### Changed

- `CollectibleManager.update()` now returns the number of tokens that despawned uncollected this
  frame, fed into `RunAnalytics.recordTokensMissed()`.
- `Game.tick()` builds a `PerformanceSnapshot` and calls the Director every frame (the Director
  itself only actually evaluates on its own interval); threads its modifiers into both spawners;
  updates `RunAnalytics` each frame gameplay is active.
- `GameOverStats` now includes the `RunSummary` and `EndRunRating` alongside the existing fields.

### Balancing

A full review pass confirmed the existing Sprint 1-3B difficulty/reward curve already closely
matches this sprint's suggested principle (0-30s introduction, 30-60s moderate, 60-90s skilled,
90s+ high-but-fair) via the unchanged four `DIFFICULTY_STAGES`. No base gameplay values (obstacle
damage, token score, multiplier thresholds, spawn weights, invincibility duration, etc.) were
changed - see docs/SPRINT_03C.md's Balancing changes section for the full review and the
reasoning for leaving them as-is, deferring to the new Adaptive Difficulty Director for
per-player fine-tuning instead of a base-curve rewrite.

## [0.4.5-alpha] - Sprint 3B: World and Visual Polish

A pure world/visual polish pass on top of Sprint 3A's game-feel pass. No gameplay redesign, no
new gameplay mechanics: player movement, obstacles, collision, Integrity, Near Miss, the
collectible/reward loop, Game State, difficulty stages, Game Over, and restart behaviour are all
unchanged in substance.

### Added

- **Environment theme system** (`src/world/EnvironmentThemeId.ts`, `environmentThemes.ts`,
  `ThemeSelector.ts`): five themes - Reception, Open Office, Meeting Room, Pantry, Server Room -
  that rotate on a configurable timer (`THEME_DURATION`). Newly-recycled track segments pick up
  the selector's current theme, so multiple consecutive segments naturally form one recognizable
  multi-segment "zone" per theme; the selector never repeats the immediately-previous theme.
  Track width, lane positions, and every collision rule are completely unaffected.
- **Twelve reusable decorative props** (`src/world/props/PropFactory.ts`): reception desk, office
  desk, office chair, computer monitor, indoor plant, filing cabinet, meeting table, coffee
  machine, pantry counter, server rack, digital signboard, wall panel/divider. Shared, module-
  level materials (mirroring `ObstacleFactory`'s pattern); only the handful of ambient-animated
  parts (monitor screens, server lights, signboard/coffee-machine indicators) get their own
  per-instance material so they can animate independently.
- **Chunk integration** (`EnvironmentSegment`): every segment prebuilds all five themes' prop
  vignettes (both wall sides) once at startup and simply toggles visibility on theme change - no
  vignette is ever created or destroyed during gameplay. All props are placed well beyond the
  track's glass-panel wall line, never intruding on the play lanes or any collision-relevant
  space.
- **Ambient world animation** (`src/effects/AmbientAnimationSystem.ts`): one centralised update
  loop drives monitor flicker, server rack blink, signboard/coffee-machine pulse, and plant sway
  for every registered prop part, instead of per-object animation logic. Only ever updated inside
  the `PLAYING` guard, so it pauses and resumes exactly like every other gameplay-tied system.
- **Track/surface polish**: periodic floor seam trim strips and wall trim accents along the glass
  panel line - purely decorative, no change to the floor's top surface, lane, or edge positions.
- **Background depth layer**: large, low-poly silhouette geometry beyond the walls (shared
  material, built once per segment) so the world no longer ends in a visible void; moves with its
  segment rather than true parallax (documented scope simplification).
- **Demo Camera Mode** (`F9`, `src/systems/DemoCameraSystem.ts`): a developer/showcase-only
  cinematic orbit around the player, for screenshots/trailer capture. Only reachable while
  `PLAYING`; freezes gameplay simulation and ignores every other input while active (without ever
  touching `GameStateManager`); restores the camera's exact normal state via
  `CameraSystem.snapTo()` on exit; defensively reset on Restart/Main Menu/Pause so it can never
  leak across a state transition.
- **Visual quality configuration** (`src/config/qualityConfig.ts`): Low/Medium/High presets
  controlling decorative prop density, ambient animation, shadows, background depth, and the
  renderer's pixel-ratio cap. Resolved once at startup from a combination of weak device signals
  (pointer type, CPU core count, viewport width - never a single signal alone), with a
  `?quality=` URL override for testing. Purely visual; never affects gameplay mechanics.
- `CameraShake`/`Renderer` constructors were already parameterized (Sprint 3A / this sprint
  respectively) to accept overrides, reused here rather than duplicated for quality/demo camera.

### Changed

- `CorporateHQ` now takes an `AmbientAnimationSystem` and the resolved `QualitySettings` in its
  constructor, and owns/updates a `ThemeSelector`.
- `EnvironmentSegment` now takes the same ambient system, a `propDensity` fraction, and a
  `backgroundDepthEnabled` flag, alongside its unchanged structural geometry.
- `Renderer` accepts an optional `maxPixelRatio`/`shadowsEnabled` (defaulting to the previous
  fixed values) instead of a hardcoded pixel-ratio cap.
- `Game.tick()` gates the entire gameplay-update block on `PLAYING && !demoCameraActive`, and
  branches camera updates between `CameraSystem.update()` and `DemoCameraSystem.update()`.

## [0.4.0-alpha] - Sprint 3A: Game Feel and Polish

A pure game-feel and polish pass on top of the Sprint 2B gameplay loop. No new gameplay
mechanics, no gameplay-balance changes: player movement, obstacles, collision, Integrity damage,
invincibility, Game State, difficulty stages, Game Over, and restart behaviour are all unchanged
in substance - only their presentation is polished. The one addition, Near Miss, is a pure bonus-
score feedback layer that never touches Integrity or the reward streak/multiplier.

### Added

- **Lane-change body lean**: a subtle (10°) visual rotation that peaks mid-transition and returns
  to exactly neutral, computed fresh each frame from the transition's own progress so it can never
  leave a residual tilt or affect lane-change timing/collision.
- **Jump and slide squash-and-stretch**: a brief anticipation compress at jump takeoff, a gentle
  stretch through hang time, a sharper compress-and-recover on landing, and a small anticipation
  compress at slide start - all applied to the visual mesh scale only. `CollisionSystem` reads
  `player.currentHeightScale` directly, never the mesh scale, so none of this touches collision
  geometry, jump/slide timing, or `JUMP_HEIGHT`/`JUMP_DURATION`/`SLIDE_DURATION`.
- **Landing feedback**: a small, distinct camera impulse (separate amplitude/duration from the
  collision shake) and a landing dust ring, both firing exactly once per landing
  (`Player.notifyLanded()` / `consumeLandingEvent()`). Suppressed in favor of the larger collision
  shake if a genuine hit is resolved the same frame, so the two effects never fight.
- **Camera polish** (`CameraSystem`): a light secondary smoothing stage layered on top of the
  existing, unchanged follow damping for a subtle "premium" trailing feel, plus a matching blend
  pass for the shake offset before it's added on top. No camera rotation, no FOV changes beyond
  the existing subtle speed-based boost.
- **`CameraShake.trigger()` now accepts an optional amplitude/duration** (defaulting to the
  existing collision values, unchanged for every existing call site), letting the landing impulse
  reuse the same decay curve and reduced-motion handling at a smaller scale.
- **`PulseRingEffect`** (`src/effects/`): a small pooled, shared ring-pulse effect used for both
  the landing dust ring and the token-pickup ring, so the two features reuse one implementation
  instead of duplicating a ring effect.
- **Token pickup polish** (`Collectible.advance()`): an ease-out-back scale pop (a slight
  overshoot before the token fades, instead of a flat linear grow), a glow pulse that rises then
  falls rather than only decaying, a brief spin acceleration during the pickup animation, and a
  ring pulse at the token's position via `PulseRingEffect`.
- **Near Miss** (`src/systems/NearMissSystem.ts`): awards +50 score for cleanly jumping over or
  sliding under an obstacle in the player's current lane, detected the instant that obstacle
  reaches the player's Z position having never overlapped it (`Obstacle.hasHitPlayer` and
  `Obstacle.inContact` both false). Triggers at most once per obstacle
  (`Obstacle.nearMissTriggered`, cleared on recycle), and deliberately never touches Integrity or
  the reward streak/multiplier - it only calls `ScoreSystem.addPoints()` and shows a
  "Near Miss! +50" popup via `FloatingRewardText.showNearMiss()`.
- **HUD score count-up**: the displayed score eases toward the real score each frame
  (`HUD.animateScoreTo()`) instead of jumping instantly; the stored/submitted score used for Game
  Over and best-score is completely unaffected - this only smooths what's displayed.
- **Token counter pulse**: a brief scale-pop on the Tokens HUD stat whenever the count increases.
- **Multiplier pop animation**: `#hud-multiplier-stat.multiplier-pulse` is now a proper keyframe
  bounce instead of a static transform, reusing the exact same trigger logic from Sprint 2B.
- Integrity Meter fill already animated via an existing CSS `transition: width` (Sprint 2A) - no
  change needed there; confirmed still smooth alongside the other HUD polish.

### Changed

- `Game.tick()` now calls `uiManager.animateScoreTo()` instead of `uiManager.updateScore()` during
  gameplay (reset/menu code paths still snap immediately via `updateScore()`, unchanged).
- `Obstacle.activate()`/`reset()` also clear the new `nearMissTriggered` flag, alongside the
  existing `hasHitPlayer`/`inContact` reset.
- `Player.reset()` also clears the new squash-stretch/landing-event state and resets
  `group.scale`/`group.rotation.z` to neutral.
- How to Play adds one row explaining the Near Miss bonus.

## [0.3.0-alpha] - Sprint 2B: Collectibles and Reward Loop

Adds a positive reward loop on top of the existing Sprint 2A obstacle/collision/Integrity loop:
collectible Integrity Tokens, a collection streak, a x1-x4 score multiplier, and Game Over
collectible statistics. No changes to player movement, obstacles, collision, Integrity damage,
invincibility, Game State, difficulty stages, Game Over, restart behaviour, or mobile controls.

### Added

- **Integrity Token collectible system** (`src/collectibles/`): a single pooled collectible type
  (`TOKEN_POOL_SIZE` = 18) mirroring the Sprint 2A obstacle architecture - `CollectibleType`,
  `Collectible` (centre-relative collision box, per-instance materials for independent pickup
  fades), `CollectibleFactory` (hexagonal blue-and-gold token geometry), `CollectiblePool`, and
  `CollectibleSpawner`.
- **Five controlled spawn patterns**: Straight Lane Line, Lane Transition Trail, Jump Arc, Slide
  Trail (which deliberately routes through an active Security Barrier), and Safe-Lane Reward
  (which rides alongside a live two-lane obstacle pattern in the open third lane). Every pattern
  validates lane clearance against active obstacles first and skips cleanly rather than forcing an
  unsafe placement.
- **Collectible collision** (`src/collision/CollectibleCollisionSystem.ts`): a padded Box3 pickup
  check separate from the obstacle `CollisionSystem`, since pickup needs none of the invincibility/
  contact-tracking complexity a damaging collision does.
- **Reward system** (`src/rewards/RewardSystem.ts`): tracks token count, current streak, best
  streak, multiplier, and max multiplier reached; a polled state holder following the same pattern
  as `IntegritySystem`. Multiplier steps x1 -> x2 -> x3 -> x4 at streaks of 5/10/20 (capped at x4);
  each token is worth `TOKEN_BASE_SCORE` (25) points times the current multiplier.
- **`ScoreSystem.addPoints(amount)`**: applies token rewards to score, alongside the existing
  time-based accumulation.
- **Obstacle-hit streak reset**: a damaging collision resets the current streak and multiplier to
  x1 (via `RewardSystem.registerObstacleHit()`) without touching token count, best streak, or max
  multiplier reached.
- **Pickup and reward feedback**: a brief scale/rise/fade pickup animation on each token
  (`Collectible.advance()`), a pooled floating `+<amount>` reward popup
  (`src/rewards/FloatingRewardText.ts`), a multiplier-increase callout, and a streak-lost callout
  (shown only when the lost streak was at least `STREAK_LOST_DISPLAY_THRESHOLD`, 5).
- **HUD additions**: Tokens, Multiplier, and Streak stats alongside the existing score/distance/
  Integrity readouts.
- **Game Over statistics**: total tokens collected, best streak, and max multiplier reached are
  now shown alongside the existing final score/distance/best score/Integrity stats.
- Reduced-motion handling for token bob/pickup animation and both callouts, matching the existing
  `CameraShake` pattern.

### Changed

- `Game.resetRun()` (Start/Restart) additionally resets the collectible pool, spawner, collision
  system, full `RewardSystem` state, and floating reward text.
- `Game.goToMainMenu()` additionally clears the collectible pool, collision system, and floating
  reward text, and resets the HUD's reward display - but, matching the existing `ScoreSystem`
  pattern, does not reset `RewardSystem`'s raw counters (an abandoned run's stats are never
  surfaced again until the next full `resetRun()`).
- How to Play now explains token collection and that tokens do not restore Integrity.

## [0.2.1-alpha] - Sprint 2A QA Hotfix

A small, targeted hotfix on top of Sprint 2A. No new gameplay systems, no Sprint 2B work - only
the five confirmed issues below.

### Fixed

- **Invincibility collision handling**: `Obstacle.hasHitPlayer` was previously set to `true` the
  instant an obstacle was found overlapping the player, before checking invincibility - so an
  obstacle merely grazed while invincible became permanently harmless for that activation.
  `CollisionSystem.findCollision()` now takes the current invincibility state and only ever
  returns an obstacle when a hit should actually apply damage; a new `Obstacle.inContact` flag
  tracks ongoing overlap (cleared the instant contact ends) so an obstacle still touching the
  player after invincibility expires becomes damaging again on the very next frame, without any
  added timer. Both `hasHitPlayer` and `inContact` are cleared on `activate()`/`reset()`, so
  recycled obstacles always start with clean collision state.
- **Obstacle type repeat limit**: the spawner's same-type reroll previously drew from the full
  weighted candidate list again, so the reroll could still land on the same type. `pickType()`
  now excludes the streak-limited type from the candidate pool outright once the limit is hit,
  so no obstacle type can appear more than two spawn selections in a row; weighted randomness is
  preserved among the remaining candidates, and two-lane (JUMP-only) selection is unaffected.
- **Lane repeat avoidance**: the same bug pattern affected lane selection - a second random roll
  could still return the lane being avoided. `pickLaneFrom()` now selects directly from the
  candidate lanes with the previous lane excluded (falling back to the full candidate set only
  if excluding it would leave no options), with no retry loop.
- **Spawn safety validation**: the spawner now checks active obstacle positions before
  committing to a spawn. A lane is only considered safe if no active obstacle in that lane is
  within `currentSpeed × MINIMUM_REACTION_TIME` world units of the spawn point (plus an
  additional `TWO_LANE_SPACING_BUFFER` for lanes touched by the most recent two-lane pattern).
  If no lane is safe, the spawn attempt is skipped cleanly; if only one is, the spawner falls
  back to a single-lane spawn instead of forcing a two-lane pattern. This check is O(active
  obstacles) using the pool's existing reused array - no per-frame allocation. The four
  difficulty stages are unchanged.
- **Main Menu cleanup**: returning to the Main Menu previously left the prior run's obstacles,
  screen flash, camera shake, and player pose/tint state exactly as they were when gameplay
  simulation stopped, which could remain visible behind the menu. `goToMainMenu()` now clears
  active obstacles, resets the screen flash overlay and camera shake, and resets the player
  (which restores the centre lane and clears hit/invincibility visuals) and the environment to
  their baseline positions - deliberately without touching score or best score, since an
  abandoned run's score should not be recorded. Starting a new game still goes through the full
  `resetRun()` flow unchanged.

## [0.2.0-alpha] - Sprint 2A: Core Gameplay

The first real gameplay loop: obstacles, collision, a dynamic Integrity Meter, and a real Game
Over. No collectibles, combos, missions, audio, or character selection - those remain out of
scope for this sprint.

### Added

- **Obstacle system** (`src/obstacles/`): five procedural Corporate HQ obstacles (Filing Cabinet,
  Stacked Archive Boxes, Security Barrier, Wet Floor Cone, Broken Office Printer), each with a
  unique type identifier, lane index, active/inactive state, and a behavior of `JUMP` or `SLIDE`.
- **Pooled obstacles** (`ObstaclePool`): a fixed pool of 4 instances per type, built once at
  startup and only ever activated/deactivated/repositioned afterward - no mesh creation or
  destruction during gameplay, and no unbounded pool growth.
- **Controlled procedural spawner** (`ObstacleSpawner`): weighted random obstacle selection
  (Filing Cabinet 25, Archive Boxes 25, Wet Floor Cone 20, Broken Printer 20, Security Barrier
  10), a 2.5s initial grace period, a minimum-reaction-time safety floor, and two-lane patterns
  (JUMP obstacles only, never paired with the Security Barrier) that always leave at least one
  lane open.
- **Box3 collision detection** (`src/collision/CollisionSystem.ts`): lightweight axis-aligned
  bounding boxes derived from the player's actual pose (jump height, slide height) rather than
  state flags, so jump/slide clearance comes from real geometry overlap.
- **Dynamic Integrity System** (`src/integrity/IntegritySystem.ts`): starts at 100%, takes 10%
  damage per valid collision, grants a 1.0s invincibility window per hit, and triggers Game Over
  exactly once when depleted.
- **Collision feedback**: a brief red screen flash (`src/effects/ScreenFlash.ts`), subtle
  temporary camera shake that never displaces the camera's follow baseline
  (`src/effects/CameraShake.ts`, disabled under `prefers-reduced-motion`), and a player hit-tint
  pulse with a gentle invincibility shimmer (`Player`/`MovementSystem`).
- **Four-stage difficulty progression**: speed 10 → 11 → 12 → 13 units/second and spawn interval
  2.0s → 1.8s → 1.6s → 1.4s at 0s/30s/60s/90s of elapsed active play time (paused and Game Over
  time excluded); restarting always returns to Stage 1.
- **Real Game Over**: Integrity reaching 0% is now the actual Game Over condition, stopping
  player/world/obstacle/collision simulation, preserving final score/distance, and updating the
  best score. The Game Over screen now also shows the final Integrity value.
- Dynamic HUD Integrity Meter with normal/warning (≤50%)/critical (≤20%) presentations, all
  distinguishable by more than color alone (percentage text always visible).

### Changed

- The `G` key no longer directly forces Game Over; it now calls the same
  `IntegritySystem.damage()` path a real collision uses, so it exercises the real depletion →
  Game Over flow instead of bypassing it. Still gated to `PLAYING` only.
- Forward speed is now driven by the four difficulty stages (capped at 13 units/second) instead
  of the earlier continuous 10 → 24 curve, per Sprint 2A's explicit speed cap.
- How to Play now explains obstacle avoidance and the Game Over condition.

## [0.1.1] - Sprint 1.1: QA Alignment and Foundation Refinement

A QA and specification-alignment patch on top of the Sprint 1 foundation. No new gameplay
systems were added — obstacles, collectibles, collision, combos, missions, and audio remain
out of scope until Sprint 2.

### Fixed

- Integrity Meter starting value corrected from 75% to **100%**, matching mandatory Sprint 1
  acceptance criteria (`src/config/gameConfig.ts`, HUD initial markup, runtime reset logic,
  `README.md`, `docs/SPRINT_01.md`).
- Slide duration aligned from 0.75s to **~0.65s**, per mandatory Sprint 1 acceptance criteria.
  Verified the player still returns smoothly to standing height after the slide ends via the
  existing exponential height-scale damping.
- Jump duration aligned from 0.85s to **~0.75s**, and lane positions aligned from ±2.4 to
  **-3 / 0 / 3**, per mandatory Sprint 1 acceptance criteria. Lane transition duration (0.18s)
  and initial speed (10 units/second) already matched and were left unchanged.
- Project identity consistency: the official tagline is now presented as **"Run Fast. Choose
  Right."** everywhere (menu, `index.html` metadata, `package.json`, README) instead of being
  conflated with the longer Master Design Document phrase.
- Version bumped to `0.1.1` consistently across `package.json`, `package-lock.json`, and the
  in-game version label.

### Reviewed (no defects found)

- **Game state and reset**: every transition (Menu ↔ Playing ↔ Paused ↔ Game Over ↔ How to
  Play) and Restart's full reset of score, distance, player transform/lane/jump/slide state,
  environment segment positions, and the Integrity Meter were verified correct. Pause and Game
  Over both stop the simulation loop's gameplay updates while rendering continues; returning to
  the Main Menu stops scoring.
- **Input**: `KeyboardInput`, `TouchInput`, and `InputManager` were reviewed for scroll
  prevention, tap-vs-swipe discrimination, single-action-per-gesture behavior, state-gated pause
  and debug-game-over handling, and listener duplication across restarts. No changes were
  required — all listeners are attached exactly once for the app's lifetime.
- **Game loop**: `GameLoop`'s single-instance guard, delta-time clamping, and always-render/
  gate-simulation-by-state behavior were verified correct under simulated tab-switch stalls.
- **Environment recycling**: `CorporateHQ` and `EnvironmentSegment` were verified to build all
  geometry once, reposition (never recreate) segments, restore identical positions on reset, and
  tile without gaps or overlap under continuous recycling.
- **Player movement**: lane clamping, the mid-transition input-acceptance rule, jump/slide
  mutual exclusion, jump-input buffering (no endless-jump path), clean landing and slide-height
  recovery, and full state/transform reset were all verified correct.

## [0.1.0] - Sprint 1: Playable Foundation

### Added

- Project foundation: Vite + TypeScript + Three.js, ESLint (flat config), Prettier, strict
  TypeScript configuration.
- Core Three.js scene: capped-pixel-ratio renderer with shadows, ACES tone mapping, sRGB color
  space, responsive resize handling, hemisphere + directional lighting, and depth fog.
- Player movement: three-lane running with eased lane transitions, jump with input buffering,
  slide with collider-height easing, and mutually exclusive jump/slide states.
- Procedural player placeholder rig (head, torso, arms, legs, backpack, shield badge) with a
  procedural run cycle (limb swing + body bob) that pauses with the game.
- Smooth third-person camera follow with fixed downward tilt and no shake.
- Recycled Corporate HQ grey-box environment: three-lane floor with white lane markings and navy
  edges, corporate-blue pillars with gold caps, glass panel placeholders, ceiling beams with gold
  accents, and a static reception backdrop at the start of the run.
- Desktop keyboard input (arrow keys/WASD, Space, Escape/P, Enter) and mobile swipe/tap input,
  both routed through a single input action layer.
- Full UI flow: Main Menu, How to Play, in-run HUD (score, distance, Integrity Meter, pause
  button), Pause screen, and Game Over screen with final score/distance/best score.
- Score and distance tracking driven by delta time; best score persisted to `localStorage` under
  `integrity-dash-best-score`.
- Centralized game-state machine (Menu, How to Play, Playing, Paused, Game Over) driving both
  gameplay and UI, avoiding scattered boolean flags.
- Temporary `G` key developer trigger for testing the Game Over flow ahead of Sprint 2 collisions.
- Cloudflare Pages-compatible build (`npm run build` → `dist/`, relative Vite base path).
- Project documentation: `README.md`, `docs/ARCHITECTURE.md`, `docs/CONTROLS.md`,
  `docs/SPRINT_01.md`.
