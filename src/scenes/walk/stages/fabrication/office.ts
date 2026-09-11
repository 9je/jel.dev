import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import type { PointPlacement } from '../../rig';
import { stencilTexture } from '../../textures';
import { surface } from '../../materials';
import { instances, merged, place, type Spot } from '../../merge';
import { LABS, labSteel } from '../../labs/materials';
import { screenFace } from '../../labs/textures';
import { papers, glassRoom } from '../../labs/props';
import { signBox } from '../../labs/signage';
import { OFFICE, SODIUM } from './layout';

/** An edge-lit acrylic label, standing at the back of a plinth: a clear plate with the product's
 *  name burned through it and the wing's orange in the channel it stands in. Origin at the foot of
 *  the plate, face toward +z. Three draw calls, and every one of them takes the hover pulse. */
function labelPlate(label: string): THREE.Group {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.36), new THREE.MeshPhysicalMaterial({ color: LABS.glassTint, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0, side: THREE.DoubleSide }));
  plate.position.y = 0.21; plate.name = 'plate'; g.add(plate);
  // The name is an alpha mapped plane, not a screen: a lit black card in front of a product is the
  // text box Jordan counted, and acrylic that only glows where the letters are is the label a
  // product actually gets. Three reads an alpha map's green channel, and the stencil's ink is pale
  // blue on clear, so the glyphs come through opaque and the ground does not come through at all.
  const map = stencilTexture(label, { width: 512, height: 160, color: '#CFE6EE', font: '600 96px Michroma, system-ui, sans-serif', alpha: 1, flecks: false });
  const ink = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.32), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xcfe6ee, emissiveIntensity: 1.6, emissiveMap: map, alphaMap: map, transparent: true, depthWrite: false }));
  ink.position.set(0, 0.21, 0.01); ink.renderOrder = 1; ink.name = 'ink'; g.add(ink);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: 0x101820, emissive: SODIUM, emissiveIntensity: 2.4 }));
  strip.position.y = 0.02; strip.name = 'strip'; g.add(strip);
  return g;
}

const shell = (color: number, roughness = 0.5, metalness = 0.3) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

/** conch.gg: a controller. Two grips off a body, two sticks on its face. Origin at the plinth top.
 *  A shell in the graphite the brief asked for disappeared against the plinth's steel cap at the
 *  hold, so the body is the pale half of a two tone case and the grips keep the graphite. */
function controller(): THREE.Group {
  const g = new THREE.Group();
  const dark = shell(0x2a2f36, 0.45, 0.2);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.14), shell(0xb0bac1, 0.4, 0.15)); body.position.y = 0.05; g.add(body);
  for (const side of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), dark);
    grip.position.set(side * 0.12, 0.05, 0.09); grip.rotation.set(Math.PI / 2.2, 0, side * 0.5); g.add(grip);
  }
  const sticks = [new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12).translate(-0.07, 0.1, 0), new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12).translate(0.05, 0.1, 0.02)];
  g.add(merged(sticks, shell(0xcfd8dd, 0.4, 0.1)));
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 0.02), new THREE.MeshStandardMaterial({ color: 0x06131a, emissive: 0x6ec1d6, emissiveIntensity: 2 }));
  led.position.set(-0.01, 0.091, 0.05); g.add(led);
  return g;
}

/** ezkey.io: a padlock, lit from inside so the one product that is a key store glows like one. */
function padlock(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.06), new THREE.MeshStandardMaterial({ color: 0x6ec1d6, emissive: 0x6ec1d6, emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.5 }));
  body.position.y = 0.08; g.add(body);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), labSteel(0xaeb8bf));
  shackle.position.y = 0.16; g.add(shackle);
  g.rotation.z = 0.06;
  return g;
}

