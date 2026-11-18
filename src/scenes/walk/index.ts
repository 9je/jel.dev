import { chooseTier, pixelRatioCap, readTierInput, type Tier, type TierInput } from './quality';
import type { WalkHandle } from './scene';
import type { ScrollController } from './scroll';
import { STOPS, stopAt, tForStop, type StopId } from './path';
import type { Hotspot } from './stages/types';
import { armMedia, disarmMedia, parseHash } from './panel';
import { onStreak, startStreakFeed } from './streak-feed';
import { retickStreak } from '../../content/ticker';

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

const STOP_IDS = STOPS.map((s) => s.id as string);
/** Every project the page carries a panel for, read off the templates the build wrote. */
const projectIds = (els: WalkElements) => new Set([...els.root.querySelectorAll<HTMLElement>('template[data-project-panel]')].map((t) => t.dataset.projectPanel!));
const panelTemplate = (els: WalkElements, id: string) => (/^[a-z0-9-]+$/.test(id) ? els.root.querySelector<HTMLTemplateElement>(`template[data-project-panel="${id}"]`) : null);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function markCurrentFromHash(els: WalkElements) {
  const named = parseHash(location.hash, STOP_IDS, projectIds(els));
  // A project's link on the stacked page lands on its row, unfolded.
  const row = named.project ? els.root.querySelector<HTMLDetailsElement>(`details[data-project="${named.project}"], details[data-flagship="${named.project}"]`) : null;
  if (row) { row.open = true; row.scrollIntoView({ block: 'start' }); }
  const id = named.stop ?? row?.closest<HTMLElement>('section[data-stop]')?.dataset.stop ?? 'booth';
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
  // The first bay of each wing stands open and the rest are one line, as the markup ships them. Set
  // here as well because the full walk closes every bay, and a fallback from it lands on this path.
  for (const d of els.root.querySelectorAll('details[data-stop-more], details[data-cert-wall]')) d.setAttribute('open', '');
  for (const list of els.root.querySelectorAll('[data-project-list]')) list.querySelector('details[data-flagship]')?.setAttribute('open', '');
  els.preloader.dataset.state = 'hidden';
  // The stacked page shows a project's pictures in its row. They wait to be scrolled to.
  for (const m of els.root.querySelectorAll('[data-inline-media]')) armMedia(m, { autoplay: false, lazy: true });
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
let columnOff: (() => void) | null = null;

/** What the facility log says as the load passes each share of it. */
const BOOT_LINES: [number, string][] = [[0, 'Mains power'], [0.2, 'Loading bay lights'], [0.45, 'Dispatch office'], [0.7, 'Booth'], [0.9, 'Door controller']];

/**
 * The load drives the sign, and a clock keeps it moving. A tube strikes when the load reaches its
 * seventh of the run, or when the last one struck 450 ms ago and the load has not moved on, so
 * the sign never sits half lit through a long stage: the last two sevenths are the room builds and
 * the shader warm up, and read by the load alone the sign stood at "J LL BS" for two seconds. No two
 * strike inside 140 ms of each other, so a load that jumps still lights them one at a time. The
 * percentage and the log line stay on the load itself.
 */
let struck = 0, lastStrike = 0, lastRatio = 0;
function setPreloader(els: WalkElements, ratio: number) {
  const r = lastRatio = Math.min(1, Math.max(0, ratio));
  const pct = els.preloader.querySelector('[data-preloader-pct]');
  if (pct) pct.textContent = String(Math.round(r * 100));
  const now = performance.now();
  if (r >= 1) struck = 7;
  else if (struck < 7 && now - lastStrike > 140 && (struck < Math.floor(r * 7 + 1e-6) || (r > 0.1 && now - lastStrike > 450))) { struck++; lastStrike = now; }
  for (const l of els.preloader.querySelectorAll<HTMLElement>('[data-n]')) l.toggleAttribute('data-lit', Number(l.dataset.n) < struck);
  const line = els.preloader.querySelector('[data-preloader-line]');
  if (line) line.textContent = BOOT_LINES.reduce((a, [at, text]) => (r >= at ? text : a), BOOT_LINES[0]![1]);
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
// The project the panel is showing, and the walk's scroll when it opened: walking on closes it.
let project: { id: string; at: number } | null = null;
let hashSync: (() => void) | null = null;
// The project a walk is on its way to open, so the same request arriving twice starts one walk.
let heading: string | null = null;
let resizeHold: (() => void) | null = null;

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
  if (project) {
    project = null;
    for (const el of els.root.querySelectorAll<HTMLElement>('.stop-inner')) el.inert = false;
    els.dock.inert = false;
    disarmMedia(card);
    delete card.dataset.kind;
    handle?.focus(null);
    // The address goes back to the stop's own, in place: the entry that opened the project stays
    // behind it, so the back button never reopens what was just put away.
    const stop = els.root.querySelector<HTMLElement>('section[data-stop][data-active]')?.dataset.stop;
    if (stop && parseHash(location.hash, STOP_IDS, projectIds(els)).project) history.replaceState(null, '', `#${stop}`);
  }
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
 * Opens a project in the panel: its template cloned in, its media given their addresses, the room's
 * camera leaned toward it. Every project answers this way, from its exhibit, from its row in the
 * copy column, and from its own link. `push` leaves a history entry, so the back button closes it.
 */
function showProject(id: string, els: WalkElements, opts: { push?: boolean; trigger?: HTMLElement | null } = {}): boolean {
  const card = els.card;
  const tpl = panelTemplate(els, id);
  const body = card?.querySelector<HTMLElement>('[data-exhibit-body]');
  if (!card || !tpl || !body) return false;
  const swap = !!project;
  // A certification's card is the same element, pinned beside its plate. It is put away first.
  if (!card.hidden && !swap) closeCard(els);
  disarmMedia(body);
  body.replaceChildren(tpl.content.cloneNode(true));
  card.setAttribute('aria-label', body.querySelector('[data-panel-title]')?.textContent?.trim() || 'Project');
  const section = els.root.querySelector<HTMLElement>(`section[data-stop="${tpl.dataset.stop}"]`);
  const wing = section?.style.getPropertyValue('--wing-light');
  if (wing) card.style.setProperty('--wing-light', wing);
  card.removeAttribute('data-side'); card.removeAttribute('data-offscreen');
  card.dataset.kind = 'project';
  card.dataset.anchor = id;
  // The entrance plays again for each project: the attribute is taken off and put back a frame on.
  card.removeAttribute('data-enter');
  card.hidden = false;
  card.scrollTop = 0;
  void card.offsetWidth;
  card.setAttribute('data-enter', '');
  armMedia(body, { autoplay: !reducedMotion() });
  // The row it stands for, so closing hands the keyboard back to this project's row and not to the
  // one a walk through the panel's Next began at.
  cardSource = opts.trigger ?? els.root.querySelector<HTMLElement>(`details[data-project="${id}"], details[data-flagship="${id}"]`);
  // What the panel hides is also out of the tab order while it is hidden.
  for (const el of els.root.querySelectorAll<HTMLElement>('.stop-inner')) el.inert = true;
  els.dock.inert = true;
  project = { id, at: scroll?.progress() ?? 0 };
  if (location.hash !== `#${id}`) {
    if (opts.push && !swap) history.pushState(null, '', `#${id}`); else history.replaceState(null, '', `#${id}`);
  }
  // How much of the frame the panel stands over, from its near edge to the far side, so the camera
  // can hold the exhibit in what is left. A sheet over the whole room leaves nothing to aim into.
  const left = card.getBoundingClientRect().left;
  handle?.focus(id, tpl.dataset.stop as StopId, left <= 1 ? 0 : 1 - left / window.innerWidth);
  card.querySelector<HTMLElement>('[data-exhibit-close]')?.focus({ preventScroll: true });
  return true;
}

/** Walks to a stop if the camera is somewhere else, and resolves once the jump has come to rest.
 *  Capped, since a jump interrupted by a wheel would otherwise never report the stop. */
async function walkTo(stop: StopId): Promise<void> {
  const s = scroll;
  if (!s || stopAt(s.progress()).id === stop) return;
  await new Promise<void>((resolve) => {
    let off: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => { off?.(); off = null; if (timer) clearTimeout(timer); timer = null; resolve(); };
    off = s.onStop((id) => { if (id === stop) finish(); });
    timer = setTimeout(finish, 2000);
    s.jumpTo(stop);
  });
}

/** Opens a project wherever the camera is: walks to its room first, lets the jump settle so the
 *  walk moving under an open panel does not close it, then opens it. */
async function goProject(id: string, els: WalkElements, opts: { push?: boolean; trigger?: HTMLElement | null } = {}) {
  const gen = generation;
  const stop = panelTemplate(els, id)?.dataset.stop as StopId | undefined;
  // The back button reports itself twice, as a history change and as a hash change.
  if (!stop || heading === id) return;
  const s = scroll;
  // An exhibit that is not at its stop's hold names where it is seen from, and the walk goes there.
  const view = handle?.hotspots().find((h) => h.id === id)?.view;
  const away = view !== undefined ? Math.abs((s?.progress() ?? view) - view) > 0.004 : !!s && stopAt(s.progress()).id !== stop;
  if (s && away) {
    heading = id;
    if (view !== undefined) s.walkTo(view); else await walkTo(stop);
    // The jump eases on after the room reports. Wait until the walk is where it was sent, since a
    // panel opened over a walk still moving is closed by it. Capped, for a jump that was cut short.
    const to = view ?? tForStop(stop);
    for (let n = 0; n < 100 && Math.abs(s.progress() - to) > 0.002; n++) await new Promise((r) => setTimeout(r, 80));
    if (heading === id) heading = null;
    // A reader who took the wheel on the way is somewhere else now, and wanted to be.
    if (gen !== generation || Math.abs(s.progress() - to) > 0.004) return;
  }
  showProject(id, els, opts);
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
  // A project opens its panel, on a phone as much as anywhere: there the panel is a sheet. It
  // opens where the camera stands. The reader picked a thing they can see, and walking them back
  // to the room's hold first would take it out of the frame they picked it in.
  // Unless the exhibit names a better place to see it from than here, and then the walk goes there.
  if (panelTemplate(els, h.id)) { if (h.view !== undefined) await goProject(h.id, els, { push: true }); else showProject(h.id, els, { push: true }); return; }
  await walkTo(h.stop);
  if (gen !== generation) return;
  // The panel may be showing a project. A certification's card takes its place.
  if (project) closeCard(els);
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

/** Lights the list row of the exhibit under the pointer, so the room and the list point at the same thing. */
function markRow(els: WalkElements, id: string | null) {
  for (const el of els.root.querySelectorAll('[data-hot]')) el.removeAttribute('data-hot');
  if (!id) return;
  for (const el of els.root.querySelectorAll<HTMLElement>('.stops [data-project], .stops [data-flagship]')) if ((el.dataset.project ?? el.dataset.flagship) === id) el.setAttribute('data-hot', '');
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
    markRow(els, h?.id ?? null);
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
  // The head follows the pointer a little while the walk is parked. Over the whole window, not the
  // canvas alone, so it does not snap back when the pointer crosses the copy or the panel.
  const onDrift = (e: PointerEvent) => { const [nx, ny] = interact.ndc(e.clientX, e.clientY, window.innerWidth, window.innerHeight); handle?.pointer(nx, ny); };
  const onDriftOut = () => handle?.pointer(0, 0);
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
  // A project's row in the copy column opens its panel, where it used to unfold in place. The click
  // on a summary is also what Enter and Space send, so the keyboard gets the same.
  const onRow = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const summary = (e.target as Element).closest?.('summary');
    const row = summary?.parentElement;
    const id = row instanceof HTMLDetailsElement ? row.dataset.project ?? row.dataset.flagship : undefined;
    if (!id || !panelTemplate(els, id)) return;
    e.preventDefault();
    void goProject(id, els, { push: true, trigger: summary as HTMLElement });
  };
  // Inside the panel: a tab swaps the picture, and the foot walks to the next project in the room.
  const onCard = (e: MouseEvent) => {
    const el = e.target as Element;
    const tab = el.closest<HTMLElement>('[data-shot-tab]');
    if (tab) {
      const hero = tab.closest('[data-panel-hero]');
      for (const s of hero?.querySelectorAll<HTMLElement>('[data-shot]') ?? []) s.toggleAttribute('data-current', s.dataset.shot === tab.dataset.shotTab);
      for (const t of hero?.querySelectorAll<HTMLElement>('[data-shot-tab]') ?? []) t.setAttribute('aria-pressed', t === tab ? 'true' : 'false');
      return;
    }
    const go = el.closest<HTMLElement>('[data-panel-go]');
    if (go && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) { e.preventDefault(); showProject(go.dataset.panelGo!, els); }
  };
  // And the other way: the pointer on a row lights its exhibit in the room.
  const rowOf = (e: Event) => { const r = (e.target as Element).closest?.<HTMLElement>('[data-project], [data-flagship]'); return r ? r.dataset.project ?? r.dataset.flagship : undefined; };
  const onRowOver = (e: Event) => { const id = rowOf(e); const h = id ? handle?.hotspots().find((x) => x.id === id) ?? null : null; handle?.hover(h); };
  const onRowOut = () => handle?.hover(null);
  els.root.querySelector('.stops')?.addEventListener('pointerover', onRowOver);
  els.root.querySelector('.stops')?.addEventListener('pointerleave', onRowOut);
  els.root.querySelector('.stops')?.addEventListener('click', onRow as EventListener);
  els.card?.addEventListener('click', onCard);
  closeBtn?.addEventListener('click', onClose);
  document.addEventListener('keydown', onEscape);

  // A coarse pointer has no hover to give, so it gets the tap alone and the label never shows.
  if (coarse) {
    els.canvas.addEventListener('pointerdown', onDown);
    els.canvas.addEventListener('pointerup', onUp);
  } else {
    els.canvas.addEventListener('pointermove', onMove);
    els.canvas.addEventListener('pointerleave', onLeave);
    els.canvas.addEventListener('click', onClick);
    window.addEventListener('pointermove', onDrift, { passive: true });
    document.documentElement.addEventListener('pointerleave', onDriftOut);
  }

  return () => {
    els.canvas.removeEventListener('pointerdown', onDown);
    els.canvas.removeEventListener('pointerup', onUp);
    els.canvas.removeEventListener('pointermove', onMove);
    els.canvas.removeEventListener('pointerleave', onLeave);
    els.canvas.removeEventListener('click', onClick);
    window.removeEventListener('pointermove', onDrift);
    document.documentElement.removeEventListener('pointerleave', onDriftOut);
    document.removeEventListener('keydown', onEscape);
    closeBtn?.removeEventListener('click', onClose);
    els.root.querySelector('.stops')?.removeEventListener('click', onRow as EventListener);
    els.root.querySelector('.stops')?.removeEventListener('pointerover', onRowOver);
    els.root.querySelector('.stops')?.removeEventListener('pointerleave', onRowOut);
    els.card?.removeEventListener('click', onCard);
    closeCard(els);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    hovered = null;
    hideLabel();
    els.canvas.style.cursor = '';
  };
}

async function startFull(els: WalkElements, tier: Tier, coarse: boolean, probed?: WebGL2RenderingContext | null) {
  const gen = ++generation;
  // The tier probe made its context on the canvas with the driver's MSAA only on a coarse pointer.
  // The low tier is the one that needs it, having no post stack to smooth edges, so a low tier on
  // a fine pointer swaps in a fresh canvas and lets the renderer make its own.
  let context = probed ?? undefined;
  if (context && (tier === 'low') !== coarse) {
    context.getExtension('WEBGL_lose_context')?.loseContext();
    const fresh = els.canvas.cloneNode() as HTMLCanvasElement; els.canvas.replaceWith(fresh); els.canvas = fresh;
    context = undefined;
  }
  // Capture the requested stop before the scroll controller exists: the controller's first
  // update can fire off a stale scroll position (left over from the browser's own
  // scroll-to-fragment while the page was still in boot layout) and rewrite location.hash via
  // history.replaceState before we get a chance to read it, corrupting which stop we open on.
  const named = parseHash(location.hash, STOP_IDS, projectIds(els));
  // A project's own link opens at its room, and then opens the project.
  const deep = named.project ?? null;
  const initial = (named.stop ?? (deep ? panelTemplate(els, deep)?.dataset.stop : null) ?? 'booth') as StopId;
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
  // The visitor has had the way out since 8 s. This is for a load that never lands: at 45 s it cut
  // off a slow machine a few seconds short of a three room gate it was still visibly working through.
  const giveUp = setTimeout(() => { if (gen === generation && els.preloader.dataset.state !== 'hidden') { teardown(); startLite(els); } }, 75000);
  // The sign's clock: the load only reports when something lands, and a tube is owed by time too.
  struck = 0; lastStrike = performance.now(); lastRatio = 0;
  const tick = setInterval(() => setPreloader(els, lastRatio), 100);
  try {
    // overlays.ts pulls three in, so it rides with the scene chunk rather than the eager bundle.
    const [{ mountWalk }, { createScroll }, { pinOverlays }, interact] = await Promise.all([import('./scene'), import('./scroll'), import('./overlays'), import('./interact')]);
    if (gen !== generation) return;
    const h = await mountWalk(els.canvas, {
      tier,
      coarse,
      context,
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
    pinCard = () => { if (handle && els.card && !els.card.hidden && els.card.dataset.kind !== 'project') pinOverlays(els.card, handle.anchors, handle.camera); };
    // The room's drop while a project is open: a shade over the canvas with a hole where the
    // exhibit is, placed each frame from where the scene says the exhibit sits.
    const dim = els.root.querySelector<HTMLElement>('[data-walk-dim]');
    let dimmed = 0;
    const shade = () => {
      if (!dim || !handle) return;
      const f = handle.focusState();
      if (f.dim === 0 && dimmed === 0) return;
      dimmed = f.dim;
      dim.toggleAttribute('data-on', f.dim > 0);
      dim.style.setProperty('--fd', f.dim.toFixed(3));
      dim.style.setProperty('--fx', `${(f.x * 100).toFixed(2)}%`);
      dim.style.setProperty('--fy', `${(f.y * 100).toFixed(2)}%`);
    };
    const pin = () => { if (!handle) return; pinCard?.(); shade(); pinRaf = requestAnimationFrame(pin); };
    pin();
    // A resize moves the walk under an open project, since the page is as long as the frame is tall.
    // That is not the reader walking on, so the project's mark is taken again from wherever the
    // walk lands. Registered ahead of the scroll's own resize listener, which is what reports it.
    resizeHold = () => { if (project) project.at = NaN; };
    window.addEventListener('resize', resizeHold);
    scroll = createScroll();
    const sc = scroll; h.beforeFrame((now) => sc.tick(now));
    scroll.onProgress((t) => {
      handle?.setProgress(t);
      // The cue has done its job the moment the walk moves, and it never comes back.
      if (t > 0.01) els.root.dataset.scrolled = '';
      // Walking on puts an open project away, the way it always did the card.
      if (project && Number.isNaN(project.at)) project.at = t;
      if (project && Math.abs(t - project.at) > 0.006) closeCard(els);
    });
    // The address is the state: a project's link opens it, and anything else puts it away. This is
    // what the back button, a pasted link and a link inside the copy all come through.
    hashSync = () => {
      const p = parseHash(location.hash, STOP_IDS, projectIds(els)).project;
      if (p && p !== project?.id) void goProject(p, els);
      else if (!p && project) closeCard(els);
    };
    window.addEventListener('hashchange', hashSync);
    window.addEventListener('popstate', hashSync);
    // The card belongs to the exhibit the camera is standing in front of. Walking away closes it.
    scroll.onStop((id) => { activate(els, id); closeCard(els); });
    for (const a of els.dock.querySelectorAll<HTMLAnchorElement>('a[data-stop-link]')) {
      a.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        const id = a.dataset.stopLink as StopId;
        closeCard(els);
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
    columnOff = wireColumnScroll(els);
    if (initial !== 'booth') scroll.jumpTo(initial, true);
    // The opening. Arriving at the booth, the camera starts on the sign at the size the preloader
    // drew it, so the preloader's fade is a cut from one sign to the same sign in the room, and then
    // it pulls back to the booth. The booth's copy strikes on once the pull back has landed, so the
    // room is revealed before anything is written over it. A deep link, or reduced motion, skips it.
    const sign = els.preloader.querySelector<HTMLElement>('[data-preloader-sign]');
    const open = initial === 'booth' && !matchMedia('(prefers-reduced-motion: reduce)').matches && !!sign;
    activate(els, initial);
    if (open) {
      const HOLD = 620, PULL = 2900;
      h.intro(sign!.getBoundingClientRect().width / window.innerWidth, HOLD, PULL);
      // walk.css holds the copy off and its strike back while this is set.
      els.root.dataset.opening = '';
      const end = () => { if (gen === generation) delete els.root.dataset.opening; };
      setTimeout(end, HOLD + PULL * 0.8);
      // A scroll cuts the pull back short, and the copy comes with it.
      scroll.onProgress((t) => { if (t > 0.004) end(); });
    }
    els.preloader.dataset.state = 'done';
    els.preloader.setAttribute('aria-busy', 'false');
    // The run catches for 420 ms, then the frame fades to the room over 480. Hide once that has played.
    hiddenTimer = setTimeout(() => { if (els.preloader.dataset.state === 'done') els.preloader.dataset.state = 'hidden'; }, 950);
    // Once the room is on screen, not over the preloader's last frames.
    if (deep) setTimeout(() => { if (gen === generation) void goProject(deep, els); }, 1000);
  } catch (err) {
    console.warn('walk failed to start, using the lite path', err);
    teardown();
    startLite(els);
  } finally { clearTimeout(slow); clearTimeout(giveUp); clearInterval(tick); }
}

function teardown() {
  generation++;
  unwire?.(); unwire = null;
  sheetOff?.(); sheetOff = null;
  columnOff?.(); columnOff = null;
  if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
  // The card's source row, so a swapped page does not hold the old one's DOM alive.
  cardSource = null;
  scroll?.dispose(); scroll = null;
  handle?.dispose(); handle = null;
  if (pinRaf) { cancelAnimationFrame(pinRaf); pinRaf = 0; }
  pinCard = null;
  if (hiddenTimer) { clearTimeout(hiddenTimer); hiddenTimer = null; }
  if (hashchangeListener) { window.removeEventListener('hashchange', hashchangeListener); hashchangeListener = null; }
  if (resizeHold) { window.removeEventListener('resize', resizeHold); resizeHold = null; }
  if (hashSync) { window.removeEventListener('hashchange', hashSync); window.removeEventListener('popstate', hashSync); hashSync = null; }
  project = null; heading = null;
}

/**
 * A copy column keeps the wheel for itself only while it has somewhere left to scroll. The card is
 * a panel and holds its wheel unconditionally, but the column stands over a third of the frame:
 * holding the wheel there when its three rows already fit would make that third of the screen dead
 * to the scroll that drives the whole walk.
 */
function wireColumnScroll(els: WalkElements): () => void {
  const bodies = Array.from(els.root.querySelectorAll<HTMLElement>('.stop-body'));
  // Two attributes off one measurement. `data-lenis-prevent` hands the wheel to a column that has
  // somewhere of its own to go, so the room does not walk out from under a reader halfway down a
  // paragraph. `data-more` says there is copy below the fold, and the card fades its last line
  // instead of cutting a sentence off square: the file's two paragraphs do not fit 28vh, and cut
  // flat the card read as broken type rather than as a card with more in it. It clears the moment
  // the reader reaches the end, which is why the scroll itself is listened to and not only the
  // pointer arriving.
  const sync = (el: HTMLElement) => {
    const over = el.scrollHeight > el.clientHeight + 1;
    el.toggleAttribute('data-lenis-prevent', over);
    el.toggleAttribute('data-more', over && el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  };
  const one = (e: Event) => sync(e.currentTarget as HTMLElement);
  const all = () => bodies.forEach(sync);
  for (const b of bodies) {
    b.addEventListener('pointerenter', one);
    b.addEventListener('scroll', one, { passive: true });
    b.addEventListener('toggle', all, true);
  }
  window.addEventListener('resize', all);
  all();
  return () => {
    for (const b of bodies) {
      b.removeEventListener('pointerenter', one);
      b.removeEventListener('scroll', one);
      b.removeEventListener('toggle', all, true);
      b.removeAttribute('data-lenis-prevent'); b.removeAttribute('data-more');
    }
    window.removeEventListener('resize', all);
  };
}

/** The banner is server rendered, so its streak line is as old as the last deploy. The live figure
 *  arrives a moment later and the text is rewritten in place, before the bay ever reads it. */
function wireStreak() {
  startStreakFeed();
  onStreak((d) => {
    for (const span of document.querySelectorAll<HTMLElement>('[data-ticker] span')) {
      span.textContent = retickStreak(span.textContent ?? '', d.current);
    }
  });
}

async function init() {
  const els = queryElements();
  if (!els) return;
  wireStreak();
  const input = readTierInput(els.canvas);
  const tier = decideTier(input);
  // Readable from devtools on a machine that runs badly: which tier it got and why.
  els.root.dataset.tier = tier; els.root.dataset.renderer = input.renderer;
  // `?timing` prints what this visit's load and frames did, on the page, for a machine that is slow
  // where the build machine is not. Fetched only when asked for.
  if (new URLSearchParams(location.search).has('timing')) void import('./timing').then((m) => m.startTiming(els.root));
  wireEffectsToggle(els, tier);
  if (tier === 'lite') { input.context?.getExtension('WEBGL_lose_context')?.loseContext(); startLite(els); } else await startFull(els, tier, input.coarse, input.context);
}

// A module script runs once the document is parsed, so the elements are there to query. The guard
// is for a script that is ever inlined ahead of them.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void init(); }); else void init();
