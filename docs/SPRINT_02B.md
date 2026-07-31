# Sprint 2B: Collectibles and Reward Loop

**Status: complete.** Builds on the Sprint 2A / 0.2.1-alpha core gameplay loop without modifying
its locked values. Adds a positive reward loop on top of the existing obstacle/collision/Integrity
systems: collectible Integrity Tokens, a collection streak, a score multiplier, and Game Over
collectible statistics. Sprint 3A (`docs/SPRINT_03A.md`) is a pure feel/polish pass on top of this
sprint's collectible/reward systems - it does not modify their scoring or reward logic.

## Objective

Give the player a reason to weave actively through the lane pattern rather than only reacting to
obstacles: collect Integrity Tokens, build a streak, climb a score multiplier, and see that streak
punished (but not made fatal) by an obstacle hit - without redesigning or weakening player
movement, obstacles, collision, Integrity damage, invincibility, Game State, difficulty stages,
Game Over, restart behaviour, or mobile controls.

## Scope

**In scope:** one collectible type (Integrity Token), pooled spawning in five controlled patterns,
Box3-based pickup detection, a reward system (token count, streak, x1-x4 multiplier), score
integration, obstacle-hit streak reset, pickup/multiplier/streak-lost visual feedback, HUD
additions, Game Over collectible statistics, and full reset/Main-Menu integration.

**Explicitly out of scope** (deferred): missions, story choices, audio, external models/textures,
character selection, permanent upgrades, shops, currency purchases, cloud saving, achievements,
daily rewards, and multiple collectible currencies. None of these were implemented.

## Collectible architecture (`src/collectibles/`)

Five modules, mirroring the `src/obstacles/` split established in Sprint 2A:

- **`CollectibleType.ts`** - the `CollectibleTypeId` enum. One value this sprint
  (`INTEGRITY_TOKEN`), kept as an enum (not a literal) so a second collectible type is a
  config/factory addition later, not a refactor.
