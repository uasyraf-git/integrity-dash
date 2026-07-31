# Sprint 3B: World and Visual Polish

**Status: complete.** Builds on Sprint 3A's game-feel/camera/HUD polish without modifying it.
A pure world/visual polish pass: no gameplay redesign, no new gameplay mechanics. Player
movement, obstacles, collision, Integrity, Near Miss, the collectible/reward loop, Game State,
difficulty stages, Game Over, and restart behaviour are all unchanged in substance. Sprint 3C
(`docs/SPRINT_03C.md`) is the Alpha Demo milestone built on top of this world/visual polish - its
Adaptive Difficulty Director consumes the same obstacle/collectible spawners this sprint left
untouched, through their own existing safety checks, and does not modify any of this sprint's
environment/theme/prop/lighting/Demo Camera systems.

## Objective

Make the game world feel varied, atmospheric, and professionally presented instead of one
repeating corridor, while preserving track dimensions, collision rules, gameplay readability, and
performance. Players experience five recognizable office-themed areas while still playing inside
one seamless endless-runner environment - the theme system decorates the existing recycled track,
it does not replace or reshape it.

## Scope

**In scope:** a five-theme environment system, twelve reusable decorative props, chunk
integration of themes into the existing segment-recycling architecture, atmosphere via material/
emissive choice (not new scene lights), subtle ambient animation, floor/wall surface polish, a
background depth layer, a developer-only Demo Camera (`F9`), and an internal Low/Medium/High
visual quality configuration.

**Explicitly out of scope** (deferred): an adaptive difficulty director, run analytics, an
end-run rating, missions, story, ethical decision gates, NPC characters, audio, achievements,
save progression, new obstacle mechanics, new power-ups, and a full settings menu. None of these
were implemented.

## Environment theme architecture

Three responsibilities, kept in three separate modules, per the sprint's engineering standards:

- **Theme selection** (`src/world/ThemeSelector.ts`): a timer-based rotation
  (`THEME_DURATION`, 16s of active play time). Advancing picks a random theme excluding the
  immediately-previous one, so back-to-back repeats never happen. Only ever called from
  `CorporateHQ.update()` inside the existing `PLAYING` guard, so the zone timer pauses with
  everything else.
- **Prop creation** (`src/world/props/PropFactory.ts`): the twelve prop builder functions (see
  below), with a shared, module-level material cache mirroring `ObstacleFactory`'s pattern.
- **Theme registry and composition** (`src/world/environmentThemes.ts`): `ENVIRONMENT_THEMES`
  maps each `EnvironmentThemeId` to a display name, an atmosphere descriptor (used for
  documentation only - see Lighting approach), and an ordered list of prop placements.
  `buildThemeVignette()` composes one themed cluster of 2-4 props for a given (theme, side)
  combination, trimming lower-priority props from the end of the list when `propDensity < 1`
  (see Visual quality configuration).

Why timer-based rather than per-segment: a theme changing every single 24-unit segment would
read as chaotic, not "recognizable areas." Because the theme selector only advances on its own
timer while multiple segments recycle in between, several consecutive segments naturally end up
sharing one theme - that contiguous run is what actually reads as a themed zone.

## Theme list

| Theme | Atmosphere | Representative props |
| --- | --- | --- |
| Reception | Warm | Reception desk, indoor plant, wall panel |
| Open Office | Neutral | Office desk, computer monitor, office chair, filing cabinet |
| Meeting Room | Soft neutral | Meeting table, two office chairs, digital signboard (as a presentation screen) |
| Pantry | Warm | Pantry counter, coffee machine, indoor plant |
| Server Room | Cool | Two server racks, wall panel |

All five reuse the same twelve-prop factory (see below) rather than introducing one-off geometry
per theme, per the "reuse whenever practical" engineering standard.

## Prop system

`PropFactory.ts` exports the twelve required builders: `createReceptionDesk`, `createOfficeDesk`,
`createOfficeChair`, `createComputerMonitor`, `createIndoorPlant`, `createFilingCabinet`,
`createMeetingTable`, `createCoffeeMachine`, `createPantryCounter`, `createServerRack`,
`createDigitalSignboard`, `createWallPanel`. Each returns `{ group, ambient? }` - a local-origin
`THREE.Group` the caller positions/rotates, plus zero or more `AmbientRegistration` entries for
parts that should animate (see Ambient animation, below).

- **Shared materials**: every static part (desk bodies, chair frames, cabinet bodies, counter
  tops, etc.) draws from one module-level material cache, built once and reused across every
  prop instance, every theme, every segment - exactly the pattern `ObstacleFactory` already
  established for obstacles.
- **Independent-state parts get their own material**: the handful of ambient-animated parts
  (a monitor's screen, a server rack's light strip, a signboard's panel, a coffee machine's
  indicator) each get a fresh `MeshStandardMaterial` created inside their own builder call, so
  two instances of the same prop type can flicker/pulse out of phase with each other instead of
  visually locking together (which sharing one material would cause).
