# Controls

## Keyboard (desktop)

| Action             | Keys                       |
| ------------------ | --------------------------- |
| Move left           | `Left Arrow` or `A`         |
| Move right          | `Right Arrow` or `D`        |
| Jump                | `Up Arrow`, `W`, or `Space` |
| Slide               | `Down Arrow` or `S`         |
| Pause / Resume      | `Escape` or `P`             |
| Start game (menu)   | `Enter`                    |
| Debug game over*    | `G`                         |

All gameplay keys are handled on `keydown` and ignore key-repeat, so holding a key does not spam
repeated actions (e.g. holding `Space` triggers exactly one jump, not continuous jumps).

\* See [Temporary G key trigger](#temporary-g-key-game-over-trigger) below.

## Mobile gestures

Swipes are read anywhere on the game canvas. A gesture only counts as a swipe once it travels past
a minimum distance threshold (32px) within a maximum duration (700ms) — shorter or slower
movements are treated as taps and ignored, so accidental touches don't trigger actions.

| Action     | Gesture      |
| ---------- | ------------ |
| Move left  | Swipe left   |
| Move right | Swipe right  |
| Jump       | Swipe up     |
| Slide      | Swipe down   |

The dominant axis of the swipe determines whether it's read as horizontal (lane change) or
vertical (jump/slide) — a swipe with more horizontal than vertical travel is always a lane change,
and vice versa.

A pause button is always visible in the top-right corner of the HUD during a run. It is sized as a
52×52px touch target (comfortably above the 44px minimum recommended for mobile) and works
identically via mouse click or touch tap.

## Interaction rules

- Jump input is ignored while sliding. A jump pressed within the last 0.12s of an in-progress jump
  is buffered and fires immediately on landing, rather than being lost.
- Slide cannot start while airborne, and pressing slide again while already sliding does not
  extend its duration.
- A new lane-change input is only accepted once the current lane transition is at least 70%
  complete, preventing rapid input from breaking the in-flight transition.
- Pause/Resume, Restart, and Main Menu buttons are only wired to fire once per click — there is no
  path in the code that can register a button's click handler more than once, including across
  repeated restarts.

## Prevented default browser behaviour

- All mapped keyboard keys (arrows, WASD, Space, Escape, P, Enter, G) call
  `event.preventDefault()` on `keydown`, so gameplay input never scrolls the page, triggers
  browser search-on-`/`, or otherwise leaks to the browser chrome.
- `touchmove` events on the game canvas call `preventDefault()` while a swipe gesture is being
  tracked, which stops the page from scrolling or bouncing during gameplay on mobile.

## Temporary G key developer shortcut

As of Sprint 2A, the **real** Game Over condition is the Integrity Meter reaching 0% through
obstacle collisions. `G` is retained only as a **development test shortcut**: pressing it while
`PLAYING` calls the same `IntegritySystem.damage()` path a real collision uses, with enough force
to deplete Integrity immediately. It does not bypass or duplicate the Game Over flow - it simply
triggers the real one on demand, which is useful for testing the Game Over/Restart/Main Menu flow
without waiting to be hit.

- Only works while `PLAYING`; it is ignored in every other state.
- Does not affect scoring, distance, obstacles, or any other normal gameplay system.
- **This remains a temporary developer/testing convenience** and is expected to be removed (or
  hidden behind a build flag) once the core obstacle loop no longer needs a manual test trigger.
