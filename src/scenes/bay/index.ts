import { navigate } from 'astro:transitions/client';
import type { BayHandle } from './scene';
import type { WingId } from './constants';

let handle: BayHandle | null = null;
let mounting = false;

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

async function init() {
  const stage = document.querySelector<HTMLElement>('[data-bay]');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-bay-canvas]');
  const consoleEl = document.querySelector<HTMLElement>('[data-console]');
  if (!stage || !canvas || !consoleEl || handle || mounting) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const still = new URLSearchParams(location.search).has('still');
  if (still) stage.dataset.still = '';

  if (!hasWebGL()) {
    stage.dataset.mode = 'still';
    consoleEl.dataset.lit = '';
    return;
  }

  let seen = false;
  try { seen = sessionStorage.getItem('jel:lit') === '1'; } catch { /* private mode */ }
  const quality = navigator.hardwareConcurrency >= 4 && !coarse ? 'high' : 'low';

  mounting = true;
  try {
    const { mountBay } = await import('./scene');
    handle = await mountBay(canvas, {
      skipSequence: reduced || seen || still,
      quality,
      onSequenceDone() {
        consoleEl.dataset.lit = '';
        try { sessionStorage.setItem('jel:lit', '1'); } catch { /* ignore */ }
      },
    });
  } catch (err) {
    console.warn('Bay failed to start, using the still', err);
    stage.dataset.mode = 'still';
    consoleEl.dataset.lit = '';
    return;
  } finally { mounting = false; }
  stage.dataset.mode = 'live';

  for (const a of consoleEl.querySelectorAll<HTMLAnchorElement>('a[data-wing]')) {
    const id = a.dataset.wing as WingId;
    a.addEventListener('pointerenter', () => handle?.setHover(id));
    a.addEventListener('focus', () => handle?.setHover(id));
    a.addEventListener('pointerleave', () => handle?.setHover(null));
    a.addEventListener('blur', () => handle?.setHover(null));
    a.addEventListener('click', async (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      a.dataset.on = '';
      await handle?.flare(id);
      navigate(a.href);
    });
  }

  if (!reduced && !coarse) {
    window.addEventListener('pointermove', onPointer, { passive: true });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
}

function onPointer(e: PointerEvent) {
  handle?.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}
function onScroll() {
  handle?.setScroll(window.scrollY / window.innerHeight);
}

function teardown() {
  window.removeEventListener('pointermove', onPointer);
  window.removeEventListener('scroll', onScroll);
  handle?.dispose();
  handle = null;
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', teardown);
