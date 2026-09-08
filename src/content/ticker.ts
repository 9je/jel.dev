import { STATUS_LABEL, type Status } from './schema';

export function buildTickerLines(items: { title: string; status: Status }[]): string[] {
  return items
    .filter((i) => i.status !== 'restricted')
    .map((i) => `${i.title} ${STATUS_LABEL[i.status]}`.toLowerCase());
}
