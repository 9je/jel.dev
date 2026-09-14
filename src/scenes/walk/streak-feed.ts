import { readStreak, type StreakData } from '../../content/streak';

/**
 * The live commit streak.
 *
 * The number baked into the page is the number the streak had on the day of the last deploy, and
 * Jordan does not push to this repo every day, so the board would sit on a stale figure until he
 * did. The server keeps a current copy at `/live/streak.json`, refreshed on a timer, and this
 * fetches it in the background while the walk builds. Same origin, so the page's own CSP covers it
 * and no key ever reaches a browser.
 *
 * Everything about it is optional. The fetch starts and nothing waits on it: the board draws the
 * baked figure immediately and repaints only if a better one turns up. A 404, a timeout, a proxy
 * error page or a build with no server behind it all end the same way, with the page unchanged.
 */
const SOURCE = '/live/streak.json';
const TIMEOUT_MS = 5000;

let live: StreakData | null = null;
let started = false;
const waiting: ((d: StreakData) => void)[] = [];

/** Starts the fetch, once per page. Safe to call from anywhere and at any time. */
export function startStreakFeed(source = SOURCE): void {
  if (started || typeof fetch !== 'function') return;
  started = true;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  fetch(source, { signal: abort.signal, cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => {
      const data = readStreak(body);
      if (!data) return;
      live = data;
      for (const cb of waiting.splice(0)) cb(data);
    })
    .catch(() => { /* the baked figure stands */ })
    .finally(() => clearTimeout(timer));
}

/** Calls back with the live figures, now if they are already in, otherwise when they land. */
export function onStreak(cb: (data: StreakData) => void): void {
  if (live) cb(live); else waiting.push(cb);
}

/** Test seam: forgets the fetch and everything waiting on it. */
export function resetStreakFeed(): void {
  live = null; started = false; waiting.length = 0;
}
