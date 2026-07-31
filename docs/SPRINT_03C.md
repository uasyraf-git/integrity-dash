# Sprint 3C: Adaptive Experience and Demo Readiness

**Status: complete.** The first Alpha Demo milestone build. Builds on Sprint 3B's world/visual
polish without modifying it. Preserves every Sprint 1-3B gameplay mechanic, visual polish system,
and performance characteristic - player movement, obstacles, collision, Integrity, Near Miss, the
collectible/reward loop, Game State, difficulty stages, Game Over, restart behaviour, the five
environment themes, ambient animation, the Demo Camera, and visual quality presets are all
unchanged in substance.

## Objective

Make the game feel fair, responsive, and replayable ahead of external Alpha Demo playtesting:
a deterministic, rule-based Adaptive Difficulty Director that responds subtly to player
performance without ever feeling like it's "cheating"; local Run Analytics; an End Run Rating;
a documented balancing review; and a demo-readiness pass. No machine learning, no external
services, no personal data collection anywhere in this sprint.

## Scope

**In scope:** the Adaptive Difficulty Director and its fairness safeguards, Run Analytics, the
Game Over statistics panel, the End Run Rating, a balancing review, a demo-readiness pass, an
opt-in developer debug overlay, and a deterministic validation harness for the new calculation
logic.

**Explicitly out of scope** (deferred): Ethical Decision Gates, story mode, a mission system,
achievements, an online leaderboard, an account system, cloud save, external telemetry,
advertisements, monetisation, an audio overhaul, NPC characters, new power-ups, and a major UI
redesign. None of these were implemented.

## Adaptive Difficulty Director architecture

Three separated responsibilities, per the sprint's own engineering standards:

- **Configuration** (`src/config/adaptiveDifficultyConfig.ts`): every tunable value - the
  enable/disable flag, evaluation interval, cooldown, mode durations, modifier bounds, rating
  thresholds, hysteresis margin, and the authored Assistance/Challenge modifier sets. No magic
  numbers live inside the Director class itself.
- **The Director** (`src/systems/AdaptiveDifficultyDirector.ts`): a small state machine
  (`update(deltaTime, snapshot)` → `{evaluated, modeChanged, newMode}`) with zero Three.js/DOM
  dependency, so it's directly unit-validatable independent of rendering (see Automated
  validation, below).
- **Consumers** (`ObstacleSpawner`, `CollectibleSpawner`): both accept an optional
  `DirectorModifiers` parameter (default: neutral), consuming it through their own existing,
  unchanged code paths rather than the Director spawning or controlling anything directly.

The Director never receives a reference to the player, the scene, or any spawner - `Game.ts` is
the only place that reads its output (`getModifiers()`) and hands it to the spawners, keeping the
dependency graph one-directional and avoiding any circular dependency between systems.

## Performance inputs

