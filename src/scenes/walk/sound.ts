import { roomAt, type StopId } from './path';

/**
 * The building's sound, made in the browser rather than downloaded: every bed is filtered noise
 * and a few oscillators, so the whole thing costs a few kilobytes of script and nothing on the wire.
 * Off until the visitor turns it on, because a page that starts making noise is a page people close,
 * and browsers will not start an audio context without a gesture anyway.
 *
 * Each room has one bed, and the walk crossfades between them as it moves: the hall's rumble, the
 * break room's fridge hum, the server fans, the clean room's air handling, the switchgear's drone.
 * The mains hum under the lab rooms is the one thing they share, which is what makes them one
 * building rather than six recordings.
 */
export interface Sound { setProgress(t: number): void; dispose(): void }

const KEY = 'jel:sound';
const FADE = 1.2;

export type Bed = (ctx: AudioContext, noise: AudioBuffer, out: AudioNode) => void;

export function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  // Pink-ish noise (Paul Kellet's economy filter), which sits lower and softer than white.
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
  }
  return buf;
}

/** A looping noise source through a filter, at a level, into `out`. */
function band(ctx: AudioContext, noise: AudioBuffer, out: AudioNode, type: BiquadFilterType, freq: number, q: number, level: number, wobble = 0): void {
  const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
  // Each bed starts its loop somewhere different, so two beds of one buffer never phase together.
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = level;
  src.connect(f).connect(g).connect(out);
  if (wobble) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 0.07 + Math.random() * 0.08; depth.gain.value = level * wobble;
    lfo.connect(depth).connect(g.gain); lfo.start();
  }
  src.start(0, Math.random() * noise.duration);
}

/** A tone and its harmonics, for hum. */
function hum(ctx: AudioContext, out: AudioNode, base: number, levels: number[]): void {
  levels.forEach((level, i) => {
    const o = ctx.createOscillator(); o.frequency.value = base * (i + 1);
    const g = ctx.createGain(); g.gain.value = level;
    o.connect(g).connect(out); o.start();
  });
}

export const BEDS: Record<StopId, Bed> = {
  // The loading bay at night: wind across the shutter and the tube overhead buzzing.
  booth: (ctx, n, out) => { band(ctx, n, out, 'bandpass', 380, 0.6, 0.5, 0.6); band(ctx, n, out, 'bandpass', 2400, 8, 0.05); hum(ctx, out, 120, [0.004, 0.003]); },
  // A steel hall twelve metres high: a low rumble and the air moving through the roof.
  fabrication: (ctx, n, out) => { band(ctx, n, out, 'lowpass', 90, 0.7, 1.1, 0.3); band(ctx, n, out, 'bandpass', 260, 0.8, 0.25, 0.5); },
  // The break room: fridges and the vending machines, and the ceiling's tubes.
  recreation: (ctx, n, out) => { hum(ctx, out, 50, [0.012, 0.018, 0.006, 0.004]); band(ctx, n, out, 'lowpass', 400, 0.7, 0.25); band(ctx, n, out, 'bandpass', 2400, 8, 0.04); },
  // The server hall: fans, a lot of them, and the whine of the fastest.
  operations: (ctx, n, out) => { band(ctx, n, out, 'bandpass', 1100, 0.6, 0.9, 0.1); band(ctx, n, out, 'lowpass', 300, 0.7, 0.4); hum(ctx, out, 2900, [0.0025]); hum(ctx, out, 50, [0.008, 0.01]); },
  // The clean room: air handling, steady and soft.
  credentials: (ctx, n, out) => { band(ctx, n, out, 'lowpass', 700, 0.5, 0.45); hum(ctx, out, 50, [0.006, 0.008]); },
  // The switchgear room: transformers, a deep drone and not much else.
  containment: (ctx, n, out) => { hum(ctx, out, 50, [0.02, 0.028, 0.01, 0.006]); band(ctx, n, out, 'lowpass', 120, 0.9, 0.5, 0.4); },
  // The control room: quiet, the equipment on the desk and the building around it.
  file: (ctx, n, out) => { band(ctx, n, out, 'lowpass', 500, 0.6, 0.2); hum(ctx, out, 50, [0.005, 0.007]); band(ctx, n, out, 'bandpass', 5200, 10, 0.012); },
};

/**
 * Each bed's trim in decibels, measured rather than guessed: every bed was rendered offline and its
 * RMS level read off, then trimmed so the loud rooms (the steel hall, the server fans) sit about
 * four decibels over the quiet ones and none of them is more than ambience. Untrimmed, the hall's
 * rumble ran fifteen decibels over the control room.
 */
export const TRIM_DB: Record<StopId, number> = { booth: -2.5, fabrication: -5.5, recreation: 1, operations: -2, credentials: -3, containment: -3.5, file: 0 };

/** Wires the dock's sound button. Returns the handle the walk feeds its scroll position to. */
export function wireSound(button: HTMLButtonElement): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const gains = new Map<StopId, GainNode>();
  let room: StopId = 'booth';
  let on = false;
  try { on = localStorage.getItem(KEY) === 'on'; } catch { /* ignore */ }

  const label = () => { button.setAttribute('aria-pressed', String(on)); button.textContent = on ? 'Sound on' : 'Sound off'; };

  const build = () => {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const noise = noiseBuffer(ctx);
    for (const [id, bed] of Object.entries(BEDS) as [StopId, Bed][]) {
      const g = ctx.createGain(); g.gain.value = id === room ? 1 : 0; g.connect(master);
      const trim = ctx.createGain(); trim.gain.value = 10 ** (TRIM_DB[id] / 20); trim.connect(g);
      bed(ctx, noise, trim); gains.set(id, g);
    }
  };

  const apply = () => {
    if (on && !ctx) build();
    if (!ctx || !master) return;
    if (on) void ctx.resume();
    master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, on ? 0.6 : 0.15);
    if (!on) setTimeout(() => { if (!on) void ctx?.suspend(); }, 800);
  };

  const onClick = () => { on = !on; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ } label(); apply(); };
  button.addEventListener('click', onClick);
  // Remembered as on from a last visit: the context still needs a gesture, so the first one starts it.
  const firstGesture = () => { if (on) apply(); };
  window.addEventListener('pointerdown', firstGesture, { once: true });
  window.addEventListener('keydown', firstGesture, { once: true });
  const onVisibility = () => { if (!ctx) return; if (document.hidden) void ctx.suspend(); else if (on) void ctx.resume(); };
  document.addEventListener('visibilitychange', onVisibility);
  label();

  return {
    setProgress(t) {
      const next = roomAt(t).id;
      if (next === room) return;
      room = next;
      if (!ctx) return;
      for (const [id, g] of gains) g.gain.setTargetAtTime(id === room ? 1 : 0, ctx.currentTime, FADE / 3);
    },
    dispose() {
      button.removeEventListener('click', onClick);
      window.removeEventListener('pointerdown', firstGesture);
      window.removeEventListener('keydown', firstGesture);
      document.removeEventListener('visibilitychange', onVisibility);
      void ctx?.close(); ctx = null; master = null; gains.clear();
    },
  };
}
