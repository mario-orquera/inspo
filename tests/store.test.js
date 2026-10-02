import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {MessageStore} from '../store.js';

function assertEquals(actual, expected, label) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e)
        throw new Error(`${label}: expected ${e}, got ${a}`);
}

const dir = GLib.dir_make_tmp('inspo-test-XXXXXX');
const path = GLib.build_filenamev([dir, 'sub', 'messages.txt']);
const file = Gio.File.new_for_path(path);

function write(text) {
    const tmp = Gio.File.new_for_path(`${path}.tmp`);
    tmp.replace_contents(new TextEncoder().encode(text), null, false, Gio.FileCreateFlags.NONE, null);
    tmp.move(file, Gio.FileCopyFlags.OVERWRITE, null, null);
}

function waitFor(cond, ms = 2000) {
    const loop = new GLib.MainLoop(null, false);
    const start = GLib.get_monotonic_time();
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 20, () => {
        if (cond() || GLib.get_monotonic_time() - start > ms * 1000) {
            loop.quit();
            return GLib.SOURCE_REMOVE;
        }
        return GLib.SOURCE_CONTINUE;
    });
    loop.run();
}

// missing file -> sample created
let changes = 0;
const store = new MessageStore(path, () => changes++);
store.load();
assertEquals(file.query_exists(null), true, 'sample file created');
assertEquals(store.messages.length >= 1, true, 'sample has messages');

// editor-style rename save is picked up
write('x\ny\n');
waitFor(() => changes > 0);
assertEquals(changes > 0, true, 'onChange fired after rename-save');
assertEquals(store.messages, ['x', 'y'], 'messages reloaded');

// second rename-save still works (monitor survives)
const before = changes;
write('z\n');
waitFor(() => changes > before);
assertEquals(store.messages, ['z'], 'monitor survives replace');

// destroy stops notifications
store.destroy();
const after = changes;
write('q\n');
waitFor(() => false, 300);
assertEquals(changes, after, 'no onChange after destroy');
print('ok');
