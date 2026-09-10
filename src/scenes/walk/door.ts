import * as THREE from 'three';
import type { AssetStore } from './assets';
import { pbr, disposeObject } from './materials';
import { hazardTexture, stencilTexture } from './textures';
import type { PointPlacement } from './rig';

export interface Door { root: THREE.Group; lamp: PointPlacement; update(open: number): void; dispose(): void }

export function doorPose(open: number, height: number) {
  const o = Math.min(1, Math.max(0, open));
  return { slatScaleY: 1 - o, bottomY: o * height, drumRadius: 0.22 + o * 0.16, stencilY: height * 0.8 + o * height * 0.2, stencilVisible: o < 0.85 };
}

export function buildDoor(store: AssetStore, opts: { width: number; height: number; position: [number, number, number] }): Door {
  const { width, height } = opts;
  const root = new THREE.Group(); root.position.set(...opts.position);

  const shutter = store.texture('metal_shutter');
  const slatMat = pbr(shutter);
  slatMat.map = shutter.map.clone(); slatMat.map.userData.owned = true;
  slatMat.normalMap = shutter.normalMap.clone(); slatMat.normalMap.userData.owned = true;
  const arm = shutter.arm.clone(); arm.userData.owned = true;
  slatMat.aoMap = slatMat.roughnessMap = slatMat.metalnessMap = arm;
  for (const t of [slatMat.map, slatMat.normalMap, arm]) { t.repeat.set(width / 3, 1); t.needsUpdate = true; }
  const slatGeo = new THREE.PlaneGeometry(width, height); slatGeo.translate(0, -height / 2, 0);  // origin at the top edge
  slatGeo.setAttribute('uv1', slatGeo.getAttribute('uv'));
  const slats = new THREE.Mesh(slatGeo, slatMat); slats.position.y = height; root.add(slats);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1b242c, roughness: 0.6, metalness: 0.7 });
  for (const x of [-width / 2 - 0.15, width / 2 + 0.15]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, height + 0.6, 0.4), frameMat); post.position.set(x, (height + 0.6) / 2, 0); root.add(post); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.5, 0.5), frameMat); lintel.position.y = height + 0.45; root.add(lintel);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, width, 24), frameMat); drum.rotation.z = Math.PI / 2; drum.position.set(0, height + 0.2, 0.15); root.add(drum);

  // One chevron pair every 0.5 m, or the 256 px band stretches across the whole 6 m rail as a smear.
  const hazard = hazardTexture(); hazard.repeat.x = width / 0.5; hazard.needsUpdate = true;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, 0.12), new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.7 })); root.add(rail);
  // The plane keeps the canvas aspect so the lettering is never stretched.
  const STENCIL_W = 1024, STENCIL_H = 320;
  const stencilWidth = width * 0.42;
  const stencil = new THREE.Mesh(new THREE.PlaneGeometry(stencilWidth, stencilWidth * STENCIL_H / STENCIL_W), new THREE.MeshBasicMaterial({ map: stencilTexture('JEL LABS', { width: STENCIL_W, height: STENCIL_H, color: '#C3D6DE', font: '400 190px Michroma, system-ui, sans-serif', alpha: 0.42 }), transparent: true, depthWrite: false, opacity: 0.92 }));
  // Offset toward the hinge side so the lettering clears the headline copy overlaid on the left.
  stencil.position.set(width * 0.125, 0, 0.02); root.add(stencil);

  // The standby lamp is mounted on the face of the right jamb post at head height. It used to sit at
  // the top corner of the shutter, inside the drum's footprint, and the drum swallowed it as it
  // grew with the door open. Down here nothing moves near it and it stays inside the frame.
  const lampMesh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshStandardMaterial({ color: 0x1a0403, emissive: 0xc8322b, emissiveIntensity: 4 }));
  lampMesh.position.set(width / 2 + 0.15, height - 0.55, 0.3); root.add(lampMesh);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 16, 1, true), frameMat); hood.position.set(lampMesh.position.x, lampMesh.position.y + 0.12, lampMesh.position.z); root.add(hood);
  // The rig owns the light now, but the placement has to sit in world space: the door's own root is
  // parented at opts.position, and a Placement carries no parent transform to inherit that from.
  const lamp: PointPlacement = { kind: 'point', position: [width / 2 + 0.15 + opts.position[0], height - 0.55 + opts.position[1], 0.3 + opts.position[2]], color: 0xc8322b, intensity: 2.5, distance: 5, decay: 2 };

  return {
    root, lamp,
    update(open) {
      const p = doorPose(open, height);
      slats.scale.y = Math.max(0.001, p.slatScaleY);
      (slatMat.map as THREE.Texture).repeat.y = p.slatScaleY; (slatMat.normalMap as THREE.Texture).repeat.y = p.slatScaleY; arm.repeat.y = p.slatScaleY;
      rail.position.y = p.bottomY + 0.06;
      drum.scale.set(p.drumRadius / 0.22, 1, p.drumRadius / 0.22);
      stencil.position.y = p.stencilY; stencil.visible = p.stencilVisible;
      const g = open > 0.05; (lampMesh.material as THREE.MeshStandardMaterial).emissive.set(g ? 0x2ecc71 : 0xc8322b); lamp.color = g ? 0x2ecc71 : 0xc8322b;
    },
    dispose() { disposeObject(root); },
  };
}
