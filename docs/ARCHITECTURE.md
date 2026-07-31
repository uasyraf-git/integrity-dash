# Architecture

This document explains how Integrity Dash's codebase fits together, through Sprint 3C (Adaptive
Experience and Demo Readiness) - the first Alpha Demo milestone.

## Overall architecture

The app is a single composition root, `src/core/Game.ts`, constructed once from `src/main.ts`.
`Game` owns every subsystem and is the only place that drives state transitions — no other module
mutates game state directly. That keeps gameplay and UI from ever falling out of sync, and makes
restart/reset behaviour predictable: `Game` is created exactly once per page load, and "restart"
always means "reset the same instances," never "construct new ones." Sprint 2A added five new
subsystems (obstacles, collision, Integrity, and two visual-feedback effects); Sprint 2B added four
more (collectibles, collectible collision, the reward system, and floating reward text); Sprint 3A
added two more (a shared pulse-ring effect and near-miss detection); Sprint 3B added four more (a
quality manager, an ambient animation system, a demo camera, and the theme selector owned inside
`CorporateHQ`); Sprint 3C added three more (the Adaptive Difficulty Director, Run Analytics, and an
opt-in debug overlay) without changing this shape — `Game` still coordinates everything, and none
of the new systems talk to each other directly. Sprint 3A's player/camera polish lives inside the
existing `MovementSystem`/`CameraSystem` modules; Sprint 3B's world polish lives inside dedicated
`src/world/` modules; Sprint 3C's Director/Analytics/Rating logic lives inside dedicated,
rendering-independent `src/systems/`/`src/config/` modules (no Three.js or DOM import anywhere in
them - see Adaptive Difficulty Director, below) rather than inside `Game.ts` directly.

```
main.ts
  └─ Game (composition root)
       ├─ Renderer                    (WebGL canvas; pixel-ratio cap + shadows from QualitySettings)
       ├─ SceneManager                (scene, camera, lights, fog)
       ├─ GameStateManager            (single source of truth for game state)
       ├─ GameLoop                    (requestAnimationFrame, delta-time clamping)
       ├─ Player                      (entity: mesh + movement state + hit/invincibility/landing/
       │                               squash-stretch visuals)
       ├─ QualityManager              (resolves Low/Medium/High visual settings once at startup)
       ├─ AmbientAnimationSystem      (one loop driving all "world feels alive" prop animation)
       ├─ CorporateHQ                 (world: recycled environment segments + theme rotation)
       ├─ ObstacleManager             (pooled obstacles: spawning + movement + recycling, Director-aware)
       ├─ CollisionSystem             (Box3 overlap between player and active obstacles)
       ├─ NearMissSystem              (detects a clean same-lane dodge, once per obstacle)
       ├─ IntegritySystem             (Integrity value, invincibility, Game Over trigger)
       ├─ CollectibleManager          (pooled Integrity Tokens: spawning + movement + recycling, Director-aware)
       ├─ CollectibleCollisionSystem  (Box3 overlap between player and active collectibles)
       ├─ RewardSystem                (token count, streak, score multiplier)
       ├─ FloatingRewardText          (pooled DOM "+<amount>" / "Near Miss!" reward popups)
       ├─ AdaptiveDifficultyDirector  (deterministic, rule-based spawn modifiers - see below)
       ├─ RunAnalytics                (current-run metrics only, frozen at Game Over)
       ├─ DebugOverlay                (opt-in `?debug=1` dev panel - never created otherwise)
       ├─ ScreenFlash                 (collision flash overlay)
       ├─ CameraShake                 (collision shake offset, parameterized amplitude/duration)
       ├─ PulseRingEffect             (pooled ring pulse: landing dust, token pickup)
       ├─ CameraSystem                (smooth follow with a secondary lag stage, plus shake offset)
       ├─ DemoCameraSystem            (F9: developer/showcase cinematic orbit, isolated from
       │                               CameraSystem)
       ├─ ScoreSystem                 (score/distance accumulation + token/near-miss point rewards)
       ├─ StorageSystem               (best-score persistence)
       ├─ InputManager                (keyboard + touch → normalized actions)
       └─ UIManager                   (DOM screens, driven by GameStateManager)
```

## Game-state flow

`src/core/GameState.ts` defines a `GameStateManager` with five states: `MENU`, `HOW_TO_PLAY`,
`PLAYING`, `PAUSED`, `GAME_OVER`. All transitions go through `GameStateManager.transition()`,
which notifies subscribers (currently just `UIManager`). `Game` exposes intent methods
(`startGame`, `pauseGame`, `resumeGame`, `restartGame`, `goToMainMenu`, `openHowToPlay`,
`closeHowToPlay`) that validate the current state before transitioning, so, for example, `pause`
is a no-op unless the game is actually `PLAYING`.

`UIManager` never touches gameplay state directly — it only reacts to `GameStateManager` changes
by showing/hiding the relevant DOM screens. This is the "no scattered booleans" rule in practice:
there is exactly one flag (the current `GameState`) that determines what's visible and what's
simulated.

## Game loop

`src/core/GameLoop.ts` wraps `requestAnimationFrame` with:

