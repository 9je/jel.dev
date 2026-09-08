import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { stopAt, tForStop, type StopId } from './path';

export interface ScrollController {
  progress(): number;
  jumpTo(id: StopId, immediate?: boolean): void;
  onProgress(cb: (t: number) => void): () => void;
  onStop(cb: (id: StopId) => void): () => void;
  dispose(): void;
}

export function createScroll(): ScrollController {
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ lerp: 0.08, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  let t = 0;
  let current: StopId | null = null;
  const progressCbs = new Set<(t: number) => void>();
  const stopCbs = new Set<(id: StopId) => void>();
  const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

  const trigger = ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      t = self.progress;
      for (const cb of progressCbs) cb(t);
      const id = stopAt(t).id;
      if (id !== current) {
        current = id;
        history.replaceState(null, '', `#${id}`);
        for (const cb of stopCbs) cb(id);
      }
    },
  });

  return {
    progress: () => t,
    jumpTo(id, immediate = false) {
      const target = tForStop(id) * maxScroll();
      if (immediate) lenis.scrollTo(target, { immediate: true, force: true });
      else lenis.scrollTo(target, { duration: 1.6, easing: (x: number) => 1 - Math.pow(1 - x, 3), force: true });
    },
    onProgress(cb) { progressCbs.add(cb); return () => progressCbs.delete(cb); },
    onStop(cb) { stopCbs.add(cb); return () => stopCbs.delete(cb); },
    dispose() { trigger.kill(); gsap.ticker.remove(tick); lenis.destroy(); },
  };
}
