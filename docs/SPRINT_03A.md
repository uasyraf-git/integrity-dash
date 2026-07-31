# Sprint 3A: Game Feel and Polish

**Status: complete.** Builds on the Sprint 2B (0.3.0-alpha) collectible/reward loop without
modifying it in substance. A pure game-feel and polish pass: no new gameplay mechanics, no
gameplay-balance changes. Player movement, obstacles, collision, Integrity damage, invincibility,
Game State, difficulty stages, Game Over, restart behaviour, and mobile controls are all unchanged
in substance - only their presentation is polished. The one addition, Near Miss, is a pure
bonus-score feedback layer that never touches Integrity or the reward streak/multiplier. Sprint
3B (`docs/SPRINT_03B.md`) is a further pure polish pass on the *world* (environment themes,
decorative props, lighting/atmosphere, a Demo Camera) on top of this sprint's player/camera/HUD
polish - neither sprint modifies the other's changes.

## Objective

Make Integrity Dash feel like a professionally polished endless runner - smoother movement,
more satisfying feedback, a "premium" camera - without redesigning or weakening anything from
Sprint 1 through 2B. Prioritise subtle feel over visual complexity: no new particle systems, no
exaggerated animation, nothing that competes with the existing HUD or collision readability.

## Scope

**In scope:** player movement polish (lane lean, jump/landing squash-and-stretch, slide
anticipation), camera polish (a secondary smoothing stage, a distinct landing impulse), collect
feedback polish (glow pulse, spin acceleration, scale pop, a ring pulse), HUD polish (score
count-up, multiplier pop, token pulse; the Integrity Meter's fill animation already existed from
Sprint 2A), a new Near Miss bonus, and landing effects (camera impulse, squash, a dust ring).

**Explicitly out of scope** (deferred): missions, story, NPCs, audio, power-ups, an adaptive
difficulty director, environment variation, a lighting overhaul, a demo camera, and a settings
menu. None of these were implemented.

## Player movement polish

All of the following are purely visual - none of them touch `currentX`, `jumpArc`, `JUMP_HEIGHT`,
`JUMP_DURATION`, `SLIDE_DURATION`, or `currentHeightScale` (the field `CollisionSystem` actually
reads for collision height), so collision timing and gameplay balance are unchanged.

- **Lane lean** (`MovementSystem.updateLaneLean`): a small (`LANE_LEAN_MAX_DEGREES`, 10°)
  rotation about the player group's Z axis, computed directly from the active lane transition's
  own progress (`Math.sin(Math.PI * t)`, zero at both ends, peak at the midpoint) rather than
  persistent state - so an interrupted lane change (a new one starting once the old one is ≥70%
  complete, per the existing rule) can never leave a residual tilt, and the lean snaps to exactly
  0 the instant the transition ends.
- **Jump anticipation, hang stretch, and landing squash** (`MovementSystem.updateSquashStretch`):
  a brief compress at takeoff (`JUMP_ANTICIPATION_DURATION` window of the jump's own, unchanged
  timer), a gentle stretch for the remaining hang time, and a sharper compress-and-recover after
  landing, driven by its own `landingEffect` timer (`JUMP_LANDING_SQUASH_DURATION`) independent of
  the jump timer - so it plays out entirely after the jump's gameplay-relevant Y-position curve
  has already finished. A buffered jump firing immediately on landing simply starts its own
  anticipation squash on top; nothing here can delay or gate input.
- **Slide anticipation**: the same squash-and-stretch value briefly compresses at slide start
  (`SLIDE_ANTICIPATION_DURATION`), on top of (never instead of) the existing, unchanged
  `currentHeightScale` damped transition that Sprint 1 already used for slide height easing.
- All targets funnel through one damped `lerp` pass (`SQUASH_STRETCH_SMOOTH_TIME`) into
  `player.squashStretch`, applied as `group.scale.y = currentHeightScale * squashStretch` and a
  volume-preserving inverse on `group.scale.x/z`. `CollisionSystem` never reads `group.scale` -
  only `player.currentHeightScale` - so squash-and-stretch cannot desync from or affect collision.

## Camera polish

- **Secondary follow lag** (`CameraSystem`): the existing, unchanged `CAMERA_FOLLOW_DAMPING` pass
  still computes `smoothedPosition` at the original responsiveness. A new, much lighter
  `CAMERA_FOLLOW_LAG` pass (`renderPosition` trailing `smoothedPosition`) smooths out any
  remaining per-frame stepping for a subtle "premium" trailing feel - not added input latency.
- **Shake blending**: the shake offset itself is blended through a matching `CAMERA_SHAKE_BLEND_TIME`
  pass before being added to `renderPosition` at the very last step, so shake still can never
  contaminate the follow-smoothing baseline, and now decays a little more smoothly too.