- **Delta-time clamping** — frame gaps larger than `MAX_DELTA_TIME` (50ms) are clamped, so a
  backgrounded tab or a long stall never produces a huge simulation jump when the tab regains
  focus.
- **A start/stop guard** — `start()` is a no-op if a loop is already running, so it's impossible
  to accidentally spawn a second `requestAnimationFrame` chain.

`Game.tick(deltaTime)` is the loop's callback. It only advances player movement, world scrolling,
score, obstacle spawning/movement, Integrity/invincibility, and collision processing while
`GameState.PLAYING` — pausing, returning to the Main Menu, or reaching Game Over stops all of
these the same way, by simply not calling them that frame. Rendering (and camera shake decay)
happens every frame regardless of state, so the scene stays visible (frozen) behind the Pause
screen and behind menus rather than going blank.

## Player system

`src/entities/Player.ts` holds the player's Three.js rig (built once from primitive geometry: a
sphere head, box torso/limbs/backpack, and small circle "badge" meshes for the shield emblem) plus
its movement state (lane index, current X, lane-transition progress, jump state, slide state, run
animation time). `src/systems/MovementSystem.ts` contains the actual per-frame physics: lane
easing, jump arc, slide height easing, and the procedural run-cycle animation (limb swing + body
bob). Splitting "what the player is" (entity) from "how it moves" (system) keeps `Player.ts`
readable and makes the movement math easy to test independently of Three.js construction code.

Key rules enforced in `MovementSystem`:

- A new lane change is only accepted once the current transition is ≥70% complete (per the design
  document), preventing input from breaking an in-flight transition.
- Jump is ignored while sliding; a jump requested in the last 0.12s of an active jump is buffered
  and fires immediately on landing, instead of being dropped.
- Slide cannot start while airborne and does not extend on repeated input.
- `updateHitAndInvincibilityVisual` drives the player's collision feedback: a sharp tint pulse for
  `HIT_FEEDBACK_DURATION` on the frame of a hit (which takes priority), or a gentle shimmer for the
  rest of an invincibility window. Both reuse the same shared torso/limb materials Player already
  owns, so no extra meshes or materials are created for feedback.

### Sprint 3A polish: lane lean and squash-and-stretch

Two more purely-visual passes run every frame, both added in Sprint 3A, both writing only to
`player.group.rotation.z` / `player.group.scale` - never to `currentX`, `currentHeightScale`,
`jumpState`, or `slideState`, so none of this can affect collision or timing:

- `updateLaneLean` computes a small (`LANE_LEAN_MAX_DEGREES`) Z-rotation directly from the active
  lane transition's own progress (`Math.sin(Math.PI * t)`, zero at both ends, peak at the
  midpoint) - stateless, so an interrupted transition can never leave a residual tilt, and it
  snaps to exactly 0 the instant `laneTransition.active` is false.
- `updateSquashStretch` blends toward a `target` scale value through one damped `lerp` pass
  (`SQUASH_STRETCH_SMOOTH_TIME`): a brief compress at jump takeoff (`JUMP_ANTICIPATION_DURATION`
  window), a gentle stretch for the rest of the jump's hang time, a sharper compress-and-recover
  after landing (its own `landingEffect` timer, independent of the jump timer), and a small
  compress at slide start. `CollisionSystem` reads `player.currentHeightScale` directly, never
  `group.scale.y`, so this cannot desync from or affect collision geometry - it only multiplies
  the value `currentHeightScale` already writes to `group.scale.y`.
- Landing itself is surfaced to `Game` via a one-shot event: `updateJump` calls
  `player.notifyLanded()` the instant a jump ends (this also starts the squash timer above), and
  `Game.tick` calls `player.consumeLandingEvent()` right after `updatePlayerMovement` to trigger
  the landing camera impulse and dust ring exactly once per landing (see Collision response and
  effects, below).

## Input system

`src/input/InputManager.ts` is the single place gameplay code subscribes to input, via
`on(action, handler)`. It owns one `KeyboardInput` and one `TouchInput` instance, constructed once
for the app's lifetime — restarting the game never re-attaches listeners, so repeated restarts
cannot multiply event handlers.

- `KeyboardInput` maps `event.code` to actions and ignores `event.repeat`, so holding a key cannot
  spam discrete actions like jump.
- `TouchInput` distinguishes a swipe from a tap using a minimum distance threshold and a maximum
  gesture duration, and calls `preventDefault()` on `touchmove` to stop the page from scrolling
  during gameplay.

## Environment recycling

`src/world/CorporateHQ.ts` and `src/world/EnvironmentSegment.ts` implement the "endless" HQ using
a **fixed pool** of `SEGMENT_COUNT` segments (currently 6), each built once with shared materials.
Every frame, `CorporateHQ.update()` advances each segment's Z position by `speed * deltaTime`; once
a segment passes far enough behind the camera, its Z is decremented by the total loop length
(`SEGMENT_LENGTH * SEGMENT_COUNT`), which teleports it back to the far end of the track. No new
geometry or materials are ever created after startup — only existing objects are repositioned —
which keeps memory flat during long runs. This structural geometry (floor, lane lines, edges,
pillars, glass panels, ceiling beams) is completely unchanged since Sprint 1/2A; Sprint 3B only
adds decorative layers on top of it (see below).

