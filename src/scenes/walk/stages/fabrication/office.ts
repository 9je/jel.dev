import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import type { PointPlacement } from '../../rig';
import { stencilTexture } from '../../textures';
import { surface } from '../../materials';
import { instances, merged, place, type Spot } from '../../merge';
import { LABS, labSteel } from '../../labs/materials';
import { screenFace } from '../../labs/textures';
import { papers, glassRoom } from '../../labs/props';
import { paperSheet } from '../../labs/textures';
import { signBox } from '../../labs/signage';
import { OFFICE, SODIUM } from './layout';
import { controller, key, bridge } from './exhibits';
import { nameplateFace, numberTag, dispatchBoardFace, consoleKeys } from './boards';

/** What each product is, in three words, for the line under its name. */
const SUBTITLES: Record<string, string> = { 'conch.gg': 'GameCube netplay', 'ezkey.io': 'Key store', 'gc-bridge': 'Controller bridge' };

/**
 * A museum nameplate, standing at the back of a plinth: a brushed steel plate on two standoffs,
 * raked back a little toward the eye, the product's name engraved in tracked Michroma with a one
 * line subtitle under it, and an edge-lit acrylic strip along its top edge in the wing's orange.
 * Origin at the foot of the standoffs, face toward +z. Four draw calls, all of them part of the
 * exhibit the pointer picks: the steel takes the hover wash and the strip pulses.
 *
 * The plate stands 0.5 m off the cap, so a product half a metre in front of it hides the
 * standoffs and not the name. The earlier label was a pane of clear acrylic with the name glowing
 * through it, which from the hold read as a text box floating over the product.
 */
function nameplate(label: string): THREE.Group {
  const g = new THREE.Group();
  const W = 1.1, Hp = 0.3, LIFT = 0.5, RAKE = 0.16;
  // The standoffs: two rods with a foot each, up into the plate's lower third.
  const rods: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    rods.push(new THREE.CylinderGeometry(0.011, 0.011, LIFT + 0.1, 8).translate(sx * W * 0.36, (LIFT + 0.1) / 2, -0.02));
    rods.push(new THREE.CylinderGeometry(0.03, 0.036, 0.012, 12).translate(sx * W * 0.36, 0.006, -0.02));
  }
  const standoffs = merged(rods, labSteel(0x6d7a84)); standoffs.name = 'standoffs'; g.add(standoffs);
  // The plate, hinged at its foot and leaned back: a body of plain steel and the engraved face
  // on it, so the map sits on the front only.
  const tilt = new THREE.Group(); tilt.position.y = LIFT; tilt.rotation.x = -RAKE; g.add(tilt);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(W, Hp, 0.012), labSteel(0x9aa5ad));
  plate.position.set(0, Hp / 2, 0); plate.name = 'plate'; tilt.add(plate);
  const face = nameplateFace(label, SUBTITLES[label] ?? '', label.length);
  const ink = new THREE.Mesh(new THREE.PlaneGeometry(W, Hp), new THREE.MeshStandardMaterial({ map: face, color: 0xffffff, metalness: 0.45, roughness: 0.42 }));
  ink.position.set(0, Hp / 2, 0.0065); ink.name = 'ink'; tilt.add(ink);
  // The lit edge: a bar of acrylic along the top of the plate, lit from its ends.
  const strip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.022, 0.022), new THREE.MeshStandardMaterial({ color: 0x1a1208, emissive: SODIUM, emissiveIntensity: 2.2 }));
  strip.position.set(0, Hp + 0.011, 0); strip.name = 'strip'; tilt.add(strip);
  return g;
}

/**
 * The dispatch board on the office's back wall: a printed schedule in an aluminium frame, with
 * the hand-written marks on it, a marker tray along its foot, magnets, and a sheet pinned under
 * one of them. Origin at the centre of the face, face toward +z. Five draw calls.
 */
