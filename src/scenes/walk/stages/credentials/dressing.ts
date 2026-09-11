import * as THREE from 'three';
import type { StageContext } from '../types';
import { grounded, place } from '../../merge';
import { papers, tapeLine } from '../../labs/props';
import { labSteel, LABS } from '../../labs/materials';
import { stencilTexture } from '../../textures';
import { X0, X1, PLATE_X, PLATE_Z } from './layout';
import certs from '../../../../content/certs.json';

export async function buildDressing(ctx: StageContext, root: THREE.Group): Promise<void> {
  const { store, pace } = ctx;
  const add = async (o: THREE.Object3D) => { root.add(o); await pace(); };

  // The six certifications, three per side, backlit on the lab's glass with the badge image and
  // name and issuer beneath. A failed image load leaves the plate lit with its name only.
  const loader = new THREE.TextureLoader();
  const certList = certs as { id: string; name: string; issuer: string; badgeImage: string }[];
  certList.forEach((c, i) => {
    const side = i < 3 ? 'west' : 'east'; const z = PLATE_Z[side][i % 3]; const x = PLATE_X[side];
    const ry = side === 'west' ? Math.PI / 2 : -Math.PI / 2;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.9, 0.08), labSteel(0xcfd8dd)); frame.position.set(x, 1.75, z); frame.rotation.y = ry; root.add(frame);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.76), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 }));
    face.position.set(x + (side === 'west' ? 0.05 : -0.05), 1.75, z); face.rotation.y = ry; root.add(face);
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
    badge.position.set(x + (side === 'west' ? 0.06 : -0.06), 2.05, z); badge.rotation.y = ry; root.add(badge);
    loader.load(c.badgeImage, (t) => { t.colorSpace = THREE.SRGBColorSpace; const m = badge.material as THREE.MeshBasicMaterial; m.map = t; m.opacity = 1; m.needsUpdate = true; }, undefined, () => { /* name only */ });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.4), new THREE.MeshBasicMaterial({ map: stencilTexture(`${c.name}`, { width: 768, height: 200, color: '#2A3B4A', font: '600 64px Michroma, system-ui, sans-serif', alpha: 1, flecks: false }), transparent: true, depthWrite: false }));
    label.position.set(x + (side === 'west' ? 0.07 : -0.07), 1.15, z); label.rotation.y = ry; root.add(label);
    const issuer = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.2), new THREE.MeshBasicMaterial({ map: stencilTexture(c.issuer, { width: 512, height: 100, color: '#2A3B4A', font: '400 44px Michroma, system-ui, sans-serif', alpha: 0.8, flecks: false }), transparent: true, depthWrite: false }));
    issuer.position.set(x + (side === 'west' ? 0.07 : -0.07), 0.95, z); issuer.rotation.y = ry; root.add(issuer);
  });
  await pace();

  // Outside the lab: a bench along the east wall, painted the lab white, two medical boxes on
  // it, two totes by the north door, papers, tape across the far end where the containment bay
  // is still greybox.
  const bench = store.model('desk');
  bench.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const tint = (m: THREE.Material) => { const c = m.clone(); if ('color' in c) (c as THREE.MeshStandardMaterial).color.setHex(LABS.panel); return c; };
    o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material);
  });
  bench.position.set(X1 - 1.2, 0, -8); bench.rotation.y = Math.PI / 2;
  await add(bench);

  const box = (x: number, z: number, ry: number) => { const b = grounded(store.model('medical_box')); b.position.set(x, 0.76, z); b.rotation.y = ry; return b; };
  await add(box(X1 - 1.0, -8.3, 0.4));
  await add(box(X1 - 0.9, -7.7, -0.3));

  const tote = (x: number, z: number, ry: number) => place(grounded(store.model('tote')), x, 0, z, ry);
  await add(tote(X1 - 1.2, -15, 0.3));
  await add(tote(X1 - 1.1, -13.4, -0.6));

  await add(papers([[X1 - 2.4, 0, -9.2, 0.5], [X1 - 2.0, 0, -6.4, 1.3], [X1 - 3.0, 0, 1.2, 2.1], [X1 - 2.2, 0, -14.6, 0.9]]));
  await add(tapeLine([X0 + 0.4, 4], [X1 - 0.4, 4], 1.0));
}
