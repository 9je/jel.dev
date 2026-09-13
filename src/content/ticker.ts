import { STATUS_LABEL, type Status } from './schema';

/**
 * The lines the banner runs: every project that is not restricted, with its status, and the commit
 * streak at the head of the list when there is one worth reading out. The board in the dispatch
 * office is the place the streak is drawn in full. This is the line that says it on the way past.
 */
export function buildTickerLines(items: { title: string; status: Status }[], streakDays = 0): string[] {
  const lines = items
    .filter((i) => i.status !== 'restricted')
    .map((i) => `${i.title} ${STATUS_LABEL[i.status]}`.toLowerCase());
  return streakDays > 1 ? [`${streakDays} days without a missed commit`, ...lines] : lines;
}
