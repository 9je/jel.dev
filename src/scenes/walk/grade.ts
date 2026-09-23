import * as THREE from 'three';
import type { StopId } from './path';

/**
 * Each room's grade: the ambient fill, the haze and the exposure it is seen through. The walk is a
 * building after hours, so the fill is low and the room's own work lights carry the frame: one lit
 * subject per stop, the rest falling off into haze in the room's colour. One fill at 1.3 for every
 * room lit the whole building to the same grey, and a lit subject had nothing darker to stand on.
 *
 * All of these are uniforms, so a room change eases them without recompiling anything. The haze is
 * also the background, so the void past a room's far wall is the same colour as its air.
 */
/** `env` is the room environment's reflection strength, which was a second fill as strong as the
 *  hemisphere and just as even. */
export interface Grade { sky: number; ground: number; fill: number; env: number; haze: number; density: number; exposure: number }

export const GRADES: Record<StopId, Grade> = {
  // Outside, at night. The neon and the lamp are the only light worth having.
  booth: { sky: 0x2a3644, ground: 0x0a0d11, fill: 0.3, env: 0.05, haze: 0x080c10, density: 0.016, exposure: 1.0 },
  // Sodium at the docks bouncing warm off the concrete, cold air overhead.
  fabrication: { sky: 0x5b6875, ground: 0x221a12, fill: 0.4, env: 0.06, haze: 0x12110f, density: 0.014, exposure: 1.05 },
  // The cabinets and the machines are the light. The room around them is blue and low.
  recreation: { sky: 0x3b5178, ground: 0x0f141d, fill: 0.35, env: 0.06, haze: 0x0b111c, density: 0.018, exposure: 1.0 },
  // Cold, and hazy down the aisle, so the far cages fade instead of stopping.
  operations: { sky: 0x4a5f6f, ground: 0x0a0f14, fill: 0.25, env: 0.05, haze: 0x0b1218, density: 0.026, exposure: 1.0 },
  // The clean lab is the one bright room in the building. It keeps most of its fill.
  credentials: { sky: 0x8499a6, ground: 0x263038, fill: 0.75, env: 0.12, haze: 0x151c22, density: 0.01, exposure: 1.0 },
  // Emergency power. Red in the shadows, one lamp on the table.
  containment: { sky: 0x3b2c30, ground: 0x0f0808, fill: 0.25, env: 0.04, haze: 0x110a0b, density: 0.022, exposure: 1.0 },
  // A dark control room and a desk lamp.
  file: { sky: 0x27313b, ground: 0x0a0c0f, fill: 0.25, env: 0.05, haze: 0x07090c, density: 0.018, exposure: 1.1 },
};

/** The grade as it eases from one room's to the next. */
export class GradeState {
  readonly sky = new THREE.Color(); readonly ground = new THREE.Color(); readonly haze = new THREE.Color();
  fill = 0; env = 0; density = 0; exposure = 1;
  private readonly to = { sky: new THREE.Color(), ground: new THREE.Color(), haze: new THREE.Color() };

  constructor(start: Grade) { this.snap(start); }

  snap(g: Grade): void {
    this.sky.setHex(g.sky); this.ground.setHex(g.ground); this.haze.setHex(g.haze);
    this.fill = g.fill; this.env = g.env; this.density = g.density; this.exposure = g.exposure;
  }

  /** Eases toward `g` over about half a second: the walk crosses a doorway in about that. */
  toward(g: Grade, dt: number): void {
    const k = 1 - Math.exp(-4 * dt);
    this.sky.lerp(this.to.sky.setHex(g.sky), k); this.ground.lerp(this.to.ground.setHex(g.ground), k); this.haze.lerp(this.to.haze.setHex(g.haze), k);
    this.fill += (g.fill - this.fill) * k; this.env += (g.env - this.env) * k; this.density += (g.density - this.density) * k; this.exposure += (g.exposure - this.exposure) * k;
  }
}