## World and environment themes (Sprint 3B, `src/world/`)

Three responsibilities, three modules, so no single file owns "theme selection + prop geometry +
where props go" (an explicit engineering-standards requirement this sprint):

- **`EnvironmentThemeId.ts`** — the five-value enum (`RECEPTION`, `OPEN_OFFICE`, `MEETING_ROOM`,
  `PANTRY`, `SERVER_ROOM`) plus an `ALL_ENVIRONMENT_THEME_IDS` array, mirroring
  `CollectibleType.ts`'s pattern.
- **`ThemeSelector.ts`** — a timer-based rotation (`THEME_DURATION`, 16s of active play time).
  `update(deltaTime)` is only ever called from `CorporateHQ.update()` inside the existing
  `PLAYING` guard, so the zone timer pauses with everything else. Advancing excludes the
  immediately-previous theme, so back-to-back repeats never happen. Because the selector advances
  on its own timer rather than per-segment, several consecutive segments that recycle before the
  timer elapses all pick up the *same* current theme — that contiguous run of segments is what
  actually reads as one recognizable "zone," not a new theme every 24 units.
- **`props/PropFactory.ts`** — the twelve required prop builders (reception desk, office desk,
  office chair, computer monitor, indoor plant, filing cabinet, meeting table, coffee machine,
  pantry counter, server rack, digital signboard, wall panel), each returning `{ group, ambient?
  }` from a local origin. A shared, module-level material cache (mirroring `ObstacleFactory`'s
  pattern) covers every static part; only the handful of ambient-animated parts (a monitor's
  screen, a server rack's light strip, a signboard/coffee-machine indicator) get their own
  per-instance material, so pooled instances of the same prop type can animate out of phase
  instead of visually locking together.
- **`environmentThemes.ts`** — `ENVIRONMENT_THEMES` maps each theme to a display name, an
  atmosphere descriptor (documentation/QA only — see Lighting, below), and an ordered prop
  placement list. `buildThemeVignette(themeId, side, propDensity, ambientSystem)` composes one
  themed cluster (2-4 props) for a given (theme, side) combination — the one place every prop
  instance actually gets constructed, which is also where `AmbientAnimationSystem.register()` is
  called for any animatable parts. `propDensity < 1` trims lower-priority props from the *end* of
  each theme's list, so a lower quality preset genuinely allocates less geometry, not just
  renders less of it.

**Chunk integration**: `EnvironmentSegment` prebuilds all five themes' vignettes (both wall
sides) once in its constructor — a `Map<EnvironmentThemeId, THREE.Group>`, every group `visible =
false` except the segment's assigned theme. `setTheme(themeId)` toggles exactly two groups'
visibility (old off, new on); no vignette is ever created or destroyed during gameplay. Props are
placed at `x = ±(TRACK_WIDTH / 2 + 0.6 + THEME_PROP_WALL_OFFSET)`, beyond the existing pillar/
glass wall line — itself already beyond the play lanes and every collision-relevant coordinate —
so props can never overlap a lane, an obstacle, or a collectible by construction, not by a
collision exemption (props are never added to any collision system at all).
`CorporateHQ.update()` calls `segment.setTheme(themeSelector.getCurrentTheme())` at the exact
moment a segment recycles to the front (the same place its Z already gets repositioned).
`CorporateHQ`'s constructor and `reset()` both assign the six segments a deterministic,
distinct initial theme each (cycling through all five), so a fresh run shows variety immediately
and Restart/Main Menu both return to the same predictable starting layout.

**Track/surface polish and background depth**: `EnvironmentSegment` also adds periodic floor
seam trim strips and thin wall trim strips along the glass-panel line (purely decorative, no lane/
edge/floor-height coordinate is touched), and — when `quality.backgroundDepthEnabled` — two large,
low-poly silhouette shapes beyond the wall line sharing one cheap material and fading into the
existing fog, eliminating the "void" beyond the glass. The silhouettes move with their segment
(not true parallax) — a deliberate scope/performance simplification, documented in
`docs/SPRINT_03B.md`.

**Lighting/atmosphere**: the existing single hemisphere + directional light setup from Sprint 1 is
completely unchanged — every theme lights the player, obstacles, and collectibles identically.
"Atmosphere" is achieved entirely through each theme's prop material/emissive choices (warm gold
for Reception, cool blue-white for Server Room, etc.), not an additional scene light — zero risk
of a lighting change ever affecting gameplay readability, zero lighting transition to manage, and
in line with the brief's own "prefer baked-style visual tricks... over many dynamic point lights"
guidance.

## Ambient animation (`src/effects/AmbientAnimationSystem.ts`)

One centralised update loop instead of per-object animation logic. A flat array of registered
`{kind, material?, object?, phase}` entries, each with a randomized phase offset (assigned in
`register()`) so pooled instances never animate in lockstep. `update(deltaTime)` switches on
`kind` (`monitorFlicker`/`serverBlink`/`signboardPulse` drive `emissiveIntensity` via a shared sine
helper; `plantSway` drives a `rotation.z` oscillation) and is only ever called from `Game.tick()`
inside the `PLAYING` guard, gated additionally by `quality.ambientAnimationEnabled` — pauses and
resumes exactly like every other gameplay-tied system, no internal state check needed here.
`reset()` clears only the elapsed timer; registrations persist for the app's lifetime since props
are never rebuilt.

