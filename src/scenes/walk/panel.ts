/**
 * The project panel: what a hash names, and the media a panel loads when it is opened. No three in
 * here and nothing that reads the page until it is called, so the first can be read in a unit test.
 */

/** What the fragment of the address names: a stop of the walk, a project, or nothing the walk
 *  knows. A stop wins, since a stop's link is what the dock and every old address already use. */
export function parseHash(hash: string, stops: readonly string[], projects: ReadonlySet<string>): { stop?: string; project?: string } {
  const id = hash.replace(/^#/, '');
  if (!/^[a-z0-9-]+$/.test(id)) return {};
  if (stops.includes(id)) return { stop: id };
  if (projects.has(id)) return { project: id };
  return {};
}

/**
 * Gives a panel's pictures and loops their addresses. They ship as `data-src`, so a project's media
 * is never asked for until its panel is opened. A loop plays muted and on its own with `autoplay`.
 * Without it (a reader who asked for less motion, or the stacked page) its poster stands and the
 * controls are theirs. `lazy` is the stacked page, where a picture waits until it is scrolled to.
 */
export function armMedia(root: ParentNode, opts: { autoplay: boolean; lazy?: boolean }): void {
  for (const el of root.querySelectorAll<HTMLImageElement | HTMLVideoElement>('[data-src]')) {
    if (el instanceof HTMLVideoElement) {
      if (el.dataset.poster) el.poster = el.dataset.poster;
      el.muted = true; el.loop = true; el.playsInline = true;
      if (opts.autoplay) el.autoplay = true;
      else { el.controls = true; el.preload = 'none'; }
    } else if (opts.lazy) el.loading = 'lazy';
    // Marked when it has something to show, so the plate can bring it up rather than cut to it.
    const shown = () => el.setAttribute('data-loaded', '');
    if (el instanceof HTMLVideoElement) shown(); else el.addEventListener('load', shown, { once: true });
    el.src = el.dataset.src!;
    if (el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0) shown();
    el.removeAttribute('data-src');
  }
}

/** Stops whatever a panel was playing, as it closes. */
export function disarmMedia(root: ParentNode): void {
  for (const v of root.querySelectorAll('video')) v.pause();
}
