export const Phase = {IDLE: 'idle', FOCUS: 'focus', SHORT: 'short', LONG: 'long'};

const MINUTE_MS = 60000;

function clampConfig(config) {
    const c = key => Math.max(1, Math.floor(Number(config[key])) || 1);
    return {focus: c('focus'), short: c('short'), long: c('long'), every: c('every')};
}

export class Pomodoro {
    constructor(config, now) {
        this._config = clampConfig(config);
        this._now = now;
        this._phase = Phase.IDLE;
        this._running = false;
        this._sessions = 0;
        this._remaining = 0;
        this._endAt = 0;
    }

    get phase() {
        return this._phase;
    }

    get running() {
        return this._running;
    }

    get sessions() {
        return this._sessions;
    }

    setConfig(config) {
        this._config = clampConfig(config);
    }

    remainingMs() {
        if (this._phase === Phase.IDLE)
            return this._config.focus * MINUTE_MS;
        if (this._running)
            return Math.max(0, this._endAt - this._now());
        return this._remaining;
    }

    dots() {
        const total = this._config.every;
        const filled = this._phase === Phase.LONG ? total : this._sessions % total;
        return {filled, total};
    }

    start() {
        if (this._running)
            return;
        if (this._phase === Phase.IDLE)
            this._enter(Phase.FOCUS);
        this._endAt = this._now() + this._remaining;
        this._running = true;
    }

    pause() {
        if (!this._running)
            return;
        this._remaining = this.remainingMs();
        this._running = false;
    }

    skip() {
        if (this._phase === Phase.IDLE)
            return;
        this._enter(this._phase === Phase.FOCUS ? Phase.SHORT : Phase.FOCUS);
    }

    reset() {
        this._phase = Phase.IDLE;
        this._running = false;
        this._sessions = 0;
        this._remaining = 0;
    }

    tick() {
        if (!this._running || this.remainingMs() > 0)
            return null;
        const ended = this._phase;
        if (ended === Phase.FOCUS) {
            this._sessions++;
            this._enter(this._sessions % this._config.every === 0 ? Phase.LONG : Phase.SHORT);
        } else {
            if (ended === Phase.LONG)
                this._sessions = 0;
            this._enter(Phase.FOCUS);
        }
        return ended;
    }

    _enter(phase) {
        this._phase = phase;
        this._running = false;
        this._remaining = this._config[phase] * MINUTE_MS;
    }
}
