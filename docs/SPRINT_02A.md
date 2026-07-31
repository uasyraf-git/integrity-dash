# Sprint 2A: Core Gameplay

**Status: complete, including the 0.2.1-alpha QA hotfix documented at the end of this file.**
Builds on the Sprint 1 / 1.1 foundation without modifying its locked movement values. Adds the
first real gameplay loop: obstacles, collision, a dynamic Integrity Meter, and a real Game Over
condition. Sprint 2B (`docs/SPRINT_02B.md`) builds the collectible/reward loop on top of this
sprint's obstacle and collision systems without modifying them.

## Objective

Transform the Sprint 1 playable foundation into a real endless-runner gameplay loop: procedural
obstacles, controlled spawning, Box3 collision detection, a dynamic Integrity Meter with
temporary invincibility, collision feedback, difficulty progression, and a real Game Over
condition - without redesigning the existing architecture, player, or Corporate HQ environment.

## Scope

**In scope:** obstacle framework/factory/pool/spawner/manager, collision detection, the Integrity
System, invincibility, collision feedback (screen flash, camera shake, player hit tint), four
difficulty stages, and a real Game Over condition.

**Explicitly out of scope** (deferred to Sprint 2B or later): collectibles, coins, Integrity
badges as collectibles, combo scoring, score multipliers, missions, story events, audio, external
models/textures, character selection, authentication, cloud saves, an online leaderboard, a
backend, analytics, advertisements, monetization, multiplayer, advanced procedural generation,
boss sequences, and new game worlds. None of these were implemented.

## Locked foundation values (unchanged)

Lane positions (-3/0/3), centre-lane start, initial speed (10 units/second), lane transition
duration (~0.18s), jump duration (~0.75s), slide duration (~0.65s), and the Integrity range
(0-100, starting at 100) all carry over from Sprint 1/1.1 unchanged.

## Obstacle types

Five procedural, Three.js-only obstacles, each visually distinguishable from lane markings,
pillars, and the player:

| Type | Behavior | Visual direction |
| --- | --- | --- |
| Filing Cabinet | JUMP | Tall grey-blue cabinet with drawer seams and gold handles |
| Stacked Archive Boxes | JUMP | 3 slightly offset cardboard-toned boxes with label panels |
| Security Barrier | SLIDE | Two posts + a horizontal gold-striped bar, with a floor-level gap |
| Wet Floor Cone | JUMP | Low gold warning cone with a dark stripe band |
| Broken Office Printer | JUMP | Navy body with an askew grey paper tray and a blue panel accent |

Every obstacle has a unique type identifier, lane index, active/inactive state, a Three.js
`Group` root, a reusable local + world collision `Box3`, and `activate()` / `deactivate()` /
`reset()` / `advance(deltaTime, speed)` methods (`src/obstacles/Obstacle.ts`).

## Object pooling

A fixed pool of 4 pre-built instances per type (`OBSTACLE_POOL_SIZE_PER_TYPE`) is constructed
once at startup (`ObstaclePool`). No obstacle mesh is ever created or destroyed during gameplay -
`acquire()` finds an inactive instance or returns `null` (the spawner just skips that attempt
rather than growing the pool). `getActive()` reuses one scratch array across calls to avoid
per-frame allocation.

## Spawning rules

- 2.5s initial grace period before the first obstacle can spawn (`OBSTACLE_GRACE_PERIOD`).
- Spawn interval is the current difficulty stage's interval, floored by a minimum-reaction-time
  safety check: `effectiveInterval = max(stage.spawnInterval, MINIMUM_REACTION_TIME)`
  (`MINIMUM_REACTION_TIME` = 0.9s). Every configured stage interval (2.0s → 1.4s) already exceeds
  this floor at every stage speed (10-13 units/second), so the floor is a defensive guarantee, not
  presently an active constraint.
