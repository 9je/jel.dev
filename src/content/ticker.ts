/** What the banner puts between two lines, in the markup and in the LED board alike. */
export const TICKER_SEP = '   •   ';

/** The streak as the banner says it. One sentence, in one place, because three things write it: the
 *  server rendered banner, the LED board in the bay, and the refresh when live numbers land. */
export function streakLine(days: number): string {
  return `${days} days without a missed commit`;
}

const IS_STREAK = /^\d+ days without a missed commit$/;

/** What the banner says when there is no run worth reading out, so it never scrolls nothing. */
export const TICKER_IDLE = 'jel labs';

/** The banner text back as the lines it was built from. */
export function splitTickerText(text: string): string[] {
  return text.split('•').map((s) => s.trim()).filter(Boolean);
}

/** The lines with the streak said once, at the head, and only when there is a run worth saying.
 *  Anything else on the banner is kept after it. With nothing to say, the idle line. */
export function withStreakLine(lines: string[], days: number): string[] {
  const rest = lines.filter((l) => !IS_STREAK.test(l) && l !== TICKER_IDLE);
  const out = days > 1 ? [streakLine(days), ...rest] : rest;
  return out.length ? out : [TICKER_IDLE];
}

/**
 * The lines the banner runs: the commit streak and nothing else. It used to read out every project
 * with its status as well, and Jordan cut it back to the one line: "please just have days without
 * missed commit". The board in the dispatch office is where the streak is drawn in full.
 */
export function buildTickerLines(streakDays = 0): string[] {
  return withStreakLine([], streakDays);
}

/**
 * The banner text with its streak line brought up to date, for when a live count arrives after the
 * page was built. Works on the rendered text rather than on the list, because by then the list is a
 * string in the markup and the LED board in the bay reads that same string.
 */
export function retickStreak(text: string, days: number): string {
  return withStreakLine(splitTickerText(text), days).join(TICKER_SEP);
}
