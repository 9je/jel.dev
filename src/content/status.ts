/**
 * The wings and the statuses, and how a status is written out.
 *
 * These live apart from `schema.ts` because the walk itself reads them: the LED banner in the bay
 * puts a status after every project name, and anything the banner imports is shipped to the browser.
 * `schema.ts` pulls in zod to validate the content collection at build time, which is 22 KB of
 * client bundle for a page that has no validating left to do.
 */
export const WINGS = ['operations', 'fabrication', 'recreation', 'containment'] as const;
export const STATUSES = ['operational', 'in-flight', 'pending-release', 'restricted', 'closed-source'] as const;
export type Wing = (typeof WINGS)[number];
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  operational: 'Operational',
  'in-flight': 'In flight',
  'pending-release': 'Pending release',
  restricted: 'Restricted',
  'closed-source': 'Closed source',
};
