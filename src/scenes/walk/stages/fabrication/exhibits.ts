import * as THREE from 'three';
import { merged } from '../../merge';
import { LABS } from '../../labs/materials';

/**
 * The three products on the dispatch office plinths. Each is built at exhibition scale, four to
 * six times life size, because the plinths are a metre across and the camera holds three metres
 * off: at life size all three were thumbnails, and Jordan could not tell what any of them were.
 *
 * Every builder returns a group with its origin at the plinth top, its face up before any rake,
 * and +z toward the camera. The office rotates the group into the room. Nothing in here touches
 * the asset store, so the shapes can be measured in a unit test.
 */

const shell = (color: number, roughness = 0.5, metalness = 0.3) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const acrylic = () => new THREE.MeshPhysicalMaterial({ color: LABS.glassTint, transparent: true, opacity: 0.26, roughness: 0.08, metalness: 0 });

/** How far a raked product face leans toward the camera, from vertical. Steep, because the camera
 *  stands only a little above the plinths and a shallow rake showed each face edge on. */
const RAKE = 0.95;

/**
 * A clear acrylic display stand for a product that leans back at RAKE. `tilt` is the raked group
 * with the product's face on its y 0 plane and its pivot `pivot` above the cap. The rail goes into
 * that group, `back` below the face so it sits flush behind the product, and runs from `from` to
 * where the raked plane meets the cap, so its foot rests on the base plate rather than floating.
 */
function stand(g: THREE.Group, tilt: THREE.Group, pivot: number, opts: { w: number; back: number; from: number }): void {
  const foot = (pivot - opts.back * Math.cos(RAKE)) / Math.sin(RAKE);
  // The rail stops a centimetre and a half short of the foot, or its lower corner cuts the cap.
  const end = foot - 0.015;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(opts.w, 0.012, end - opts.from), acrylic());
  rail.position.set(0, -opts.back - 0.006, (end + opts.from) / 2); tilt.add(rail);
  const base = new THREE.Mesh(new THREE.BoxGeometry(opts.w + 0.1, 0.012, foot * Math.cos(RAKE) + 0.16), acrylic());
  base.position.set(0, 0.006, (foot * Math.cos(RAKE)) / 2 - 0.02); g.add(base);
}

/**
 * conch.gg: a GameCube controller, the Sketchfab model conch.gg itself ships (CoryRichards,
 * CC BY 4.0, credited on the page and in assets/CREDITS.md). `model` is the store's clone. It
 * arrives at the author's scale, so it is fitted to WIDTH across, its face laid on the raked
 * group's y 0 plane, then leaned back toward the camera. A real controller rests on its grip ends
 * and its shoulder humps, both about as deep, so the shell cannot lean on a rail the way the key
 * does: leaned back it stands on its grips with a matte riser under the shoulders, the way a shop
 * props one.
 */
export function controller(model: THREE.Object3D): THREE.Group {
  const WIDTH = 0.66, LEAN = 0.45;
  const g = new THREE.Group();
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const s = WIDTH / (box.max.x - box.min.x);
  model.scale.multiplyScalar(s);
  model.position.set(-(box.min.x + box.max.x) / 2 * s, -box.max.y * s, -(box.min.z + box.max.z) / 2 * s);
  const thick = (box.max.y - box.min.y) * s, half = (box.max.z - box.min.z) / 2 * s;
  // The lowest point after the lean is the front bottom corner of the box, so the pivot lifts it
  // to the cap. The real grips sit a touch inside that corner, which is a millimetre or two of air.
  const pivot = thick * Math.cos(LEAN) + half * Math.sin(LEAN) + 0.002;
  const tilt = new THREE.Group(); tilt.rotation.x = LEAN; tilt.position.y = pivot; tilt.add(model); g.add(tilt);
  const riser = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.14), shell(0x1b2129, 0.7, 0.2));
  riser.position.set(0, 0.07, -0.23); g.add(riser);
  // The cable, off the top of the shell and away across the cap short of the label plate.
  const top = new THREE.Vector3(0, 0, -half).applyAxisAngle(new THREE.Vector3(1, 0, 0), LEAN).add(new THREE.Vector3(0, pivot, 0));
  const end = new THREE.Vector3(0, 0.012, -0.36);
  const run = end.clone().sub(top), len = run.length();
  const lead = new THREE.CylinderGeometry(0.009, 0.009, len, 8);
  lead.rotateX(Math.atan2(run.z, run.y));
  const cable = new THREE.Mesh(lead, shell(0x9aa4ac, 0.7, 0.1)); cable.position.copy(top.clone().add(end).multiplyScalar(0.5)); g.add(cable);
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.009, 6, 18, Math.PI * 1.45).rotateX(Math.PI / 2), shell(0x9aa4ac, 0.7, 0.1));
  curl.position.set(0.06, 0.012, -0.4); g.add(curl);
  return g;
}

