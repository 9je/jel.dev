import { chooseTier, readTierInput, type Tier } from './quality';

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

async function init() {
  const els = queryElements();
  if (!els) return;
  const tier = decideTier();
  wireEffectsToggle(els, tier);
  startLite(els); // Task 4 replaces this branch with the full path when tier !== 'lite'
}

document.addEventListener('astro:page-load', init);
