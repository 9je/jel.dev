import { chooseTier, pixelRatioCap, readTierInput, type Tier, type TierInput } from './quality';
import type { WalkHandle } from './scene';
import type { ScrollController } from './scroll';
import { STOPS, stopAt, tForStop, type StopId } from './path';
import type { Hotspot } from './stages/types';

export interface WalkElements {
  root: HTMLElement; canvas: HTMLCanvasElement; dock: HTMLElement; preloader: HTMLElement; spacer: HTMLElement; sections: HTMLElement[]; hotspotLabel: HTMLElement | null; card: HTMLElement | null;
}

export function queryElements(): WalkElements | null {
  const root = document.querySelector<HTMLElement>('[data-walk]');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-walk-canvas]');
  const dock = document.querySelector<HTMLElement>('[data-dock]');
  const preloader = document.querySelector<HTMLElement>('[data-preloader]');
  const spacer = document.querySelector<HTMLElement>('[data-spacer]');
  if (!root || !canvas || !dock || !preloader || !spacer) return null;
  return {
    root, canvas, dock, preloader, spacer,
    sections: Array.from(document.querySelectorAll<HTMLElement>('section[data-stop]')),
    hotspotLabel: document.querySelector<HTMLElement>('[data-hotspot-label]'),
    card: document.querySelector<HTMLElement>('[data-exhibit-card]'),
  };
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
  // The stacked page has no toggle and no compact column: the styling both of those belong to is
  // scoped to the full walk. So every body, every flagship and the certification wall are open
  // here, including on a browser that got this far through a fallback after startFull closed them.
  for (const d of els.root.querySelectorAll('details[data-stop-more], details[data-flagship], details[data-cert-wall]')) d.setAttribute('open', '');
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
// Places the open exhibit card against its anchor. Held here so opening a card can place it in the
// same frame rather than leaving it at the default for one, and so teardown can drop it.
let pinCard: (() => void) | null = null;
// Everything the pointer wiring below added to the document, as one function, so teardown does not
// have to know the shape of it. The sheet handles are wired before the scene mounts, and a mount
// that never finishes still has to hand them back, so they keep their own.
let unwire: (() => void) | null = null;
let sheetOff: (() => void) | null = null;

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

type Interact = typeof import('./interact');

// How long a freshly opened row stays marked. The CSS animation runs for the same span.
const FOCUS_MS = 2500;
let focusTimer: ReturnType<typeof setTimeout> | null = null;
// The panel the open card was cloned from, so closing it can hand the keyboard back there.
let cardSource: HTMLElement | null = null;

/** The outline a panel wears for a moment, so the reader can see which row the exhibit was. */
function mark(el: HTMLElement, els: WalkElements) {
  if (focusTimer) clearTimeout(focusTimer);
  for (const prev of els.root.querySelectorAll('[data-focus]')) prev.removeAttribute('data-focus');
  el.setAttribute('data-focus', '');
  focusTimer = setTimeout(() => { el.removeAttribute('data-focus'); focusTimer = null; }, FOCUS_MS);
}

/** Unfolds the panel an exhibit belongs to, marks it, and puts the keyboard on it. The phone flow:
 *  a tap opens the sheet with that project's row open, where a card would cover the room. */
function openTarget(h: Hotspot, els: WalkElements, interact: Interact) {
  const el = interact.targetFor(h.id, h.kind, els.root);
  if (!el) return;
  // On a phone the stop body is a closed sheet, so the row would otherwise open inside something
  // nobody can see. startFull stripped `open` from it, and a tap is the reader asking for it back.
  els.root.querySelector(`section[data-stop="${h.stop}"] details[data-stop-more]`)?.setAttribute('open', '');
  if (el instanceof HTMLDetailsElement) el.open = true;
  mark(el, els);
  // The stop body is the only thing that should move. It sits inside a fixed layer, so the document
  // is already showing it, but a browser that decides otherwise would drive the camera through
  // Lenis, so the page scroll is put straight back.
  const y = window.scrollY;
  el.scrollIntoView({ block: 'nearest' });
  if (window.scrollY !== y) window.scrollTo(0, y);
  const key = el.querySelector<HTMLElement>('summary, h1, h2, h3, .badge-name') ?? el;
  // A summary is focusable already, and writing tabindex onto it would take the row out of the tab
  // order for good. Only a heading or a badge name, which are not focusable, needs the attribute.
  if (key.tabIndex < 0) key.setAttribute('tabindex', '-1');
  key.focus({ preventScroll: true });
}

