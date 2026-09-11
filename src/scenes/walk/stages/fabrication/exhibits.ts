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
 * conch.gg: a GameCube controller. The silhouette is an extruded outline of the real shell, body
 * with a shoulder over each end and the two grips falling away toward whoever holds it, with a
 * bevel so the edges round off. The face is laid out where the console laid it: the main stick in
 * its octagonal gate top left, the pad below it, one oversized green A with the small red B beside
 * it and the grey X and Y kidneys around it, the yellow C nub below, and Start in the middle.
 * Built in millimetres at real size and scaled up on the group.
 */
export function controller(): THREE.Group {
  const g = new THREE.Group();
  const S = 4.6 / 1000, PIVOT = 0.375;
  const tilt = new THREE.Group(); tilt.rotation.x = RAKE; tilt.position.y = PIVOT; g.add(tilt);
  const mm = new THREE.Group(); mm.scale.setScalar(S); tilt.add(mm);

  // Right half of the outline, top centre round to bottom centre, mirrored for the left.
  const right: [number, number][] = [[0, 34], [30, 36], [52, 33], [66, 22], [71, 4], [69, -14], [62, -34], [56, -56], [46, -70], [35, -68], [28, -50], [22, -30], [10, -24], [0, -25]];
  const left = right.slice(1, -1).reverse().map(([x, y]): [number, number] => [-x, y]);
  const outline = [...right, ...left].map(([x, y]) => new THREE.Vector2(x, y));
  const shape = new THREE.Shape(); shape.moveTo(outline[0].x, outline[0].y); shape.splineThru(outline.slice(1)); shape.closePath();
  const body = new THREE.ExtrudeGeometry(shape, { depth: 20, bevelEnabled: true, bevelThickness: 6, bevelSize: 5, bevelSegments: 3, curveSegments: 10 });
  // Shape y ran away from the player. Lay the face up, so the extrusion hangs below y 0 and that
  // axis runs away from the camera.
  body.translate(0, 0, -26); body.rotateX(-Math.PI / 2);
  mm.add(new THREE.Mesh(body, shell(0x46398f, 0.42, 0.05)));

  const at = (geo: THREE.BufferGeometry, x: number, y: number, h = 0) => geo.translate(x, h, -y);
  // The face. A is the one bold thing on it, so it is drawn at the size the console drew it.
  const parts: [THREE.BufferGeometry[], THREE.Material][] = [
    [[at(new THREE.CylinderGeometry(11.5, 11.5, 6, 20), 37, 4, 3)], shell(0x3fae4b, 0.35, 0.05)],
    [[at(new THREE.CylinderGeometry(6, 6, 5, 14), 20, -8, 2.5)], shell(0xc93d33, 0.35, 0.05)],
    [[at(new THREE.CylinderGeometry(9, 8, 10, 14), 30, -34, 5), at(new THREE.SphereGeometry(8, 12, 8).scale(1, 0.5, 1), 30, -34, 10)], shell(0xe4b825, 0.4, 0.05)],
    [[
      at(new THREE.CylinderGeometry(6, 6, 5, 14).scale(0.8, 1, 1.7), 55, 2, 2.5),
      at(new THREE.CylinderGeometry(6, 6, 5, 14).scale(1.7, 1, 0.8), 37, 22, 2.5),
      at(new THREE.CylinderGeometry(4.5, 4.5, 4, 12), 0, 10, 2),
      at(new THREE.CylinderGeometry(16, 16, 3, 8), -38, 12, 1.5),
      at(new THREE.CylinderGeometry(9, 8, 14, 14), -38, 12, 7),
      at(new THREE.SphereGeometry(10, 12, 8).scale(1, 0.4, 1), -38, 12, 14),
      at(new THREE.BoxGeometry(24, 5, 8), -32, -30, 2.5),
      at(new THREE.BoxGeometry(8, 5, 24), -32, -30, 2.5),
    ], shell(0xb7bcc4, 0.45, 0.1)],
  ];
  for (const [geos, mat] of parts) mm.add(merged(geos, mat));

  // The cable leaves the top of the shell, which the rake carries up and away from the camera, and
  // comes down behind the stand to curl on the cap short of the label plate.
  const cable = [
    new THREE.CylinderGeometry(0.009, 0.009, 0.53, 8).rotateX(-2.74).translate(0, 0.256, -0.195),
    new THREE.TorusGeometry(0.06, 0.009, 6, 18, Math.PI * 1.45).rotateX(Math.PI / 2).translate(0.06, 0.012, -0.36),
  ];
  g.add(merged(cable, shell(0x9aa4ac, 0.7, 0.1)));
  stand(g, tilt, PIVOT, { w: 0.36, back: 32 * S, from: -0.17 });
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
 * gc-bridge: the four port GameCube adapter the bridge reads, flat on the cap with its ports toward
 * the camera and the USB lead out of its side. The four sockets in a row, each the console's own
 * rounded plug outline with a bump on top, are what say GameCube from across a room.
 */
export function adapter(): THREE.Group {
  const g = new THREE.Group();
  const W = 0.7, D = 0.36, H = 0.16, R = 0.012;
  const rr = new THREE.Shape();
  const r = 0.05, hw = W / 2, hd = D / 2;
  rr.moveTo(-hw + r, -hd); rr.lineTo(hw - r, -hd); rr.quadraticCurveTo(hw, -hd, hw, -hd + r);
  rr.lineTo(hw, hd - r); rr.quadraticCurveTo(hw, hd, hw - r, hd); rr.lineTo(-hw + r, hd);
  rr.quadraticCurveTo(-hw, hd, -hw, hd - r); rr.lineTo(-hw, -hd + r); rr.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  const body = new THREE.ExtrudeGeometry(rr, { depth: H - 2 * R, bevelEnabled: true, bevelThickness: R, bevelSize: R, bevelSegments: 3, curveSegments: 6 });
  body.translate(0, 0, R); body.rotateX(-Math.PI / 2);
  g.add(new THREE.Mesh(body, shell(0x2f353b, 0.55, 0.2)));

  // Sockets across the front face, which the bevel carries R proud of the outline: a light plate
  // with the plug's round bump, and a dark recess in it.
  const F = hd + R;
  const plates: THREE.BufferGeometry[] = [], recesses: THREE.BufferGeometry[] = [];
  for (const x of [-0.255, -0.085, 0.085, 0.255]) {
    plates.push(new THREE.BoxGeometry(0.115, 0.075, 0.014).translate(x, 0.07, F + 0.006));
    plates.push(new THREE.CylinderGeometry(0.038, 0.038, 0.014, 16).rotateX(Math.PI / 2).translate(x, 0.108, F + 0.006));
    recesses.push(new THREE.BoxGeometry(0.085, 0.05, 0.01).translate(x, 0.065, F + 0.014));
    recesses.push(new THREE.CylinderGeometry(0.024, 0.024, 0.01, 12).rotateX(Math.PI / 2).translate(x, 0.102, F + 0.014));
  }
  g.add(merged(plates, shell(0x9ea6ad, 0.5, 0.2)));
  g.add(merged(recesses, shell(0x15181c, 0.7, 0.1)));
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, 0.02), new THREE.MeshStandardMaterial({ color: 0x06131a, emissive: 0x3fd47a, emissiveIntensity: 2.4 }));
  led.position.set(-0.3, H + 0.002, hd - 0.05); g.add(led);

  // The USB lead out of the right side, bending back across the cap to its plug.
  const lead = [
    new THREE.CylinderGeometry(0.01, 0.01, 0.2, 8).rotateZ(Math.PI / 2).translate(hw + 0.1, 0.03, 0.02),
    new THREE.TorusGeometry(0.09, 0.01, 6, 16, Math.PI / 2).rotateX(Math.PI / 2).translate(hw + 0.2, 0.03, -0.07),
    new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8).rotateX(Math.PI / 2).translate(hw + 0.29, 0.03, -0.13),
  ];
  g.add(merged(lead, shell(0x2b3740, 0.8, 0.1)));
  const plugBody = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.09), shell(0x1e2328, 0.6, 0.2)); plugBody.position.set(hw + 0.29, 0.03, -0.24); g.add(plugBody);
  const plugTip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.016, 0.06), shell(0xc0c8ce, 0.3, 0.8)); plugTip.position.set(hw + 0.29, 0.03, -0.31); g.add(plugTip);
  return g;
}
