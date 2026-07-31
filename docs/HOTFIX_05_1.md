# Hotfix v0.5.1 - Alpha Demo Stabilisation

## Summary

`v0.5.1-alpha-demo` is a small, targeted hotfix on top of Sprint 3C - the final stabilisation
pass before external Alpha Demo playtesting. It fixes five confirmed issues found during internal
architecture review. No new gameplay mechanics, no UI redesign, and no gameplay rebalancing were
made; every change is either a bug fix or a documentation correction. Every Sprint 1-3C gameplay
mechanic, visual system, and performance characteristic is unchanged.

## Fixed issues

### 1. Player action analytics only counted requests, not accepted actions

`requestJump()`, `requestSlide()`, and `requestLaneChange()` (`src/systems/MovementSystem.ts`)
previously returned `void`, and `Game.bindInput()` called the matching `RunAnalytics.record*()`
unconditionally on every raw input event - so a rejected action (e.g. trying to jump while
already sliding, or lane-changing past the boundary) was still counted as if it had happened.

All three functions now return `boolean`: `true` only when they actually start a new action,
`false` on every rejection path (mid-lane-transition too early, sliding, already jumping - a
buffered request queued for landing counts as `false` too, since it isn't a newly accepted action
in that call - or already at the requested lane boundary). `Game.bindInput()` now only records
analytics when the call returns `true`.

This applies uniformly to keyboard, touch, and mobile controls without any per-input-device
change, because all three already dispatch through the same `InputManager` → `Game.bindInput()`
channel - `KeyboardInput` and `TouchInput` only ever call `dispatch(action)`, never
`requestJump`/`requestSlide`/`requestLaneChange` or `RunAnalytics` directly.

### 2. Demo Camera Mode exit logic was scattered and incomplete

Exiting Demo Camera Mode (restoring the gameplay camera, the HUD, and clearing the Demo Camera
flag) was previously handled ad hoc: `toggleDemoCamera()` had its own restore logic, while
`pauseGame()`, `resetRun()`, and `goToMainMenu()` each called `demoCameraSystem.reset()` directly
- which only clears the internal `active` flag, without restoring the HUD or camera. `Game Over`
had no Demo Camera handling at all.

A single `Game.exitDemoCameraMode()` now does all of it in one place: resets the Demo Camera
system, shows the HUD, and re-anchors the camera (`CameraSystem.snapTo()`). It is now the only
way any code path exits Demo Camera Mode, and is called from every flow that can end it: `F9`
toggle-off, Restart, Main Menu, Pause, Game Over, and New Game (via `resetRun()`).

### 3. Adaptive Difficulty documentation didn't match implementation

`computePerformanceScore()` (`src/systems/AdaptiveDifficultyDirector.ts`) only ever read five of
the ten `PerformanceSnapshot` fields (`integrityPercent`, `currentStreak`, `bestMultiplier`,
`nearMissCountSinceLastEvaluation`, `obstacleHitsSinceLastEvaluation`). `docs/SPRINT_03C.md`
already partially called this out but omitted `survivalDuration` from the "not weighted" list,
making it read as though the field might be used when it isn't.

Per this hotfix's no-rebalancing scope, the fix is documentation-only (Option B: keep the fields
as reserved inputs, not remove them): `PerformanceSnapshot` in
`src/config/adaptiveDifficultyConfig.ts` now has a field-by-field JSDoc note on every currently
unused field (`currentMultiplier`, `bestStreak`, `tokensCollected`, `timeSinceLastHit`,
`survivalDuration`), `computePerformanceScore()`'s own doc comment lists exactly which five
fields it reads, and `docs/SPRINT_03C.md`'s Performance Inputs section was corrected to include
`survivalDuration` in the reserved-fields list. `computePerformanceScore()`'s logic itself is
byte-for-byte unchanged - confirmed by `npm run validate` still reporting the same 38/38 passes.

### 4. Near Miss documentation accuracy

Re-verified `NearMissSystem.detect()`: it is a clean-dodge (lane-match) detector - an obstacle
that shares the player's current lane and reaches the player's Z position without ever
overlapping the player - not a continuous-position/distance-based measurement. This was already
correctly documented (`docs/SPRINT_03A.md` "Near Miss" section, README `Known limitations`, and
the class-level comment on `NearMissSystem` itself), so no code, gameplay, or player-facing text
change was needed. The "Near Miss! +50" popup text is unchanged. This hotfix adds the same note
to `docs/ALPHA_DEMO_QA.md`'s Known Issues so testers see it alongside the other documented,
intentional behaviours.

### 5. Restart lifecycle review

