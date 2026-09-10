import { chooseTier, readTierInput, type Tier, type TierInput } from './quality';
import type { WalkHandle } from './scene';
import type { ScrollController } from './scroll';
import { STOPS, tForStop, type StopId } from './path';

export interface WalkElements {
  root: HTMLElement; canvas: HTMLCanvasElement; dock: HTMLElement; preloader: HTMLElement; spacer: HTMLElement; sections: HTMLElement[];
}

export function queryElements(): WalkElements | null {
  const root = document.querySelector<HTMLElement>('[data-walk]');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-walk-canvas]');
  const dock = document.querySelector<HTMLElement>('[data-dock]');
  const preloader = document.querySelector<HTMLElement>('[data-preloader]');
  const spacer = document.querySelector<HTMLElement>('[data-spacer]');
  if (!root || !canvas || !dock || !preloader || !spacer) return null;
  return { root, canvas, dock, preloader, spacer, sections: Array.from(document.querySelectorAll<HTMLElement>('section[data-stop]')) };
}

const FALLBACK_KEY = 'jel:fallback';

export function decideTier(input: TierInput = readTierInput()): Tier {
  const q = new URLSearchParams(location.search);
  const forced = q.get('effects');
  if (forced === 'off') { try { localStorage.setItem('jel:effects', 'off'); } catch { /* ignore */ } return 'lite'; }
  if (forced === 'on') { try { localStorage.setItem('jel:effects', 'on'); } catch { /* ignore */ } }
  const q2 = q.get('quality');
  if (q2 === 'low' || q2 === 'medium' || q2 === 'high') return input.webgl ? q2 : 'lite';
  // The scene already gave up once in this tab (context lost, or too slow after trimming). Stay on
  // the lite path for the rest of the session rather than crawling for five seconds on every load.
  try { if (sessionStorage.getItem(FALLBACK_KEY) && forced !== 'on') return 'lite'; } catch { /* ignore */ }
  return chooseTier(input);
}

function wireEffectsToggle(els: WalkElements, tier: Tier) {
  const btn = els.dock.querySelector<HTMLButtonElement>('[data-effects]');
  if (!btn) return;
  const on = tier !== 'lite';
  btn.setAttribute('aria-pressed', String(on));
  btn.textContent = on ? 'Effects on' : 'Effects off';
  btn.addEventListener('click', () => {
    try { localStorage.setItem('jel:effects', on ? 'off' : 'on'); } catch { /* ignore */ }
    const url = new URL(location.href); url.searchParams.delete('effects'); url.searchParams.delete('quality');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    location.reload();
  });
}

function markCurrentFromHash(els: WalkElements) {
  const id = location.hash.replace('#', '') || 'booth';
  for (const a of els.dock.querySelectorAll<HTMLAnchorElement>('a[data-stop-link]')) {
    a.setAttribute('aria-current', a.dataset.stopLink === id ? 'true' : 'false');
  }
}

let hashchangeListener: (() => void) | null = null;

export function startLite(els: WalkElements) {
  els.root.dataset.mode = 'lite';
  els.preloader.dataset.state = 'hidden';
  markCurrentFromHash(els);
  hashchangeListener = () => markCurrentFromHash(els);
  window.addEventListener('hashchange', hashchangeListener);
}

let generation = 0;
let handle: WalkHandle | null = null;
let scroll: ScrollController | null = null;
let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
let pinRaf = 0;

function setPreloader(els: WalkElements, ratio: number) {
  els.preloader.style.setProperty('--progress', String(Math.min(1, ratio)));
  const pct = els.preloader.querySelector('[data-preloader-pct]');
  if (pct) pct.textContent = String(Math.round(ratio * 100));
}

function activate(els: WalkElements, id: StopId) {
  for (const s of els.sections) { if (s.dataset.stop === id) s.setAttribute('data-active', ''); else s.removeAttribute('data-active'); }
  for (const a of els.dock.querySelectorAll<HTMLAnchorElement>('a[data-stop-link]')) a.setAttribute('aria-current', a.dataset.stopLink === id ? 'true' : 'false');
}

// Moves keyboard focus onto the stop's heading once the camera has landed there, so a dock click
// (with or without a background-build wait first) reads the same to a screen reader either way.
function focusHeading(id: StopId) {
  const heading = document.querySelector<HTMLElement>(`section[data-stop="${id}"] .stop-title`);
  if (heading) { heading.setAttribute('tabindex', '-1'); setTimeout(() => heading.focus({ preventScroll: true }), 1700); }
}

