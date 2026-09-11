import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { planTargets } from '../../scripts/assets/build.mjs';

const src = JSON.parse(readFileSync('scripts/assets/manifest.json', 'utf8'));

describe('asset source manifest', () => {
  it('names every group later tasks rely on', () => {
    const groups = new Set([...Object.values(src.textures), ...Object.values(src.models)].map((e: any) => e.group));
    expect([...groups].sort()).toEqual(['booth', 'containment', 'credentials', 'fabrication', 'fabrication-dressing', 'fabrication-extra', 'file', 'labs', 'operations', 'recreation']);
  });
  it('plans desktop and phone outputs for every entry', () => {
    const plan = planTargets(src, 'desktop');
    expect(plan.textures.metal_plate.out.diffuse).toBe('public/assets/desktop/textures/metal_plate/diffuse.webp');
    expect(plan.textures.concrete_floor.size).toBe(1024);
    expect(plan.textures.metal_plate.size).toBe(768);  // per-texture cap
    expect(planTargets(src, 'phone').textures.metal_plate.size).toBe(512);  // the cap never raises a tier
    expect(plan.models.desk.out).toBe('public/assets/desktop/models/desk.glb');
    expect(planTargets(src, 'phone').models.desk.size).toBe(256);
  });
  it('reads a tracked third party model from its source, with its credit', () => {
    const plan = planTargets(src, 'desktop');
    expect(plan.models.gamecube_controller.raw).toBe('assets/src/gamecube_controller/scene.gltf');
    expect(plan.models.gamecube_controller.out).toBe('public/assets/desktop/models/gamecube_controller.glb');
    expect(src.models.gamecube_controller.credit.license).toBe('CC-BY-4.0');
    expect(plan.models.gamecube_controller.group).toBe('fabrication-dressing');
  });
});
