import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {pickNext} from './messages.js';
import {Phase, Pomodoro} from './pomodoro.js';
import {PomodoroButton} from './pomodoroUi.js';
import {MessageStore} from './store.js';

const POMO_KEYS = ['focus-minutes', 'short-break-minutes', 'long-break-minutes', 'sessions-before-long'];

export default class InspoExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._current = null;
        this._timerId = 0;
        this._tooltip = null;

        this._label = new St.Label({
            style_class: 'inspo-label',
            y_align: Clutter.ActorAlign.CENTER,
            reactive: true,
            track_hover: true,
            visible: false,
        });
        this._label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._label.set_style('max-width: 560px;');
        this._label.connect('button-press-event', () => {
            this._rotate();
            return Clutter.EVENT_STOP;
        });
        this._label.connect('notify::hover', () => this._updateTooltip());

        Main.panel._leftBox.add_child(this._label);

        this._settingsId = this._settings.connect('changed::rotation-minutes', () => this._armTimer());

        const path = GLib.build_filenamev([GLib.get_user_config_dir(), 'inspo', 'messages.txt']);
        this._store = new MessageStore(path, () => this._rotate());
        this._store.load();
        this._rotate();

        this._enablePomodoro();
    }

    _pomoConfig() {
        return {
            focus: this._settings.get_int('focus-minutes'),
            short: this._settings.get_int('short-break-minutes'),
            long: this._settings.get_int('long-break-minutes'),
            every: this._settings.get_int('sessions-before-long'),
        };
    }

    _enablePomodoro() {
        this._pomoTickId = 0;
        this._pomodoro = new Pomodoro(this._pomoConfig(), () => GLib.get_monotonic_time() / 1000);
        this._pomoButton = new PomodoroButton(this._pomodoro, this._settings, {
            onAction: () => this._syncPomoTick(),
        });
        Main.panel.addToStatusArea('inspo-pomodoro', this._pomoButton, 0, 'right');
        this._pomoSettingsIds = POMO_KEYS.map(key =>
            this._settings.connect(`changed::${key}`, () => {
                this._pomodoro.setConfig(this._pomoConfig());
                this._pomoButton.refresh();
            }));
    }

    _syncPomoTick() {
        if (this._pomodoro.running && !this._pomoTickId) {
            this._pomoTickId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                const ended = this._pomodoro.tick();
                if (ended)
                    this._notifyPhaseEnd(ended);
                this._pomoButton.refresh();
                if (this._pomodoro.running)
                    return GLib.SOURCE_CONTINUE;
                this._pomoTickId = 0;
                return GLib.SOURCE_REMOVE;
            });
        } else if (!this._pomodoro.running && this._pomoTickId) {
            GLib.source_remove(this._pomoTickId);
            this._pomoTickId = 0;
        }
    }

    _notifyPhaseEnd(ended) {
        if (ended === Phase.FOCUS) {
            const next = this._pomodoro.phase;
            const minutes = this._settings.get_int(next === Phase.LONG ? 'long-break-minutes' : 'short-break-minutes');
            Main.notify('Focus done', `Take a ${minutes} minute break`);
        } else {
            Main.notify('Break over', 'Ready to focus?');
        }
    }

    _disablePomodoro() {
        if (this._pomoTickId)
            GLib.source_remove(this._pomoTickId);
        this._pomoTickId = 0;
        this._pomoSettingsIds?.forEach(id => this._settings.disconnect(id));
        this._pomoSettingsIds = null;
        this._pomoButton?.destroy();
        this._pomoButton = null;
        this._pomodoro = null;
    }

    _rotate() {
        const next = pickNext(this._store.messages, this._current);
        this._current = next;
        this._label.visible = next !== null;
        this._label.text = next ?? '';
        this._armTimer();
    }

    _armTimer() {
        if (this._timerId)
            GLib.source_remove(this._timerId);
        const minutes = Math.max(1, this._settings.get_int('rotation-minutes'));
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, minutes * 60, () => {
            this._timerId = 0;
            this._rotate();
            return GLib.SOURCE_REMOVE;
        });
    }

    _updateTooltip() {
        this._hideTooltip();
        if (!this._label.hover || !this._current)
            return;
        this._tooltip = new St.Label({style_class: 'dash-label', text: this._current});
        Main.uiGroup.add_child(this._tooltip);
        const [x, y] = this._label.get_transformed_position();
        this._tooltip.set_position(Math.max(0, Math.round(x)), Math.round(y + this._label.height + 4));
    }

    _hideTooltip() {
        this._tooltip?.destroy();
        this._tooltip = null;
    }

    disable() {
        this._disablePomodoro();
        if (this._timerId)
            GLib.source_remove(this._timerId);
        this._timerId = 0;
        this._hideTooltip();
        this._store?.destroy();
        this._store = null;
        this._settings?.disconnect(this._settingsId);
        this._settings = null;
        this._label?.destroy();
        this._label = null;
        this._current = null;
    }
}