/**
 * Empties the exhibit card and puts it away, handing the keyboard back to the row the card came
 * from, or to the stop's name when that row belongs to a stop the camera has already left. Opening
 * a card puts focus on its close control and a canvas takes no focus, so every close path has to do
 * this or the document is left focused on nothing at all.
 */
function closeCard(els: WalkElements) {
  const card = els.card;
  if (!card || card.hidden) return;
  const held = card.contains(document.activeElement);
  card.hidden = true;
  card.removeAttribute('data-anchor');
  card.querySelector('[data-exhibit-body]')?.replaceChildren();
  const src = cardSource; cardSource = null;
  if (!held) return;
  const active = els.root.querySelector<HTMLElement>('section[data-stop][data-active]');
  // A row in a stop the walk has moved on from is `visibility: hidden`, and focusing that is the
  // same as focusing nothing, so it falls back to the name of the stop the camera is at.
  const here = src && active?.contains(src) ? src.querySelector<HTMLElement>('summary') ?? src : null;
  const back = here ?? active?.querySelector<HTMLElement>('.stop-title') ?? null;
  if (!back) return;
  if (back.tabIndex < 0) back.setAttribute('tabindex', '-1');
  back.focus({ preventScroll: true });
}

/**
 * Opens the exhibit card beside the thing that was clicked, filled with that exhibit's own copy.
 * Every hotspot answers the same way: Jordan's complaint was that two of the three products in the
 * bay unfolded a row in the list and the third threw up a pinned panel.
 */
function openCard(h: Hotspot, els: WalkElements, interact: Interact) {
  const card = els.card;
  const src = interact.targetFor(h.id, h.kind, els.root);
  if (!card || !src) return;
  // The personnel file on the control desk stands for its stop rather than for a plate of its own,
  // and the stop's copy is already open in the column beside it. Marking it is the whole of what a
  // card would do here, so it is marked rather than duplicated.
  if (src.classList.contains('stop-body')) { mark(src, els); return; }
  card.querySelector('[data-exhibit-body]')?.replaceChildren(interact.exhibitContent(src, document));
  // The card is what the screen reader lands in, so it is named after the exhibit rather than left
  // as the word Exhibit next to a button called Close.
  card.setAttribute('aria-label', card.querySelector('.row-title, .bay-title, .badge-name, h3')?.textContent?.trim() || h.label);
  // The card lives outside the stop sections, so it does not inherit the wing's colour. The section
  // carries it in its own style attribute, which is cheaper to read than a computed style.
  const wing = src.closest<HTMLElement>('section[data-stop]')?.style.getPropertyValue('--wing-light');
  if (wing) card.style.setProperty('--wing-light', wing);
  handle?.ensureAnchor(h);
  cardSource = src;
  card.dataset.anchor = h.id;
  card.hidden = false;
  pinCard?.();
  mark(src, els);
  card.querySelector<HTMLElement>('[data-exhibit-close]')?.focus({ preventScroll: true });
}

/**
 * Walks to the exhibit's stop if the camera is somewhere else, waits for it to land, then opens the
 * panel. The wait is capped: a jump interrupted by a wheel would otherwise never report the stop and
 * the copy would never open.
 */
async function activateHotspot(h: Hotspot, els: WalkElements, coarse: boolean, interact: Interact) {
  const gen = generation;
  const s = scroll;
  if (s && stopAt(s.progress()).id !== h.stop) {
    await new Promise<void>((resolve) => {
      let off: (() => void) | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = () => { off?.(); off = null; if (timer) clearTimeout(timer); timer = null; resolve(); };
      off = s.onStop((id) => { if (id === h.stop) finish(); });
      timer = setTimeout(finish, 2000);
      s.jumpTo(h.stop);
    });
    if (gen !== generation) return;
  }
  if (coarse) openTarget(h, els, interact); else openCard(h, els, interact);
}

