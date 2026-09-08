import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { BANK_Z, HANGAR, COLORS } from './constants';

export interface Lights { banks: THREE.RectAreaLight[]; hemi: THREE.HemisphereLight; sign: THREE.PointLight }

let initialised = false;

export function buildLights(root: THREE.Object3D): Lights {
  if (!initialised) { RectAreaLightUniformsLib.init(); initialised = true; }
  const banks = BANK_Z.map((z) => {
    const l = new THREE.RectAreaLight(COLORS.panelWhite, 0, 30, 0.8);
    l.position.set(0, HANGAR.height - 0.4, z);
    l.lookAt(0, 0, z);
    root.add(l);
    return l;
  });
  const hemi = new THREE.HemisphereLight(0x2a3b4a, 0x0e161e, 0.25);
  root.add(hemi);
  const sign = new THREE.PointLight(COLORS.glassCyan, 0, 16, 1.5);
  sign.position.set(HANGAR.width / 2 - 3, 6, -18);
  root.add(sign);
  return { banks, hemi, sign };
}
