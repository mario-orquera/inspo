import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {parseMessages} from './messages.js';

const SAMPLE = `# Inspo messages: one per line. Lines starting with # are ignored.
Small steps every day add up.
You are closer than you were yesterday.
`;

export class MessageStore {
    constructor(path, onChange) {
        this._file = Gio.File.new_for_path(path);
        this._onChange = onChange;
        this._messages = [];
        this._monitor = null;
        this._monitorId = 0;
    }

    get messages() {
        return this._messages;
    }

    load() {
        if (!this._file.query_exists(null)) {
            GLib.mkdir_with_parents(this._file.get_parent().get_path(), 0o755);
            this._file.replace_contents(new TextEncoder().encode(SAMPLE), null, false,
                Gio.FileCreateFlags.NONE, null);
        }
        this._reload();
        if (!this._monitor) {
            // Watch the directory so rename-based saves (most editors) are seen.
            this._monitor = this._file.get_parent().monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
            this._monitorId = this._monitor.connect('changed', (_m, file, other, event) => {
                const E = Gio.FileMonitorEvent;
                const touchesUs = file.equal(this._file) || (other && other.equal(this._file));
                if (touchesUs && [E.CHANGES_DONE_HINT, E.CREATED, E.MOVED_IN, E.RENAMED].includes(event)) {
                    this._reload();
                    this._onChange();
                }
            });
        }
    }

    _reload() {
        try {
            const [, bytes] = this._file.load_contents(null);
            this._messages = parseMessages(new TextDecoder().decode(bytes));
        } catch (e) {
            this._messages = [];
        }
    }

    destroy() {
        if (this._monitor) {
            this._monitor.disconnect(this._monitorId);
            this._monitor.cancel();
            this._monitor = null;
        }
        this._onChange = () => {};
    }
}
