# Sprint 1: Playable Foundation

**Status: Sprint 1 foundation is complete. Sprint 1.1 (QA Alignment and Foundation Refinement) is
also complete and is documented at the end of this file.** Obstacles, collision, and a dynamic
Integrity Meter have since landed in **Sprint 2A** — see [`docs/SPRINT_02A.md`](SPRINT_02A.md).
Collectibles, combos, missions, and audio remain deferred beyond Sprint 2A.

## Sprint objective

Create a clean, playable technical foundation for Integrity Dash: a browser-based 3D endless
runner running on Vite + TypeScript + Three.js, with three-lane movement, jump, slide, a
Corporate HQ grey-box environment, a full menu/HUD/pause/game-over UI flow, and desktop + mobile
input — all professional grey-box quality, with no obstacles or collectibles yet.

## Design source and mandated Sprint 1 values

Implementation follows the connected **Integrity Dash - Master Design Document** as the general
design and gameplay reference. However, per explicit Sprint 1 acceptance criteria, the following
values are pinned to the original Sprint 1 brief rather than the Master Design Document's fuller
Gameplay Blueprint values, and take precedence for this sprint:

- Tagline (official): **"Run Fast. Choose Right."**
- Lane positions: **-3 / 0 / +3** (lane width 3, track width ~8.0)
- Jump duration: **~0.75s** (height 2.2 units, peak at half the duration, 0.12s input buffer)
- Slide duration: **~0.65s** (standing height 1.8, sliding height 0.8)
- Lane transition duration: **~0.18s** (unchanged from the Master Design Document)
- Initial running speed: **10 units/second** (unchanged from the Master Design Document)
- Integrity Meter starting value: **100%** (range 0–100%, static until Sprint 2 gameplay events
  can change it)
- Camera: 6.5 units behind, 3.4 units high, 10° downward tilt, 0.12–0.18s follow damping
  (unchanged from the Master Design Document)

**Scope conflict, resolved by explicit decision:** the Master Design Document locks in two
selectable playable characters (a male Integrity Agent and a hijab-wearing female Integrity
Agent) with a Character Selection screen. The original Sprint 1 brief scoped only a single
generic placeholder character with no character-select screen. Per explicit direction, Sprint 1
ships the single generic placeholder only; dual-character selection is deferred to a later sprint
rather than guessed at now (see Sprint 2 recommendations below).

## Completed items

- Vite + TypeScript + Three.js project scaffold with strict TypeScript, ESLint flat config, and
  Prettier.
- Central game-state machine: `MENU`, `HOW_TO_PLAY`, `PLAYING`, `PAUSED`, `GAME_OVER`.
- Three-lane player movement with eased lane transitions and the 70%-transition input-acceptance
  rule.
- Jump with buffered input and clean landing; slide with eased collider-height change. Jump and
  slide are mutually exclusive and cannot break each other's state.
- Procedural placeholder player rig (head, torso, arms, legs, backpack, shield badge) with a
  procedural run animation that starts with gameplay and pauses with the game.
- Smooth, stable third-person camera follow with fixed tilt, no shake, and a very slight
  speed-based FOV increase.
- Recycled Corporate HQ grey-box environment: three-lane floor, white lane markings, dark navy
  edges, blue pillars with gold caps, glass panel placeholders, ceiling beams with gold accents,
  fog for depth, and a static reception backdrop at the start of the run. Environment segments are
  repositioned, not recreated.
- Desktop keyboard input and mobile swipe input, unified through a single input action layer, with
  a persistent, adequately-sized mobile pause button.
- Main Menu, How to Play, HUD (score, distance, Integrity Meter), Pause, and Game Over screens,
  all driven centrally by game state.
- Score (10 pts/sec) and distance tracking via delta time; best score persisted to `localStorage`
  under `integrity-dash-best-score`, updated only when beaten.
- Temporary `G` key game-over trigger for testing, documented as temporary.
- Cloudflare Pages-compatible build output (`dist/`, relative Vite base path, no hard-coded
  localhost URLs).

## Acceptance criteria

All Sprint 1 acceptance criteria from the brief were verified:

- `npm install`, `npm run build`, and `npm run lint` all succeed.
- The Main Menu displays correctly; Start Game enters the 3D scene with the player in the centre
  lane.
- Left/right lane movement works and is clamped to the three lanes; jump and slide work and never
  produce a broken/conflicting state.
- The camera follows smoothly with no shake; the environment recycles to create continuous forward
  motion without unbounded mesh creation.
- Score and distance increase while playing; pause/resume/restart/main-menu all work correctly and
  reset runtime state cleanly, including the Integrity Meter resetting to 100%.
- Mobile swipe controls and the mobile pause button are implemented and functional.
- Best score persists via `localStorage`.
- The `G` key reliably triggers Game Over for testing, only while `PLAYING`.
- The canvas is responsive and resizes correctly; verified via automated browser testing that
  repeated restarts never produce duplicate canvases, render loops, or duplicated event listeners,
  and that no console errors occur across a full play-through (menu → play → pause → resume →
  debug game over → restart → menu → how to play).

## Known limitations

- No obstacles, collectibles, combo system, missions, or power-ups — the Integrity Meter is
  displayed and fully wired for future updates, but holds steady at 100% since nothing changes it
  yet.
- Only one generic placeholder character exists; the Master Design Document's two-character
  system and Character Selection screen are deferred (see above).
