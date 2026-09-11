import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { groupProgress, manifestFor, AssetStore, type AssetManifest } from '../../src/scenes/walk/assets';
import { disposeObject } from '../../src/scenes/walk/materials';

describe('groupProgress', () => {
  it('weights progress by bytes', () => {
    const p = groupProgress([{ bytes: 100, done: true }, { bytes: 300, done: false }]);
    expect(p).toEqual({ loaded: 100, total: 400 });
  });
  it('handles an empty group', () => expect(groupProgress([])).toEqual({ loaded: 0, total: 0 }));
});

describe('manifestFor', () => {
  it('maps tiers to manifests', () => {
    expect(manifestFor('high')).toBe('desktop');
    expect(manifestFor('medium')).toBe('desktop');
    expect(manifestFor('low')).toBe('phone');
    expect(manifestFor('lite')).toBe('phone');
  });
});

function stubManifest(url: string): AssetManifest {
  return {
    tier: 'desktop',
    groups: {
      g: {
        bytes: 100,
        textures: { t: { diffuse: url, normal: url, arm: url, repeat: [1, 1], bytes: 50 } },
        models: { m: { url, bytes: 50 } },
      },
    },
  };
}

function stubTexLoad(fail: boolean) {
  return (url: string, onLoad: (t: unknown) => void, _onProgress: unknown, onError: (e: unknown) => void) => {
    if (fail && url.includes('fail')) onError(new Error('boom'));
    else onLoad({ wrapS: 0, wrapT: 0, repeat: { set() {} }, anisotropy: 0, colorSpace: '' });
  };
}

describe('AssetStore.loadGroup', () => {
  it('clears pending on failure so the group can be retried, without leaking partial state', async () => {
    const store = new AssetStore(stubManifest('fail.webp'));
    let calls = 0;
    (store as unknown as { texLoader: { load: unknown } }).texLoader.load = (...args: Parameters<ReturnType<typeof stubTexLoad>>) => { calls++; return stubTexLoad(true)(...args); };
    // A real Group, because the store marks a loaded model's geometry and materials as its own.
    (store as unknown as { gltf: { loadAsync: unknown } }).gltf.loadAsync = async () => {
      const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())); return { scene: g };
    };

    // (a) a failing texture URL rejects, clears `pending`, and neither texture() nor model() can succeed.
    await expect(store.loadGroup('g')).rejects.toThrow();
    expect((store as unknown as { pending: Map<string, unknown> }).pending.has('g')).toBe(false);
    expect(() => store.texture('t')).toThrow();
    expect(() => store.model('m')).toThrow();

    // (b) swapping the stub to succeed lets the same group id be retried and load cleanly.
    (store as unknown as { texLoader: { load: unknown } }).texLoader.load = (...args: Parameters<ReturnType<typeof stubTexLoad>>) => { calls++; return stubTexLoad(false)(...args); };
    await expect(store.loadGroup('g')).resolves.toBeUndefined();
    expect(store.texture('t')).toBeTruthy();
    expect(store.model('m')).toBeTruthy();

    // (c) once loaded, a second call resolves immediately without touching the loader again.
    const callsBeforeRetry = calls;
    await expect(store.loadGroup('g')).resolves.toBeUndefined();
    expect(calls).toBe(callsBeforeRetry);
  });
});

describe('disposeObject', () => {
  it('disposes an owned map but leaves an unowned one untouched', () => {
    const geometry = new THREE.BufferGeometry();
    const map = new THREE.Texture(); map.userData.owned = true;
    const normalMap = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map, normalMap });
    const mesh = new THREE.Mesh(geometry, material);
    const mapSpy = vi.spyOn(map, 'dispose');
    const normalSpy = vi.spyOn(normalMap, 'dispose');
    const geoSpy = vi.spyOn(geometry, 'dispose');
    const matSpy = vi.spyOn(material, 'dispose');

    disposeObject(mesh);

    expect(mapSpy).toHaveBeenCalledTimes(1);
    expect(normalSpy).not.toHaveBeenCalled();
    expect(geoSpy).toHaveBeenCalledTimes(1);
    expect(matSpy).toHaveBeenCalledTimes(1);
  });
});