- **Landing impulse**: `CameraShake.trigger()` now accepts optional amplitude/duration overrides
  (defaulting to the existing, unchanged collision-hit values), reusing the exact same decay curve
  and reduced-motion handling for a smaller, distinct impulse on landing
  (`LANDING_IMPULSE_AMPLITUDE`/`LANDING_IMPULSE_DURATION`). If a genuine collision is *also*
  resolved the same frame, the landing impulse is skipped so it can never overwrite the larger
  collision shake that already fired.
- No camera rotation was added, and FOV changes are still only the existing, unchanged subtle
  speed-based boost from Sprint 1.

## Landing effects

Landing surfaces as a one-shot event (`Player.notifyLanded()` → `consumeLandingEvent()`), read by
`Game.processLandingEvent()` right after collision/pickup processing each `PLAYING` frame. A
landing triggers: the camera impulse above (unless suppressed by a same-frame collision), the
squash-and-stretch pose described above, and a small white dust ring at the player's feet via the
shared `PulseRingEffect`.

## Collect feedback polish

All changes are inside `Collectible.advance()`'s pickup branch - the scoring/reward logic in
`RewardSystem` is completely untouched:

- **Scale pop**: an ease-out-back curve (`easeOutBack`, new in `utils/math.ts`) instead of a flat
  linear grow, giving the token a slight overshoot before it fades away.
- **Glow pulse**: `Math.sin(Math.PI * t)` (rises then falls, a flash) instead of a monotonic decay
  from a fixed starting boost.
- **Spin acceleration**: the token's rotation keeps advancing during pickup at an accelerating
  rate (`TOKEN_PICKUP_SPIN_ACCEL`) on top of its normal idle rotation speed.
- **Ring pulse**: a gold ring via the shared `PulseRingEffect`, triggered from
  `Game.processPickups()` at the token's exact position at the moment of pickup.
- **Floating reward text**: the existing rise-and-fade animation already included a scale pop at
  15% (Sprint 2B); unchanged, and now shared with the Near Miss variant below.

## HUD polish

- **Score count-up** (`HUD.animateScoreTo()`): the *displayed* score eases toward the real score
  each frame (`SCORE_COUNT_SMOOTH_TIME`) instead of jumping instantly. The stored/submitted score
  (`ScoreSystem.getScore()`), used for Game Over and the best-score comparison, is completely
  unaffected - this only smooths what's shown. Reset paths (`resetRun()`) still call the original
  `updateScore()`, which snaps the displayed value immediately, so a new run never counts up from
  a stale previous total.
- **Token counter pulse**: a brief CSS scale-pop (`.hud-stat.token-pulse`) on the Tokens stat
  whenever `updateTokens()` sees the count increase, tracked via a `lastTokenCount` comparison
  reset alongside the rest of `resetRewardDisplay()` so a legitimate reset-to-zero never misfires
  a pulse.
- **Multiplier pop**: `#hud-multiplier-stat.multiplier-pulse` changed from a static `transform:
  scale()` to a proper CSS keyframe bounce (`multiplier-pop`) - the JS trigger logic
  (`showMultiplierIncrease()`) from Sprint 2B is completely unchanged, only the CSS it drives.
- **Integrity Meter fill**: already animated via a CSS `transition: width` added in Sprint 2A - no
  change was needed here; confirmed still smooth alongside the rest of the HUD polish.
- The HUD's structure/layout is unchanged - every change above is either a new CSS animation on
  an existing element or a value passed into an existing update method signature.

## Near Miss

A new, self-contained bonus: cleanly jumping over or sliding under an obstacle in the player's
current lane, without ever colliding with it, awards a fixed score bonus with no Integrity or
multiplier effect.

- **Detection** (`src/systems/NearMissSystem.ts`): stateless itself, all bookkeeping lives on
  `Obstacle`. An obstacle qualifies once it has never overlapped the player at all this activation
  (`!hasHitPlayer && !inContact` - excluding both a genuine hit and a graze blocked by
  invincibility, so only a genuinely clean dodge counts), shares the player's current lane, and
  has reached the player's fixed Z position (the player's Z never changes - only X/Y do). Matching
  by *lane* rather than continuous distance is a deliberate simplification: a same-lane `JUMP`
  obstacle can only be avoided by actually being airborne when it arrives, and a same-lane `SLIDE`
  obstacle only by actually sliding, so a same-lane pass with zero overlap is already strong
  evidence of a real dodge.
- **One-shot per obstacle**: `Obstacle.nearMissTriggered` is set the instant a Near Miss is
  detected and reset alongside `hasHitPlayer`/`inContact` in `activate()`/`reset()`, so a recycled
  obstacle always starts clean and can never award the bonus twice.
- **Reward**: `Game.processNearMisses()` calls `ScoreSystem.addPoints(NEAR_MISS_SCORE)` (50) and
  `FloatingRewardText.showNearMiss()` (a "Near Miss! +50" popup, reusing the existing floating
  reward pool with a distinct accent color) for each detected Near Miss. It never calls into
  `IntegritySystem` or `RewardSystem`, so a Near Miss can never affect Integrity, the collection
  streak, or the multiplier.

## Performance approach