/**
 * The phone sheet's handle: it says which way it goes, and it takes a drag as well as a tap. A
 * flick up opens the sheet, a flick down closes it, and anything shorter than 24 px is a tap the
 * disclosure handles itself. The click after a drag is cancelled, or the swipe would open the
 * sheet and the tap behind it would close it again in the same gesture.
 */
function wireSheets(els: WalkElements): () => void {
  const undo: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
    el.addEventListener(type, fn);
    undo.push(() => el.removeEventListener(type, fn));
  };
  for (const d of els.root.querySelectorAll<HTMLDetailsElement>('details[data-stop-more]')) {
    if (d.dataset.wired) continue;
    d.dataset.wired = '';
    undo.push(() => { delete d.dataset.wired; });
    const label = d.querySelector<HTMLElement>('[data-stop-more-label]');
    const toggle = d.querySelector<HTMLElement>('.stop-more-toggle');
    on(d, 'toggle', () => { if (label) label.textContent = d.open ? 'Less' : 'More'; });
    if (!toggle) continue;
    let from = 0, dragged = false;
    on(toggle, 'pointerdown', (e) => { from = e.clientY; dragged = false; });
    on(toggle, 'pointerup', (e) => {
      const dy = e.clientY - from;
      if (Math.abs(dy) < 24) return;
      dragged = true;
      d.open = dy < 0;
    });
    on(toggle, 'click', (e) => { if (dragged) { e.preventDefault(); dragged = false; } });
  }
  return () => { for (const f of undo) f(); undo.length = 0; };
}

/** Pointer picking over the canvas. Returns the function that removes everything it added. */
function wirePointer(els: WalkElements, coarse: boolean, interact: Interact): () => void {
  const label = els.hotspotLabel;
  let hovered: Hotspot | null = null;
  let raf = 0;
  let at: { x: number; y: number } | null = null;
  let down: { x: number; y: number } | null = null;

  const hideLabel = () => { if (label) { label.hidden = true; label.textContent = ''; } };
  const setHover = (h: Hotspot | null) => {
    if (h === hovered) return;
    hovered = h;
    handle?.hover(h);
    els.canvas.style.cursor = h ? 'pointer' : '';
  };
  const pickAt = (x: number, y: number) => {
    if (!handle) return null;
    const [nx, ny] = interact.ndc(x, y, window.innerWidth, window.innerHeight);
    return handle.pick(nx, ny);
  };

  // One pick per frame however many moves the mouse reports: a gaming mouse sends a thousand a
  // second, and the cursor cannot be in two places within one frame anyway.
  const pickFrame = () => {
    raf = 0;
    const p = at;
    if (!p) return;
    const h = pickAt(p.x, p.y);
    setHover(h);
    if (!label) return;
    if (!h) { hideLabel(); return; }
    label.textContent = h.label;
    label.style.setProperty('--hx', `${p.x}px`);
    label.style.setProperty('--hy', `${p.y}px`);
    label.hidden = false;
  };

  const onMove = (e: PointerEvent) => { at = { x: e.clientX, y: e.clientY }; if (!raf) raf = requestAnimationFrame(pickFrame); };
  const onLeave = () => { at = null; if (raf) { cancelAnimationFrame(raf); raf = 0; } setHover(null); hideLabel(); };
  const open = (x: number, y: number) => {
    // A move queued a pick for the next frame, and it would paint the hover label back over the
    // cursor after the click cleared it. The click is the newer answer, so the pick is dropped.
    at = null; if (raf) { cancelAnimationFrame(raf); raf = 0; }
    hideLabel();
    const h = pickAt(x, y);
    // A click on the room and not on an exhibit is the reader putting the card away.
    if (!h) { closeCard(els); return; }
    setHover(null); hideLabel();
    void activateHotspot(h, els, coarse, interact);
  };
  const onClick = (e: MouseEvent) => open(e.clientX, e.clientY);
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
  // A tap, not a swipe: more than 8 px of travel was the reader walking the camera, not picking.
  const onUp = (e: PointerEvent) => {
    const d = down; down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
    open(e.clientX, e.clientY);
  };

  const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCard(els); };
  const onClose = () => closeCard(els);
  const closeBtn = els.card?.querySelector<HTMLElement>('[data-exhibit-close]') ?? null;

  // A coarse pointer has no hover to give, so it gets the tap alone and the label never shows.
  if (coarse) {
    els.canvas.addEventListener('pointerdown', onDown);
    els.canvas.addEventListener('pointerup', onUp);
  } else {
    els.canvas.addEventListener('pointermove', onMove);
    els.canvas.addEventListener('pointerleave', onLeave);
    els.canvas.addEventListener('click', onClick);
    document.addEventListener('keydown', onEscape);
    closeBtn?.addEventListener('click', onClose);
  }

  return () => {
    els.canvas.removeEventListener('pointerdown', onDown);
    els.canvas.removeEventListener('pointerup', onUp);
    els.canvas.removeEventListener('pointermove', onMove);
    els.canvas.removeEventListener('pointerleave', onLeave);
    els.canvas.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onEscape);
    closeBtn?.removeEventListener('click', onClose);
    closeCard(els);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    hovered = null;
    hideLabel();
    els.canvas.style.cursor = '';
  };
}

