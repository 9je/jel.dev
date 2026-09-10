export type Tier = 'high' | 'medium' | 'low' | 'lite';
export interface TierInput {
  webgl: boolean;
  renderer: string;
  threads: number;
  coarse: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  pref: 'on' | 'off' | null;
  memoryGB?: number;
  /** The browser refused a context with `failIfMajorPerformanceCaveat`: it would have been software. */
  caveat?: boolean;
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|warp/i;
// Checked before INTEGRATED because every Intel string, Arc included, also matches "intel".
const DISCRETE = /nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|radeon vii|\barc\b|\bfirepro\b/i;
// Shares system memory with the CPU and a fraction of a discrete card's fill rate. Iris Xe on a
// U-series laptop, Radeon(TM) Graphics on a Ryzen APU, and the phone GPUs all belong here.
const INTEGRATED = /intel|iris|uhd graphics|hd graphics|radeon\(tm\)|vega|mali|adreno|powervr|videocore|xclipse|immortalis/i;

/**
 * The GPU is the bottleneck, so the renderer string is the first word. Thread count and memory only
 * separate high from medium once a discrete card is known to be present. A laptop with twelve
 * threads and an integrated GPU used to land on `high` and crash the tab.
 */
export function chooseTier(i: TierInput): Tier {
  if (!i.webgl) return 'lite';
  if (i.pref === 'off') return 'lite';
  const forced = i.pref === 'on';
  if (!forced && (i.reducedMotion || i.saveData)) return 'lite';
  if (i.caveat || SOFTWARE.test(i.renderer)) return forced ? 'low' : 'lite';
  if (i.coarse) return i.threads >= 4 ? 'low' : forced ? 'low' : 'lite';
  if (DISCRETE.test(i.renderer)) return i.threads >= 8 && (i.memoryGB ?? 8) >= 8 ? 'high' : 'medium';
  if (INTEGRATED.test(i.renderer)) return 'low';
  // Apple silicon, a masked string, or a card we do not know. Medium has no SSAO and no shadows,
  // so it is the safe middle when the hardware is unknown.
  return 'medium';
}

export function readTierInput(): TierInput {
  let webgl = false, renderer = '', caveat = false;
  try {
    const c = document.createElement('canvas');
    let gl = (c.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) || c.getContext('webgl', { failIfMajorPerformanceCaveat: true })) as WebGLRenderingContext | null;
    if (!gl) {
      // Software WebGL exists but the browser is warning us off it. Read the renderer anyway so the
      // document can say what it was, then classify it as a caveat.
      caveat = true;
      gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    }
    if (gl) {
      webgl = true;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER) ?? '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch { webgl = false; }
  let pref: 'on' | 'off' | null = null;
  try { const v = localStorage.getItem('jel:effects'); pref = v === 'on' || v === 'off' ? v : null; } catch { /* ignore */ }
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  return {
    webgl,
    renderer,
    threads: navigator.hardwareConcurrency || 2,
    coarse: matchMedia('(pointer: coarse)').matches,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: !!nav.connection?.saveData,
    pref,
    memoryGB: nav.deviceMemory,
    caveat,
  };
}

/** How many physical pixels per CSS pixel the walk renders. Phones have DPR 3 screens and tile
 *  based GPUs that shade a 1.5 frame comfortably; an integrated desktop GPU on a 1080p panel does
 *  not, and stays at one. */
export function pixelRatioCap(tier: Tier, coarse: boolean): number {
  if (tier === 'lite') return 1;
  if (tier === 'low') return coarse ? 1.5 : 1;
  return 1.5;
}

export type Verdict = 'keep' | 'trim' | 'bail';

/**
 * Frame-time governor for a scene that was tiered too high. Measured in wall time, not frames: a
 * machine at 6 fps used to need twenty seconds to fill the old 120 frame sample. The first second
 * after each decision is ignored because shader compiles and texture uploads land there.
 *
 * Window one (2 s): under `trimFps`, ask the scene to drop the post stack, shadows and pixel ratio.
 * Window two (3 s, after the trim): still under `bailFps`, hand the page to the lite path.
 */
export class FrameGovernor {
  private stage: 0 | 1 | 2 = 0;
  private settle = 0; private elapsed = 0; private frames = 0;
  constructor(private readonly trimFps = 24, private readonly bailFps = 20, private readonly warmup = 1) {}
  push(dt: number): Verdict {
    if (this.stage === 2) return 'keep';
    if (this.settle < this.warmup) { this.settle += dt; return 'keep'; }
    this.elapsed += dt; this.frames++;
    const window = this.stage === 0 ? 2 : 3;
    if (this.elapsed < window) return 'keep';
    const fps = this.frames / this.elapsed;
    const floor = this.stage === 0 ? this.trimFps : this.bailFps;
    const verdict: Verdict = fps >= floor ? 'keep' : this.stage === 0 ? 'trim' : 'bail';
    this.settle = 0; this.elapsed = 0; this.frames = 0;
    this.stage = verdict === 'keep' || verdict === 'bail' ? 2 : 1;
    return verdict;
  }
}
