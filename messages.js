export function parseMessages(text) {
    return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '' && !line.startsWith('#'));
}

export function pickNext(messages, last, rng = Math.random) {
    if (messages.length === 0)
        return null;
    const others = messages.filter(m => m !== last);
    const candidates = others.length > 0 ? others : messages;
    return candidates[Math.floor(rng() * candidates.length)];
}
