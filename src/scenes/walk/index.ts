import { chooseTier, readTierInput, type Tier } from './quality';
import type { WalkHandle } from './scene';
import type { ScrollController } from './scroll';
import type { StopId } from './path';

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

export function decideTier(): Tier {
  const q = new URLSearchParams(location.search);
  const forced = q.get('effects');
  if (forced === 'off') { try { localStorage.setItem('jel:effects', 'off'); } catch { /* ignore */ } return 'lite'; }
  if (forced === 'on') { try { localStorage.setItem('jel:effects', 'on'); } catch { /* ignore */ } }
  const input = readTierInput();
  const q2 = q.get('quality');
  if (q2 === 'low' || q2 === 'medium' || q2 === 'high') return input.webgl ? q2 : 'lite';
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
    location.href = url.pathname + url.search + url.hash;
  });
}

function markCurrentFromHash(els: WalkElements) {
  const id = location.hash.replace('#', '') || 'booth';
  for (const a of els.dock.querySelectorAll<HTMLAnchorElement>('a[data-stop-link]')) {
    a.setAttribute('aria-current', a.dataset.stopLink === id ? 'true' : 'false');
  }
}

export function startLite(els: WalkElements) {
  els.root.dataset.mode = 'lite';
  els.preloader.dataset.state = 'hidden';
  markCurrentFromHash(els);
  window.addEventListener('hashchange', () => markCurrentFromHash(els));
}

let generation = 0;
let handle: WalkHandle | null = null;
let scroll: ScrollController | null = null;

function setPreloader(els: WalkElements, ratio: number) {
  els.preloader.style.setProperty('--progress', String(Math.min(1, ratio)));
  const pct = els.preloader.querySelector('[data-preloader-pct]');
  if (pct) pct.textContent = String(Math.round(ratio * 100));
}

function activate(els: WalkElements, id: StopId) {
  for (const s of els.sections) { if (s.dataset.stop === id) s.setAttribute('data-active', ''); else s.removeAttribute('data-active'); }
  for (const a of els.dock.querySelectorAll<HTMLAnchorElement>('a[data-stop-link]')) a.setAttribute('aria-current', a.dataset.stopLink === id ? 'true' : 'false');
}

async function startFull(els: WalkElements, tier: Tier) {
  const gen = ++generation;
  els.root.dataset.mode = 'full';
  els.preloader.dataset.state = 'loading';
  els.preloader.setAttribute('aria-busy', 'true');
  const slow = setTimeout(() => {
    if (els.preloader.dataset.state === 'loading') { els.preloader.dataset.state = 'slow'; els.preloader.querySelector('[data-preloader-lite]')?.removeAttribute('hidden'); }
  }, 8000);
  const giveUp = setTimeout(() => { if (gen === generation && els.preloader.dataset.state !== 'hidden') { teardown(); startLite(els); } }, 45000);
  try {
    const [{ mountWalk }, { createScroll }] = await Promise.all([import('./scene'), import('./scroll')]);
    if (gen !== generation) return;
    const h = await mountWalk(els.canvas, { tier, onLoadProgress: (l, t) => setPreloader(els, l / t) });
    if (gen !== generation) { h.dispose(); return; }
    handle = h;
    scroll = createScroll();
    scroll.onProgress((t) => handle?.setProgress(t));
    scroll.onStop((id) => activate(els, id));
    for (const a of els.dock.querySelectorAll<HTMLAnchorElement>('a[data-stop-link]')) {
      a.addEventListener('click', (e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); scroll?.jumpTo(a.dataset.stopLink as StopId); });
    }
    const initial = (location.hash.replace('#', '') || 'booth') as StopId;
    activate(els, initial);
    if (initial !== 'booth') scroll.jumpTo(initial, true);
    els.preloader.dataset.state = 'done';
    els.preloader.setAttribute('aria-busy', 'false');
    setTimeout(() => { if (els.preloader.dataset.state === 'done') els.preloader.dataset.state = 'hidden'; }, 500);
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
}

async function init() {
  const els = queryElements();
  if (!els) return;
  const tier = decideTier();
  wireEffectsToggle(els, tier);
  if (tier === 'lite') startLite(els); else await startFull(els, tier);
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', teardown);