- Obstacle type is chosen by weighted random selection against `OBSTACLE_CONFIGS[*].spawnWeight`
  (Filing Cabinet 25, Archive Boxes 25, Wet Floor Cone 20, Broken Printer 20, Security Barrier
  10), with a gentle reroll if the same type would repeat a third time in a row.
- Two-lane patterns are only used on stages where `twoLanePatternsAllowed` is true, only ever pick
  two of the three lanes (a three-lane wall is structurally impossible - the spawner never
  generates a third simultaneous lane), and are restricted to `JUMP`-behavior obstacles only, so a
  `SLIDE` obstacle can never land at the same reaction point as a simultaneous `JUMP` obstacle.
- Because every obstacle spawns at the same fixed `OBSTACLE_SPAWN_Z` and spawn events are spaced
  by at least the effective interval, a new obstacle can never appear on top of a still-nearby
  one - by the time the next spawn event fires, the previous obstacle(s) have already traveled
  `speed * interval` (≥18 units at every stage) away from the spawn point.

## Collision rules

Lightweight axis-aligned bounding boxes (`THREE.Box3`), no physics engine, no per-frame
raycasting. The player's box is rebuilt every frame from actual pose:

- `minY` = the player's current world Y (jump already elevates this).
- `maxY` = `minY + STANDING_HEIGHT * currentHeightScale` (slide already shrinks this).

This means clearance is real overlap math, not a check against `jumpState.active` /
`slideState.active`: a jump obstacle is only cleared once the player's box has actually risen
above its `collisionMaxY`, and the Security Barrier's box only has a gap (`collisionMinY` = 0.9)
low enough for the player's slide-height box (~0.8) to fit under - standing height (1.8) does not
fit and still collides, and jumping into the barrier still collides if the geometry overlaps.
Each obstacle's `hasHitPlayer` flag is set the instant a collision is found (whether or not damage
is actually applied), which is what stops one obstacle from ever damaging the player twice in a
single pass; it's cleared again by `activate()` when the obstacle is recycled for a later pass.

## Integrity System

`src/integrity/IntegritySystem.ts` exposes `reset()`, `damage(amount)`, `heal(amount)`,
`getValue()`, `getPercentage()`, `isDepleted()`, `isInvincible()`, `startInvincibility(duration)`,
and `update(deltaTime)`. Starting/maximum Integrity is 100, standard obstacle damage is 10,
invincibility duration is 1.0s. Damage is a no-op while invincible or already depleted, is always
clamped to `[0, 100]`, and can only trigger Game Over once per run (the depleted flag is cleared
by `reset()`). `heal()` is implemented and reserved for future systems but has no gameplay source
this sprint (no healing collectibles).

## Invincibility

Started via `startInvincibility(INVINCIBILITY_DURATION)` on a valid hit; counted down by
`update(deltaTime)`, which is only ever called while `PLAYING` (so pausing freezes the countdown,
consistent with every other gameplay timer). While invincible, further `damage()` calls are
ignored, and the player rig shows a gentle emissive shimmer (distinct from the sharper one-shot
hit-tint pulse) so invincibility is visually readable without being distracting.

## Difficulty stages

| Stage | Time | Speed | Spawn interval | Two-lane patterns |
| --- | --- | --- | --- | --- |
| 1 | 0-30s | 10 | ~2.0s | No |
| 2 | 30-60s | 11 | ~1.8s | Yes |
| 3 | 60-90s | 12 | ~1.6s | Yes |
| 4 | 90s+ | 13 | ~1.4s | Yes |

Elapsed time only counts while `PLAYING` (paused and Game Over time are excluded), so speed and
spawn cadence step discretely rather than on a continuous curve. Restarting always resets elapsed
time to 0, which re-enters Stage 1 immediately. Speed does not exceed 13 this sprint.

## Reset requirements