/** gc-bridge: an adapter with its cable curling away across the plinth. */
function adapter(): THREE.Group {
  const g = new THREE.Group();
  const dark = shell(0x39424b, 0.5, 0.4);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.09), dark); body.position.y = 0.025; g.add(body);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.004, 0.06), labSteel(0xa7b1b8)); plate.position.y = 0.052; g.add(plate);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.012), new THREE.MeshStandardMaterial({ color: 0x06131a, emissive: 0x3fd47a, emissiveIntensity: 2.4 }));
  led.position.set(0.05, 0.053, 0); g.add(led);
  const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6), shell(0x2b3740, 0.8, 0.1));
  lead.position.set(0.28, 0.01, 0.08); lead.rotation.set(0, 0.5, Math.PI / 2); g.add(lead);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 20, Math.PI * 1.5), shell(0x2b3740, 0.8, 0.1));
  coil.position.set(0.5, 0.01, 0.28); coil.rotation.x = Math.PI / 2; g.add(coil);
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
  // hall the office was a grey glass shed with a grey word on it; the one lit sign in the bay that
  // is not the ticker is what makes it read as somewhere with someone in it.
  g.add(place(signBox('DISPATCH', { w: 1.8, h: 0.3, accent: SODIUM, on: true }), frontDoorX - OX, H - 0.25, hz + 0.07));

  // The dispatch counter, along the front glass west of the door. Six metres of it, as drawn, would
  // have run across the doorway the camera walks through, so it takes the clear run instead.
  const cx = -1.95, cw = 2.8, cz = hz - 0.36;
  const counter = new THREE.Mesh(new THREE.BoxGeometry(cw, S, 0.6), new THREE.MeshStandardMaterial({ color: LABS.panel, roughness: 0.7 }));
  counter.position.set(cx, S / 2, cz); g.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.04, 0.04, 0.64), labSteel(0x8e99a1)); top.position.set(cx, S + 0.02, cz); g.add(top);

  // The console: a panel box with its screen raked back toward whoever is standing behind it. The
  // face is built by geometry rather than by Euler angles, so the lines read the right way up from
  // the operator's side rather than mirrored.
  const console_ = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), shell(0xb6c0c7, 0.55, 0.2));
  console_.position.set(cx - 0.6, S + 0.13, cz); g.add(console_);
  const faceGeo = new THREE.PlaneGeometry(1.06, 0.4); faceGeo.rotateZ(Math.PI); faceGeo.rotateX(-Math.PI / 2 - 0.35);
  const face = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.1, emissiveMap: screenFace(['DISPATCH', 'bay 2 open', 'dock 1 closed'], '#E0813A', 512, 200) }));
  face.position.set(cx - 0.6, S + 0.29, cz - 0.02); g.add(face);

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

  // The back wall's two working fixtures: the shift board and the clock. The board is a white face
  // with its writing on a plane of its own, because a stencil is clear everywhere it is not ink and
  // a clear map on an opaque material multiplies the whole board down to black.
  const boardBack = new THREE.Mesh(new THREE.BoxGeometry(1.86, 1.06, 0.03), labSteel(0x8e99a1)); boardBack.position.set(-2.4, 1.55, -hz + 0.08); g.add(boardBack);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), new THREE.MeshStandardMaterial({ color: 0xf2f6f8, roughness: 0.4 }));
  board.position.set(-2.4, 1.55, -hz + 0.1); g.add(board);
  const shift = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: stencilTexture('SHIFT B', { width: 512, height: 171, color: '#2455A4', font: '600 110px Michroma, system-ui, sans-serif', alpha: 0.85, flecks: false }), transparent: true, depthWrite: false }));
  shift.position.set(-2.4, 1.72, -hz + 0.11); g.add(shift);

  // The recreation wing owns the clock model and is not loaded here, so this one is turned.
  const clock = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 24), shell(0x1b2129, 0.6, 0.3)); rim.rotation.x = Math.PI / 2; clock.add(rim);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.155, 24), shell(0xeef3f5, 0.5, 0)); dial.position.z = 0.017; clock.add(dial);
  const hands = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), new THREE.MeshBasicMaterial({ map: stencilTexture('11 : 07', { width: 256, height: 128, color: '#1B2129', font: '600 64px Michroma, system-ui, sans-serif', alpha: 1, flecks: false }), transparent: true, depthWrite: false }));
  hands.position.z = 0.019; clock.add(hands);
  g.add(place(clock, 2.5, 2.4, -hz + 0.1));

  // Exhibits along the west glass, 3 m apart, facing the camera at the hold. The flagship sits in
  // the centre so its plate, which pins to the right of its anchor, lands in the gap beside it
  // rather than over a neighbour. Positive z is to the camera's left.
  const exhibits: [string, string, number, () => THREE.Group][] = [
    ['conch', 'conch.gg', 3.0, controller],
    ['ezkey', 'ezkey.io', 0, padlock],
    ['gc-bridge', 'gc-bridge', -3.0, adapter],
  ];
  const hotspots: Hotspot[] = [];
  const ex = -hx + 0.9;
  for (const [key, label, dz, make] of exhibits) {
    // One group per exhibit, and it is what the pointer picks: plinth, product, plate and its light
    // strip all belong to the one product, so the whole thing lifts together under the cursor. The
    // plinths are three meshes rather than one instanced batch for exactly that reason.
    const exhibit = new THREE.Group(); exhibit.name = key;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.4), shell(0x9aacb4, 0.5, 0.1));
    plinth.position.set(ex, 0.5, dz); exhibit.add(plinth);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.5), labSteel(0x46525a));
    cap.position.set(ex, 1.02, dz); exhibit.add(cap);
    exhibit.add(place(labelPlate(label), ex - 0.34, 1.045, dz, Math.PI / 2));
    exhibit.add(place(make(), ex + 0.14, 1.045, dz, Math.PI / 2 + 0.35));
    g.add(exhibit);
    hotspots.push({ id: key, kind: 'project', label, object: exhibit, stop: 'fabrication' });
    // The plate hangs to the right of its anchor, so the anchor sits past the product's right edge.
    anchors.set(key, new THREE.Vector3(OX + ex + 0.6, 1.7, OZ + dz - 0.9));
  }

  // The desk on the east side, its stool on its side.
  const desk = store.model('desk'); desk.position.set(hx - 1.3, 0, -1.2); desk.rotation.y = Math.PI / 2; g.add(desk);
  const stool = store.model('stool'); stool.position.set(hx - 2.2, 0.28, -0.4); stool.rotation.set(Math.PI / 2, 0, 0.5); g.add(stool);

  return { light: { kind: 'point', position: [OX, H - 0.4, OZ], color: LABS.cold, intensity: 6, distance: 12, decay: 1.8 }, hotspots };
}
