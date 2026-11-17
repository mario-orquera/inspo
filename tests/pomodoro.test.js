import {Phase, Pomodoro} from '../pomodoro.js';

function assertEquals(actual, expected, label) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e)
        throw new Error(`${label}: expected ${e}, got ${a}`);
}

const MIN = 60000;
const cfg = {focus: 25, short: 5, long: 15, every: 4};
let t = 0;
const now = () => t;
const fresh = (c = cfg) => {
    t = 0;
    return new Pomodoro(c, now);
};

// fresh machine
let p = fresh();
assertEquals([p.phase, p.running, p.remainingMs()], [Phase.IDLE, false, 25 * MIN], 'fresh machine');

// start and count down
p.start();
t = 60000;
assertEquals([p.phase, p.running, p.remainingMs()], [Phase.FOCUS, true, 24 * MIN], 'running countdown');

// pause then resume preserves remaining
p.pause();
t += 10 * MIN;
assertEquals(p.remainingMs(), 24 * MIN, 'paused time is frozen');
p.start();
assertEquals(p.remainingMs(), 24 * MIN, 'resume keeps remaining');
t += MIN;
assertEquals(p.remainingMs(), 23 * MIN, 'resume continues counting');

// huge clock jump ends exactly one phase
p = fresh();
p.start();
t = 10 * 60 * MIN;
assertEquals(p.tick(), Phase.FOCUS, 'tick reports ended phase');
assertEquals([p.phase, p.running, p.remainingMs()], [Phase.SHORT, false, 5 * MIN], 'next phase paused, full duration');
assertEquals(p.tick(), null, 'no cascade');

// full cycle
p = fresh();
const seen = [];
for (let i = 0; i < 8; i++) {
    p.start();
    t += 100 * 60 * MIN;
    p.tick();
    seen.push(p.phase);
    if (p.phase === Phase.LONG) {
        assertEquals(p.sessions, 4, 'four sessions before long');
        assertEquals(p.dots(), {filled: 4, total: 4}, 'dots full during long');
    }
    if (p.phase === Phase.SHORT && p.sessions === 2)
        assertEquals(p.dots(), {filled: 2, total: 4}, 'dots after two sessions');
    if (p.phase === Phase.LONG)
        break;
}
assertEquals(seen, ['short', 'focus', 'short', 'focus', 'short', 'focus', 'long'].slice(0, seen.length), 'cycle order');
assertEquals(seen[seen.length - 1], 'long', 'reaches long break');
p.start();
t += 100 * 60 * MIN;
p.tick();
assertEquals([p.phase, p.sessions], [Phase.FOCUS, 0], 'after long break: focus, sessions reset');

// skip
p = fresh();
p.skip();
assertEquals([p.phase, p.running], [Phase.IDLE, false], 'skip on idle is a no-op');
p.start();
p.skip();
assertEquals([p.phase, p.running, p.sessions], [Phase.SHORT, false, 0], 'skip focus: paused short, no session counted');
p.skip();
assertEquals([p.phase, p.running], [Phase.FOCUS, false], 'skip break: paused focus');

// reset
p = fresh();
p.start();
t += 5 * MIN;
p.reset();
assertEquals([p.phase, p.sessions, p.running], [Phase.IDLE, 0, false], 'reset');

// no-ops
p = fresh();
p.pause();
assertEquals([p.phase, p.running], [Phase.IDLE, false], 'pause on idle');
p.start();
t += MIN;
p.start();
assertEquals(p.remainingMs(), 24 * MIN, 'start twice does not restart');
p.pause();
p.pause();
assertEquals(p.remainingMs(), 24 * MIN, 'pause twice');

// setConfig: running keeps duration, next phase uses new value
p = fresh();
p.start();
p.setConfig({...cfg, focus: 50});
assertEquals(p.remainingMs(), 25 * MIN, 'running phase unchanged');
t += 100 * 60 * MIN;
p.tick();
p.start();
t += 100 * 60 * MIN;
p.tick();
assertEquals([p.phase, p.remainingMs()], [Phase.FOCUS, 50 * MIN], 'next focus uses new length');
p = fresh();
p.setConfig({...cfg, focus: 50});
assertEquals(p.remainingMs(), 50 * MIN, 'idle applies immediately');

// clamping
p = fresh({focus: 0, short: -3, long: 15, every: 4});
assertEquals(p.remainingMs(), MIN, 'focus 0 clamps to 1 min');
p.start();
t += 2 * MIN;
p.tick();
assertEquals(p.remainingMs(), MIN, 'short -3 clamps to 1 min');

print('ok');