`Game.resetRun()` resets, in one place: elapsed play time, current speed, player transform/lane/
jump/slide/hit-feedback/invincibility state, environment segment positions, the obstacle pool
(every obstacle deactivated and repositioned) and spawner (timers and type/lane history cleared),
collision system's player bounds, the Integrity System (value, invincibility, depleted flag), the
screen flash overlay and its pending timer, camera shake, score/distance, and every HUD value.
`GameLoop`, `InputManager`, and the WebGL canvas are constructed exactly once in `Game`'s
constructor and are never recreated by Restart/Main Menu, so repeated restarts cannot duplicate
loops, listeners, canvases, or overlays - verified with an automated multi-cycle restart test (see
Acceptance criteria).

## Performance approach

- All obstacle geometry and materials are built once; only positions and visibility change at
  runtime (no per-frame mesh creation, matching the existing `CorporateHQ` pattern).
- Collision math reuses persistent `Box3`/`Vector3` instances (player bounds, each obstacle's
  world bounds) - no new geometry objects are allocated in the per-frame hot path.
- `ObstaclePool.getActive()` reuses one scratch array across calls instead of allocating a new
  array every frame.
- No post-processing, no additional dynamic lights, and no shadow-casting was added beyond what
  Sprint 1 already used; obstacles reuse a small set of shared materials rather than one material
  per mesh.

## Acceptance criteria

All 44 Sprint 2A acceptance criteria from the brief were verified, including (see the final
delivery report for full validation results):

- Existing Sprint 1 controls, lane clamping, jump/slide, camera follow, pause/resume, and mobile
  swipe controls still work unchanged.
- Obstacles begin only after the grace period; all five types were observed in a live run.
- A real collision was observed reducing Integrity from 100% to exactly 90% (one 10%-damage hit),
  with the player's hit-tint visibly triggered and no further damage during the following
  invincibility window.
- The `G` shortcut only works while `PLAYING`, routes through the real damage path, and the
  resulting Game Over screen correctly displayed final score, distance, best score, and Integrity
  (0%).
- Restart was verified (via automated browser testing) to reset Integrity to 100%, clear the HUD
  back to a fresh run, and leave the world clear of obstacles through a new grace period.
- A multi-cycle restart/Game-Over/Main-Menu loop produced exactly one canvas, one `#hud`, and one
  `#screen-flash` element throughout, with zero console errors.
- `npm run lint` and `npm run build` both pass.

## Known limitations

- Obstacle type/lane selection is randomized, so any single short playthrough may not encounter
  every obstacle type or every avoidance case; the underlying rules (weights, safety spacing,
  behavior-based collision) are verified structurally and via the tests above rather than by
  exhaustively enumerating every random outcome.
- Difficulty is capped at Stage 4 (13 units/second); it does not continue climbing past 90s.
- No collectibles, combos, missions, or audio - see Scope above.
- Only a single generic placeholder character exists; the Master Design Document's two-character
  system remains deferred (see `docs/SPRINT_01.md`).
- The `G` key remains a temporary developer test shortcut, not a permanent feature.
- Visuals remain grey-box placeholder geometry.

## Deferred Sprint 2B features

- Collectibles (Integrity Badges, Evidence Files) and their Integrity/score effects.
- Combo and score-multiplier systems.
- Missions.
- The Master Design Document's two-character system and Character Selection screen.
- Audio.
- Any further difficulty tuning beyond the four Sprint 2A stages.

**Update:** Sprint 2B (0.3.0-alpha) implemented the collectible/streak/multiplier item above (one
collectible type, the Integrity Token) on top of this sprint's obstacle and collision systems
without modifying them. Missions, the two-character system, audio, and further difficulty tuning
remain deferred. See `docs/SPRINT_02B.md`.

---

## QA Hotfix (0.2.1-alpha)

A small, targeted fix on top of Sprint 2A - five confirmed issues, no new gameplay.

### 1. Invincibility collision handling

