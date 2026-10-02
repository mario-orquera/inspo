import {parseMessages, pickNext} from '../messages.js';

function assertEquals(actual, expected, label) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e)
        throw new Error(`${label}: expected ${e}, got ${a}`);
}

assertEquals(parseMessages('a\n\n# c\n  b  \r\n'), ['a', 'b'], 'skips blank/comment, trims, handles CRLF');
assertEquals(parseMessages(''), [], 'empty text');
for (const r of [0, 0.99])
    assertEquals(pickNext(['a', 'b'], 'a', () => r), 'b', `never repeats last (rng=${r})`);
assertEquals(pickNext(['a'], 'a'), 'a', 'single message may repeat');
assertEquals(pickNext([], null), null, 'empty list');
assertEquals(pickNext(['a', 'b', 'c'], null, () => 0), 'a', 'rng 0 picks first');
print('ok');