function dispatchBoard(): THREE.Group {
  const g = new THREE.Group();
  const W = 1.8, Hb = 1.0;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, Hb + 0.06, 0.03), labSteel(0x9aa5ad));
  frame.position.z = -0.02; frame.name = 'frame'; g.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, Hb), new THREE.MeshStandardMaterial({ map: dispatchBoardFace(), roughness: 0.32, metalness: 0.05 }));
  face.name = 'face'; g.add(face);
  // The tray and two markers lying in it.
  const tray = merged([
    new THREE.BoxGeometry(0.7, 0.012, 0.06).translate(0, 0, 0.03),
    new THREE.BoxGeometry(0.7, 0.03, 0.01).translate(0, 0.015, 0.06),
  ], labSteel(0x8e99a1));
  tray.position.set(-W / 2 + 0.42, -Hb / 2 - 0.035, 0); tray.name = 'tray'; g.add(tray);
  const pens = merged([
    new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8).rotateZ(Math.PI / 2).translate(-0.12, 0.014, 0.03),
    new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8).rotateZ(Math.PI / 2).rotateY(0.18).translate(0.1, 0.014, 0.028),
  ], new THREE.MeshStandardMaterial({ color: 0x1f3f8f, roughness: 0.45 }));
  pens.position.copy(tray.position); pens.name = 'pens'; g.add(pens);
  // Magnets: a pinned sheet under one, three more parked along the frame.
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.22), new THREE.MeshStandardMaterial({ map: paperSheet(4), roughness: 0.9 }));
  sheet.position.set(W / 2 - 0.16, Hb / 2 - 0.34, 0.003); sheet.rotation.z = -0.05; sheet.name = 'sheet'; g.add(sheet);
  const magnets = merged([
    new THREE.CylinderGeometry(0.018, 0.018, 0.008, 14).rotateX(Math.PI / 2).translate(W / 2 - 0.16, Hb / 2 - 0.25, 0.008),
    new THREE.CylinderGeometry(0.018, 0.018, 0.008, 14).rotateX(Math.PI / 2).translate(W / 2 - 0.08, -Hb / 2 + 0.12, 0.006),
    new THREE.CylinderGeometry(0.018, 0.018, 0.008, 14).rotateX(Math.PI / 2).translate(W / 2 - 0.13, -Hb / 2 + 0.12, 0.006),
    new THREE.CylinderGeometry(0.018, 0.018, 0.008, 14).rotateX(Math.PI / 2).translate(W / 2 - 0.18, -Hb / 2 + 0.12, 0.006),
  ], new THREE.MeshStandardMaterial({ color: LABS.hazard, roughness: 0.5 }));
  magnets.name = 'magnets'; g.add(magnets);
  return g;
}

const shell = (color: number, roughness = 0.5, metalness = 0.3) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

/**
 * A display plinth, 1.4 along the glass by 1.0 deep on a 1.045 m cap: a cast concrete body on a recessed steel kick,
 * steel angles on its corners, a bevelled steel cap with the wing's orange lit in a line under its
 * lip, and a numbered plate on the front. Origin at the floor under the centre of the body. Seven
 * draw calls, all of them part of the exhibit the pointer picks, so the whole pedestal lifts with
 * its product. The flat grey box it replaces was the one greybox thing left in the office.
 */