async function startFull(els: WalkElements, tier: Tier, coarse: boolean) {
  const gen = ++generation;
  // Capture the requested stop before the scroll controller exists: ScrollTrigger's first
  // onUpdate can fire off a stale scroll position (left over from the browser's own
  // scroll-to-fragment while the page was still in boot layout) and rewrite location.hash via
  // history.replaceState before we get a chance to read it, corrupting which stop we open on.
  const raw = location.hash.replace('#', '');
  const initial: StopId = STOPS.some((s) => s.id === raw) ? (raw as StopId) : 'booth';
  els.root.dataset.mode = 'full';
  els.preloader.dataset.state = 'loading';
  els.preloader.setAttribute('aria-busy', 'true');
  const slow = setTimeout(() => {
    if (els.preloader.dataset.state === 'loading') {
      els.preloader.dataset.state = 'slow';
      const link = els.preloader.querySelector<HTMLAnchorElement>('[data-preloader-lite]');
      if (link) { link.href = `/?effects=off${location.hash}`; link.removeAttribute('hidden'); }
    }
  }, 8000);
  const giveUp = setTimeout(() => { if (gen === generation && els.preloader.dataset.state !== 'hidden') { teardown(); startLite(els); } }, 45000);
  try {
    // overlays.ts pulls three in, so it rides with the scene chunk rather than the eager bundle.
    const [{ mountWalk }, { createScroll }, { pinOverlays }] = await Promise.all([import('./scene'), import('./scroll'), import('./overlays')]);
    if (gen !== generation) return;
    const h = await mountWalk(els.canvas, {
      tier,
      coarse,
      gate: initial === 'booth' ? ['booth', 'fabrication'] : ['booth', 'fabrication', initial],
      initialProgress: tForStop(initial),
      onLoadProgress: (l, t) => setPreloader(els, l / t),
      // The dressed room did not arrive and the greybox is standing in. Flag it on the document so
      // it is visible in the DOM rather than only in the console.
      onDegraded: () => els.root.setAttribute('data-degraded', ''),
      onFallback: (reason) => {
        if (gen !== generation) return;
        console.warn(`walk fell back to the lite path: ${reason}`);
        try { sessionStorage.setItem(FALLBACK_KEY, reason); } catch { /* ignore */ }
        els.root.setAttribute('data-fallback', reason);
        teardown(); startLite(els);
      },
    });
    if (gen !== generation) { h.dispose(); return; }
    handle = h;
    // The camera moves every frame, so the panels pinned to world anchors have to follow it.
    const pin = () => { if (!handle) return; pinOverlays(els.sections, handle.anchors, handle.camera, scroll?.progress() ?? 0); pinRaf = requestAnimationFrame(pin); };
    pin();
    scroll = createScroll();
    scroll.onProgress((t) => handle?.setProgress(t));
    scroll.onStop((id) => activate(els, id));
    for (const a of els.dock.querySelectorAll<HTMLAnchorElement>('a[data-stop-link]')) {
      a.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        const id = a.dataset.stopLink as StopId;
        if (handle && !handle.ready(id)) {
          // The room is still building in the background. Show the tube, land when it exists, or
          // after 20s regardless so a download that never settles doesn't strand the dock at 90%.
          els.preloader.dataset.state = 'loading'; els.preloader.setAttribute('aria-busy', 'true');
          setPreloader(els, 0.9);
          const timeout = new Promise<void>((resolve) => setTimeout(resolve, 20_000));
          void Promise.race([handle.whenReady(id), timeout]).then(() => {
            if (gen !== generation) return;
            setPreloader(els, 1); els.preloader.dataset.state = 'done'; els.preloader.setAttribute('aria-busy', 'false');
            hiddenTimer = setTimeout(() => { if (els.preloader.dataset.state === 'done') els.preloader.dataset.state = 'hidden'; }, 1100);
            scroll?.jumpTo(id);
            focusHeading(id);
          });
          return;
        }
        scroll?.jumpTo(id);
        focusHeading(id);
      });
    }
    activate(els, initial);
    if (initial !== 'booth') scroll.jumpTo(initial, true);
    els.preloader.dataset.state = 'done';
    els.preloader.setAttribute('aria-busy', 'false');
    // 700 ms of tube flicker, then a 350 ms fade out. Hide once that has finished playing.
    hiddenTimer = setTimeout(() => { if (els.preloader.dataset.state === 'done') els.preloader.dataset.state = 'hidden'; }, 1100);
  } catch (err) {
    console.warn('walk failed to start, using the lite path', err);
    teardown();
    startLite(els);
  } finally { clearTimeout(slow); clearTimeout(giveUp); }
}

function teardown() {
  generation++;
  scroll?.dispose(); scroll = null;
  handle?.dispose(); handle = null;
  if (pinRaf) { cancelAnimationFrame(pinRaf); pinRaf = 0; }
  if (hiddenTimer) { clearTimeout(hiddenTimer); hiddenTimer = null; }
  if (hashchangeListener) { window.removeEventListener('hashchange', hashchangeListener); hashchangeListener = null; }
}

async function init() {
  const els = queryElements();
  if (!els) return;
  const input = readTierInput();
  const tier = decideTier(input);
  // Readable from devtools on a machine that runs badly: which tier it got and why.
  els.root.dataset.tier = tier; els.root.dataset.renderer = input.renderer;
  wireEffectsToggle(els, tier);
  if (tier === 'lite') startLite(els); else await startFull(els, tier, input.coarse);
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', teardown);