- **Collision**: props are pure decoration. They are never added to `CollisionSystem`,
  `ObstacleManager`, or any other collision-relevant system - the only thing that keeps them out
  of the player's way is *placement* (see Chunk integration), not a collision exemption.

## Chunk integration

`EnvironmentSegment` (one repeatable 24-unit slice of track, unchanged Sprint 1/2A structural
geometry: floor, lane lines, edges, pillars, glass panels, ceiling beams) prebuilds all five
themes' vignettes - both wall sides - once in its constructor, storing each in a
`Map<EnvironmentThemeId, THREE.Group>` with `visible = false` by default. `setTheme(themeId)`
toggles exactly two groups' visibility (the previous theme off, the new one on) - an O(1) swap,
never a rebuild. No vignette is ever created or destroyed during gameplay.

`CorporateHQ.update()` advances the `ThemeSelector` every frame and, whenever a segment's Z wraps
around behind the camera (the existing recycle path from Sprint 1), calls
`segment.setTheme(themeSelector.getCurrentTheme())` right there - the same moment the segment is
already being repositioned to the front of the track. `CorporateHQ`'s constructor assigns each of
the six segments a distinct *initial* theme (cycling through all five), so a fresh run shows
variety immediately rather than one theme repeated six times. `reset()` restores that exact same
deterministic initial assignment and resets the `ThemeSelector`, so Restart and Main Menu both
return the environment to a predictable, identical starting layout.

All props are placed at `x = ±(TRACK_WIDTH / 2 + 0.6 + THEME_PROP_WALL_OFFSET)` - beyond the
existing pillar/glass wall line, itself already beyond the play lanes (`±3`) and the pillars
(`±4.6`). Obstacle spawn points, collectible spawn points, and Near Miss detection all operate
entirely in the `-3..3` lane/x range and are structurally unaware that `CorporateHQ` exists beyond
sharing the same coordinate system - none of them were touched this sprint, and none of them can
overlap a themed vignette by construction.

## Lighting approach

The brief asked for "subtle lighting variation by theme" while also asking to avoid excessive
dynamic lights and prefer baked-style tricks/emissive materials. Sprint 3B resolves this by **not
adding a per-theme scene light at all**: the existing single hemisphere + directional light setup
from Sprint 1 is completely unchanged, so the player, obstacles, and collectibles are lit exactly
as before in every theme - zero risk of a theme accidentally hurting gameplay readability. Instead,
"atmosphere" comes from each theme's prop material and emissive choices: Reception's gold accents
and warm wood-toned desk, Server Room's cool blue-white rack lights and dark server-toned
materials, Pantry's warm counter/coffee-machine tones, and so on (see the Theme list table's
Atmosphere column). This is exactly the "prefer baked-style visual tricks, emissive materials...
over many dynamic point lights" guidance taken literally - zero additional real-time lights, zero
risk of flashing/abrupt brightness changes between themes, and no lighting transition to manage at
all (a segment's visible theme changes are instant and only affect its own decorative geometry).

## Visual quality configuration

`src/config/qualityConfig.ts` defines three presets (`QualityLevel.LOW/MEDIUM/HIGH`), each a
`QualitySettings` object: `propDensity` (0.4/0.7/1.0 - trims each theme's prop list, and below
0.6 also skips building the far wall side entirely, roughly halving the decorative footprint),
`ambientAnimationEnabled`, `shadowsEnabled`, `backgroundDepthEnabled`, and `maxPixelRatio`
(1/1.5/2). `QualityManager` resolves one level once at startup: a `?quality=low|medium|high` URL
override for manual testing, falling back to `detectDefaultQuality()`, which combines coarse-
pointer detection, CPU core count, and viewport width - never any single signal alone - into a
sensible default. None of this is exposed through a UI yet (no settings menu this sprint), but
`QualityManager`/`QualitySettings` are self-contained specifically so a future settings menu can
call `setLevel()`-style logic without restructuring anything here.

Quality only ever affects *how much* decorative geometry/animation/shadow/resolution is used -
`Game`, `CollisionSystem`, `RewardSystem`, and every other gameplay system are completely
unaware `QualityManager` exists.

## Ambient visual animation

`src/effects/AmbientAnimationSystem.ts` is one centralised update loop, not per-object animation
logic. Prop builders that produce an animatable part return an `AmbientRegistration` describing
what to animate (`monitorFlicker`, `serverBlink`, `signboardPulse`, `plantSway`) and which
material/object drives it; `environmentThemes.ts`'s `buildThemeVignette()` registers each one with
the shared system as it builds. `register()` assigns a random phase offset so pooled instances of
the same prop type never animate in perfect lockstep. `update(deltaTime)` is only ever called from
`Game.tick()` inside the `PLAYING` guard (and only when `quality.ambientAnimationEnabled`), so it
pauses and resumes exactly like every other gameplay-tied system with no internal state check
needed; `reset()` (called on Restart/Main Menu) clears only the elapsed timer - registrations
persist for the app's lifetime, since props are never rebuilt.

## Track and surface polish

Purely decorative additions to `EnvironmentSegment`, none of which touch a single lane, edge,
floor-height, or obstacle/collectible-relevant coordinate: periodic floor seam trim strips
(`FLOOR_SEAM_INTERVAL`) and thin horizontal wall trim strips along the glass-panel line
(`WALL_TRIM_THICKNESS`). The existing thin lane-line markings from Sprint 1 already satisfy "lane
guidance without looking like a road" - left unchanged.

## Background depth

`EnvironmentSegment.addBackgroundSilhouettes()` attaches two large, low-poly silhouette boxes
(one per side) beyond the wall line, sharing one cheap, unlit-style material and fading into the
existing fog. This eliminates the "void" beyond the glass without adding meaningful draw-call or
geometry cost - and is skipped entirely when `quality.backgroundDepthEnabled` is false. It is
*not* true parallax (see Known limitations): the silhouettes are children of their segment and
move at the same speed as everything else, a deliberate scope/performance simplification.

## Demo Camera Mode

`src/systems/DemoCameraSystem.ts` is a small, self-contained class isolated from `CameraSystem`:
while active, it writes directly to the shared `THREE.PerspectiveCamera` (a slow orbit around the
player, `DEMO_CAMERA_ORBIT_SPEED`/`RADIUS`/`HEIGHT`), and `CameraSystem`'s own follow-smoothing
state is simply never touched. `Game.tick()` gates the entire gameplay-update block on `PLAYING &&
!demoCameraActive` (the same technique Pause already uses - just not calling anything that frame),
and branches the camera update between the two systems. Exiting calls
`CameraSystem.snapTo(player)`, which re-anchors both the smoothing state and the camera's own
transform in one call - "exact normal state," guaranteed. `F9` is only reachable while `PLAYING`;
every other input (movement, pause, debug Game Over) is ignored while Demo Camera Mode is active,
and it is defensively reset on Pause/Restart/Main Menu so it can never leak across a state
transition.

## Performance considerations

- All prop, trim, and background geometry is built once at startup (in `EnvironmentSegment`'s
  constructor) - nothing is created or destroyed during gameplay, matching the existing
  segment-recycling philosophy exactly.
- Shared geometries/materials wherever the visual doesn't require independent state (see Prop
  system); only per-instance where genuinely needed (animated emissive parts, `Collectible`'s
  existing per-instance materials from Sprint 2B).