function plinth(store: StageContext['store'], n: number): THREE.Group {
  const g = new THREE.Group();
  // Local x runs along the glass and local z toward the camera: the office turns it a quarter.
  const W = 1.4, D = 1.0, TOP = 1.045, CAP = 0.05, KICK = 0.12;
  const kick = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, KICK, D - 0.1), labSteel(0x1b2129)); kick.position.y = KICK / 2; g.add(kick);
  const concrete = surface(store.texture('concrete_wall'), W, TOP - KICK, 1.2); concrete.color.setHex(0xd6dde1); concrete.roughness = 0.8;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, TOP - CAP - KICK, D), concrete); body.position.y = KICK + (TOP - CAP - KICK) / 2; g.add(body);
  // Corner angles: two flanges per corner, standing a millimetre proud of the concrete.
  const angles: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    angles.push(new THREE.BoxGeometry(0.05, TOP - CAP - KICK, 0.008).translate(sx * (W / 2 - 0.025), body.position.y, sz * (D / 2 + 0.001)));
    angles.push(new THREE.BoxGeometry(0.008, TOP - CAP - KICK, 0.05).translate(sx * (W / 2 + 0.001), body.position.y, sz * (D / 2 - 0.025)));
  }
  g.add(merged(angles, labSteel(0x6d7a84)));
  // The cap: a rounded rectangle with a bevelled edge, 5 cm proud of the body all round.
  const cw = W + 0.1, cd = D + 0.1, r = 0.04;
  const rr = new THREE.Shape();
  rr.moveTo(-cw / 2 + r, -cd / 2); rr.lineTo(cw / 2 - r, -cd / 2); rr.quadraticCurveTo(cw / 2, -cd / 2, cw / 2, -cd / 2 + r);
  rr.lineTo(cw / 2, cd / 2 - r); rr.quadraticCurveTo(cw / 2, cd / 2, cw / 2 - r, cd / 2); rr.lineTo(-cw / 2 + r, cd / 2);
  rr.quadraticCurveTo(-cw / 2, cd / 2, -cw / 2, cd / 2 - r); rr.lineTo(-cw / 2, -cd / 2 + r); rr.quadraticCurveTo(-cw / 2, -cd / 2, -cw / 2 + r, -cd / 2);
  const capGeo = new THREE.ExtrudeGeometry(rr, { depth: CAP - 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 4 });
  capGeo.translate(0, 0, 0.008); capGeo.rotateX(-Math.PI / 2); capGeo.translate(0, TOP - CAP, 0);
  const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0x2b3740, metalness: 0.6, roughness: 0.4 })); g.add(cap);
  // The light line: a strip under the cap's lip on all four sides, in the wing's orange.
  const lip: THREE.BufferGeometry[] = [];
  const ly = TOP - CAP - 0.012;
  lip.push(new THREE.BoxGeometry(W + 0.06, 0.012, 0.02).translate(0, ly, D / 2 + 0.02));
  lip.push(new THREE.BoxGeometry(W + 0.06, 0.012, 0.02).translate(0, ly, -D / 2 - 0.02));
  lip.push(new THREE.BoxGeometry(0.02, 0.012, D + 0.06).translate(W / 2 + 0.02, ly, 0));
  lip.push(new THREE.BoxGeometry(0.02, 0.012, D + 0.06).translate(-W / 2 - 0.02, ly, 0));
  g.add(merged(lip, new THREE.MeshStandardMaterial({ color: 0x1a1208, emissive: SODIUM, emissiveIntensity: 1.8 })));
  // The tag: a small engraved steel plate on the front face at eye level for a standing visitor.
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.006), labSteel(0xaab3ba)); plate.position.set(0, 0.72, D / 2 + 0.004); g.add(plate);
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshStandardMaterial({ map: numberTag(`0${n}`, n), metalness: 0.45, roughness: 0.42 }));
  num.position.set(0, 0.72, D / 2 + 0.0075); g.add(num);
  return g;
}

/**
 * The dispatch office: glass above a white sill on all four sides, a door in the front and back
 * face on the walked line, a lit ceiling grid, a working counter under blinds on the front glass,
 * the three products on lit plinths along the west glass, and a desk with its stool on its side.
 */