## Demo Camera (`src/systems/DemoCameraSystem.ts`)

A small, self-contained class deliberately isolated from `CameraSystem`: while active, it writes
directly to the shared `THREE.PerspectiveCamera` (a slow fixed-radius orbit around the player), and
never touches `CameraSystem`'s own follow-smoothing state at all. `Game.tick()` gates the entire
gameplay-update block on `PLAYING && !demoCameraActive` — the same technique Pause already uses
(simply not calling anything that frame) — and branches the camera update between
`CameraSystem.update()` and `DemoCameraSystem.update()`. Exiting calls `CameraSystem.snapTo(player)`,
which re-anchors both the smoothing state and the camera's transform in one call, satisfying "camera
must restore its exact normal state." `F9` (`demoCameraToggle`) is only reachable while `PLAYING`;
every other input is ignored while active (`Game.canReceiveGameplayInput()`); it is defensively
reset in `pauseGame()`/`resetRun()`/`goToMainMenu()` so it can never leak across a state transition,
and it never calls `GameStateManager.transition()` itself.

## Visual quality configuration (`src/config/qualityConfig.ts`)

`QualityManager` resolves one `QualityLevel` (`LOW`/`MEDIUM`/`HIGH`) once at `Game` construction: a
`?quality=` URL override for manual testing, else `detectDefaultQuality()`, which combines coarse-
pointer detection, CPU core count, and viewport width — never any single signal alone. The
resolved `QualitySettings` (`propDensity`, `ambientAnimationEnabled`, `shadowsEnabled`,
`backgroundDepthEnabled`, `maxPixelRatio`) flow into `Renderer` (pixel-ratio cap, shadow map
enabled/disabled), `CorporateHQ`/`EnvironmentSegment` (prop density, background depth), and
`Game.tick()` (whether `AmbientAnimationSystem.update()` runs). Nothing here is gameplay-visible
beyond visual density — `CollisionSystem`, `RewardSystem`, and every other gameplay system are
completely unaware `QualityManager` exists. Not yet exposed through a UI (no settings menu this
sprint), but deliberately self-contained so a future settings menu can call into it directly.

## UI system

Each screen (`src/ui/screens/*.ts`) wraps one DOM subtree and exposes `show()`/`hide()` plus a
`bind()` method that attaches its button listeners exactly once. `UIManager` composes all five
screens, binds them to the handler callbacks it receives from `Game`, and subscribes to
`GameStateManager` to keep visibility in sync with state. Because binding happens once at
construction (not on every `show()`), UI buttons cannot end up with duplicate listeners after
restarts.

## Scoring and storage

`src/systems/ScoreSystem.ts` accumulates score (`SCORE_PER_SECOND` points/second) and distance
(`currentSpeed * deltaTime`) using delta time, so both are frame-rate independent.
`src/systems/StorageSystem.ts` wraps `localStorage` access in `try/catch` (so private-browsing
mode degrades gracefully instead of throwing) and only writes a new best score when the current
run's score exceeds the stored one.

## Obstacle system (`src/obstacles/`)

Five modules, each with one job, mirroring the `CorporateHQ`/`EnvironmentSegment` split:

- **`ObstacleType.ts`** — the `ObstacleTypeId` enum (five types) and `ObstacleBehavior` enum
  (`JUMP` / `SLIDE`). No logic, just identifiers.
- **`Obstacle.ts`** — one pooled instance: its Three.js `group`, a local-space collision `Box3`
  (set once), a reused world-space `Box3` (translated every frame, never reallocated), and
  `activate()` / `deactivate()` / `reset()` / `advance(deltaTime, speed)` methods. `hasHitPlayer`
  marks whether this activation has already applied a real damaging hit, so one obstacle can
  never damage the player twice in a single pass; `inContact` separately tracks whether the
  player is currently overlapping it at all, which is what lets an obstacle grazed only while
  invincible become damaging again the moment invincibility ends, without a timer (see Collision
  system below). Both flags are cleared in `activate()`/`reset()`.
- **`ObstacleFactory.ts`** — builds the five obstacles' Three.js geometry from
  `OBSTACLE_CONFIGS` (`gameConfig.ts`), so the rendered silhouette and the collision box are always
  derived from the same numbers. Materials are created once (module-level cache) and shared across
  every pooled instance of every type, the same pattern `CorporateHQ` uses for its materials.
- **`ObstaclePool.ts`** — a fixed pool (`OBSTACLE_POOL_SIZE_PER_TYPE`, 4 per type) built entirely
  in its constructor. `acquire()` finds an inactive instance of the requested type or returns
  `null` (the spawner just skips that attempt — the pool is never grown during play).
  `getActive()` reuses a single scratch array across calls, so scanning for active obstacles each
  frame allocates nothing.