- `AmbientAnimationSystem` is one flat array iterated once per frame - no per-object listeners,
  no nested update calls.
- `NearMissSystem`-style scratch-array reuse patterns are unaffected; this sprint adds no new
  per-frame allocations to the hot gameplay loop.
- Quality presets bound decorative density on lower-end devices: `propDensity < 0.6` skips
  building the far wall side entirely (not just hiding it), `shadowsEnabled` toggles the
  renderer's shadow map at construction, `backgroundDepthEnabled` skips the background layer's
  geometry entirely, and `maxPixelRatio` caps the renderer's resolution.
- No new post-processing, no additional dynamic lights (see Lighting approach) - the render cost
  added by this sprint is bounded to draw calls for whatever theme vignette is currently visible
  per segment (at most a handful of extra low-poly meshes per segment side).

## Files created

`src/world/EnvironmentThemeId.ts`, `src/world/environmentThemes.ts`, `src/world/ThemeSelector.ts`,
`src/world/props/PropFactory.ts`, `src/effects/AmbientAnimationSystem.ts`,
`src/systems/DemoCameraSystem.ts`, `src/config/qualityConfig.ts`.

## Files modified

`src/world/CorporateHQ.ts`, `src/world/EnvironmentSegment.ts`, `src/core/Game.ts`,
`src/core/Renderer.ts`, `src/ui/UIManager.ts`, `src/input/KeyboardInput.ts`,
`src/input/InputManager.ts`, `src/config/gameConfig.ts`, `index.html`, `package.json`,
`package-lock.json`, `README.md`, `CHANGELOG.md`, `docs/ARCHITECTURE.md`, `docs/SPRINT_03A.md`.

## Known limitations

- **Theme rotation is randomized on a timer, not curated per distance/level** - see Environment
  theme architecture. A hand-authored progression is a reasonable future refinement, not
  implemented here.
- **Background depth is not true parallax** - see Background depth above.
- **Visual quality has no settings-menu UI** - resolved automatically, with a `?quality=` URL
  override for testing only.
- **Atmosphere is achieved via material/emissive choice, not a literal additional light per
  theme** - a deliberate reading of the brief's own "prefer baked-style tricks... over many
  dynamic point lights" guidance; see Lighting approach for the reasoning.
- Visuals remain grey-box/low-poly, consistent with the rest of the project - Sprint 3B adds
  variety and atmosphere within that same style, not final art.
- No audio accompanies any ambient animation or theme transition - out of scope this sprint.
- The Demo Camera's orbit path is a single fixed radius/speed/height, not a curated multi-shot
  sequence - sufficient for the stated "screenshots and trailer recording" use case, not a full
  cinematic camera system.