export function buildOffice(ctx: StageContext, root: THREE.Group): { light: PointPlacement; hotspots: Hotspot[] } {
  const { store, anchors } = ctx;
  const { x: OX, z: OZ, w: W, d: D, h: H, sill: S, frontDoorX, backDoorX, doorW } = OFFICE;
  const hx = W / 2, hz = D / 2;

  // The bay floor runs under it, so the office floor is the same concrete lifted a centimetre and
  // painted lighter. Without a store the ceiling grid is flat paint: the office sits behind the
  // preloader, before the shared labs textures load.
  const floorMat = surface(store.texture('concrete_floor'), W, D, 4); floorMat.color.setHex(0xc9d4dc);
  const g = glassRoom(null, {
    w: W, d: D, h: H, sill: S,
    doors: [
      { face: 'north', x: frontDoorX - OX, w: doorW },
      { face: 'south', x: backDoorX - OX, w: doorW },
    ],
    litEvery: 2, panelIntensity: 0.9, floor: floorMat,
  });
  g.position.set(OX, 0, OZ); root.add(g);
  // A lit box over the front door instead of the stencil on its head panel. From the far end of the
  // hall the office was a grey glass shed with a grey word on it. The one lit sign in the bay that
  // is not the ticker is what makes it read as somewhere with someone in it.
  g.add(place(signBox('DISPATCH', { w: 1.8, h: 0.3, accent: SODIUM, on: true, code: 'BAY 02' }), frontDoorX - OX, H - 0.25, hz + 0.07));

  // The dispatch counter, along the front glass west of the door. Six metres of it, as drawn, would
  // have run across the doorway the camera walks through, so it takes the clear run instead.
  const cx = -1.95, cw = 2.8, cz = hz - 0.36;
  const counter = new THREE.Mesh(new THREE.BoxGeometry(cw, S, 0.6), new THREE.MeshStandardMaterial({ color: LABS.panel, roughness: 0.7 }));
  counter.position.set(cx, S / 2, cz); g.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.04, 0.04, 0.64), labSteel(0x8e99a1)); top.position.set(cx, S + 0.02, cz); g.add(top);

  // The console: a cream wedge with its top raked toward whoever stands behind it, a screen on
  // the operator's left of the raked face and a keypad on the right. The panels are built by
  // geometry rather than by Euler angles, so their faces read the right way up from the operator's
  // side rather than mirrored. The box with a lit rectangle it replaces was a box with a lit
  // rectangle, and the reference for this room is a keyed desk console under a gooseneck.
  const CW = 1.2, CD = 0.5, BACK = 0.2, FRONT = 0.07;
  const profile = new THREE.Shape();
  profile.moveTo(-CD / 2, 0); profile.lineTo(CD / 2, 0); profile.lineTo(CD / 2, FRONT); profile.lineTo(-CD / 2, BACK); profile.closePath();
  const wedgeGeo = new THREE.ExtrudeGeometry(profile, { depth: CW, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
  // Extruded along its own z, then turned so the run lies along x with the high edge at +z, the glass.
  wedgeGeo.rotateY(Math.PI / 2); wedgeGeo.translate(-CW / 2, 0, 0);
  const console_ = new THREE.Mesh(wedgeGeo, shell(0xd5d6cf, 0.6, 0.05));
  console_.position.set(cx - 0.6, S + 0.04, cz); g.add(console_);
  // The raked face: from the low edge at -z up to the high edge at +z. A panel is turned so its
  // top lands on the high edge and its normal stands off the slope.
  const rake = Math.atan2(BACK - FRONT, CD), SKIN = 0.006;
  const onSlope = (geo: THREE.BufferGeometry, x: number, s: number, lift: number) => {
    const off = SKIN + lift;
    geo.rotateZ(Math.PI); geo.rotateX(-Math.PI / 2 - rake);
    geo.translate(x, (FRONT + BACK) / 2 + s * Math.sin(rake) + off * Math.cos(rake), s * Math.cos(rake) - off * Math.sin(rake));
    return geo;
  };
  const bezel = new THREE.Mesh(onSlope(new THREE.PlaneGeometry(0.54, 0.24), 0.3, 0.12, 0.002), shell(0x1b2129, 0.5, 0.2));
  const screen = new THREE.Mesh(onSlope(new THREE.PlaneGeometry(0.5, 0.2), 0.3, 0.12, 0.004), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.1, emissiveMap: screenFace(['DISPATCH', 'bay 2 open', 'dock 1 closed'], '#E0813A', 512, 200) }));
  const keys = new THREE.Mesh(onSlope(new THREE.PlaneGeometry(0.56, 0.28), -0.3, -0.04, 0.002), new THREE.MeshStandardMaterial({ map: consoleKeys(), roughness: 0.55 }));
  for (const m of [bezel, screen, keys]) { m.position.copy(console_.position); g.add(m); }

  // The gooseneck: two segments and a head, bent toward the operator.
  const mic = new THREE.Group();
  const steel = labSteel(0x7d878e);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.02, 12), steel); base.position.y = 0.01; mic.add(base);
  const stem = (len: number, lean: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, len, 6), steel); m.position.set(0, y, z); m.rotation.x = lean; return m; };
  mic.add(stem(0.35, -0.15, 0.19, -0.026), stem(0.35, -0.9, 0.47, -0.19));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), shell(0x1b2129, 0.7, 0.2)); head.position.set(0, 0.58, -0.33); mic.add(head);
  mic.position.set(cx + 0.75, S + 0.04, cz); g.add(mic);

  // Paperwork on the counter and where it fell on the floor. The booth's desk lamp stood on the
  // counter's east end for a draft: behind glass, half lit, its chrome armature read as an orange
  // scribble hanging in the office, which is the one thing on Jordan's list about the booth.
  g.add(papers([[cx + 0.2, S + 0.04, cz - 0.14, 0.3], [cx + 0.32, S + 0.04, cz - 0.05, 1.1], [hx - 2.6, 0, 0.3, 0.4], [hx - 2.0, 0, 0.9, 1.2], [hx - 3.1, 0, -0.2, 2.3], [-1.2, 0, 2.4, 0.8]]));

  // Venetian blinds across the upper third of the front glass, one of the three run up short. They
  // are the reason the office reads as a room with a window rather than as a vitrine: from the hall
  // the eye gets a slatted band at the top of the glass and a lit counter under it.
  const slats: Spot[] = [], rails: Spot[] = [];
  for (const [bx, bottom] of [[-3.8, H - 0.9], [-1.5, H - 0.9], [3.4, H - 0.55]] as [number, number][]) {
    rails.push([bx, H - 0.16, hz - 0.05]);
    for (let y = H - 0.25; y > bottom - 0.001; y -= 0.06) slats.push([bx, y, hz - 0.05]);
  }
  const blindMat = shell(0xcfd8dd, 0.75, 0.1);
  g.add(instances(new THREE.BoxGeometry(2.4, 0.02, 0.05), blindMat, slats));
  g.add(instances(new THREE.BoxGeometry(2.44, 0.07, 0.07), labSteel(0x8e99a1), rails));

  // The back wall's two working fixtures: the dispatch board and the clock. The board hangs
  // toward the west end of the wall, where the turn into and out of the hold sweeps across it.
  g.add(place(dispatchBoard(), -3.2, 1.55, -hz + 0.1));

  // The recreation wing owns the clock model and is not loaded here, so this one is turned.
  const clock = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 24), shell(0x1b2129, 0.6, 0.3)); rim.rotation.x = Math.PI / 2; clock.add(rim);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.155, 24), shell(0xeef3f5, 0.5, 0)); dial.position.z = 0.017; clock.add(dial);
  const hands = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), new THREE.MeshBasicMaterial({ map: stencilTexture('11 : 07', { width: 256, height: 128, color: '#1B2129', font: '600 64px Michroma, system-ui, sans-serif', alpha: 1, flecks: false }), transparent: true, depthWrite: false }));
  hands.position.z = 0.019; clock.add(hands);
  g.add(place(clock, 2.5, 2.4, -hz + 0.1));

  // Exhibits along the west glass, evenly spaced, facing the camera at the hold. The flagship sits in
  // the centre so its plate, which pins to the right of its anchor, lands in the gap beside it
  // rather than over a neighbour. Positive z is to the camera's left.
  //
  // Spaced 2.6 m rather than 3 m and carried 0.4 m to the camera's left, which walks the far exhibit
  // 0.8 m out from under the dock. The dock holds a strip down the right of the frame that the page's
  // own cards already keep out of, and nothing kept the room's props out of it. conch stays where it
  // was: the office is 8 m deep, so its plinth is already close to the south glass, and any further
  // left would put it under the copy column.
  const exhibits: [string, string, number, () => THREE.Group][] = [
    ['conch', 'conch.gg', 3.0, () => controller(store.model('gamecube_controller'))],
    ['ezkey', 'ezkey.io', 0.4, key],
    ['gc-bridge', 'gc-bridge', -2.2, bridge],
  ];
  const hotspots: Hotspot[] = [];
  const ex = -hx + 0.9;
  exhibits.forEach(([key, label, dz, make], i) => {
    // One group per exhibit, and it is what the pointer picks: plinth, product, plate and its light
    // strip all belong to the one product, so the whole thing lifts together under the cursor. The
    // plinths are built per exhibit rather than as one instanced batch for exactly that reason.
    // The plinth's long side faces the camera, so its front plate turns with it.
    const exhibit = new THREE.Group(); exhibit.name = key;
    exhibit.add(place(plinth(store, i + 1), ex, 0, dz, Math.PI / 2));
    exhibit.add(place(nameplate(label), ex - 0.34, 1.045, dz, Math.PI / 2));
    exhibit.add(place(make(), ex + 0.14, 1.045, dz, Math.PI / 2 + 0.35));
    g.add(exhibit);
    hotspots.push({ id: key, kind: 'project', label, object: exhibit, stop: 'fabrication' });
    // The plate hangs to the right of its anchor, so the anchor sits past the product's right edge.
    anchors.set(key, new THREE.Vector3(OX + ex + 0.6, 1.7, OZ + dz - 0.9));
  });

  // The desk on the east side, its stool on its side.
  const desk = store.model('desk'); desk.position.set(hx - 1.3, 0, -1.2); desk.rotation.y = Math.PI / 2; g.add(desk);
  const stool = store.model('stool'); stool.position.set(hx - 2.2, 0.28, -0.4); stool.rotation.set(Math.PI / 2, 0, 0.5); g.add(stool);

  return { light: { kind: 'point', position: [OX, H - 0.4, OZ], color: LABS.cold, intensity: 6, distance: 12, decay: 1.8 }, hotspots };
}