- **`ObstacleSpawner.ts`** — timing, safety validation, and selection. Waits out
  `OBSTACLE_GRACE_PERIOD`, then attempts a spawn every `max(stage.spawnInterval,
  MINIMUM_REACTION_TIME)` seconds. Before committing, `getSafeLanes()` checks each lane's active
  obstacles (from the pool's already-reused array - no extra allocation) against a minimum spacing
  of `currentSpeed × MINIMUM_REACTION_TIME` from `OBSTACLE_SPAWN_Z` (plus `TWO_LANE_SPACING_BUFFER`
  for lanes the previous two-lane pattern touched); an unsafe attempt is skipped cleanly rather than
  forced. Obstacle type is chosen via `pickWeightedIndex` against each type's `spawnWeight`, with
  the streak-limited type excluded outright (not just rerolled) once `MAX_SAME_TYPE_STREAK` is hit,
  so no type can appear more than two spawn selections in a row; lane repeats are avoided the same
  way (`pickLaneFrom` excludes the previous lane directly, no retry loop). Two-lane patterns (only
  on stages that allow them, and only when at least two lanes are safe) always pick two of the
  three lanes and are restricted to `JUMP`-behavior types only, so a `SLIDE` obstacle can never land
  at the same reaction point as a simultaneous `JUMP` obstacle. A three-lane wall is structurally
  impossible — the spawner never generates more than two simultaneous lanes.
- **`ObstacleManager.ts`** — owns one `ObstaclePool` and one `ObstacleSpawner`. `update()` advances
  every active obstacle by `speed * deltaTime` and deactivates any obstacle that passes
  `OBSTACLE_DESPAWN_Z`. Like every other gameplay system, it is only ever called from `Game.tick`
  inside the `PLAYING` guard — there is no internal state check for game state, because it's simply
  never invoked outside `PLAYING`.

## Collision system (`src/collision/CollisionSystem.ts`)

Plain axis-aligned bounding boxes via `THREE.Box3` — no physics engine, no raycasting. The
player's box is recomputed every frame from actual pose: `minY` is the player's current world Y
(which jump already elevates), `maxY` is `minY + STANDING_HEIGHT * currentHeightScale` (which
slide already shrinks). That means jump/slide clearance falls out of real overlap math, not a
check against `jumpState.active` or `slideState.active` — a jump obstacle is only avoided once the
player's box has actually risen above it, and the Security Barrier's collision box only has a gap
low enough for the player's slide-height box to fit under. `findCollision(obstacles, isInvincible)`
skips any obstacle that isn't `active` or already has `hasHitPlayer` set, updates `inContact` for
every obstacle it scans, and only ever returns an obstacle - for the caller to actually resolve as
damage - while `isInvincible` is false. It only ever needs to reuse one `Box3` for the player side
of the check.

## Integrity system (`src/integrity/IntegritySystem.ts`)

A small, deliberately polled state holder — not an event emitter. `Game.tick` already polls
`ScoreSystem` and pushes its values to the HUD every frame; `IntegritySystem` follows the same
pattern (`getPercentage()` is read and pushed to the HUD every `PLAYING` frame) rather than adding
an event framework for a handful of call sites. `damage()` clamps to `[0, 100]`, is a no-op while
invincible, and can only ever set the depleted flag once per run (`reset()` clears it). Real Game
Over is exactly `isDepleted()` returning true — checked once per frame in `Game.tick`, right after
collision processing.

## Collision response and effects (`src/effects/`)

`Game.processCollisions()` is the single place a collision becomes a game event:

1. `CollisionSystem.findCollision(obstacles, isInvincible)` scans every active, unresolved
   obstacle, updating `inContact` for each, and returns the one obstacle (if any) that should
   apply damage this frame - which only ever happens while the player is not invincible.
2. If an obstacle came back, it is marked `hasHitPlayer = true` right there - since
   `findCollision` never returns one during invincibility, this only ever fires on a genuine
   damaging hit, never on a graze that invincibility blocked. `OBSTACLE_DAMAGE` is applied,
   `INVINCIBILITY_DURATION` of invincibility starts, and the three feedback effects trigger
   together (`Player.triggerHit()`, `ScreenFlash.trigger()`, `CameraShake.trigger()`).

An obstacle merely grazed while invincible is never marked resolved, so if the player is still
overlapping it once invincibility expires, it becomes damaging again on the very next frame -
`inContact` is what makes that possible without a timer, and it's cleared the instant the
obstacle stops overlapping the player at all.

`ScreenFlash` toggles one CSS class on a single overlay `<div>` and manages exactly one pending
`setTimeout` at a time (a new trigger clears any previous one first, so rapid hits never stack
timers). `CameraShake` is pure data — a decaying offset `{x, y}` — read by `CameraSystem.update()`
and added on top of its already-smoothed follow position at the very last step, so shake can never
leak into the follow-smoothing state itself. `Game.pauseGame()` explicitly resets `CameraShake`, so
pausing mid-shake can never leave the camera visibly displaced.

### Sprint 3A: camera lag, landing impulse, and the shared pulse-ring effect

`CameraShake.trigger(amplitude?, duration?)` now takes optional overrides (defaulting to the
unchanged collision-hit values), so a second, smaller "landing impulse" can reuse the exact same
decay curve and reduced-motion handling instead of a parallel implementation. `CameraSystem` adds
a second, lighter smoothing stage: `renderPosition` trails the already-damped `smoothedPosition`
through its own fast `CAMERA_FOLLOW_LAG` pass, and the shake offset is blended through a matching
`CAMERA_SHAKE_BLEND_TIME` pass before being added at the very last step - both purely cosmetic
smoothing on top of the unchanged primary follow, not new input latency.

`Game.processLandingEvent(suppressCameraImpulse)` is the single place a landing becomes a game
event, called every `PLAYING` frame right after `processCollisions()`/`processPickups()`:
`player.consumeLandingEvent()` returns true at most once per landing (set by
`Player.notifyLanded()`, called from `MovementSystem.updateJump()` the instant a jump ends). If a
genuine collision was *also* resolved this same frame, the smaller landing camera impulse is
skipped so it can never overwrite the larger collision shake that already fired - the landing dust
ring still plays regardless, since it doesn't compete with anything.

`src/effects/PulseRingEffect.ts` is a small pooled ring-mesh effect (4 instances, one shared
`RingGeometry`, per-instance `MeshBasicMaterial` for independent color/opacity) used for both the
landing dust ring and the token-pickup ring pulse, so the two features share one implementation
instead of duplicating a ring effect. `trigger(x, y, z, colorHex, startScale, endScale, duration,
opacity)` claims the next pool slot round-robin (a trigger while all four are in use simply
reuses the oldest, imperceptible given how short each pulse is) and skips entirely under
`prefers-reduced-motion`. `update()` runs every frame regardless of state (like `CameraShake`), and
`Game` explicitly calls `reset()` on pause/restart/Main Menu so no ring can linger behind a menu.

## Collectible system (`src/collectibles/`)

Five modules mirroring the `src/obstacles/` split, added in Sprint 2B:

- **`CollectibleType.ts`** — the `CollectibleTypeId` enum. One value this sprint
  (`INTEGRITY_TOKEN`), kept as an enum so a second type is additive later.
- **`Collectible.ts`** — one pooled instance: Three.js `group`, a local-space collision `Box3`
  (**centre-relative**, since tokens float — the inverse of `Obstacle`'s floor-relative
  convention), a reused world-space `Box3`, and `activate()` / `deactivate()` / `reset()` /
  `markCollected()` / `advance(deltaTime, speed)`. Unlike `ObstacleFactory`'s shared material
  cache, each `Collectible` owns its own materials, because the pickup animation independently
  fades opacity and boosts emissive per token — sharing would make one token's pickup affect every
  other active token.
- **`CollectibleFactory.ts`** — builds one token's hexagonal blue-and-gold geometry, with fresh
  materials on every call.
- **`CollectiblePool.ts`** — a fixed pool (`TOKEN_POOL_SIZE`, 18) built once at startup, structured
  the same way as `ObstaclePool` (a `Map<CollectibleTypeId, Collectible[]>`, `acquire()` returning
  `null` on exhaustion, a reused-scratch-array `getActive()`).
- **`CollectibleSpawner.ts`** — implements five controlled spawn patterns (Straight Lane Line, Lane
  Transition Trail, Jump Arc, Slide Trail, Safe-Lane Reward), each validated against active
  obstacle positions (`isLaneClear()` / `isLaneClearAllowingBehavior()`) before anything is placed,
  skipping cleanly rather than forcing an unsafe spawn. The Safe-Lane Reward pattern detects a live
  two-lane obstacle pattern by an exact-Z match across active obstacles (two obstacles spawned
  together always share identical Z afterward, since both advance by the same `speed * deltaTime`
  every frame) and places a trail in the remaining open lane.
- **`CollectibleManager.ts`** — owns one pool and one spawner; `update(deltaTime, speed,
  elapsedActiveTime, activeObstacles)` advances every active token and deactivates any that finish
  their pickup animation or pass `COLLECTIBLE_DESPAWN_Z`. Only ever called from `Game.tick` inside
  the `PLAYING` guard, like every other gameplay system.

## Collectible collision (`src/collision/CollectibleCollisionSystem.ts`)

A separate, simpler sibling to `CollisionSystem`, by design — pickup needs none of the
invincibility/`inContact` bookkeeping a damaging collision does, since a token is consumed exactly
once (`collected`) with no possibility of re-triggering. `updatePlayerBounds(player)` computes one
padded `Box3` from the player's real pose (the same jump/slide-aware geometry `CollisionSystem`
already uses, widened slightly by `TOKEN_PICKUP_PADDING`). `findPickups(collectibles)` returns
every currently-overlapping active, uncollected token in one pass, using a reused scratch array.