- **`Collectible.ts`** - one pooled token instance: its Three.js `group`, a local-space collision
  `Box3` (set once, **centre-relative**, since tokens float rather than sit on the floor - the
  inverse convention from `Obstacle`'s floor-relative origin), a reused world-space `Box3`, and
  `activate()` / `deactivate()` / `reset()` / `markCollected()` / `advance(deltaTime, speed)`.
  Materials are owned **per-instance** (not shared via a module cache like `ObstacleFactory`),
  because the pickup animation fades opacity and boosts emissive independently per token - sharing
  materials across the pool would make one token's pickup flash or fade every other active token
  at once.
- **`CollectibleFactory.ts`** - builds one token's geometry: a hexagonal Integrity-Blue body with
  gold hexagonal accent discs and a white pentagon "badge" symbol on both faces, echoing the
  player's shield-emblem motif. Builds fresh materials on every call (`createCollectible()`).
- **`CollectiblePool.ts`** - a fixed pool (`TOKEN_POOL_SIZE`, 18) built once at startup, mirroring
  `ObstaclePool` exactly (including a `Map`-per-type structure, kept for architectural parity even
  though only one type currently exists). `acquire()` returns `null` on exhaustion rather than
  growing the pool; `getActive()` reuses one scratch array.
- **`CollectibleSpawner.ts`** - timing and the five controlled spawn patterns (below). Every
  pattern validates lane clearance against active obstacles before placing anything, and skips
  cleanly (spawns nothing) if no safe placement exists - patterns are never forced into an unsafe
  position.
- **`CollectibleManager.ts`** - owns one pool and one spawner; `update(deltaTime, speed,
  elapsedActiveTime, activeObstacles)` advances every active token and deactivates any that finish
  their pickup animation or pass `COLLECTIBLE_DESPAWN_Z`. Like every other gameplay system, it is
  only ever called from `Game.tick` inside the `PLAYING` guard.

## Token design

A single collectible type, the **Integrity Token**: a small hexagonal blue-and-gold token that
idles with a gentle bob and a slow rotation, and animates a quick scale/rise/fade-out on pickup.
It does not restore Integrity - it exists purely for score and streak, keeping the Integrity Meter
and the reward loop as two independent systems (per the design constraint that tokens must not
weaken or replace Integrity/obstacle damage).

## Object pooling

`TOKEN_POOL_SIZE` = 18 instances, built once at startup, mirroring the Sprint 2A obstacle pool
pattern: no token mesh is ever created or destroyed during gameplay, `acquire()` finds an inactive
instance or returns `null`, and `getActive()` reuses one scratch array per call.

## Spawn patterns

`CollectibleSpawner` implements five named patterns, chosen and timed independently of obstacle
spawning:

| Pattern | Description |
| --- | --- |
| Straight Lane Line | 3-5 tokens in a single safe lane, evenly spaced, at standing height |
| Lane Transition Trail | A 4-token sequence across lanes (e.g. `0 -> 1 -> 2 -> 1`), encouraging a deliberate lane change |
| Jump Arc | 3-5 tokens in one lane, rising from standing height to a peak and back down, timed to a jump |
| Slide Trail | 3-4 tokens at slide height, preferring a lane currently occupied by a Security Barrier (SLIDE-behavior obstacle) so collecting the trail and clearing the barrier are the same action |
| Safe-Lane Reward | Detects a live two-lane obstacle pattern (two obstacles sharing the same Z in different lanes) and places a trail in the third, open lane, travelling alongside the obstacles at the same speed |

Interval randomization (`rollNextInterval`) draws uniformly from `[COLLECTIBLE_SPAWN_INTERVAL_MIN,
effectiveMax]`, where `effectiveMax` shrinks slightly per difficulty stage
(`COLLECTIBLE_MAX_INTERVAL_REDUCTION_PER_STAGE`), floored at the minimum, so tokens appear
somewhat more often at higher difficulty without ever spawning faster than the minimum interval.

## Pattern safety

Every pattern is checked against active obstacles before anything is placed:

- `isLaneClear()` rejects a lane if any active obstacle sits within
  `COLLECTIBLE_OBSTACLE_CLEARANCE` world units of the intended token Z.
- `isLaneClearAllowingBehavior()` is the same check with one `ObstacleBehavior` exempted, used only
  by the Slide Trail pattern so it can deliberately route through a Security Barrier (which the
  slide itself already clears) while still respecting JUMP-type obstacles in the same lane.
- If no lane satisfies the pattern's safety requirement, the spawner skips that attempt entirely -
  no pattern is ever forced into an obstacle's path.

## Introduction timing

A `COLLECTIBLE_GRACE_PERIOD` of 1.0s (independent of the obstacle grace period) delays the first
token spawn slightly past the run start, so the player's first frames are never spent scanning for
both systems' onboarding at once.

## Spawn interval

`COLLECTIBLE_SPAWN_INTERVAL_MIN` = 2.2s, `COLLECTIBLE_SPAWN_INTERVAL_MAX` = 3.8s (narrowed slightly
at later difficulty stages, see above).

## Collectible collision (`src/collision/CollectibleCollisionSystem.ts`)

A separate, simpler sibling to `CollisionSystem` (obstacles) - kept separate rather than merged, on
purpose, because pickup has none of the invincibility/`inContact` complexity a damaging collision
needs. `updatePlayerBounds(player)` computes one padded `Box3` from the player's real pose (the
same jump/slide-aware geometry `CollisionSystem` uses, widened slightly by
`TOKEN_PICKUP_PADDING` so pickup feels slightly more generous than obstacle collision).
`findPickups(collectibles)` returns every currently-overlapping active, uncollected token in one
pass (reused scratch array, no per-frame allocation) - a token is only ever picked up once, gated
by its own `collected` flag rather than a `hasHitPlayer`-style resolved flag.

## Pickup flow

On each token `Game.processPickups()` finds via `CollectibleCollisionSystem`:

1. Mark the token `collected` and start its pickup animation (`Collectible.markCollected()`).
2. `RewardSystem.collectToken()` increments total token count, increments the current streak,
   updates the multiplier from the **new** streak value, and returns the score reward computed at
   that new multiplier - so the token that crosses a streak threshold (5/10/20) is itself scored at
   the new, higher rate.
3. `ScoreSystem.addPoints(reward)` applies the reward to score.
4. `FloatingRewardText.show(reward)` shows a `+<amount>` popup.
5. If the multiplier increased, `UIManager.showMultiplierIncrease()` shows the multiplier-increase
   callout.

## Reward system (`src/rewards/RewardSystem.ts`)

A small, deliberately **polled** state holder (not an event emitter), following the same pattern
`IntegritySystem` already established: `Game.tick` reads its values and pushes them to the HUD
every `PLAYING` frame rather than the reward system pushing updates itself. Tracks `tokenCount`,
`currentStreak`, `bestStreak`, `multiplier`, and `maxMultiplierReached`. `registerObstacleHit()`
resets `currentStreak` and `multiplier` to their base values but never touches `tokenCount`,
`bestStreak`, or `maxMultiplierReached` - those are run statistics, not streak state.

## Multiplier thresholds

| Streak | Multiplier |
| --- | --- |
| 0-4 | x1 |
| 5-9 | x2 |
| 10-19 | x3 |
| 20+ | x4 (capped, does not increase further) |

`TOKEN_BASE_SCORE` = 25 points per token before the multiplier is applied.

## Scoring integration

`ScoreSystem.addPoints(amount)` is the only addition to the existing scoring system - it adds a
fixed amount directly to `score`, alongside the existing time-based `SCORE_PER_SECOND`
accumulation, which is unchanged. Token rewards and passive score accrual are simply two sources
adding to the same total.

## Obstacle-hit integration

`Game.processCollisions()` calls `RewardSystem.registerObstacleHit()` on every damaging collision
(the same call site that already applies Integrity damage and triggers collision feedback - no new
collision-detection path was added). If the lost streak was at least
`STREAK_LOST_DISPLAY_THRESHOLD` (5), `UIManager.showStreakLost()` displays the Streak Lost callout;
a short or zero streak resets silently, so the callout only fires when there was something
meaningful to lose.

## HUD changes

`src/ui/screens/HUD.ts` adds three compact stats (Tokens, Multiplier, Streak) next to the existing
score/distance/Integrity readouts, plus two transient callouts (multiplier increase, streak lost)
that reuse the same single-pending-timeout pattern `ScreenFlash` established in Sprint 2A. A new
pooled `FloatingRewardText` component (`src/rewards/FloatingRewardText.ts`, 6 reusable DOM
elements) shows a `+<amount>` popup near the player on every pickup, positioned in fixed
screen-space with a small random horizontal jitter rather than projecting the token's 3D position,
which keeps it a plain DOM component with no camera/Three.js coupling.

## Game Over statistics

The Game Over screen now also shows total tokens collected, best streak reached, and the maximum
multiplier reached during the run (`GameOverScreen.show()` extended with `#final-tokens`,
`#final-best-streak`, `#final-max-multiplier`).

## Reset requirements

`Game.resetRun()` (Start/Restart) additionally resets: the collectible pool (every token
deactivated and repositioned), the spawner (pattern timers cleared, next interval re-rolled), the
collectible collision system's player bounds, the full `RewardSystem` state (token count, streak,
best streak, multiplier, max multiplier), the floating reward text pool (all pending timers
cancelled, all elements hidden), and the HUD's reward display.

## Main Menu cleanup

`Game.goToMainMenu()` clears the collectible pool, resets the collectible collision system, clears
all floating reward text, and resets the HUD's reward display back to 0/x1/0 - but, matching the
existing pattern for `ScoreSystem` (Sprint 2A/2A-hotfix), does **not** reset `RewardSystem`'s raw
counters (token count, best streak, max multiplier). An abandoned run's numeric stats are simply
never surfaced again until the next Start/Restart runs the full `resetRun()`, so this cannot leak
stale numbers into a new run regardless.

