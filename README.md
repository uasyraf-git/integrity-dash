# Integrity Dash

**Run Fast. Choose Right.**

A browser-based 3D endless runner set inside a fictional corporate headquarters. The player
dashes through modular office environments across three lanes, jumping and sliding past the
architecture while an Integrity Meter tracks their standing. Integrity Dash is built as a real
arcade game first — the ethics theme comes through the setting and the Integrity Meter, not
through slides or quizzes.

This is a fictional production: no real company name, logo, or branding appears anywhere in the
game. The visual identity is an original blue-and-gold shield emblem on a dark navy backdrop.

## Current version

`0.5.1-alpha-demo`

## Current sprint status

**Sprint 1: Playable Foundation — complete. Sprint 1.1: QA Alignment — complete.
Sprint 2A: Core Gameplay — complete. Sprint 2A QA Hotfix (0.2.1-alpha) — complete.
Sprint 2B: Collectibles and Reward Loop — complete. Sprint 3A: Game Feel and Polish —
complete. Sprint 3B: World and Visual Polish — complete. Sprint 3C: Adaptive Experience
and Demo Readiness — complete. Hotfix v0.5.1: Alpha Demo Stabilisation — complete.** This
is the final stabilisation pass before external Alpha Demo playtesting.

Sprint 1 delivered the technical foundation (lane movement, jump, slide, the recycled Corporate
HQ environment, and the full menu/HUD/pause/game-over UI flow). Sprint 1.1 was a QA and alignment
patch with no new gameplay. Sprint 2A added the first real gameplay loop: five pooled procedural
obstacle types, controlled spawning with a difficulty curve, Box3 collision detection, a dynamic
Integrity Meter with temporary invincibility, collision feedback, and a real Game Over condition.
The 0.2.1-alpha hotfix corrected five confirmed Sprint 2A issues. Sprint 2B added a positive
reward loop: a pooled Integrity Token collectible in five controlled patterns, a collection
streak, a x1–x4 score multiplier, and Game Over collectible statistics. Sprint 3A was a pure
game-feel and polish pass (lane lean, jump/landing squash-and-stretch, camera polish, richer
token feedback, HUD animation, and the Near Miss bonus) with no new gameplay mechanics. Sprint 3B
was a pure world/visual polish pass: a five-theme environment system (Reception, Open Office,
Meeting Room, Pantry, Server Room), twelve reusable decorative props, ambient animation, surface
polish, a background depth layer, a developer-only Demo Camera (`F9`), and Low/Medium/High visual
quality presets. Sprint 3C added a deterministic, rule-based Adaptive Difficulty Director, a
local Run Analytics system, an End Run Rating, and a final balancing/demo-readiness pass. **The
v0.5.1 hotfix fixed five confirmed Sprint 3A-3C issues** (player action analytics only counting
accepted actions, a single consolidated Demo Camera exit path, Adaptive Difficulty and Near Miss
documentation accuracy, and a full restart-lifecycle review) with no new gameplay mechanics, UI
redesign, or rebalancing. See [Known limitations](#known-limitations),
[`docs/HOTFIX_05_1.md`](docs/HOTFIX_05_1.md), [`docs/SPRINT_03C.md`](docs/SPRINT_03C.md),
[`docs/ALPHA_DEMO_QA.md`](docs/ALPHA_DEMO_QA.md), [`docs/SPRINT_03B.md`](docs/SPRINT_03B.md),
[`docs/SPRINT_03A.md`](docs/SPRINT_03A.md), [`docs/SPRINT_02B.md`](docs/SPRINT_02B.md),
[`docs/SPRINT_02A.md`](docs/SPRINT_02A.md), and [`docs/SPRINT_01.md`](docs/SPRINT_01.md).

The Adaptive Difficulty Director is a small, deterministic rule engine - not machine learning -
that observes a handful of reliably-measurable performance signals every ~18 seconds and, only
when clearly warranted, applies small, temporary, bounded modifiers to the existing obstacle and
collectible spawners (spawn interval, pattern weighting) for 10-15 seconds. It never touches the
player, physics, damage values, collision boxes, or invincibility, and every modifier still flows
through the spawners' existing safety checks - it can only make an already-safe spawn plan
slightly easier or slightly busier, never unfair. It can be disabled entirely via configuration.

Missions, story choices, audio, power-ups, character selection, shops/currency purchases, cloud
saving, achievements, daily rewards, ethical decision gates, NPC characters, new obstacle
mechanics, new power-ups, an online leaderboard, an account system, and a full settings menu
remain **out of scope** and are not implemented (see Known limitations).

## Technology stack

- [Vite](https://vitejs.dev/) — build tooling and dev server
- [TypeScript](https://www.typescriptlang.org/) (strict mode)
- [Three.js](https://threejs.org/) — 3D rendering, programmatic grey-box geometry only
- Plain HTML/CSS for UI screens (no UI framework)
- ESLint (flat config) + Prettier

No backend, database, authentication, leaderboard service, external 3D models/textures, or
copyrighted audio are used. All geometry is generated in code.

## Features implemented

- **Adaptive Difficulty Director**: a deterministic, rule-based system (no machine learning) that
  evaluates a bounded Performance Rating (Struggling/Stable/Skilled/Excellent, never shown to the
  player) roughly every 18 seconds and, with a 20-second cooldown between changes, may enter a
  10-15 second Assistance or Challenge window - small, clamped modifiers to obstacle spawn
  interval and obstacle/collectible pattern weighting, always still validated by the existing
  spawn-safety rules. Never touches player movement, damage, invincibility, or speed caps.
  Configurable, and can be disabled entirely.
- **Run Analytics**: tracks run duration (excluding paused time), jumps, slides, lane changes,
  obstacle hits, Near Misses, missed tokens, and a time-weighted average multiplier for the
  current run only - frozen the instant Game Over triggers, reset on every Restart/Main Menu, no
  network transmission or personal data.
- **End Run Rating**: a deterministic 1-5 star rating with a title and short, encouraging feedback
  line, computed from a weighted combination of score, survival time, Integrity remaining, best
  streak, tokens, collection rate, Near Misses, and average multiplier - never from score alone.
- Three-lane running with smooth eased lane transitions and a subtle body lean into each lane
  change (purely visual - lane timing and collision are unchanged)
- Jump and slide with input buffering and clean state handling (no conflicting states), plus a
  cosmetic squash-and-stretch pass (anticipation, hang-time stretch, landing squash, slide
  anticipation) layered on top without altering jump/slide timing or collision height
- Procedural running animation (arm/leg swing, body bob) that pauses with the game
- Smooth, stable third-person camera follow with a light secondary smoothing stage for a subtle
  trailing feel, plus a brief camera shake on collision and a smaller, distinct impulse on
  landing (no aggressive FOV swings, no camera rotation, reduced/disabled under
  `prefers-reduced-motion`)
- Landing dust ring and token-pickup ring pulse (shared, pooled Three.js effect)
- **Near Miss bonus**: cleanly jumping over or sliding under an obstacle in your lane (without
  ever colliding with it) awards +50 score, with a "Near Miss! +50" popup - no Integrity or
  multiplier effect
- Recycled, procedurally-built Corporate HQ environment (pillars, glass panels, ceiling beams,
  gold accents, lane markings, fog for depth) — a fixed pool of segments is repositioned, never
  recreated
- **Five environment themes** (Reception, Open Office, Meeting Room, Pantry, Server Room) that
  rotate through recognizable, decorated zones spanning several recycled segments at a time -
  track width, lane positions, and every collision rule are completely unaffected
- **Twelve reusable low-poly decorative props** (desks, chairs, monitors, plants, filing
  cabinets, a meeting table, a coffee machine, a pantry counter, server racks, a digital
  signboard, wall panels) placed well outside the play lanes, built once at startup and never
  created or destroyed during gameplay
- Subtle ambient world animation (monitor flicker, server rack blink, signboard/coffee-machine
  pulse, plant sway) driven by one centralised update loop, paused with the game
- Floor-seam and wall-trim surface polish, plus a lightweight background depth layer beyond the
  glass walls so the world no longer feels like it ends abruptly
- **Demo Camera (`F9`, developer/showcase only)**: a slow cinematic orbit around the player for
  screenshots or trailer capture; freezes gameplay while active and restores the exact normal
  camera on exit
- Internal Low/Medium/High visual quality presets (decorative prop density, ambient animation,
  shadows, background depth, pixel-ratio cap) resolved automatically from device signals, with a
  `?quality=` override for testing - purely visual, never affects gameplay
- **Five pooled procedural obstacle types** (Filing Cabinet, Stacked Archive Boxes, Security
  Barrier, Wet Floor Cone, Broken Office Printer) with controlled, weighted spawning, a grace
  period, and a four-stage difficulty curve (speed 10 → 13, spawn interval 2.0s → 1.4s)
- **Box3-based collision detection** driven by the player's real pose (jump height, slide
  height), not state flags — jump clears floor obstacles, slide clears the Security Barrier
- **Dynamic Integrity Meter**: starts at 100%, loses 10% per valid hit, grants ~1s of
  invincibility per hit, and triggers a real Game Over at 0%
- Collision feedback: a brief red screen flash, subtle camera shake, and a player hit-tint pulse
  (with a gentle shimmer while invincible)
- **Integrity Token collectibles**: a pooled hexagonal token spawned in five controlled patterns
  (Straight Lane Line, Lane Transition Trail, Jump Arc, Slide Trail, Safe-Lane Reward), each
  validated against active obstacles before it spawns
- **Collection streak and x1–x4 score multiplier**: the multiplier steps up at streaks of 5, 10,
  and 20 tokens, resets to x1 on an obstacle hit, and drives a floating `+<amount>` reward popup
  (now with a small pop-scale entrance), a multiplier-increase callout with a bouncier pop
  animation, and a streak-lost callout
- Full game-state system: Menu, How to Play, Playing, Paused, Game Over
- Desktop keyboard controls and mobile swipe controls, including a temporary `G` developer
  shortcut that exercises the real Integrity-depletion Game Over path
- HUD with score (smoothly counts up to its true value rather than jumping instantly), distance,
  tokens (brief pulse on each pickup), streak, multiplier, and a fully dynamic, smoothly-filling
  Integrity Meter (normal/warning/critical states)
- Score and distance tracking, with best score persisted to `localStorage`; token pickups and
  Near Miss bonuses both add to score via the same accumulator
- **Enhanced Game Over screen**: the End Run Rating (stars, title, feedback) plus a full Run
  Statistics panel - score, distance, run time, best score, Integrity remaining, tokens collected,
  Near Misses, obstacle hits, best streak, and best multiplier - with a brief, staggered entrance
  animation (disabled under `prefers-reduced-motion`)
- Responsive canvas that fills the screen and resizes cleanly
- Restart/menu flows that never duplicate canvases, render loops, event listeners, obstacles,
  collectibles, or overlays

## Desktop controls

| Action           | Keys                          |
| ---------------- | ------------------------------ |
| Move left         | `A` or `Left Arrow`            |
| Move right        | `D` or `Right Arrow`           |
| Jump              | `W`, `Up Arrow`, or `Space`    |
| Slide             | `S` or `Down Arrow`            |
| Pause / Resume    | `Escape` or `P`                |
| Start (from menu) | `Enter`                        |
| Debug game over*  | `G`                            |
| Demo Camera†      | `F9`                           |

\* Temporary developer test shortcut. Real Game Over is triggered by the Integrity Meter reaching
0% through obstacle collisions; `G` just forces that same path on demand for testing. See
[Known limitations](#known-limitations).

† Developer/showcase-only cinematic camera for screenshots and trailer capture, only reachable
while `PLAYING`. Freezes gameplay while active, ignores every other input except `F9` itself, and
restores the exact normal camera state on exit. Not intended for players. See
[`docs/SPRINT_03B.md`](docs/SPRINT_03B.md).

### Developer-only debug overlay

Loading the game with `?debug=1` in the URL (e.g. `http://localhost:5173/?debug=1`) shows a small,
fixed-position, monospace overlay in the bottom-left corner with the Adaptive Difficulty
Director's live mode/rating, current modifiers, evaluation countdown, and a Run Analytics summary.
It is never created at all without that query parameter, so it cannot appear in normal play. See
[`docs/SPRINT_03C.md`](docs/SPRINT_03C.md).

## Mobile controls

Swipe anywhere on the game canvas:

| Action       | Gesture      |
| ------------ | ------------ |
| Move left    | Swipe left   |
| Move right   | Swipe right  |
| Jump         | Swipe up     |
| Slide        | Swipe down   |

A visible pause button sits in the top-right corner of the HUD at all times; it works identically
on desktop and touch. See [`docs/CONTROLS.md`](docs/CONTROLS.md) for full details.

## Local development

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`) in a browser.

Other scripts:

```bash
npm run lint     # ESLint
npm run format   # Prettier, writes files in place
npm run validate # Deterministic validation of the Director/Analytics/Rating calculation logic
```

## Production build

```bash
npm run build
```

This type-checks the project (`tsc --noEmit`) and then builds with Vite. Output is written to
`dist/`. Preview the production build locally with:

```bash
npm run preview
```

## Cloudflare Pages deployment

Integrity Dash builds to a static site and deploys cleanly to Cloudflare Pages.

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory:** repository root
- Vite's `base` is set to `./` (relative), so the build works from any path and needs no
  environment-specific configuration. No localhost URLs are hard-coded anywhere in the project.

## Project folder overview

```
src/
  config/       Gameplay tuning values and the visual theme palette
  core/         Game orchestrator, state machine, render loop, renderer, scene setup
  entities/     Player rig (mesh + movement state + hit/invincibility visuals)
  input/        Keyboard and touch input, normalized into a single action stream
  systems/      Movement (incl. lane lean, squash-and-stretch), camera follow, the developer
                Demo Camera, near-miss detection, scoring, localStorage persistence, the
                Adaptive Difficulty Director, Run Analytics, and End Run Rating
  world/        Recycled Corporate HQ environment: segments, environment theme registry/config,
                theme rotation timer, and a props/ subfolder of prop-factory builder functions
  obstacles/    Pooled procedural obstacles: type, factory, pool, spawner (Director-aware),
                manager
  collectibles/ Pooled Integrity Token collectibles: type, factory, pool, spawner
                (Director-aware), manager
  collision/    Box3-based player/obstacle and player/collectible collision detection
  integrity/    Integrity Meter value, invincibility, Game Over trigger
  rewards/      Token count, streak, score multiplier, floating reward text
  effects/      Screen flash, camera shake (collision + landing impulse), the shared pooled
                pulse-ring effect (landing dust, token pickup), and the centralised ambient
                world-animation system (monitor flicker, server blink, signboard/plant motion)
  ui/           DOM-driven screens (menu, how-to-play, HUD, pause, game over) and the opt-in
                developer debug overlay
  utils/        Math helpers and shared constants
  styles/       Global CSS
public/assets/  Placeholder folders for future models, textures, audio, icons
docs/           Architecture, controls, and sprint documentation
scripts/        Deterministic validation harness for Director/Analytics/Rating logic (`npm run
                validate`) - see docs/SPRINT_03C.md
```

`src/config/gameConfig.ts` holds gameplay/visual tuning constants; `src/config/qualityConfig.ts`
holds the Low/Medium/High visual quality presets and the `QualityManager` that resolves one at
startup; `src/config/adaptiveDifficultyConfig.ts` and `src/config/runRatingConfig.ts` hold every
Adaptive Difficulty Director and End Run Rating tuning value respectively.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how these pieces fit together.

## Known limitations

Sprint 3A and 3B were both pure polish passes (game-feel, then world/visual); neither added or
removed a gameplay mechanic. Sprint 3C adds the Adaptive Difficulty Director, Run Analytics, and
End Run Rating as genuinely new systems, but they only ever produce small, bounded, temporary
spawn adjustments and post-run feedback - they do not change the core loop itself. The functional
limitations below carry over from Sprint 2B unchanged, plus the Sprint 3A/3B/3C items at the end:

- Only one collectible type exists (the Integrity Token); it does not restore Integrity and has no
  effect on invincibility — it is purely a score/streak mechanic. A second collectible type or
  currency is not implemented.
- No missions, story choices, power-ups, permanent upgrades, shops, currency purchases, cloud
  saving, achievements, daily rewards, or character selection yet — these remain explicitly out of
  scope (see `docs/SPRINT_02B.md`).
- Only a single generic placeholder character is implemented. The Master Design Document specifies
  two selectable characters (including a hijab-wearing agent); that is intentionally deferred to a
  later sprint rather than guessed at here — see `docs/SPRINT_01.md`.
- Speed and difficulty are capped at Stage 4 (13 units/second); they are not intended to keep
  climbing beyond that yet.
- The `G` key is a temporary developer test shortcut for the real Game Over path (it is not a
  second Game Over mechanism) and is expected to be removed or hidden once no longer needed for
  manual testing.
- Visuals are deliberately grey-box/low-poly (no final character, obstacle, collectible, or
  environment art) — Sprint 3B adds variety and atmosphere within that same style, not final art.
- No audio yet; only the folder structure exists for future sound.
- `heal()` exists on the Integrity system for future use but has no gameplay source yet (tokens
  deliberately do not heal Integrity this sprint).
- **Near Miss lane-match heuristic**: a Near Miss is detected when an obstacle in the player's
  current lane reaches the player's Z position without ever overlapping it (see
  `docs/SPRINT_03A.md`). This is a lane-level check, not a continuous-position/distance check
  against the player's exact X, so it is a good approximation of "cleanly dodged" rather than a
  literal narrowest-margin measurement.
- **Adaptive Difficulty reserved snapshot fields**: `PerformanceSnapshot` carries a few fields
  (`currentMultiplier`, `bestStreak`, `tokensCollected`, `timeSinceLastHit`, `survivalDuration`)
  that `computePerformanceScore()` does not read yet - see `docs/HOTFIX_05_1.md` and the field-level
  documentation on `PerformanceSnapshot` in `src/config/adaptiveDifficultyConfig.ts`. They are kept
  as documented, reserved inputs for a future tuning pass rather than removed or force-fit into the
  score, per the v0.5.1 hotfix's "no speculative balancing changes" scope.
- **Theme rotation is timer-based, not curated**: which theme a newly-recycled segment picks up
  is randomized (excluding immediate repetition) on a fixed timer, not hand-authored per
  distance/level - see `docs/SPRINT_03B.md`.
- **Background depth is not true parallax**: the distant silhouette layer is attached to (and
  moves at the same speed as) each segment, rather than drifting at its own slower rate. It still
  removes the "void" beyond the walls; a deliberate scope/performance simplification.
- **Visual quality presets have no UI yet**: Low/Medium/High is resolved automatically (with a
  `?quality=` URL override for testing) - a full settings menu remains out of scope.
- **The Adaptive Difficulty Director's rating weights and thresholds are a first, conservative
  tuning pass**, not the result of large-scale playtesting data - they are fully centralised and
  documented (`src/config/adaptiveDifficultyConfig.ts`) specifically so they're easy to revisit
  after Alpha Demo feedback. See `docs/SPRINT_03C.md`.
- **"Tokens missed" in Run Analytics counts tokens that despawned uncollected** - a reliable,
  directly-measurable signal, but it does not distinguish "player chose not to detour for a
  token" from "player never had a realistic chance to reach it."
- **The End Run Rating's reference values (what counts as a "full credit" score, survival time,
  etc.) are deliberately generous placeholders**, not tuned to a specific skill ceiling - see
  `docs/SPRINT_03C.md` for the exact values and the reasoning to revisit them post-demo.
- No ethical decision gates, story mode, mission system, achievements, online leaderboard, account
  system, cloud save, external telemetry, audio, NPC characters, new power-ups, or a major UI
  redesign — explicitly out of scope for this sprint (see `docs/SPRINT_03C.md`).

## Next planned sprint

See `docs/SPRINT_03C.md` for the deferred-item list. The next sprint's scope is not implemented in
this branch; implementation will begin only after Sprint 3C (the Alpha Demo build) is reviewed.