## Reward system (`src/rewards/`)

`RewardSystem.ts` is a small, deliberately polled state holder, following the same pattern
`IntegritySystem` established — `Game.tick` reads its values and pushes them to the HUD every
`PLAYING` frame. `collectToken()` increments token count, increments the current streak, derives
the multiplier from the **new** streak (so the token that crosses a threshold is itself scored at
the new rate), and returns `TOKEN_BASE_SCORE * multiplier`. `registerObstacleHit()` resets the
current streak and multiplier but leaves token count, best streak, and max multiplier reached
untouched, since those are run statistics rather than streak state.

`FloatingRewardText.ts` is a small pool of reusable DOM elements (`FLOATING_REWARD_POOL_SIZE`, 6)
that show a `+<amount>` popup on pickup, positioned in fixed screen-space near the player with
random horizontal jitter — deliberately not projected from the token's 3D position, to keep this a
plain DOM component with no camera/Three.js coupling, matching `ScreenFlash`'s simplicity. Each
element tracks at most one pending removal timer, cleared before a new one starts, so rapid pickups
can never accumulate timers or grow the DOM. Sprint 3A extracted the shared display logic into a
private `display(text, variantClass?)` method: `show(amount)` is unchanged (`+<amount>`), and the
new `showNearMiss(bonus)` reuses the exact same pool/timer machinery with a `"Near Miss!
+<bonus>"` message and a distinct CSS accent class (`floating-reward-near-miss`), cleared before
any new variant is applied so a reused pool element never carries a stale class.

