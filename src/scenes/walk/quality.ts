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
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function chooseTier(i: TierInput): Tier {
  if (!i.webgl) return 'lite';
  if (i.pref === 'off') return 'lite';
  const forced = i.pref === 'on';
  if (!forced && (i.reducedMotion || i.saveData)) return 'lite';
  if (SOFTWARE.test(i.renderer)) return forced ? 'low' : 'lite';
  if (i.coarse) return i.threads >= 4 ? 'low' : forced ? 'low' : 'lite';
  if (i.threads >= 8 && (i.memoryGB ?? 8) >= 8) return 'high';
  return 'medium';
}

export function readTierInput(): TierInput {
  let webgl = false, renderer = '';
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      webgl = true;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
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
  };
}
