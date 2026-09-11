import * as THREE from 'three';
import type { Font } from 'three/addons/loaders/FontLoader.js';
import type { AssetStore } from './assets';
import { pbr, disposeObject } from './materials';
import { hazardTexture } from './textures';
import { signLetters } from './labs/signage';
import { instances } from './merge';
import type { PointPlacement } from './rig';

export interface Door { root: THREE.Group; lamp: PointPlacement; update(open: number): void; dispose(): void }

export function doorPose(open: number, height: number) {
  const o = Math.min(1, Math.max(0, open));
  return { slatScaleY: 1 - o, bottomY: o * height, drumRadius: 0.22 + o * 0.16 };
}

export function buildDoor(store: AssetStore, opts: { width: number; height: number; position: [number, number, number]; typeface: Font | null }): Door {
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
  // The posts stop level with the top of the fascia. Run any taller and their tips stand above it.
  const postH = height + 0.35;
  for (const x of [-width / 2 - 0.15, width / 2 + 0.15]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, postH, 0.4), frameMat); post.position.set(x, postH / 2, 0); root.add(post); }
  // The head box laps the top of the curtain, the way a roller shutter's does. It used to float 0.35
  // higher, which cost it twice over: the band it carries sat above the top of a 55 degree frame from
  // the booth's standing point, and the 0.2 of soffit between it and the curtain read from down here
  // as a gap of black sky with a sign hanging in it.
  const fasciaY = height + 0.1;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.5, 0.5), frameMat); lintel.position.y = fasciaY; root.add(lintel);
  // The roller lives inside the head box, behind the fascia's front face. Out front, which is where
  // it used to sit, it swelled through the fascia and through the sign on it as the curtain wound on.
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, width, 24), frameMat); drum.rotation.z = Math.PI / 2; drum.position.set(0, height - 0.05, -0.15); root.add(drum);

  // One chevron pair every 0.5 m, or the 256 px band stretches across the whole 6 m rail as a smear.
  const hazard = hazardTexture(); hazard.repeat.x = width / 0.5; hazard.needsUpdate = true;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, 0.12), new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.7 })); root.add(rail);

  // The sign is fabricated, not painted: extruded letters bolted to the fascia over a lit panel,
  // standing 0.015 m proud of it so the panel's glow carries round their edges. It hangs on the door
  // root rather than on the curtain, so it holds still while the shutter rolls up behind it. The
  // stencil it replaces rode up with the slats and read as a decal someone had pasted on the door.
  const sign = new THREE.Group(); sign.name = 'sign'; root.add(sign);
  const backlight = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.5, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x05080b, emissive: 0x6ec1d6, emissiveIntensity: 0.85 }),
  );
  backlight.position.set(0, fasciaY, 0.255); sign.add(backlight);
  const letters = signLetters(opts.typeface, 'JEL LABS', { size: 0.36, depth: 0.06, color: 0xcfd8dd, emissive: 0x6ec1d6, emissiveIntensity: 0.22 });
  // signLetters leaves the origin on the left baseline, so the run is centred by measuring it.
  letters.geometry.computeBoundingBox();
  const run = letters.geometry.boundingBox!;
  letters.position.set(-(run.min.x + run.max.x) / 2, fasciaY - (run.min.y + run.max.y) / 2, 0.27);
  sign.add(letters);

  // The standby lamp is a bulkhead fitting on the face of the right jamb post at head height. The
  // bare emissive ball it replaces had nothing around it to say how big it was or what it was bolted
  // to, and its bloom ran straight across the shutter.
  const lampX = width / 2 + 0.15, lampY = height - 0.55, lampZ = 0.32;
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.12), frameMat);
  housing.position.set(lampX, lampY, lampZ); root.add(housing);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshStandardMaterial({ color: 0x1a0403, emissive: 0xc8322b, emissiveIntensity: 2.6 }));
  lens.position.set(lampX, lampY, lampZ + 0.06); root.add(lens);
  const cage = instances(new THREE.BoxGeometry(0.012, 0.24, 0.012), frameMat, Array.from({ length: 6 }, (_, i): [number, number, number] => [lampX - 0.075 + i * 0.03, lampY, lampZ + 0.13]));
  root.add(cage);
  // The rig owns the light now, but the placement has to sit in world space: the door's own root is
  // parented at opts.position, and a Placement carries no parent transform to inherit that from.
  // It stands clear of the housing, which would otherwise swallow the pool it is meant to throw.
  const lamp: PointPlacement = { kind: 'point', position: [lampX + opts.position[0], lampY + opts.position[1], 0.5 + opts.position[2]], color: 0xc8322b, intensity: 2, distance: 3.2, decay: 2 };

  return {
    root, lamp,
    update(open) {
      const p = doorPose(open, height);
      slats.scale.y = Math.max(0.001, p.slatScaleY);
      (slatMat.map as THREE.Texture).repeat.y = p.slatScaleY; (slatMat.normalMap as THREE.Texture).repeat.y = p.slatScaleY; arm.repeat.y = p.slatScaleY;
      rail.position.y = p.bottomY + 0.06;
      drum.scale.set(p.drumRadius / 0.22, 1, p.drumRadius / 0.22);
      const g = open > 0.05; (lens.material as THREE.MeshStandardMaterial).emissive.set(g ? 0x2ecc71 : 0xc8322b); lamp.color = g ? 0x2ecc71 : 0xc8322b;
    },
    dispose() { disposeObject(root); },
  };
}