- `PulseRingEffect` is a fixed pool of 4 ring meshes sharing one `RingGeometry` (built once,
  module-level); only per-instance `MeshBasicMaterial` color/opacity and mesh transform change at
  runtime. A trigger while all four are in use reuses the oldest slot round-robin - imperceptible
  given how short each pulse is - rather than growing the pool.
- `NearMissSystem.detect()` reuses one scratch array across calls (matching every other active-
  entity scan in the codebase) and iterates the same already-computed active-obstacle list
  `processCollisions()` already retrieves - no additional per-frame allocation or traversal cost.
- Lane lean and squash-and-stretch are simple scalar math applied directly to existing
  `group.rotation`/`group.scale` fields - no new meshes, materials, or geometry.
- The HUD score count-up and token pulse are lightweight per-frame arithmetic and CSS
  class/animation toggles respectively - no additional DOM nodes.
- `PulseRingEffect.update()` and `CameraShake.update()` both skip their decay work early once
  inactive, so idle pools cost nothing per frame beyond the array iteration.

## Accessibility

- `PulseRingEffect.trigger()` is a no-op entirely under `prefers-reduced-motion: reduce`
  (checked once at module load, matching `CameraShake`'s existing pattern) - no landing dust ring
  or token ring pulse plays.
- The landing camera impulse reuses `CameraShake`'s existing reduced-motion gate (it's the same
  `trigger()` method, just parameterized), so it's disabled under reduced motion exactly like the
  collision shake already was.
- Lane lean and squash-and-stretch are small-magnitude, non-jarring transforms; they are not
  separately gated by `prefers-reduced-motion` since they're comparable in scale to the existing,
  already-ungated run-cycle bob/limb-swing animation, and remain readable even when motion is
  reduced elsewhere.
- The new `multiplier-pop`/`token-pulse-pop` CSS keyframe animations are disabled under
  `prefers-reduced-motion: reduce` (the existing media-query block was extended), matching the
  pattern already used for the floating reward animation and the previous static multiplier-pulse
  transform.
- The Near Miss floating text reuses the same `aria-hidden` pooled DOM elements as token rewards -
  purely supplementary visual feedback for state already reflected in score.

## How to Play

Added one instruction row explaining the Near Miss bonus (clearing an obstacle in-lane by a hair
for a score bonus, no Integrity or multiplier risk), matching the style of the existing rows.

## Acceptance criteria

Verified via automated browser testing and code review:

- Existing Sprint 1 through 2B gameplay (movement, obstacles, collision, Integrity damage,
  invincibility, streak/multiplier, difficulty stages, Game Over, restart, mobile controls) is
  unchanged in substance.
- Lane changes show a smooth, symmetric lean that returns to neutral; jump shows a takeoff
  anticipation, hang-time stretch, and a landing squash; slide shows a brief anticipation - all
  without altering jump/slide timing or collision behavior.
- The camera never rotates and never changes FOV beyond the existing subtle speed-based boost;
  follow and shake both read as smoother without adding perceptible input lag.
- Collecting a token shows a scale-pop, a glow flash, a brief spin acceleration, and a ring pulse.
- The HUD score visibly counts up rather than jumping; the token stat pulses on pickup; the
  multiplier callout has a bouncier pop; the Integrity Meter fill remains smooth.
- A clean jump-over/slide-under in the player's lane shows a "Near Miss! +50" popup, adds exactly
  50 to score, and leaves Integrity, streak, and multiplier untouched; an obstacle actually hit
  never also awards a Near Miss.
- Landing shows a small camera impulse and dust ring, and does not overwrite a same-frame
  collision shake.
- Restart and Main Menu both fully clear the new visual/effect state (pulse rings, landing/squash
  timers, lean rotation) alongside everything from prior sprints; repeated Start/Restart/Main-Menu
  cycles produce no duplicate canvases, HUD roots, or floating reward containers, and no console
  errors.
- Mobile swipe controls (lane change, jump, slide) still work with the new visual polish layered
  on top.
- `npm run lint` and `npm run build` both pass.

## Known limitations

- The Near Miss lane-match heuristic (see above) is a lane-level check, not a continuous-
  position/distance measurement against the player's exact X - a good approximation of "cleanly
  dodged," not a literal narrowest-margin score.
- Squash-and-stretch, lane lean, and the pulse-ring effect are tuned by feel (small, conservative
  magnitudes) rather than against a formal animation curve library; further tuning may follow user
  feedback in a later sprint.
- No audio accompanies any of the new feedback (landing, pickup, Near Miss, multiplier pop) - see
  Scope above.
- Visuals remain grey-box placeholder geometry, consistent with the rest of the project.

## Deferred features

- Missions, story, NPCs, audio, power-ups, an adaptive difficulty director, environment variation,
  a lighting overhaul, a demo camera, and a settings menu (all explicitly out of scope for this
  sprint).
- A second collectible type, character selection, and any further difficulty tuning beyond the
  four Sprint 2A stages remain deferred from earlier sprints as well.
