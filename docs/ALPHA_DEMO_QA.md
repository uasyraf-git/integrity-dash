# Alpha Demo QA Guide

This document is for anyone testing the v0.5.1-alpha-demo Alpha Demo build - internal reviewers,
external playtesters, or a future contributor picking the project back up. It covers how to get
the game running, what to test, and how to report what you find.

Integrity Dash is a browser-based 3D endless runner. No installation beyond Node.js is required -
there's no account, no login, and nothing is sent anywhere: all progress (best score) lives only
in your browser's `localStorage`, and Run Analytics never leave your machine.

## Installation steps

1. Install [Node.js](https://nodejs.org/) 18 or later.
2. Unzip the delivered package (or clone the repository).
3. From the project root:
   ```bash
   npm install
   ```

## Build steps

**Play locally (fastest, live-reloading):**
```bash
npm run dev
```
Open the printed local URL (typically `http://localhost:5173`).

**Production build + preview (closer to how it'll actually be hosted):**
```bash
npm run build
npm run preview
```
Open the printed local URL (typically `http://localhost:4173`).

**Before reporting any issue**, also run these and note any failures:
```bash
npm run lint       # ESLint - should report 0 errors
npm run validate   # Deterministic Director/Analytics/Rating validation - should report 0 failed
```

## Desktop test checklist

- [ ] Main Menu shows the game title, tagline, and version label (`v0.5.1-alpha-demo`).
- [ ] "How to Play" opens, lists every control clearly, and "Back" returns to the Main Menu.
- [ ] "Start Game" begins a run at Score 0, Integrity 100%, Tokens 0.
- [ ] Keyboard controls: `A`/`D`/arrows change lanes, `W`/`Up`/`Space` jumps, `S`/`Down` slides,
      `Escape`/`P` pauses.
- [ ] Pause shows Resume/Restart/Main Menu and the 3D scene freezes visibly behind it.
- [ ] Resume continues exactly where the run left off (score/HUD do not jump or reset).
- [ ] Restart (from Pause or Game Over) begins a completely fresh run.
- [ ] Main Menu (from Pause or Game Over) returns cleanly with no leftover obstacles, tokens, or
      effects visible.

## Mobile test checklist

Test on an actual phone if possible, or a narrow emulated viewport (e.g. 390x844) otherwise.

- [ ] Swipe left/right changes lanes; swipe up jumps; swipe down slides.
- [ ] The pause button (top-right) is reachable and works via tap.
- [ ] HUD stats remain readable and do not overlap the player or each other.
- [ ] The Game Over statistics panel fits the screen without horizontal scrolling and without
      being cut off - see the enhanced panel described below.
- [ ] Text throughout remains legible (no clipped or overlapping text) at a phone-sized viewport.

## Gameplay test checklist

- [ ] Obstacles appear after a short grace period at run start; jump clears floor obstacles;
      slide clears the Security Barrier.
- [ ] Getting hit reduces Integrity by 10% and grants a brief invincibility window (shown by a
      shimmer on the player).
- [ ] Reaching 0% Integrity ends the run (Game Over).
- [ ] Integrity Tokens can be collected while standing, jumping, and sliding, in all three lanes.
- [ ] Collecting tokens builds a streak; the multiplier steps to x2 at streak 5, x3 at 10, x4 at
      20, and never exceeds x4; a floating "+25"-style popup appears on each pickup.
- [ ] Hitting an obstacle resets the current streak/multiplier to 0/x1 but does **not** reset
      total tokens collected or best streak.
- [ ] Cleanly jumping over or sliding under an obstacle in your own lane (without touching it)
      shows a "Near Miss! +50" popup and adds to score, with no change to Integrity, streak, or
      multiplier.
- [ ] All five environment themes (Reception, Open Office, Meeting Room, Pantry, Server Room) are
      each recognizable and visually distinct during an extended run.
- [ ] `F9` toggles the developer Demo Camera: gameplay visibly freezes, the HUD hides, the camera
      orbits smoothly; pressing `F9` again restores normal gameplay and the HUD exactly as before
      (score continues from where it paused, not from 0).

## Hotfix v0.5.1 checklist

These cover the fixes made in the v0.5.1 stabilisation hotfix - see `docs/HOTFIX_05_1.md` for the
full write-up. All of the following apply on desktop, touch, and mobile input alike (they share
the same input-handling code path).

- [ ] An accepted jump/slide/lane-change (one that actually happens on screen) is counted exactly
      once in the Run Analytics summary shown on the eventual Game Over screen.
- [ ] A rejected action is **not** counted at all: try to lane-change past the leftmost/rightmost
      lane repeatedly (stand in an edge lane and keep pressing further outward), try to jump while
      already sliding, and try to slide while already jumping - none of these should nudge the
      corresponding Game Over stat.
- [ ] Exiting Demo Camera Mode (`F9` again, or by leaving PLAYING while it's active) always
      restores the HUD, the normal gameplay camera, and normal input - confirmed via each of these
      paths individually: `F9` toggle-off mid-run, Restart from Pause, Main Menu from Pause, and
      starting a fresh game after a Main Menu return. No path should ever leave the HUD hidden or
      the camera stuck in its orbit.
- [ ] Toggle Demo Camera on/off at least 5 times in a row within a single run; each toggle behaves
      identically to the first (no drift, no leftover frozen frame, no missing HUD).

## Performance test checklist

- [ ] The game feels smooth (no visible stutter) on a normal desktop browser.
- [ ] The game remains playable on a mobile device or a throttled/low-end emulation.
- [ ] Try `?quality=low`, `?quality=medium`, and `?quality=high` in the URL - each should look
      visibly different in decorative density, and all three should run smoothly.
- [ ] Play one long, continuous run (3+ minutes) and confirm: no growing slowdown over time, no
      visual "pop-in" glitches from the recycled environment, and the browser's task manager (or
      dev tools Performance/Memory tab, if available to you) does not show steadily climbing
      memory usage.

## Restart stress test

1. Start a run, play briefly, force Game Over (see note on the `G` key below), Restart. Repeat
   this cycle at least 10 times in a row, as quickly as is comfortable.
2. After the 10 cycles: confirm there is still exactly **one** game canvas, **one** HUD, and the
   Game Over statistics reflect only the most recent run (not accumulated across all 10).
3. Confirm no console errors appeared at any point (open your browser's DevTools console before
   starting).
4. Separately, repeat the same idea with Main Menu instead of Restart: Start → play briefly →
   Pause → Main Menu, 5 times in a row. Confirm the same - one canvas, one HUD, no leftover
   obstacles/tokens/effects, no console errors.
5. Toggle Demo Camera (`F9`) on and off a few times in the middle of this stress test (e.g.
   between cycles 3 and 4). Confirm it still behaves identically afterward - HUD reappears, camera
   is normal - and doesn't affect the rest of the stress test.

*Note: `G` is a temporary developer shortcut (only while actually playing) that instantly forces
Game Over via the same Integrity-depletion path a real collision would use - it exists specifically
to make this kind of repeated-cycle testing practical without needing to survive to a natural
Game Over every time.*

## Pause test

- [ ] Pausing mid-jump or mid-slide freezes the player's pose exactly where it was; resuming
      continues the same jump/slide, not a reset one.
- [ ] The elapsed run time shown on the eventual Game Over screen does **not** include time spent
      paused (pause a run for 30+ seconds, then check the Run Time stat looks like the time you
      actually played, not the time since Start).
- [ ] Ambient world animation (monitor flicker, server rack lights, etc.) visibly stops while
      paused and resumes when you resume.

## Main Menu reset test

1. Start a run, collect a few tokens, take a hit, then return to the Main Menu mid-run (via
   Pause → Main Menu) **without** reaching Game Over.
2. Start a new run. Confirm: Score/Tokens/Streak/Multiplier/Integrity all begin completely fresh
   (0/0/x1/100%), and no obstacles or tokens from the abandoned run are still visible.
3. Confirm the previous run's best score (shown on the next Game Over) was **not** affected by
   the abandoned run.

## Director validation scenarios

The Adaptive Difficulty Director's core logic is validated automatically and deterministically -
run `npm run validate` and confirm it reports `0 failed`. That harness checks (in isolation from
rendering): rating computation and hysteresis, evaluation timing, mode entry/duration/cooldown,
modifier clamping, and a disabled Director. See `docs/SPRINT_03C.md` for the full scenario list.

For manual/in-browser confirmation, load the game with `?debug=1` and watch the small overlay in
the bottom-left corner while playing:

- [ ] The overlay shows `Director: NONE (...)` at the start of a run and a countdown ("next eval:
      Xs") that counts down from ~18 toward 0.
- [ ] Playing carelessly (taking hits, low Integrity) for a couple of evaluation cycles should
      eventually show `Director: ASSISTANCE (...)` with modifier values other than `1.00`.
- [ ] Playing very cleanly (high Integrity, building a streak, clean dodges) for a couple of
      cycles should eventually show `Director: CHALLENGE (...)`.
- [ ] The mode shown should never change more than once every ~20-30 seconds - if it appears to
      flip rapidly back and forth, that's a bug worth reporting.
- [ ] With the overlay open, the difficulty shift itself should be hard to *consciously* notice
      during normal play (a slightly longer or shorter gap between obstacles) - it should not
      feel like an obvious, sudden rule change.

## Run Analytics validation

- [ ] Play a run doing a mix of jumps, slides, and lane changes, then check the Game Over screen:
      Run Time, Tokens, Near Misses, and Obstacle Hits should all look like plausible counts for
      what you actually did (not zero, not wildly inflated).
- [ ] Restart immediately after: the new run's Game Over screen (force it quickly with `G`) should
      show near-zero stats, not a continuation of the previous run's numbers.
- [ ] Return to Main Menu mid-run instead of Restarting, start a new run, and confirm the same
      (fresh, not carried-over) behaviour.

## Rating validation

- [ ] A short run ended quickly with several hits and no tokens should land on a low star count
      (1-2 stars) with an encouraging (not harsh) feedback line.
- [ ] A long, clean run with high Integrity, a good streak, and several tokens should land on a
      high star count (4-5 stars).
- [ ] The same kind of run (similar stats) played twice should land on a similar rating both
      times - the rating should never feel random.
- [ ] The star display should be readable without relying on colour alone (it's rendered as
      filled/empty star characters, not a colour swatch).

## Known issues

- Visuals are intentionally low-poly/grey-box placeholder geometry throughout - this is expected
  for the current milestone, not a bug to report.
- No audio yet.
- The Director's tuning (see `docs/SPRINT_03C.md`) is a first pass, not the result of large-scale
  playtesting - if the game feels consistently too easy or too hard even after a few runs, that's
  useful feedback, not necessarily a "bug."
- The Director's performance snapshot carries a few fields (`currentMultiplier`, `bestStreak`,
  `tokensCollected`, `timeSinceLastHit`, `survivalDuration`) that its scoring rule doesn't read yet
  - see `docs/HOTFIX_05_1.md`. This is documented, intentional, and unchanged behaviour, not a bug.
- Near Miss is a clean-dodge (lane-match) detector, not a literal narrowest-distance measurement -
  see `docs/HOTFIX_05_1.md` and `docs/SPRINT_03A.md`. This is documented, intentional, and
  unchanged behaviour, not a bug.
- Background depth (the distant scenery beyond the walls) moves at the same speed as the
  foreground rather than true parallax - a known, deliberate simplification.
- Theme rotation is randomized on a timer rather than hand-authored per distance - you may see
  the same theme appear more than once in a single long run (never twice *in a row*, but not on
  a fixed schedule either).

## Tester feedback template

Please copy this into your report and fill it in:

```
**Build tested:** v0.5.1-alpha-demo
**Platform:** [desktop browser + OS / mobile device + OS]
**Browser:** [Chrome / Firefox / Safari / etc., version if known]

**Summary impression:**


**Difficulty feel:** [too easy / about right / too hard / inconsistent]


**Did you notice the Adaptive Difficulty Director changing anything?**
[yes, describe what / no / not sure]


**End Run Rating - did it feel fair for the run you played?**
[yes / no, explain]


**Bugs or issues found:**
1.
2.

**Console errors seen (if DevTools was open):**


**Anything that felt unpolished or out of place:**


**Anything you particularly liked:**

```