`Game.processCollisions()` previously set `Obstacle.hasHitPlayer = true` before checking
invincibility, so an obstacle merely grazed while invincible became permanently harmless for
that activation - it could never damage the player again even after invincibility ended, which
is not physically reasonable if the player is still in contact with it.

Fixed by moving the invincibility check into `CollisionSystem.findCollision(obstacles,
isInvincible)` itself: it now returns an obstacle only when a hit should actually apply damage
(i.e. never while invincible), and `Game.processCollisions()` only marks `hasHitPlayer` on
obstacles it actually receives back. A new `Obstacle.inContact` flag tracks whether the player is
currently overlapping the obstacle at all (set true on overlap, cleared the moment overlap ends),
giving the collision system real contact-state to reason about instead of a timer. Net effect: an
obstacle grazed during invincibility applies no damage and is not marked resolved; if the player
is still overlapping it once invincibility expires, it becomes damaging again on the very next
frame; a genuine damaging hit still marks the obstacle resolved for that activation exactly as
before; and both `hasHitPlayer` and `inContact` are cleared in `activate()`/`reset()`, so a
recycled obstacle always starts with clean collision state.

### 2. Obstacle type repeat limit

`ObstacleSpawner.pickType()` previously rerolled against the same full weighted candidate list on
hitting the streak limit, so the reroll could still land on the same type by chance. It now
excludes the streak-limited type from the candidate pool outright (falling back to the full pool
only if that would leave zero candidates, e.g. a behavior-restricted two-lane pick with only one
eligible type), so no type can appear more than `MAX_SAME_TYPE_STREAK` (2) times in a row.
Weighted randomness is preserved among whatever candidates remain.

### 3. Lane repeat avoidance

`ObstacleSpawner.pickLaneFrom()` (previously `pickLane()`) replaces the old "reroll and hope"
logic with a direct selection from the candidate lanes with the lane to avoid filtered out first,
falling back to the full candidate set only if that exclusion would leave nothing. No retry loop.

### 4. Spawn safety validation

The spawner now checks active obstacle positions before committing to a spawn:
`getSafeLanes()` marks a lane unsafe if any active obstacle in that lane is within
`currentSpeed × MINIMUM_REACTION_TIME` world units of `OBSTACLE_SPAWN_Z` (plus an additional
`TWO_LANE_SPACING_BUFFER` for lanes touched by the immediately preceding two-lane pattern). A
two-lane pattern is only attempted when at least two lanes are safe; a single-lane spawn falls
back to whatever safe lane is available; if none are safe, the attempt is skipped cleanly. This
check iterates the pool's already-reused active-obstacle array (no per-frame or per-attempt large
allocation - just a small, bounded array of at most 3 lane indices per spawn attempt, and spawn
attempts only happen once per effective interval, never every frame). The four difficulty stages
are unchanged.

### 5. Main Menu cleanup

`Game.goToMainMenu()` previously only transitioned game state - gameplay simulation stopped
correctly (Sprint 2A's existing state-gating already handled that), but the previous run's
active obstacles, screen flash, camera shake, and player pose/tint remained exactly as they were,
which could still be visible in the 3D backdrop behind the Main Menu panel. It now also resets
the environment, obstacle pool, collision system, screen flash, and camera shake, and resets the
player (which restores the centre lane and clears hit/invincibility visuals) - explicitly without
touching score or best score, since an abandoned run should not be recorded. `startGame()` /
`restartGame()` still go through the complete, unchanged `resetRun()` flow.

### Verification

Verified via automated browser testing (and code review for the now-deterministic repeat-limit
logic): a normal collision still applies exactly 10% damage and ~1s invincibility; repeated
Start/Restart/Main-Menu cycles produce exactly one canvas, one `#hud`, and one `#screen-flash`
with zero console errors; returning to the Main Menu mid-run visibly clears obstacles and resets
the player to the centre lane; and a subsequent fresh Start still begins at Integrity 100% and
score 0.