`PerformanceSnapshot` (built fresh by `Game` every frame) carries: `integrityPercent`,
`currentMultiplier`, `bestMultiplier`, `currentStreak`, `bestStreak`, `tokensCollected`,
`nearMissCountSinceLastEvaluation`, `obstacleHitsSinceLastEvaluation`, `timeSinceLastHit`, and
`survivalDuration`. All are cheap, already-tracked values - no new measurement infrastructure was
needed. `computePerformanceScore()` actually weighs a focused subset of these (Integrity, current
streak, best multiplier, and the two *windowed* counters - not lifetime totals, so a single early
mistake doesn't permanently depress the rating for the rest of a long run); the remaining fields
(`currentMultiplier`, `bestStreak`, `tokensCollected`, `timeSinceLastHit`, `survivalDuration`) are
carried in the snapshot as **reserved inputs**, clearly documented as such on the
`PerformanceSnapshot` interface itself (`src/config/adaptiveDifficultyConfig.ts`), but are not
read by the score calculation this sprint - kept for a future tuning pass rather than force-fit
into the score just to use every metric (see `docs/HOTFIX_05_1.md`), avoiding "metrics that
cannot be measured reliably" turning into noise in the score.

## Performance rating

Four states - Struggling, Stable, Skilled, Excellent - computed from a bounded numeric score
(roughly `[-2.1, 1.8]`) via `RATING_THRESHOLDS` (`[0.3, 1.0, 1.5]`). **Never displayed during
normal gameplay** - only readable via `AdaptiveDifficultyDirector.getRating()`, used solely by the
opt-in debug overlay. Hysteresis (`RATING_HYSTERESIS_MARGIN`, 0.15) means the rating can only move
one step per evaluation, and only once the score clears the relevant boundary by that margin, not
merely touches it - this is what keeps transitions from flapping right at a threshold.

## Evaluation timing

- Evaluates every `EVALUATION_INTERVAL` = **18 seconds** of accumulated play time (within the
  suggested 15-20s range) - not every frame.
- `MODE_CHANGE_COOLDOWN` = **20 seconds**, measured from the moment a mode is *entered*, not from
  when it reverts - a new mode can only start once this has elapsed since the last one began.
- A new mode can only ever start from a neutral state (`DirectorMode.NONE`) - an active
  Assistance/Challenge window is never interrupted mid-flight by a new evaluation.
- Each mode auto-expires after its own fixed duration regardless of the evaluation cadence,
  checked every frame independent of the 18s evaluation timer.

With `ASSISTANCE_DURATION`/`CHALLENGE_DURATION` at 12s each (shorter than the 18s evaluation
interval), a mode always finishes before the *next* evaluation can even run - so in practice a
mode is never interrupted, and the cooldown (not the "can't interrupt" rule) is what actually
paces how often the difficulty can shift. Together these guarantee: no oscillation, no
back-to-back changes, and no possibility of a player noticing a rule-of-thumb "every N seconds
the game changes."

## Assistance rules

Entered when the rating is Struggling. `ASSISTANCE_MODIFIERS`:

| Modifier | Value | Effect |
| --- | --- | --- |
| `obstacleSpawnIntervalModifier` | 1.15 | ~15% longer obstacle spawn interval |
| `multiLanePatternWeightModifier` | 0.5 | Two-lane obstacle pattern chance roughly halved |
| `difficultObstacleWeightModifier` | 0.6 | Security Barrier's spawn weight reduced ~40% |
| `complexPatternWeightModifier` | 0.6 | Lane Transition / Slide Trail collectible pattern weight reduced ~40% |
| `collectibleSpawnModifier` | 1.2 | ~20% more frequent collectible patterns |

Lasts 12 seconds (within the suggested 10-15s range), then auto-reverts. Never restores
Integrity, never grants invincibility, never changes player speed - only spawn interval and
weight nudges, all still funneled through the spawners' unchanged safety checks.

## Challenge rules

Entered when the rating is Excellent. `CHALLENGE_MODIFIERS`:

| Modifier | Value | Effect |
| --- | --- | --- |
| `obstacleSpawnIntervalModifier` | 0.9 | ~10% shorter obstacle spawn interval |
| `multiLanePatternWeightModifier` | 1.25 | Two-lane obstacle pattern chance increased ~25% |
| `difficultObstacleWeightModifier` | 1.3 | Security Barrier's spawn weight increased ~30% |
| `complexPatternWeightModifier` | 1.3 | Lane Transition / Slide Trail collectible pattern weight increased ~30% |
| `collectibleSpawnModifier` | 0.9 | ~10% less frequent collectible patterns |

Stays within the existing `MAX_SPEED`/difficulty-stage caps entirely (the Director never touches
speed at all); never increases damage; never spawns a pattern the existing safety checks
wouldn't already allow on their own.

## Fairness safeguards

The Director has **no code path** that bypasses an existing safety check - this is a structural
guarantee, not a runtime re-validation step:

- `ObstacleSpawner`'s `MINIMUM_REACTION_TIME` floor (`Math.max(interval * modifier,
  MINIMUM_REACTION_TIME)`) is applied *after* the modifier, always.
- `getSafeLanes()`/`isLaneClear()` (both spawners) are completely untouched - a
  Director-influenced spawn attempt still only commits if a safe lane/pattern placement exists;
  an unsafe attempt is still skipped cleanly exactly as before.
- The two-lane pattern lane cap (never more than 2 of 3 lanes) and the same-type/same-lane
  repeat limits are untouched.
- `clampModifiers()` clamps every modifier to `[MINIMUM_MODIFIER, MAXIMUM_MODIFIER]` = `[0.5,
  1.5]` before it's ever handed to a spawner - defense in depth on top of the fact that the
  authored `ASSISTANCE_MODIFIERS`/`CHALLENGE_MODIFIERS` are already within that range.
- The Director never receives the player, camera, or collision system, so it structurally cannot
  touch player movement, physics, damage values, collision boxes, or invincibility rules.
- Mode changes are rare by construction (evaluation interval + cooldown + neutral-only entry -
  see Evaluation timing), so "every evaluation cycle" cannot trigger a change.
- Can be disabled entirely (`ADAPTIVE_DIFFICULTY_ENABLED = false`), at which point `update()`
  always returns early and `getModifiers()` always reports `NEUTRAL_MODIFIERS` - every consumer
  behaves exactly as it did before Sprint 3C.

## Modifier limits

`MINIMUM_MODIFIER = 0.5`, `MAXIMUM_MODIFIER = 1.5` - both `ASSISTANCE_MODIFIERS` and
`CHALLENGE_MODIFIERS` are authored comfortably within this range (the largest deviation from
neutral is the 0.5x pattern-weight reduction), so no modifier ever comes close to doubling or
halving anything gameplay-critical. `clampModifiers()` enforces the bound regardless.

## Run Analytics architecture

`src/systems/RunAnalytics.ts`, zero Three.js/DOM dependency, kept independent of the UI:

- **Tracked**: run duration (excluding paused time - only ever updated from inside the same
  `PLAYING && !demoCameraActive` gate every other gameplay system uses), jump/slide/lane-change
  counts (recorded the instant an input is actually forwarded to the movement system), obstacle
  hits, Near Misses, tokens missed (a token that despawned without ever being collected -
  `CollectibleManager.update()` now returns this count each frame), Director Assistance/Challenge
  activation counts, and a time-weighted running sum used to compute the average multiplier.
- **Composed at Game Over**: `getSummary(context)` combines its own counters with a few values
  other systems already track correctly (score, distance, tokens collected, best streak, best
  multiplier, Integrity remaining) into one immutable `RunSummary` - avoiding duplicate,
  potentially-drifting tracking of numbers that already have a canonical source.
- **Freeze, not just reset**: `freeze()` is called the instant Game Over triggers, before the
  summary is even built - every subsequent `record*`/`update` call becomes a no-op, so nothing
  that happens after Game Over (however unlikely) can corrupt the displayed summary.
- **Reset**: `reset()` zeroes every counter and un-freezes - called from both `resetRun()`
  (Start/Restart) and `goToMainMenu()`, satisfying "Restart resets all statistics" and "Main Menu
  resets all statistics" as two independent, explicit call sites.

## End Run Rating calculation

`src/systems/EndRunRating.ts` + `src/config/runRatingConfig.ts`. A pure function -
`calculateEndRunRating(summary)` always returns the same rating for the same `RunSummary`, with
no random component. Each input is normalized to `[0, 1]` against a reference maximum
(`RATING_REFERENCE_VALUES`), then combined into a weighted composite score:

| Input | Weight | Reference "full credit" value |
| --- | --- | --- |
| Integrity remaining | 0.25 | 100% |
| Survival duration | 0.15 | 120s |
| Score | 0.15 | 2500 |
| Obstacle hits (credit, inverted) | 0.15 | 0 hits/minute (full credit), 6 hits/minute (zero credit) |
| Best streak | 0.10 | 20 |
| Tokens collected | 0.10 | 25 |
| Average multiplier | 0.10 | x4 (x1 = zero credit) |
| Collection rate | 0.05 | 100% |
| Near Miss count | 0.05 | 8 |

Integrity and survival are weighted highest ("Integrity and safe play should contribute
significantly"); Near Miss is one of the two smallest weights ("should not overpower Integrity or
survival"); score is under a sixth of the total ("do not rate only by score" - satisfied
structurally, not just by convention, since score is literally one of nine roughly-comparable
weighted terms). Obstacle hits are normalized *per minute of survival*, not as a raw count, so a
longer run isn't punished just for lasting longer at the same skill level.

The composite score (`[0, 1]`) maps to 1-5 stars via `STAR_THRESHOLDS = [0.2, 0.4, 0.6, 0.8]`
(each independently configurable). Titles and feedback (`RATING_TIERS`) follow the suggested
theme (Integrity Champion / Ethics Leader / Compliance Explorer / Learning Professional / Needs
More Training) with feedback lines written to be encouraging at every tier, including 1 star -
"every run builds experience" rather than anything critical of the player.

## Game Over statistics panel

`GameOverScreen` adds the rating block (stars as literal `★`/`☆` text characters, never
colour-only) plus five new stat rows (Run Time, Near Misses, Obstacle Hits) alongside the
existing seven (Final Score, Distance, Best Score, Integrity Remaining, Tokens Collected, Best
Streak, Best Multiplier) - ten stats total in a 2-column grid (1-column on mobile), still
comfortably readable without feeling crowded. A brief staggered entrance animation
(`.stat-reveal`, CSS keyframe + a per-row `animation-delay` set in JS) plays once per Game Over,
skipped entirely under `prefers-reduced-motion` (checked once in JS, and mirrored in a CSS
`@media (prefers-reduced-motion: reduce)` override as defense in depth, matching the pattern
every other animated element in the project already uses). `.game-over-panel` also gained a
`max-height: 90vh; overflow-y: auto;` safety net so the extra content can never overflow a short
mobile viewport.

## Balancing changes

A systematic review against the suggested principle (0-30s introduction, 30-60s moderate
challenge, 60-90s skilled play required, 90s+ high-but-fair) found the **existing Sprint 2A
`DIFFICULTY_STAGES` curve already matches it closely**: Stage 1 (0-30s, speed 10, no two-lane
patterns) is exactly the introduction window; Stage 2 (30-60s, speed 11, two-lane patterns
enabled) is the moderate-challenge window; Stage 3 (60-90s, speed 12) is the skilled-play window;
Stage 4 (90s+, speed 13, capped) is the high-but-fair endgame. **No base gameplay values were
changed this sprint** - `OBSTACLE_DAMAGE` (10), `INVINCIBILITY_DURATION` (1.0s),
`TOKEN_BASE_SCORE` (25), the x1→x2→x3→x4 multiplier streak thresholds (0/5/10/20),
`NEAR_MISS_SCORE` (50), obstacle spawn weights, and token pattern frequency all remain exactly as
tuned across Sprints 1-3B. This was a deliberate choice, not an oversight: those values have
already been through five sprints of design and QA, "do not make large arbitrary changes" was an
explicit instruction, and the Director's bounded, temporary modifiers are the mechanism Sprint 3C
adds specifically to fine-tune the experience *per player* without needing to re-tune the shared
base curve. A comparison worth noting: Near Miss (50) sits between a base token (25) and a
maximum x4 token (100) - rewarding skilled dodging without ever trivially dominating over
consistent token collection, which was already the case before this review and needed no change.

## Demo readiness pass

Verified (see `docs/ALPHA_DEMO_QA.md` for the full checklist): title and version visible on the
Main Menu; How to Play is comprehensive and unchanged in structure; Play/Pause/Restart/Main Menu
all work reliably including through the new systems' resets; `F9` Demo Camera still works
unmodified; mobile controls remain functional; repeated restarts do not corrupt Run
Analytics/Director state (each reset independently verified); Game Over statistics stay correct
across multiple consecutive runs (no stale/cumulative carryover); the debug overlay is invisible
by default and only ever appears with an explicit `?debug=1`; a full-project text search found no
leftover `TODO`/`FIXME`/placeholder/`console.log` debug code; console stayed error-free across
every QA run performed.

## Configuration and debug support

All Sprint 3C tuning lives in `src/config/adaptiveDifficultyConfig.ts` (Director) and
`src/config/runRatingConfig.ts` (rating) - no magic numbers in the calculation logic itself. The
opt-in debug overlay (`src/ui/DebugOverlay.ts`, `?debug=1` only) shows the Director's live mode/
rating/modifiers/evaluation countdown and a Run Analytics summary via a single `textContent`
write per frame - disabled by default, never created without the query parameter, and produces no
console output at all.

## Automated / deterministic validation

The project doesn't use a test framework, and this sprint's own guidance was not to add one
solely for it. Since the Director/Analytics/Rating modules have zero Three.js/DOM dependency,
`npm run validate` compiles just those files to CommonJS (`tsconfig.validate.json` →
`.validate-build/`, gitignored) and runs `scripts/validate.mjs` - a small, dependency-free
assertion harness. Scenarios covered (38 checks, all passing):

- Performance rating: struggling vs. excellent snapshots score differently; hysteresis holds a
  rating in place at a boundary and requires clearing it by the margin to move; a rating can only
  move one step per call even given an extreme score swing.
- Director state transitions: does not evaluate before `EVALUATION_INTERVAL`; enters Assistance
  Mode for a struggling snapshot; reports Assistance modifiers while active; does not re-evaluate
  on a small step; does not interrupt an active mode; auto-reverts after its own duration without
  needing an evaluation; cooldown (measured from mode entry) blocks a new mode right after
  reverting; a new mode becomes reachable again once the cooldown fully elapses.
- A disabled Director never evaluates and always reports neutral modifiers.
- `clampModifiers()` clamps out-of-range values in both directions and leaves in-range values
  untouched; the authored Assistance modifiers are confirmed already within bounds.
- `RunAnalytics`: records every tracked metric; `freeze()` stops further recording; `reset()`
  zeroes every counter and re-enables recording.
- The time-weighted average multiplier is verified against a hand-computed expected value, plus
  the zero-duration/no-division-by-zero default case.
- `EndRunRating`: the same summary always produces the same rating (determinism); a mid-score,
  high-integrity run is not automatically 1 star (not rated by score alone); a near-perfect run
  reaches the 5-star boundary; a very short, damaging run reaches the 1-star boundary; even the
  1-star feedback line is non-empty and encouraging; the Director's internal rating/mode is never
  part of the rating output.

## Known limitations

- The Director's rating weights and thresholds are a first, conservative tuning pass, not the
  product of large-scale playtesting data - fully centralised and documented specifically so
  they're easy to revisit after Alpha Demo feedback.
- "Tokens missed" counts tokens that despawned uncollected - a reliable, directly-measurable
  signal, but it doesn't distinguish "chose not to detour" from "never had a realistic chance."
- The End Run Rating's reference values (what counts as "full credit" for score, survival time,
  etc.) are deliberately generous placeholders, not tuned to a specific skill ceiling.
- The debug overlay is a plain text panel, not a full inspector - sufficient for verifying
  Director/Analytics behaviour during QA, not intended as a general debugging tool.
- No audio, NPCs, missions, story, ethical decision gates, achievements, leaderboard, account
  system, cloud save, or settings menu - see Scope above.
