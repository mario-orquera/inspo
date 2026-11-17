import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Phase} from './pomodoro.js';

const PHASE_TITLES = {
    [Phase.IDLE]: 'Ready',
    [Phase.FOCUS]: 'Focus',
    [Phase.SHORT]: 'Short break',
    [Phase.LONG]: 'Long break',
};

const PHASE_CLASSES = ['inspo-pomo-focus', 'inspo-pomo-break', 'inspo-pomo-paused'];

// Mirrors the ranges in the gschema; keep in sync.
const SETTINGS = [
    {key: 'focus-minutes', label: 'Focus', min: 1, max: 180, step: 1},
    {key: 'short-break-minutes', label: 'Short break', min: 1, max: 60, step: 1},
    {key: 'long-break-minutes', label: 'Long break', min: 1, max: 120, step: 1},
    {key: 'sessions-before-long', label: 'Sessions before long break', min: 1, max: 12, step: 1},
    {key: 'rotation-minutes', label: 'Message rotation', min: 1, max: 1440, step: 5},
];

function formatTime(ms) {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function iconButton(iconName, onClick) {
    const icon = new St.Icon({icon_name: iconName, icon_size: 16});
    const button = new St.Button({
        style_class: 'button inspo-pomo-button',
        child: icon,
        can_focus: true,
        x_expand: true,
    });
    button.connect('clicked', onClick);
    return {button, icon};
}

export const PomodoroButton = GObject.registerClass(
class PomodoroButton extends PanelMenu.Button {
    _init(machine, settings, {onAction}) {
        super._init(0.0, 'Inspo Pomodoro');
        this._machine = machine;
        this._settings = settings;
        this._onAction = onAction;
        this._settingsIds = [];

        this._buildPanel();
        this._buildMenu();
        this.connect('destroy', () => {
            this._settingsIds.forEach(id => this._settings.disconnect(id));
            this._settingsIds = [];
        });
        this.refresh();
    }

    _buildPanel() {
        const box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        box.add_child(new St.Icon({icon_name: 'alarm-symbolic', style_class: 'system-status-icon'}));
        this._panelLabel = new St.Label({y_align: Clutter.ActorAlign.CENTER, style_class: 'inspo-pomo-time'});
        box.add_child(this._panelLabel);
        this.add_child(box);
    }

    _buildMenu() {
        const head = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        const col = new St.BoxLayout({vertical: true, x_expand: true});
        this._title = new St.Label({style_class: 'inspo-pomo-title', x_align: Clutter.ActorAlign.CENTER});
        this._readout = new St.Label({style_class: 'inspo-pomo-readout', x_align: Clutter.ActorAlign.CENTER});
        this._dots = new St.Label({style_class: 'inspo-pomo-dots', x_align: Clutter.ActorAlign.CENTER});
        col.add_child(this._title);
        col.add_child(this._readout);
        col.add_child(this._dots);
        head.add_child(col);
        this.menu.addMenuItem(head);

        const controls = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        const row = new St.BoxLayout({x_expand: true, style_class: 'inspo-pomo-controls'});
        const play = iconButton('media-playback-start-symbolic', () => {
            if (this._machine.running)
                this._machine.pause();
            else
                this._machine.start();
            this._acted();
        });
        this._playIcon = play.icon;
        row.add_child(play.button);
        row.add_child(iconButton('media-skip-forward-symbolic', () => {
            this._machine.skip();
            this._acted();
        }).button);
        row.add_child(iconButton('view-refresh-symbolic', () => {
            this._machine.reset();
            this._acted();
        }).button);
        controls.add_child(row);
        this.menu.addMenuItem(controls);

        const taskItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        this._task = new St.Entry({
            style_class: 'inspo-pomo-task',
            hint_text: 'What are you focusing on?',
            text: this._settings.get_string('task'),
            can_focus: true,
            x_expand: true,
        });
        this._task.set_style('width: 260px;');
        const saveTask = () => this._settings.set_string('task', this._task.text);
        this._task.clutter_text.connect('activate', saveTask);
        this._task.clutter_text.connect('key-focus-out', saveTask);
        taskItem.add_child(this._task);
        this.menu.addMenuItem(taskItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const sub = new PopupMenu.PopupSubMenuMenuItem('Settings');
        for (const spec of SETTINGS)
            this._addStepper(sub.menu, spec);
        this.menu.addMenuItem(sub);
    }

    _addStepper(menu, {key, label, min, max, step}) {
        const item = new PopupMenu.PopupBaseMenuItem({activate: false});
        item.add_child(new St.Label({text: label, x_expand: true, y_align: Clutter.ActorAlign.CENTER}));
        const value = new St.Label({
            style_class: 'inspo-pomo-value',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const bump = delta => {
            const next = Math.min(max, Math.max(min, this._settings.get_int(key) + delta));
            this._settings.set_int(key, next);
        };
        const minus = iconButton('list-remove-symbolic', () => bump(-step)).button;
        const plus = iconButton('list-add-symbolic', () => bump(step)).button;
        item.add_child(minus);
        item.add_child(value);
        item.add_child(plus);
        menu.addMenuItem(item);

        const show = () => {
            value.text = String(this._settings.get_int(key));
        };
        show();
        this._settingsIds.push(this._settings.connect(`changed::${key}`, show));
    }

    _acted() {
        this.refresh();
        this._onAction();
    }

    refresh() {
        const m = this._machine;
        const idle = m.phase === Phase.IDLE;
        const paused = !idle && !m.running;

        this._panelLabel.visible = !idle;
        this._panelLabel.text = formatTime(m.remainingMs());
        for (const c of PHASE_CLASSES)
            this.remove_style_class_name(c);
        if (paused)
            this.add_style_class_name('inspo-pomo-paused');
        else if (m.phase === Phase.FOCUS)
            this.add_style_class_name('inspo-pomo-focus');
        else if (!idle)
            this.add_style_class_name('inspo-pomo-break');

        this._title.text = PHASE_TITLES[m.phase] + (paused ? ' (paused)' : '');
        this._readout.text = formatTime(m.remainingMs());
        const {filled, total} = m.dots();
        this._dots.text = Array.from({length: total}, (_, i) => (i < filled ? '●' : '○')).join(' ');
        this._playIcon.icon_name = m.running
            ? 'media-playback-pause-symbolic'
            : 'media-playback-start-symbolic';
    }
});
