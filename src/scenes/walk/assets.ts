import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import type { Tier } from './quality';

export interface ManifestTexture { diffuse: string; normal: string; arm: string; repeat: [number, number]; bytes: number }
export interface ManifestModel { url: string; bytes: number }
export interface AssetManifest { tier: 'desktop' | 'phone'; groups: Record<string, { bytes: number; textures: Record<string, ManifestTexture>; models: Record<string, ManifestModel> }> }
export interface TextureSet { map: THREE.Texture; normalMap: THREE.Texture; arm: THREE.Texture; repeat: [number, number] }

export function manifestFor(tier: Tier): 'desktop' | 'phone' { return tier === 'high' || tier === 'medium' ? 'desktop' : 'phone'; }

export function groupProgress(files: { bytes: number; done: boolean }[]) {
  return files.reduce((acc, f) => ({ loaded: acc.loaded + (f.done ? f.bytes : 0), total: acc.total + f.bytes }), { loaded: 0, total: 0 });
}

export class AssetStore {
  private textures = new Map<string, TextureSet>();
  private models = new Map<string, THREE.Group>();
  private loaded = new Set<string>();
  private pending = new Map<string, Promise<void>>();
  private texLoader = new THREE.TextureLoader();
  private gltf: GLTFLoader;
  private draco: DRACOLoader;

  constructor(readonly manifest: AssetManifest) {
    this.draco = new DRACOLoader(); this.draco.setDecoderPath('/draco/');
    this.gltf = new GLTFLoader(); this.gltf.setDRACOLoader(this.draco);
  }

  static async open(tier: Tier): Promise<AssetStore> {
    const res = await fetch(`/assets/manifest.${manifestFor(tier)}.json`);
    if (!res.ok) throw new Error(`asset manifest ${res.status}`);
    return new AssetStore((await res.json()) as AssetManifest);
  }

  private loadTexture(url: string, srgb: boolean, repeat: [number, number]): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => this.texLoader.load(url, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 4;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; resolve(t);
    }, undefined, reject));
  }

  loadGroup(id: string, onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (this.loaded.has(id)) return Promise.resolve();
    const existing = this.pending.get(id); if (existing) return existing;
    const g = this.manifest.groups[id]; if (!g) return Promise.reject(new Error(`unknown asset group ${id}`));
    const files: { bytes: number; done: boolean }[] = [];
    const report = () => { const p = groupProgress(files); onProgress?.(p.loaded, p.total); };
    const track = <T>(bytes: number, p: Promise<T>) => { const f = { bytes, done: false }; files.push(f); return p.then((v) => { f.done = true; report(); return v; }); };
    const work: Promise<unknown>[] = [];
    const textureKeys: string[] = [];
    const modelKeys: string[] = [];
    for (const [key, t] of Object.entries(g.textures)) {
      textureKeys.push(key);
      work.push(track(t.bytes, Promise.all([
        this.loadTexture(t.diffuse, true, t.repeat), this.loadTexture(t.normal, false, t.repeat), this.loadTexture(t.arm, false, t.repeat),
      ]).then(([map, normalMap, arm]) => { this.textures.set(key, { map, normalMap, arm, repeat: t.repeat }); })));
    }
    for (const [key, m] of Object.entries(g.models)) {
      modelKeys.push(key);
      work.push(track(m.bytes, this.gltf.loadAsync(m.url).then((res) => { this.models.set(key, res.scene); })));
    }
    report();
    const p = Promise.all(work)
      .then(() => { this.loaded.add(id); })
      .catch((err) => {
        for (const key of textureKeys) this.textures.delete(key);
        for (const key of modelKeys) this.models.delete(key);
        throw err;
      })
      .finally(() => { this.pending.delete(id); });
    this.pending.set(id, p);
    return p;
  }

  texture(key: string): TextureSet { const t = this.textures.get(key); if (!t) throw new Error(`texture ${key} not loaded`); return t; }
  /** Object3D.clone(true) clones the hierarchy but each clone still shares geometry and materials with the template. */
  model(key: string): THREE.Group { const m = this.models.get(key); if (!m) throw new Error(`model ${key} not loaded`); return m.clone(true); }

  dispose() {
    for (const t of this.textures.values()) { t.map.dispose(); t.normalMap.dispose(); t.arm.dispose(); }
    for (const m of this.models.values()) m.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const mat of Array.isArray(o.material) ? o.material : [o.material]) { for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'] as const) (mat as THREE.MeshStandardMaterial)[k]?.dispose(); mat.dispose(); } } });
    this.textures.clear(); this.models.clear(); this.draco.dispose();
  }
}
