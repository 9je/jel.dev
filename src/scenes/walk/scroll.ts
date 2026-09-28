import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { roomAt, tForStop, type StopId } from './path';

export interface ScrollController {
  progress(): number;
  jumpTo(id: StopId, immediate?: boolean): void;
  onProgress(cb: (t: number) => void): () => void;
  onStop(cb: (id: StopId) => void): () => void;
  dispose(): void;
}

/**
 * Lenis drives the scroll on its own frame loop and reports every change, smoothed or native. This
 * used to run through gsap's ticker and a ScrollTrigger spanning the page, which was 41 KB of the
 * first visit to read one number that Lenis already has. The scene eases toward the target, so which
 * frame callback runs first makes no visible difference.
 */
export function createScroll(): ScrollController {
  const lenis = new Lenis({ lerp: 0.08, smoothWheel: true, wheelMultiplier: 0.9, autoRaf: true });

  let t = 0;
  let current: StopId | null = null;
  const progressCbs = new Set<(t: number) => void>();
  const stopCbs = new Set<(id: StopId) => void>();
  const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

  // Progress is read off the page itself, as the trigger did: the scroll position over the full
  // scrollable length. A resize changes that length, so it updates too.
  const update = () => {
    const next = Math.min(1, Math.max(0, window.scrollY / maxScroll()));
    if (next === t) return;
    t = next;
    for (const cb of progressCbs) cb(t);
    // The room the camera is standing in, not the nearest stop: the copy and its title strike as the
    // walk crosses a room's threshold, which is the reveal, rather than halfway down the corridor
    // before it.
    const id = roomAt(t).id;
    if (id !== current) {
      current = id;
      history.replaceState(null, '', `#${id}`);
      for (const cb of stopCbs) cb(id);
    }
  };
  lenis.on('scroll', update);
  window.addEventListener('resize', update);
  // A page that opens scrolled (a restored position) reports it once its listeners are attached.
  queueMicrotask(update);

  return {
    progress: () => t,
    jumpTo(id, immediate = false) {
      const target = tForStop(id) * maxScroll();
      if (immediate) lenis.scrollTo(target, { immediate: true, force: true });
      else lenis.scrollTo(target, { duration: 1.6, easing: (x: number) => 1 - Math.pow(1 - x, 3), force: true });
    },
    onProgress(cb) { progressCbs.add(cb); return () => progressCbs.delete(cb); },
    onStop(cb) { stopCbs.add(cb); return () => stopCbs.delete(cb); },
    dispose() { window.removeEventListener('resize', update); lenis.destroy(); },
  };
}
