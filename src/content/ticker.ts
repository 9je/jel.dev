import { STATUS_LABEL, type Status } from './status';

/** What the banner puts between two lines, in the markup and in the LED board alike. */
export const TICKER_SEP = '   •   ';

/** The streak as the banner says it. One sentence, in one place, because three things write it: the
 *  server rendered banner, the LED board in the bay, and the refresh when live numbers land. */
export function streakLine(days: number): string {
  return `${days} days without a missed commit`;
}

const IS_STREAK = /^\d+ days without a missed commit$/;

/** The banner text back as the lines it was built from. */
export function splitTickerText(text: string): string[] {
  return text.split('•').map((s) => s.trim()).filter(Boolean);
}

/** The lines with the streak said once, at the head, and only when there is a run worth saying. */
export function withStreakLine(lines: string[], days: number): string[] {
  const rest = lines.filter((l) => !IS_STREAK.test(l));
  return days > 1 ? [streakLine(days), ...rest] : rest;
}

/**
 * The lines the banner runs: every project that is not restricted, with its status, and the commit
 * streak at the head of the list when there is one worth reading out. The board in the dispatch
 * office is the place the streak is drawn in full. This is the line that says it on the way past.
 */
export function buildTickerLines(items: { title: string; status: Status }[], streakDays = 0): string[] {
  const lines = items
    .filter((i) => i.status !== 'restricted')
    .map((i) => `${i.title} ${STATUS_LABEL[i.status]}`.toLowerCase());
  return withStreakLine(lines, streakDays);
}

/**
 * The banner text with its streak line brought up to date, for when a live count arrives after the
 * page was built. Works on the rendered text rather than on the list, because by then the list is a
 * string in the markup and the LED board in the bay reads that same string.
 */
export function retickStreak(text: string, days: number): string {
  return withStreakLine(splitTickerText(text), days).join(TICKER_SEP);
}
