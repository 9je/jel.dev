import { navigate } from 'astro:transitions/client';
import type { BayHandle } from './scene';
import type { WingId } from './constants';

let handle: BayHandle | null = null;
let mounting = false;
let generation = 0;
let safety = 0;

/** Milliseconds before the console is lit regardless, so its links are never invisible-but-focusable. */
const SAFETY_MS = 4000;

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    // Release the probe context: browsers cap live WebGL contexts.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

function clearSafety() {
  if (safety) { clearTimeout(safety); safety = 0; }
}

async function init() {
  const stage = document.querySelector<HTMLElement>('[data-bay]');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-bay-canvas]');
  const consoleEl = document.querySelector<HTMLElement>('[data-console]');
  if (!stage || !canvas || !consoleEl || handle || mounting) return;
  const gen = ++generation;

  clearSafety();
  safety = window.setTimeout(() => {
    safety = 0;
    if (consoleEl.dataset.lit === undefined) {
      consoleEl.dataset.lit = '';
      if (stage.dataset.mode === 'loading') stage.dataset.mode = 'still';
    }
  }, SAFETY_MS);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const still = new URLSearchParams(location.search).has('still');
  if (still) stage.dataset.still = '';

  if (!hasWebGL()) {
    stage.dataset.mode = 'still';
    consoleEl.dataset.lit = '';
    clearSafety();
    return;
  }

  let seen = false;
  try { seen = sessionStorage.getItem('jel:lit') === '1'; } catch { /* private mode */ }
  const quality = still || coarse || navigator.hardwareConcurrency < 4 ? 'low' : 'high';

  mounting = true;
  let h: BayHandle | null = null;
  try {
    const { mountBay } = await import('./scene');
    if (gen !== generation) return;
    h = await mountBay(canvas, {
      skipSequence: reduced || seen || still,
      quality,
      onSequenceDone() {
        clearSafety();
        consoleEl.dataset.lit = '';
        try { sessionStorage.setItem('jel:lit', '1'); } catch { /* ignore */ }
      },
    });
  } catch (err) {
    console.warn('Bay failed to start, using the still', err);
    stage.dataset.mode = 'still';
    consoleEl.dataset.lit = '';
    clearSafety();
    return;
  } finally { mounting = false; }

  if (gen !== generation) { h?.dispose(); return; }
  handle = h;
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
  generation++;
  clearSafety();
  window.removeEventListener('pointermove', onPointer);
  window.removeEventListener('scroll', onScroll);
  handle?.dispose();
  handle = null;
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', teardown);