Audited every reset path - `resetRun()` (Restart/New Game), `goToMainMenu()`, `pauseGame()`, and
`triggerGameOver()` - against every listed system: Player, Camera, Demo Camera, HUD, Score,
Integrity, Multiplier, Tokens, Streak, Near Miss, Run Analytics, Adaptive Difficulty, Rating,
floating text, landing effects, environment themes, and pause state.

Every system already had a correct, idempotent `reset()` (including `ScreenFlash`, which clears
its pending `setTimeout` on reset, avoiding a stale-timer callback firing after a fresh run has
started). The only genuine gap found was Issue 2 above (Demo Camera's HUD/camera restore not
being consistently applied) - fixed by routing every reset path through
`Game.exitDemoCameraMode()`. No stale data, duplicated listeners/timers, or growing scene objects
were found beyond that.

## Technical changes

### Files modified

- `src/systems/MovementSystem.ts` - `requestJump()`, `requestSlide()`, `requestLaneChange()` now
  return `boolean`.
- `src/core/Game.ts` - `bindInput()`'s jump/slide/lane-change handlers only record analytics on
  `true`; new `exitDemoCameraMode()` method; `toggleDemoCamera()`, `pauseGame()`,
  `goToMainMenu()`, `resetRun()`, and `triggerGameOver()` now route through it.
- `src/config/adaptiveDifficultyConfig.ts` - field-level JSDoc on `PerformanceSnapshot` marking
  reserved (currently unused) fields.
- `src/systems/AdaptiveDifficultyDirector.ts` - `computePerformanceScore()` doc comment lists
  exactly which snapshot fields it reads.
- `docs/SPRINT_03C.md` - corrected the Performance Inputs section's reserved-fields list.
- `docs/ALPHA_DEMO_QA.md` - version bump, new "Hotfix v0.5.1 checklist" section, expanded restart
  stress test (Main Menu cycles, repeated Demo Camera toggling), two new Known Issues notes.
- `README.md` - version bump, hotfix summary in Current sprint status, new Known limitations note
  on the reserved Adaptive Difficulty fields.
- `CHANGELOG.md` - new `[0.5.1-alpha-demo]` entry.
- `index.html` - version label bump.
- `package.json` / `package-lock.json` - version bump (`npm install` re-run to sync the lockfile).

### Files created

- `docs/HOTFIX_05_1.md` - this document.

## Validation

All three required commands were run against the actual repository state, not assumed:

- `npm install` - succeeded, lockfile version synced to `0.5.1-alpha-demo`.
- `npm run lint` (ESLint) - **0 errors, 0 warnings**.
- `npm run build` (`tsc --noEmit && vite build`) - **0 TypeScript errors**, production build
  succeeded.
- `npm run validate` (deterministic Director/Analytics/Rating harness) - **38 passed, 0 failed**,
  identical to the pre-hotfix baseline, confirming Issue 3's documentation-only change didn't
  alter Director behaviour.

## Manual QA

Performed against a `npm run build && npm run preview` production build:

- **Player actions**: accepted jump/slide/lane-change each increment the corresponding Game Over
  Run Analytics stat exactly once; repeatedly requesting a lane change past the leftmost/
  rightmost lane, jumping while sliding, and sliding while jumping do not increment their stats.
- **Demo Camera**: `F9` toggle-off, Restart, Main Menu, and Pause each verified individually to
  restore the HUD and camera correctly; toggled Demo Camera on/off repeatedly (5+ times) within a
  single run with no drift or leftover frozen frame.
- **Restart stress test**: 10x Restart cycles, 5x Main Menu cycles, and several forced Game Overs
  - one canvas, one HUD, no leftover obstacles/tokens/effects, no accumulated stats across cycles,
  no console errors at any point.
- **Full regression**: obstacles, collision/Integrity, tokens/multiplier/streak, Near Miss,
  Adaptive Difficulty (via `?debug=1`), all five environment themes, and quality presets
  (`?quality=low|medium|high`) all confirmed unchanged from Sprint 3C behaviour.

*Note: headless/CI environments observe simulated game-time advancing slower than wall-clock time
relative to a real browser, which is a long-standing environmental characteristic of this
project's rendering loop under throttled/headless conditions, not a defect introduced by this
hotfix - QA timings above account for that.*

## Known limitations

Unchanged from Sprint 3C, plus the two now-explicit documentation notes from this hotfix:

- `PerformanceSnapshot` carries five reserved-but-currently-unused fields (`currentMultiplier`,
  `bestStreak`, `tokensCollected`, `timeSinceLastHit`, `survivalDuration`) - documented, not a bug.
- Near Miss is a lane-match clean-dodge heuristic, not a literal distance measurement -
  documented, not a bug.
- All other Sprint 3C known limitations (Director tuning is a first pass, no audio, non-parallax
  background depth, timer-based theme rotation, no quality-preset UI) carry over unchanged - see
  `docs/ALPHA_DEMO_QA.md` and README `Known limitations`.