## Performance approach

- All token geometry is built once per pooled instance at startup; only position, rotation, scale,
  opacity, and emissive intensity change at runtime - no per-frame mesh or material creation.
- Collision and movement math reuse persistent `Box3` instances (player bounds, each token's world
  bounds) exactly as `CollisionSystem` does for obstacles - no new geometry objects in the hot path.
- `CollectiblePool.getActive()` and `CollectibleCollisionSystem.findPickups()` both reuse a single
  scratch array across calls instead of allocating a new array every frame.
- The Safe-Lane Reward pattern's two-lane-match detection is O(n²) over active obstacles, but that
  set is always small (at most a handful of pooled obstacles at once), so this is trivially cheap
  and only runs when the spawner considers a new pattern, never every frame.

## Accessibility

- Token idle bob amplitude and the pickup animation's rise/scale delta are both reduced (to 25% of
  their normal magnitude) when `prefers-reduced-motion: reduce` is set, following the same
  detect-once-at-module-load pattern `CameraShake` already uses.
- The multiplier-increase and streak-lost callouts fade via opacity only (no transform) under
  reduced motion.
- HUD reward stats remain visible (not hidden) on small screens - only compacted in size and
  padding - since hiding gameplay-relevant stats would fail the "HUD remains readable on small
  screens" requirement.
- Floating reward text and both callouts are marked `aria-hidden`, since they are purely
  supplementary visual feedback for state already reflected in the HUD's persistent stats.

## Acceptance criteria

Verified via automated browser testing and code review:

- Existing Sprint 1 / Sprint 2A gameplay (movement, obstacles, collision, Integrity damage,
  invincibility, difficulty stages, Game Over, restart, mobile controls) is unchanged.
- Tokens spawn only after the collectible grace period, in patterns that never overlap an active
  obstacle's clearance zone.
- Collecting a token increments the HUD token count and streak, and the multiplier steps to x2,
  x3, and x4 at streaks of 5, 10, and 20 and never exceeds x4.
- A floating `+<amount>` reward popup appears on pickup and cleans up on its own.
- An obstacle hit resets the current streak and multiplier to x1 but leaves token count and best
  streak untouched; a streak of 5 or more lost triggers the Streak Lost callout.
- Game Over displays token count, best streak, and max multiplier alongside the existing stats.
- Restart and Main Menu both fully clear collectible/reward visual state; Restart additionally
  zeroes all reward statistics for the new run.
- Repeated Start/Restart/Main-Menu cycles produce no duplicate canvases, HUD roots, or floating
  reward containers, and no console errors.
- `npm run lint` and `npm run build` both pass.

## Known limitations

- Token pattern selection is randomized, so any single short playthrough may not exhibit every
  pattern; the underlying safety rules (obstacle clearance, behavior exemptions) are verified
  structurally and via testing rather than by exhaustively enumerating every random outcome.
- Only one collectible type exists this sprint (Integrity Token); the pool/factory/type structure
  is deliberately kept generic (a `Map`-per-type pool, an enum-based type id) so a second type is
  an additive change later, not a refactor - but no second type is implemented now.
- Tokens do not restore Integrity and have no effect on invincibility - they are purely a score/
  streak mechanic, by design.
- Visuals remain grey-box placeholder geometry, consistent with the rest of the project.
- No audio accompanies pickups or multiplier changes - see Scope above.

## Deferred features

- Missions, story choices, character selection, permanent upgrades, shops, currency purchases,
  cloud saving, achievements, daily rewards, and multiple collectible currencies (all explicitly
  out of scope for this sprint).
- Audio for pickups, streak loss, or multiplier changes.
- A second collectible type or currency.
- Any further difficulty tuning beyond the four Sprint 2A stages.
