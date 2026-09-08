import * as THREE from 'three';
import { BANK_Z, HANGAR, COLORS } from './constants';

export interface Lights { banks: THREE.SpotLight[]; hemi: THREE.HemisphereLight; sign: THREE.PointLight }

export function buildLights(root: THREE.Object3D): Lights {
  const banks = BANK_Z.map((z) => {
    const l = new THREE.SpotLight(COLORS.panelWhite, 0, 40, Math.PI / 2.6, 0.6, 1.2);
    l.position.set(0, HANGAR.height - 0.4, z);
    l.target.position.set(0, 0, z);
    root.add(l);
    root.add(l.target);
    return l;
  });
  const hemi = new THREE.HemisphereLight(0x2a3b4a, 0x0e161e, 0.25);
  root.add(hemi);
  const sign = new THREE.PointLight(COLORS.glassCyan, 0, 16, 1.5);
  sign.position.set(HANGAR.width / 2 - 3, 6, -18);
  root.add(sign);
  return { banks, hemi, sign };
}