async function startFull(els: WalkElements, tier: Tier, coarse: boolean) {
  const gen = ++generation;
  // Capture the requested stop before the scroll controller exists: ScrollTrigger's first
  // onUpdate can fire off a stale scroll position (left over from the browser's own
  // scroll-to-fragment while the page was still in boot layout) and rewrite location.hash via
  // history.replaceState before we get a chance to read it, corrupting which stop we open on.
  const raw = location.hash.replace('#', '');
  const initial: StopId = STOPS.some((s) => s.id === raw) ? (raw as StopId) : 'booth';
  // The markup ships every stop body open so the stacked page reads with no JavaScript. Only the
  // full walk closes them, and only on a phone, where an open body would be a fixed sheet over the
  // room. Doing it here rather than in init() means the lite path never loses its in-flow copy.
  if (coarse) { for (const d of els.root.querySelectorAll('details[data-stop-more]')) d.removeAttribute('open'); sheetOff = wireSheets(els); }
  // And on a fine pointer the flagship and the certification wall are each one line of the compact
  // column rather than a panel over the room: the exhibits' cards carry the copy, and the row keeps
  // both of them a tab stop away for a reader with no pointer on the room. The sheet keeps them open.
  else for (const d of els.root.querySelectorAll('details[data-flagship], details[data-cert-wall]')) d.removeAttribute('open');
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
    const [{ mountWalk }, { createScroll }, { pinOverlays }, interact] = await Promise.all([import('./scene'), import('./scroll'), import('./overlays'), import('./interact')]);
    if (gen !== generation) return;
    const h = await mountWalk(els.canvas, {
      tier,
      coarse,
      pixelRatioCap: pixelRatioCap(tier, coarse),
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
    pinCard = () => { if (handle && els.card && !els.card.hidden) pinOverlays(els.card, handle.anchors, handle.anchorRadii, handle.camera); };
    const pin = () => { if (!handle) return; pinCard?.(); pinRaf = requestAnimationFrame(pin); };
    pin();
    scroll = createScroll();
    scroll.onProgress((t) => {
      handle?.setProgress(t);
      // The cue has done its job the moment the walk moves, and it never comes back.
      if (t > 0.01) els.root.dataset.scrolled = '';
    });
    // The card belongs to the exhibit the camera is standing in front of. Walking away closes it.
    scroll.onStop((id) => { activate(els, id); closeCard(els); });
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
          // Cleared as soon as the race settles: readiness usually wins it, and a timer left armed
          // would keep the tab awake for another twenty seconds for nothing.
          let waitTimer: ReturnType<typeof setTimeout> | undefined;
          const timeout = new Promise<void>((resolve) => { waitTimer = setTimeout(resolve, 20_000); });
          void Promise.race([handle.whenReady(id), timeout]).then(() => {
            clearTimeout(waitTimer);
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
    unwire = wirePointer(els, coarse, interact);
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
  unwire?.(); unwire = null;
  sheetOff?.(); sheetOff = null;
  if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
  // The card's source row, so a swapped page does not hold the old one's DOM alive.
  cardSource = null;
  scroll?.dispose(); scroll = null;
  handle?.dispose(); handle = null;
  if (pinRaf) { cancelAnimationFrame(pinRaf); pinRaf = 0; }
  pinCard = null;
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