## Pickup flow

`Game.processPickups()` is the single place a pickup becomes a game event, called every `PLAYING`
frame right alongside `processCollisions()`:

1. `CollectibleCollisionSystem.findPickups()` returns every newly-overlapping, uncollected token.
2. Each token is marked `collected` (`Collectible.markCollected()`, starting its pickup animation:
   an ease-out-back scale pop, a rise-then-fall glow pulse, and a brief spin acceleration - see
   `Collectible.advance()`), its reward is computed and added to score
   (`RewardSystem.collectToken()` → `ScoreSystem.addPoints()`), a floating reward popup is shown,
   and a token-colored ring pulses at the token's position (`PulseRingEffect.trigger()`).
3. If the multiplier increased as a result, `UIManager.showMultiplierIncrease()` fires the
   multiplier-increase callout.

`Game.processCollisions()` (obstacles) additionally calls `RewardSystem.registerObstacleHit()` on
every damaging hit — the same call site that already applies Integrity damage and collision
feedback, no new collision-detection path. If the lost streak was at least
`STREAK_LOST_DISPLAY_THRESHOLD`, `UIManager.showStreakLost()` fires the streak-lost callout.

## Near Miss (`src/systems/NearMissSystem.ts`)

A pure detection pass, stateless itself - all the bookkeeping lives on `Obstacle`. `detect(player,
obstacles)` scans active obstacles and flags one as a Near Miss when all of the following hold:
it hasn't already triggered (`nearMissTriggered`), it never overlapped the player at all this
activation (`!hasHitPlayer && !inContact` - excluding not just genuine hits but also a graze
blocked by invincibility, so only a genuinely clean dodge counts), it shares the player's current
lane, and it has reached the player's fixed Z position (`group.position.z >= 0` - the player's Z
never changes, only X/Y do). Matching a *lane*, not a continuous X/distance value, is a deliberate
simplification: since a same-lane `JUMP` obstacle can only be avoided by actually being airborne
when it arrives, and a same-lane `SLIDE` obstacle only by actually sliding, a same-lane pass with
no overlap is already strong evidence of a real, skillful dodge. `Obstacle.nearMissTriggered` is
reset alongside `hasHitPlayer`/`inContact` in `activate()`/`reset()`, so a recycled obstacle always
starts clean. `Game.processNearMisses()` reads the detection result and is the only place a Near
Miss becomes a game event: it calls `ScoreSystem.addPoints(NEAR_MISS_SCORE)` and
`FloatingRewardText.showNearMiss()` for each - it never touches `IntegritySystem` or
`RewardSystem`, so a Near Miss can never affect Integrity or the collection streak/multiplier.

## Adaptive Difficulty Director (Sprint 3C, `src/systems/AdaptiveDifficultyDirector.ts`)

Deliberately independent of rendering and gameplay state - the whole file (and
`config/adaptiveDifficultyConfig.ts`) has zero Three.js or DOM import, so its logic is directly
unit-validatable (see `npm run validate`, below). `Game` builds a `PerformanceSnapshot` every
frame from values it already owns (Integrity, streak, best multiplier, and two rolling counters -
`hitsSinceLastEvaluation`/`nearMissesSinceLastEvaluation` - that `Game` resets whenever the
Director reports it evaluated) and calls `director.update(deltaTime, snapshot)`.

- **Evaluation cadence**: the Director only actually computes a new rating every
  `EVALUATION_INTERVAL` (18s) of accumulated time - `update()` is called every frame, but almost
  every call is an early return. `computePerformanceScore()` combines Integrity, streak, best
  multiplier, and the two windowed (not lifetime) counters into one bounded score.
- **Rating hysteresis**: `computeRating()` maps that score to one of four ratings
  (Struggling/Stable/Skilled/Excellent - never shown to the player), but can only move one step
  per evaluation, and only once the score clears the relevant boundary by
  `RATING_HYSTERESIS_MARGIN` - not merely touches it. This is what stops the rating (and
  therefore any mode change) from flapping right at a threshold.
