/**
 * The shape of the commit streak payload, and the one place that decides whether a payload is
 * trustworthy enough to draw.
 *
 * Two things produce it. `scripts/streak.mjs` writes `streak.json` next to this file at build time,
 * which is the copy baked into the page, and the same script runs on a timer on the server and
 * writes the copy the page fetches at `/live/streak.json`. The baked copy is only as fresh as the
 * last deploy, so the board reads the live one when it can and falls back without complaint.
 *
 * Anything fetched over the wire is checked here before a single pixel is drawn from it: a truncated
 * file, a proxy error page or a 404 body would otherwise put nonsense on a wall in the scene.
 */
export interface StreakData {
  login: string;
  generated: string;
  current: number;
  longest: number;
  yearTotal: number;
  total: number;
  /** The last twelve weeks, one digit a day, oldest first, each the 0 to 4 level of that day. */
  recent: string;
}

const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 100000;
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 64;

/** The payload if it is one, and null for everything else. Never throws: the caller is drawing. */
export function readStreak(value: unknown): StreakData | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!text(v.login) || !text(v.generated)) return null;
  if (!count(v.current) || !count(v.longest) || !count(v.yearTotal) || !count(v.total)) return null;
  if (typeof v.recent !== 'string' || !/^[0-4]{0,84}$/.test(v.recent)) return null;
  return { login: v.login, generated: v.generated, current: v.current, longest: v.longest, yearTotal: v.yearTotal, total: v.total, recent: v.recent };
}
