import { describe, it, expect } from 'vitest';
import { createCalm, needed, APPROACH, SETTLE_MS } from '../../src/scenes/walk/calm';

describe('needed', () => {
  it('is true inside the room and on the approach to it, from either side', () => {
    expect(needed(0.4, 0.332, 0.52)).toBe(true);
    expect(needed(0.332 - APPROACH + 0.001, 0.332, 0.52)).toBe(true);
    expect(needed(0.52 + APPROACH - 0.001, 0.332, 0.52)).toBe(true);
  });
  it('is false a room away', () => {
    expect(needed(0.2, 0.332, 0.52)).toBe(false);
    expect(needed(0.7, 0.332, 0.52)).toBe(false);
  });
});

describe('createCalm', () => {
  it('is still before anything has moved', () => expect(createCalm(() => 0).still()).toBe(true));
  it('is not still while the camera moves, nor for the settle after', () => {
    let t = 1000; const c = createCalm(() => t);
    c.moved(); expect(c.still()).toBe(false);
    t += SETTLE_MS - 1; expect(c.still()).toBe(false);
    t += 2; expect(c.still()).toBe(true);
  });
  it('lets work through while moving once the room is needed', async () => {
    let t = 0; const c = createCalm(() => t, (cb) => { t += 50; c.moved(); cb(); });
    let hurry = false, polls = 0;
    c.moved();
    await c.wait(() => { if (++polls === 3) hurry = true; return hurry; });
    expect(polls).toBe(3);
  });
  it('returns at once when still', async () => {
    const c = createCalm(() => 0, () => { throw new Error('waited'); });
    await c.wait(() => false);
  });
});

describe('buildNow', () => {
  it('builds a room that is still ahead of the camera without waiting for it to park', async () => {
    const { buildNow } = await import('../../src/scenes/walk/calm');
    const { STOPS } = await import('../../src/scenes/walk/path');
    const rec = STOPS.find((s) => s.id === 'recreation')!, ops = STOPS.find((s) => s.id === 'operations')!;
    // Standing in the booth, the break room two rooms on builds now: a quick scroll is there in seconds.
    expect(buildNow(0, rec.enter, ops.enter)).toBe(true);
    // A room well behind the camera (only after a dock jump) can wait for it to stop.
    expect(buildNow(0.9, rec.enter, ops.enter)).toBe(false);
  });
});

describe('doorHold', () => {
  it('holds a reader leaving a room before the next one is built, and never otherwise', async () => {
    const { doorHold } = await import('../../src/scenes/walk/calm');
    const { STOPS } = await import('../../src/scenes/walk/path');
    const fab = STOPS.find((s) => s.id === 'fabrication')!, rec = STOPS.find((s) => s.id === 'recreation')!;
    const none = () => false, all = () => true;
    // Reading the bay with the break room unbuilt: no hold, they are still reading.
    expect(doorHold(fab.t, (id) => id === 'fabrication')).toBeNull();
    // Walking out of the bay toward an unbuilt break room: held, before its doorway.
    const leaving = fab.hold[1] + 0.01;
    expect(leaving).toBeLessThan(rec.enter);
    expect(doorHold(leaving, (id) => id === 'fabrication')).toBe('recreation');
    // Built: walk on.
    expect(doorHold(leaving, all)).toBeNull();
    // Every transit between two rooms is covered, whichever room is missing.
    for (let i = 1; i < STOPS.length; i++) expect(doorHold((STOPS[i - 1].hold[1] + STOPS[i].enter) / 2, none)).toBe(STOPS[i].id);
  });
});

describe('doorHold walking back', () => {
  it('holds a reader walking back out of a room toward an unbuilt one, as a deep link leaves them', async () => {
    const { doorHold } = await import('../../src/scenes/walk/calm');
    const { STOPS } = await import('../../src/scenes/walk/path');
    const cred = STOPS.find((s) => s.id === 'credentials')!, cont = STOPS.find((s) => s.id === 'containment')!;
    // Opened on containment by a link: credentials, behind, is not built.
    const ready = (id: string) => id !== 'credentials';
    // Reading containment: no hold.
    expect(doorHold(cont.t, ready, -1)).toBeNull();
    // Walking back toward its doorway: held before credentials comes into view.
    const back = (cred.hold[1] + cont.enter) / 2;
    expect(doorHold(back, ready, -1)).toBe('credentials');
    // Walking forward through the same stretch is not a reason to wait for the room behind.
    expect(doorHold(back, ready, 1)).toBeNull();
  });
});

describe('roomsOnTheWay', () => {
  it('names every room a flight passes into, and the next one when it ends at a door', async () => {
    const { roomsOnTheWay } = await import('../../src/scenes/walk/calm');
    const { STOPS } = await import('../../src/scenes/walk/path');
    const t = (id: string) => STOPS.find((s) => s.id === id)!;
    expect(roomsOnTheWay(t('booth').t, t('operations').t)).toEqual(['fabrication', 'recreation', 'operations']);
    // The containment report's table sits past the hold, at the file's door: the file has to stand too.
    expect(roomsOnTheWay(t('containment').t, 0.92)).toEqual(['file']);
  });
});
