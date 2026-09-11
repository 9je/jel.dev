import { describe, expect, it } from 'vitest';
import { Light, Scene, Vector3 } from 'three';
import { greybox } from '../../src/scenes/walk/stages/greybox';
import { STOPS, type StopId } from '../../src/scenes/walk/path';
import type { StageContext } from '../../src/scenes/walk/stages/types';

function ctx(): StageContext {
  return { scene: new Scene(), tier: 'low', anchors: new Map<string, Vector3>(), store: null as unknown as StageContext['store'], typeface: null, pace: async () => {} };
}

/** Lights the renderer would see: three skips an invisible group whole, lights included. */
function visibleLights(scene: Scene): number {
  let n = 0;
  const walk = (o: { visible: boolean; children: unknown[] }) => {
    if (!o.visible) return;
    if ((o as unknown as Light).isLight) n++;
    for (const c of o.children) walk(c as { visible: boolean; children: unknown[] });
  };
  walk(scene);
  return n;
}

function nearOf(i: number): Set<StopId> {
  return new Set([STOPS[i]?.id, STOPS[i - 1]?.id, STOPS[i + 1]?.id].filter(Boolean) as StopId[]);
}

describe('greybox lighting', () => {
  it('keeps the visible light count constant across every stop, so no material ever recompiles mid-walk', () => {
    // three rebuilds every lit material's program whenever the count of visible lights changes.
    // Switching a greybox space on or off must therefore never add or remove a light. The greybox
    // itself owns none any more: the scene's rig is the only light source now.
    const c = ctx();
    const g = greybox(c);
    g.hide('booth'); g.hide('hangar');
    const counts = STOPS.map((_, i) => { g.setNear(nearOf(i)); return visibleLights(c.scene); });
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBe(0);
  });

  it('still hides far spaces and replaced ones', () => {
    const c = ctx();
    const g = greybox(c);
    g.hide('hangar');
    g.setNear(new Set<StopId>(['booth', 'fabrication']));
    const byName = new Map<string, boolean>();
    c.scene.traverse((o) => { if (o.name.startsWith('greybox-') && o.name !== 'greybox-markers') byName.set(o.name, o.visible); });
    expect(byName.get('greybox-booth')).toBe(true);
    expect(byName.get('greybox-hangar')).toBe(false);
    expect(byName.get('greybox-corridor')).toBe(false);
    expect(byName.get('greybox-office')).toBe(false);
  });

  it('hides the stop marker standing in a space once that space is replaced', () => {
    // Every dressed stage hides its greybox space, and the marker for the stop inside it has to go
    // dark too, or the marker stands alone in the middle of the finished room forever.
    const c = ctx();
    const g = greybox(c);
    const markerVisible = (stop: StopId) => {
      let visible: boolean | undefined;
      c.scene.traverse((o) => { if (o.name === `marker-${stop}`) visible = o.visible; });
      return visible;
    };
    expect(markerVisible('recreation')).toBe(true);
    g.hide('corridor');
    expect(markerVisible('recreation')).toBe(false);
  });
});