- No audio; only the folder structure exists for future sound.
- Visuals are intentionally grey-box placeholder geometry, not final art.
- The `G` key debug trigger is a temporary stand-in for real collision-driven game overs.

## Sprint 2 recommendations

- Implement the obstacle and collectible spawn system (`5.9`–`5.10` of the design document),
  reusing the segment-recycling pattern already in `CorporateHQ`.
- Implement collision detection against the player's existing `jumpState`/`slideState`/
  `currentHeightScale`, and wire real Integrity Meter changes (badges, evidence files, cash
  envelopes, luxury gifts, fake invoices, office hazards) through `Game`.
- Implement the combo and score-multiplier system.
- Revisit the deferred two-character system and Character Selection screen as its own scoped
  decision once the core obstacle loop is stable, per the Master Design Document.
- Replace the temporary `G` key game-over trigger with real collision-triggered game overs.
- Revisit whether Sprint 1's pinned placeholder values (lane spacing, jump/slide timing,
  Integrity Meter start) should converge toward the Master Design Document's fuller Gameplay
  Blueprint values once real obstacle/integrity-event tuning begins.

---

## Sprint 1.1 — QA Alignment and Foundation Refinement

**Objective:** correct Sprint 1 specification mismatches against the mandated acceptance values,
review the existing implementation for reliability, and prepare a clean review package. No new
gameplay systems were added.

### Corrections applied

- Integrity Meter starting value: 75% → **100%** (`gameConfig.ts`, runtime reset, HUD initial
  markup, README, this document).
- Slide duration: 0.75s → **~0.65s** (`gameConfig.ts`, this document). Verified the player still
  returns cleanly to standing height afterward via the existing exponential height-scale
  smoothing in `MovementSystem`.
- Jump duration: 0.85s → **~0.75s**, lane positions: ±2.4 → **-3 / 0 / +3** (`gameConfig.ts`,
  this document), per the mandated Sprint 1 acceptance values. Lane transition duration (0.18s)
  and initial speed (10 units/second) already matched and needed no change.
- Project identity: the on-screen tagline, `index.html` metadata, and `package.json` description
  now present only the official tagline, **"Run Fast. Choose Right."**, rather than conflating it
  with the Master Design Document's longer phrase.
- Version bumped to `0.1.1` across `package.json`, `package-lock.json`, and the in-game version
  label.

### Reviewed, no genuine defects found

A structural review of the following areas against the Sprint 1.1 checklist found the existing
Sprint 1 implementation already correct, so no code changes were needed beyond the value
corrections above:

- **Game state and reset** (`core/Game.ts`, `core/GameState.ts`): every transition between
  `MENU`, `HOW_TO_PLAY`, `PLAYING`, `PAUSED`, and `GAME_OVER` is valid and guarded. Restart fully
  resets score, distance, player position/lane/jump/slide state, environment segment positions,
  and the Integrity Meter (now to 100%). Restart never creates a second render loop or duplicate
  input listeners, since `GameLoop` and `InputManager` are constructed exactly once in `Game`'s
  constructor. Returning to the Main Menu does not continue scoring, because gameplay systems
  only update while `stateManager.is(GameState.PLAYING)`. Pause and Game Over both stop that same
  gated update block.
- **Input** (`input/KeyboardInput.ts`, `input/TouchInput.ts`, `input/InputManager.ts`): all
  mapped gameplay keys call `preventDefault()` to stop page scrolling; `TouchInput` distinguishes
  taps from swipes via a minimum-distance threshold and dispatches at most one action per
  gesture; pause only toggles from `PLAYING`/`PAUSED`; the `G` debug key is gated to `PLAYING` in
  `Game.bindInput()`; and all listeners are attached once for the app's lifetime, so repeated
  restarts cannot multiply them.
- **Game loop** (`core/GameLoop.ts`): `start()` no-ops if a loop is already running, so only one
  `requestAnimationFrame` chain can ever exist. Delta time is clamped to 1/20s, preventing extreme
  movement after a tab-switch stall. Rendering runs unconditionally every frame (so `MENU`,
  `PAUSED`, and `GAME_OVER` all still render the scene), while gameplay systems update only
  inside the `PLAYING` guard.
- **Environment recycling** (`world/CorporateHQ.ts`, `world/EnvironmentSegment.ts`): all segment
  geometry and materials are built once in the constructors; `update()` and `reset()` only call
  `setZ()`. `reset()` uses the exact same placement formula as initial construction. Because the
  recycle offset (`SEGMENT_LENGTH * SEGMENT_COUNT`) is always an exact multiple of the segment
  spacing, segments tile with no gap or overlap under continuous recycling, and memory usage
  stays flat indefinitely.
- **Player movement** (`entities/Player.ts`, `systems/MovementSystem.ts`): lane index is always
  clamped to `[0, 2]`; the 70%-transition input-acceptance rule means `currentX` only ever
  interpolates between two valid lane positions, never an invalid in-between lane; jump and slide
  are mutually exclusive in both directions; repeated jump input while airborne is either dropped
  or coalesced into a single buffered re-jump on landing (never stacked into multiple jumps);
  landing snaps Y back to 0 and slide height recovers via smooth damping; and `Player.reset()`
  restores every transform (position, scale, body/limb rotations) and animation-state field the
  movement system touches. The run animation only advances inside the same `PLAYING`-gated update
  call, so it freezes cleanly on pause.

### Validation

See the final Sprint 1.1 delivery report for the actual `npm install` / `npm run lint` /
`npm run build` results and the manual review checklist outcome.
