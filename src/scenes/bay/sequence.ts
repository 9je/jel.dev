export interface LightState { banks: number[]; cube: number; gates: number; sign: number; console: number }

export const SEQUENCE_DURATION = 2.2;
const BANK_START = 0.2;
const BANK_STEP = 0.25;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Two dips then hold, over one bank's window. local is 0..1. */
function flicker(local: number): number {
  if (local <= 0) return 0;
  if (local >= 1) return 1;
  if (local < 0.15) return 0.6;
  if (local < 0.3) return 0.05;
  if (local < 0.5) return 0.9;
  if (local < 0.6) return 0.2;
  return 1;
}

export function lightsOnState(t: number): LightState {
  const banks = [0, 1, 2, 3].map((i) => flicker((t - (BANK_START + i * BANK_STEP)) / BANK_STEP));
  return {
    banks,
    cube: clamp01((t - 1.2) / 0.4),
    gates: clamp01((t - 1.6) / 0.4),
    sign: clamp01((t - 2.0) / 0.2),
    console: clamp01((t - 2.0) / 0.2),
  };
}

export const LIT: LightState = { banks: [1, 1, 1, 1], cube: 1, gates: 1, sign: 1, console: 1 };
