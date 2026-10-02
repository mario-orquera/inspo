# Inspo — GNOME Shell inspirational message extension

Date: 2026-10-02

## Goal
A personal GNOME Shell 49 extension (Wayland, NixOS) that shows one inspirational
line next to the clock in the top panel. Ambient only: no popups, no interruptions.

## Behavior
- Messages live in `~/.config/inspo/messages.txt`, one per line. Blank lines and lines
  starting with `#` are ignored.
- One message is shown at a time, picked randomly, never equal to the previous one
  (unless only one message exists).
- The message rotates on a timer; default 10 minutes, configurable via GSettings key
  `rotation-minutes`.
- Clicking the label immediately shows another random message (and resets the timer).
- The file is watched (`Gio.FileMonitor`); edits are picked up without restart.
- Long messages are ellipsized to a max width; the full text is shown in a tooltip on hover.
- Missing file: create a sample file on first run. Empty/no valid lines: show nothing.

## Architecture (approach 1: label injected into the date menu button)
Add an `St.Label` inside `Main.panel.statusArea.dateMenu` beside the clock display.
The calendar dropdown keeps working. `disable()` removes the label, stops the timer,
and cancels the file monitor, leaving no residue.

Units:
- `messages.js` — `parseMessages(text)` and `pickNext(messages, last, rng)`. Pure, no Shell imports.
- `store.js` — loads the file, creates the sample, monitors changes, emits a change callback.
- `extension.js` — `enable()/disable()`, builds the label, wires the timer, click, and store.
- `schemas/` — GSettings schema with `rotation-minutes` (default 10).
- `metadata.json` — uuid, name, `shell-version: ["49"]`.

## Testing
- Pure logic (`messages.js`) is tested under plain `gjs`: comment/blank skipping, no-repeat,
  single-message case, empty list.
- Panel wiring is verified manually in a nested shell:
  `dbus-run-session gnome-shell --nested --wayland` (extensions cannot be reloaded live on Wayland).

## Install / NixOS
- Dev: symlink the project into `~/.local/share/gnome-shell/extensions/<uuid>/`.
- Final: package as a `stdenv.mkDerivation` (copy files, compile schemas), add to
  `environment.systemPackages` in `/etc/nixos/configuration.nix`, and enable the uuid via dconf.

## Out of scope (YAGNI)
Popups/notifications, prefs GUI, popover, multiple message files, context triggers,
replacing the clock text.

## Known risk
Injecting into the date menu touches Shell internals and may break on GNOME upgrades;
fallback is the separate-indicator approach (approach 2).
