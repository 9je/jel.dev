// Refreshes src/content/streak.json from a GitHub profile's public contribution calendar.
//
// The walk's shift board is the only part of the site that is about something still happening, so
// it has to be current on the day it is deployed. This runs in CI ahead of the image build, writes
// the JSON the scene imports, and on any failure leaves the committed snapshot exactly as it is:
// a board a day behind is a board, and a build that fails because github.com was slow is not.
//
//   node scripts/streak.mjs [login] [outfile]
import { writeFileSync, readFileSync } from 'node:fs';

const login = process.argv[2] ?? '9je';
const out = process.argv[3] ?? new URL('../src/content/streak.json', import.meta.url).pathname;

/** Every day the calendar carries, oldest first: date, the 0 to 4 level, and the count when the
 *  tooltip for that cell gives one. */
function parse(html) {
  const tips = new Map();
  for (const m of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = /^(\d[\d,]*)\s/.exec(m[2].trim());
    tips.set(m[1], n ? Number(n[1].replace(/,/g, '')) : 0);
  }
  const days = [];
  for (const m of html.matchAll(/<td[^>]*class="[^"]*ContributionCalendar-day[^"]*"[^>]*>/g)) {
    const tag = m[0];
    const date = /data-date="([^"]+)"/.exec(tag)?.[1];
    if (!date) continue;
    const level = Number(/data-level="(\d)"/.exec(tag)?.[1] ?? 0);
    const id = /\sid="([^"]+)"/.exec(tag)?.[1];
    days.push({ date, level, count: id && tips.has(id) ? tips.get(id) : level > 0 ? 1 : 0 });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}

/** The run of days up to today with something on them. A day with nothing on it ends the run,
 *  except today: the board should not read zero at breakfast because the day is young. */
function currentStreak(days) {
  let i = days.length - 1;
  if (i >= 0 && days[i].level === 0) i -= 1;
  let n = 0;
  for (; i >= 0 && days[i].level > 0; i--) n += 1;
  return n;
}

function longestStreak(days) {
  let best = 0, run = 0;
  for (const d of days) { run = d.level > 0 ? run + 1 : 0; if (run > best) best = run; }
  return best;
}

try {
  const res = await fetch(`https://github.com/users/${login}/contributions`, {
    headers: { 'user-agent': 'jel.dev build', accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`github answered ${res.status}`);
  const days = parse(await res.text());
  if (days.length < 300) throw new Error(`only ${days.length} days came back, the page shape has changed`);
  const year = new Date().getUTCFullYear();
  const data = {
    login,
    generated: new Date().toISOString().slice(0, 10),
    current: currentStreak(days),
    longest: longestStreak(days),
    yearTotal: days.filter((d) => d.date.startsWith(String(year))).reduce((n, d) => n + d.count, 0),
    total: days.reduce((n, d) => n + d.count, 0),
    // The last twelve weeks as one digit a day, which is what the board has room to draw.
    recent: days.slice(-84).map((d) => d.level).join(''),
  };
  writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`streak: ${data.current} days, longest ${data.longest}, ${data.yearTotal} in ${year}`);
} catch (err) {
  const had = (() => { try { return JSON.parse(readFileSync(out, 'utf8')).generated; } catch { return null; } })();
  console.warn(`streak: ${err.message}. Keeping the snapshot${had ? ` from ${had}` : ''}.`);
}