/**
 * ezkey.io: a key store, so a key. Brushed steel, a round bow with the product's cyan lit through
 * it, a long shaft and three bits standing up off it. It lies on its side across the cap, leaning
 * back a little on the stand, because the classic silhouette is the side view: stood on end and
 * raked toward the eye it read as a lollipop and hid its own label.
 */
export function key(): THREE.Group {
  const g = new THREE.Group();
  const LEAN = 0.6, PIVOT = 0.15;
  const tilt = new THREE.Group(); tilt.rotation.x = LEAN; tilt.position.y = PIVOT; g.add(tilt);
  const steel = [
    new THREE.TorusGeometry(0.105, 0.03, 10, 28).translate(-0.22, 0, 0),
    new THREE.BoxGeometry(0.5, 0.06, 0.03).translate(0.11, 0, 0),
    new THREE.BoxGeometry(0.06, 0.04, 0.03).translate(0.38, 0, 0),
    new THREE.BoxGeometry(0.045, 0.075, 0.03).translate(0.13, 0.06, 0),
    new THREE.BoxGeometry(0.045, 0.09, 0.03).translate(0.215, 0.068, 0),
    new THREE.BoxGeometry(0.045, 0.065, 0.03).translate(0.3, 0.055, 0),
  ];
  tilt.add(merged(steel, shell(0xd6dde2, 0.3, 0.8)));
  const inlay = new THREE.Mesh(new THREE.CircleGeometry(0.08, 24), new THREE.MeshStandardMaterial({ color: 0x06131a, emissive: 0x6ec1d6, emissiveIntensity: 1.8, side: THREE.DoubleSide }));
  inlay.position.set(-0.22, 0, 0); tilt.add(inlay);
  // Its own stand: the key's plane is upright, so the rail is a clear sheet behind it.
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.3, 0.012), acrylic()); rail.position.set(0.05, 0.02, -0.024); tilt.add(rail);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.012, 0.28), acrylic()); base.position.set(0.05, 0.006, 0.04); g.add(base);
  return g;
}

/**
 * gc-bridge: the four port adapter the bridge reads, with a GameCube controller plug in port one.
 * The box alone read as a network switch. What says GameCube is the plug, the console's own indigo
 * with its rounded nose, and the sockets cut to that plug's outline, a rounded square with a bump
 * on top. The whole thing leans a little toward the camera on a riser so the ports face the eye.
 */