- **Mode entry, duration, and cooldown**: a new Assistance/Challenge mode can only ever start
  from a neutral state (an active mode is never interrupted mid-flight) and only once
  `MODE_CHANGE_COOLDOWN` (20s, measured from the *previous* mode's entry) has elapsed. Each mode
  auto-reverts to neutral after its own fixed duration (`ASSISTANCE_DURATION`/`CHALLENGE_DURATION`,
  12s each) regardless of further evaluations - checked every frame, independent of the
  evaluation cadence, so a mode can never overstay its welcome even if the next scheduled
  evaluation is still far away.
- **Modifiers, not control**: the Director never touches the player, physics, damage, or spawns
  anything itself. It only ever produces a `DirectorModifiers` object (five small multipliers),
  clamped to `[MINIMUM_MODIFIER, MAXIMUM_MODIFIER]` by `clampModifiers()` as defense in depth on
  top of the fact that `ASSISTANCE_MODIFIERS`/`CHALLENGE_MODIFIERS` are already authored within
  that range.
- **Fairness (Task 2)**: `ObstacleSpawner.update()`/`CollectibleSpawner.update()` both take an
  optional `DirectorModifiers` (defaulting to `NEUTRAL_MODIFIERS`, so every pre-Sprint-3C call
  site is unaffected). The modifiers only ever scale an *existing* interval or weight inside the
  *same* code path that already runs every other safety check - `MINIMUM_REACTION_TIME`,
  `getSafeLanes()`/`isLaneClear()`, the two-lane-pattern lane cap, and the same-type/lane repeat
  limits are structurally untouched and always still apply. A Director-influenced spawn can never
  arrive faster than the existing floor allows, and can never land in an unsafe lane - the
  Director literally has no code path that bypasses those checks, rather than a separate
  validation step re-checking its output.
- **Reset**: `reset()` clears all timers, mode, rating, and modifiers back to their construction
  defaults - called from both `resetRun()` and `goToMainMenu()`.

## Run Analytics and End Run Rating (`src/systems/RunAnalytics.ts`, `EndRunRating.ts`)

Also zero Three.js/DOM dependency, kept deliberately separate from the UI. `RunAnalytics` tracks
run duration and a handful of event counters (jumps, slides, lane changes, obstacle hits, Near
Misses, missed tokens, Director activations) plus a time-weighted running sum for the average
multiplier - all via cheap `record*()`/`update()` calls from `Game`, no per-frame allocation.
`freeze()` (called the instant Game Over triggers, before anything else can run) makes every
subsequent `record*`/`update` call a no-op, guaranteeing the summary can never be corrupted by a
stray post-Game-Over event. `getSummary(context)` composes the final `RunSummary` from its own
counters plus a few values other systems already track correctly (score, distance, tokens
collected, best streak, best multiplier, Integrity remaining) rather than re-tracking them
redundantly.

`calculateEndRunRating(summary)` (`EndRunRating.ts`) is a pure function - the same `RunSummary`
always produces the same rating, no randomness, no hidden state. It normalizes several inputs to
`[0, 1]` against reference maxima (`runRatingConfig.ts`), combines them into a weighted composite
score (obstacle hits contribute a *credit* normalized per minute of survival, so a longer run
isn't punished just for lasting longer), and maps the composite score to a 1-5 star tier via
configurable thresholds. Integrity and survival duration are weighted highest; score alone is
under a third of the total weight - deliberately, so the rating is never "just a score readout."

`Game.triggerGameOver()` is the one place both come together: freeze analytics, build the
summary, calculate the rating, pass both into `UIManager.showGameOver()` alongside the existing
stats. `GameOverScreen` renders the star string as literal `★`/`☆` characters (not colour-only),
the title, the feedback line, and five additional stat rows (Run Time, Near Misses, Obstacle
Hits) alongside the pre-existing ones, with a brief staggered entrance animation
(`.stat-reveal`) skipped entirely under `prefers-reduced-motion`.

## Debug overlay (`src/ui/DebugOverlay.ts`)

Opt-in only: the constructor checks `?debug=1` once and creates no DOM element at all if absent -
so it is never visible in normal play and adds zero cost for the vast majority of sessions.  When
enabled, `Game` calls `updateDebugOverlay()` once per gameplay frame (itself gated the same way
every other gameplay-tied call is), writing the Director's mode/rating/modifiers/evaluation
countdown and a live Run Analytics summary into one `textContent` write - no console output at
all, so it can never spam the browser console.

## Deterministic validation (`scripts/validate.mjs`, `npm run validate`)

The project has no test framework, and Sprint 3C's own guidance was not to add one solely for
this sprint. Since `AdaptiveDifficultyDirector.ts`, `RunAnalytics.ts`, `EndRunRating.ts`, and
their config modules have zero Three.js/DOM dependency, `tsconfig.validate.json` compiles just
those files (plus `utils/math.ts`) to CommonJS in a gitignored `.validate-build/` directory, and
`scripts/validate.mjs` (plain Node, no framework) imports the compiled output and runs a small
assertion harness - rating/hysteresis boundaries, Director mode transitions/cooldown/duration,
modifier clamping, a disabled Director, Run Analytics recording/freeze/reset, the time-weighted
average multiplier, and End Run Rating determinism plus 1-star/5-star boundary cases. Run via
`npm run validate` (compiles, then runs); see `docs/SPRINT_03C.md` for the full scenario list.
