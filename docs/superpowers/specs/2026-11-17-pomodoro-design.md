# Pomodoro timer — addition to Inspo

Date: 2026-11-17

## Goal
A configurable pomodoro timer inside the existing Inspo extension: glanceable in the
top bar, controllable from a dropdown, configurable without a prefs window.

## Behavior
- Phases: `idle`, `focus`, `short`, `long`. Defaults: focus 25 min, short break 5,
  long break 15, long break after every 4 focus sessions.
- Phases never start on their own: when a phase ends, the machine moves to the next
  phase in a paused state and sends a desktop notification
  (e.g. "Focus done — take 5"). The user presses start.
- Actions: `start`, `pause`, `skip` (jump to next phase, paused), `reset` (back to
  idle, session count cleared).
- The running timer is not persisted: it resets on shell restart/logout.
  Settings and task text persist via GSettings.
- Time is computed from an end timestamp (monotonic clock), not by counting ticks,
  so suspend and tick jitter do not drift the countdown.

## UI
- Panel button on the right side (status area), separate from the Inspo message label.
  - Idle: icon only.
  - Active: icon + `MM:SS`, with a style class per phase (focus accent, break green,
    paused dimmed).
- Dropdown (`PopupMenu`):
  - Phase title and large time readout.
  - Row of buttons: start/pause, skip, reset.
  - Dot row showing progress toward the long break.
  - Single-line entry for the current task (persisted).
  - Collapsible "Settings" submenu with +/- steppers for focus, short break,
    long break, sessions-before-long-break.
- Phase end: `Main.notify()`.

## Architecture
- `pomodoro.js` — pure state machine, no Shell imports. Takes config and a clock
  function; exposes state, `start/pause/skip/reset`, and `tick(now)` which returns
  whether a phase ended. Testable under plain gjs.
- `pomodoroUi.js` — `PanelMenu.Button` subclass; renders machine state, forwards
  button presses, writes settings from the steppers.
- `extension.js` — creates/destroys the button in `enable()/disable()`; runs a 1 s
  `GLib.timeout_add_seconds` tick only while a phase is running; reacts to
  `changed::` signals for the pomodoro keys. The existing message label is unchanged.
- `schemas/` — new keys: `focus-minutes` (i, 25), `short-break-minutes` (i, 5),
  `long-break-minutes` (i, 15), `sessions-before-long` (i, 4), `task` (s, "").
  Ranges mirror the existing `rotation-minutes` style (min 1).
- `stylesheet.css` — phase classes and dropdown layout.
- `default.nix` — copy the new `.js` files into the install dir.

## Cleanup
`disable()` removes the tick source, disconnects settings signals, and destroys the
button, leaving no residue (same standard as the message label).

## Testing
- `tests/pomodoro.test.js` under gjs: phase transitions, long break after N sessions,
  pause/resume preserves remaining time, skip, reset, tick across a phase boundary,
  config change while idle.
- UI verified manually in a nested shell:
  `dbus-run-session gnome-shell --nested --wayland`.

## Out of scope (YAGNI)
Sound, auto-start, daily stats, persisting a running timer, a prefs window.
Auto-start and stats can be added later without changing the architecture.