export function adapter(): THREE.Group {
  const g = new THREE.Group();
  const W = 0.7, D = 0.36, H = 0.16, R = 0.012, LEAN = 0.3;
  const hw = W / 2, hd = D / 2, F = hd + R;
  // Lean about the front bottom edge, so the ports stay on the cap and the back rises onto the
  // riser. The whole box sits BACK behind the origin so the plug and its cord fit on the cap.
  const BACK = 0.2;
  const tilt = new THREE.Group(); tilt.position.z = F - BACK; tilt.rotation.x = LEAN; g.add(tilt);
  const a = new THREE.Group(); a.position.z = -F; tilt.add(a);
  const rr = new THREE.Shape();
  const r = 0.05;
  rr.moveTo(-hw + r, -hd); rr.lineTo(hw - r, -hd); rr.quadraticCurveTo(hw, -hd, hw, -hd + r);
  rr.lineTo(hw, hd - r); rr.quadraticCurveTo(hw, hd, hw - r, hd); rr.lineTo(-hw + r, hd);
  rr.quadraticCurveTo(-hw, hd, -hw, hd - r); rr.lineTo(-hw, -hd + r); rr.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  const body = new THREE.ExtrudeGeometry(rr, { depth: H - 2 * R, bevelEnabled: true, bevelThickness: R, bevelSize: R, bevelSegments: 3, curveSegments: 6 });
  body.translate(0, 0, R); body.rotateX(-Math.PI / 2);
  a.add(new THREE.Mesh(body, shell(0x2f353b, 0.55, 0.2)));

  // Sockets across the front face, which the bevel carries R proud of the outline: a light surround
  // in the plug's outline, and a dark hole inside it.
  const PORTS = [-0.255, -0.085, 0.085, 0.255];
  const plates: THREE.BufferGeometry[] = [], holes: THREE.BufferGeometry[] = [];
  for (const x of PORTS) {
    plates.push(new THREE.BoxGeometry(0.12, 0.08, 0.014).translate(x, 0.07, F + 0.006));
    plates.push(new THREE.CylinderGeometry(0.04, 0.04, 0.014, 16).rotateX(Math.PI / 2).translate(x, 0.11, F + 0.006));
    holes.push(new THREE.BoxGeometry(0.095, 0.058, 0.01).translate(x, 0.066, F + 0.014));
    holes.push(new THREE.CylinderGeometry(0.028, 0.028, 0.01, 12).rotateX(Math.PI / 2).translate(x, 0.105, F + 0.014));
  }
  a.add(merged(plates, shell(0xa3aab1, 0.5, 0.2)));
  a.add(merged(holes, shell(0x0d1013, 0.8, 0.1)));
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, 0.02), new THREE.MeshStandardMaterial({ color: 0x06131a, emissive: 0x3fd47a, emissiveIntensity: 2.4 }));
  led.position.set(-0.3, H + 0.002, hd - 0.05); a.add(led);

  // The controller plug in port one: the indigo body with its rounded nose in the socket, and a
  // grey cable out of its back. The lean brings the cable's exit down to the cap right at the
  // origin, so the cord lies flat from there, in the unleaned group, and curls short of the edge.
  const indigo = shell(0x46398f, 0.42, 0.05);
  const plug = [
    new THREE.BoxGeometry(0.1, 0.07, 0.12).translate(PORTS[0], 0.095, F + 0.075),
    new THREE.CylinderGeometry(0.03, 0.03, 0.12, 14).rotateX(Math.PI / 2).translate(PORTS[0], 0.13, F + 0.075),
    new THREE.BoxGeometry(0.06, 0.05, 0.06).translate(PORTS[0], 0.09, F + 0.16),
  ];
  a.add(merged(plug, indigo));
  const cord = [
    new THREE.CylinderGeometry(0.009, 0.009, 0.1, 8).rotateX(Math.PI / 2).translate(PORTS[0], 0.02, F - BACK + 0.04),
    new THREE.TorusGeometry(0.05, 0.009, 6, 18, Math.PI * 1.3).rotateX(Math.PI / 2).translate(PORTS[0] - 0.05, 0.02, F - BACK + 0.11),
  ];
  g.add(merged(cord, shell(0x9aa4ac, 0.7, 0.1)));

  // The USB lead out of the right side, bending back across the cap to its plug.
  const lead = [
    new THREE.CylinderGeometry(0.01, 0.01, 0.2, 8).rotateZ(Math.PI / 2).translate(hw + 0.1, 0.03, 0.02),
    new THREE.TorusGeometry(0.09, 0.01, 6, 16, Math.PI / 2).rotateX(Math.PI / 2).translate(hw + 0.2, 0.03, -0.07),
    new THREE.CylinderGeometry(0.01, 0.01, 0.06, 8).rotateX(Math.PI / 2).translate(hw + 0.29, 0.03, -0.1),
  ];
  a.add(merged(lead, shell(0x2b3740, 0.8, 0.1)));
  const plugBody = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.09), shell(0x1e2328, 0.6, 0.2)); plugBody.position.set(hw + 0.29, 0.03, -0.175); a.add(plugBody);
  const plugTip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.016, 0.06), shell(0xc0c8ce, 0.3, 0.8)); plugTip.position.set(hw + 0.29, 0.03, -0.245); a.add(plugTip);

  // The back bottom edge rises D sin LEAN. The riser's top stops just under the body there.
  const riser = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), shell(0x1b2129, 0.7, 0.2));
  riser.position.set(0, 0.05, -0.21 - BACK); g.add(riser);
  return g;
}
