import * as THREE from 'three';
import type { AssetStore } from '../../assets';
import { grounded, merged, once, place } from '../../merge';
import { labSteel } from '../../labs/materials';
import { canvas, own, rng } from '../../labs/textures';

/**
 * The three things standing in the server hall that a visitor can walk up to. Each is a job in
 * progress rather than a display: a hand truck of cartons parked at the open cage gate, a cart of
 * servers waiting to be racked, and the cross connect frame the hall's patching runs through.
 * Nothing here is a screen. The scanned props come from the `operations` asset group.
 */

const prop = (store: AssetStore, key: string) => grounded(store.model(key));

/**
 * A rollout, parked. The hand truck stands upright on its toe plate with three cartons on it, two
 * more are already off and on the floor, and the checklist is on the nearest one where whoever was
 * counting them put it down. Origin on the floor under the truck's axle, toe plate toward +z.
 */
export function rolloutStation(store: AssetStore): THREE.Group {
  const g = new THREE.Group(); g.name = 'rollout';
  g.add(prop(store, 'hand_truck'));
  const box = () => prop(store, 'ops_box');
  // On the plate: the scan is 0.38 by 0.34 by 0.52, so a stack of three stands a little over a
  // metre, under the truck's handles. Each sits a few degrees off the one below it.
  const stack: [number, number, number][] = [[0.04, 0.03, 1.22], [Math.PI + 0.09, 0.445, 1.14], [Math.PI / 2 - 0.06, 0.83, 1.0]];
  for (const [ry, y, s] of stack) g.add(place(box(), 0.01, y, 0.36, ry, s));
  // Off the truck, beside it on the gate side.
  g.add(place(box(), 0.72, 0, 0.18, Math.PI / 2 + 0.5, 1.22));
  g.add(place(box(), 0.86, 0, 0.82, Math.PI - 0.25, 1.1));
  g.add(place(prop(store, 'ops_clipboard'), 0.7, 0.415, 0.2, 1.1));
  return g;
}

/** One server off the pallet: a 2U chassis, lid on, ears and rails fitted, nothing lit. Origin at
 *  the centre of its base, bezel toward +z. Three draw calls. */
function chassis(seed: number): THREE.Group {
  const W = 0.44, H = 0.088, D = 0.68;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshStandardMaterial({ color: 0x8e979d, roughness: 0.42, metalness: 0.75 }));
  body.position.y = H / 2; g.add(body);
  // The bezel: black, with drive carriers across it. The same idea as a fitted unit in the racks,
  // unpowered, so the carriers are a colour map and nothing glows.
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(W + 0.002, H + 0.002, 0.018), new THREE.MeshStandardMaterial({ map: bezelFace(seed), roughness: 0.5, metalness: 0.3 }));
  bezel.position.set(0, H / 2, D / 2 + 0.008); g.add(bezel);
  const steel: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    // Rack ear, then the inner rail down the side.
    const ear = new THREE.BoxGeometry(0.022, H, 0.004); ear.translate(sx * (W / 2 + 0.011), H / 2, D / 2 - 0.002); steel.push(ear);
    const rail = new THREE.BoxGeometry(0.006, 0.04, D - 0.08); rail.translate(sx * (W / 2 + 0.003), H / 2, -0.02); steel.push(rail);
  }
  g.add(merged(steel, labSteel(0xb8c0c5)));
  return g;
}

function bezelFace(seed: number): THREE.CanvasTexture {
  const w = 512, h = 104;
  const [c, ctx] = canvas(w, h); const r = rng(seed);
  ctx.fillStyle = '#0d1114'; ctx.fillRect(0, 0, w, h);
  // Eight carriers, two rows of four, each a perforated face with a release tab.
  for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
    const x = 56 + i * 98, y = 8 + row * 46;
    ctx.fillStyle = '#1b2227'; ctx.fillRect(x, y, 92, 40);
    ctx.fillStyle = '#2c363d'; for (let k = 0; k < 9; k++) ctx.fillRect(x + 8 + k * 7, y + 6, 3, 28);
    ctx.fillStyle = r() > 0.5 ? '#7d2a22' : '#3a444b'; ctx.fillRect(x + 74, y + 6, 12, 28);
  }
  // The ear end: a power button ring and a strip of ports.
  ctx.strokeStyle = '#59646b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(28, 30, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#252d33'; ctx.fillRect(14, 58, 30, 12); ctx.fillRect(14, 76, 30, 12);
  ctx.fillStyle = '#252d33'; ctx.fillRect(456, 14, 42, 76);
  ctx.fillStyle = '#3d484f'; for (let k = 0; k < 6; k++) ctx.fillRect(460, 18 + k * 12, 34, 5);
  return own(c);
}

/**
 * The next servers into the hall, on the cart they were wheeled in on: two stacked on the top
 * shelf, one underneath, the drill that fits the rails lying beside them. Origin on the floor at
 * the cart's centre, its long side along x.
 */
export function serverCart(store: AssetStore): THREE.Group {
  const g = new THREE.Group(); g.name = 'server-cart';
  g.add(prop(store, 'ops_cart'));
  // The cart's top tray is 0.88 up inside a rim, the lower shelf 0.2.
  const TOP = 0.885, LOW = 0.215;
  g.add(place(chassis(3), -0.2, TOP, 0.0, Math.PI / 2 + 0.04));
  g.add(place(chassis(8), -0.17, TOP + 0.09, 0.01, Math.PI / 2 - 0.07));
  g.add(place(chassis(5), 0.05, LOW, 0.0, Math.PI / 2 + 0.02));
  // The drill on its side on the tray, past the end of the stack.
  const drill = prop(store, 'drill');
  drill.rotation.set(Math.PI / 2, 0, 0.5);
  g.add(place(new THREE.Group().add(drill), 0.42, TOP + 0.03, 0.12, 0.3, 1.25));
  return g;
}

const LEADS = [0x2f6fd0, 0xe0a51e, 0xd9652a, 0x3f9c5a, 0xd7dbdc];

/**
 * The cross connect: an open two post frame, 2.1 m, bolted to the floor, carrying patch panels and
 * two switches with the leads between them hanging in loops down the front, and the trunk of them
 * leaving over the top. This is where one system in the hall is joined to another, by hand, a lead
 * at a time. Origin on the floor at the centre of the frame, its face toward +z.
 */
export function patchFrame(seed = 4): THREE.Group {
  const g = new THREE.Group(); g.name = 'patch-frame';
  const r = rng(seed);
  const W = 0.53, H = 2.1;
  const steel: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const post = new THREE.BoxGeometry(0.045, H, 0.08); post.translate(sx * W / 2, H / 2, 0); steel.push(post);
    const foot = new THREE.BoxGeometry(0.1, 0.012, 0.5); foot.translate(sx * W / 2, 0.006, 0); steel.push(foot);
    const gusset = new THREE.BoxGeometry(0.045, 0.012, 0.3); gusset.rotateX(0.9); gusset.translate(sx * W / 2, 0.13, 0.13); steel.push(gusset);
  }
  // A finger duct up the outside of each post, the grey trough the leads are dressed into.
  const duct: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const back = new THREE.BoxGeometry(0.09, H - 0.3, 0.012); back.translate(sx * (W / 2 + 0.07), H / 2 + 0.05, 0.04); duct.push(back);
    const lip = new THREE.BoxGeometry(0.012, H - 0.3, 0.07); lip.translate(sx * (W / 2 + 0.115), H / 2 + 0.05, 0.075); duct.push(lip);
  }
  g.add(merged(duct, new THREE.MeshStandardMaterial({ color: 0x5d676d, roughness: 0.7, metalness: 0.1 })));
  const top = new THREE.BoxGeometry(W + 0.045, 0.05, 0.08); top.translate(0, H - 0.025, 0); steel.push(top);
  g.add(merged(steel, labSteel(0x59646c)));

  // What is fitted, from the top down: y of each unit's centre and what it is.
  const U = 0.0445;
  type Kind = 'panel' | 'switch' | 'manager';
  const fit: Kind[] = ['panel', 'panel', 'manager', 'switch', 'manager', 'panel', 'panel', 'manager', 'switch', 'manager', 'panel', 'panel', 'panel'];
  const panelGeo: THREE.BufferGeometry[] = [], switchGeo: THREE.BufferGeometry[] = [], ringGeo: THREE.BufferGeometry[] = [];
  const ports: { panel: THREE.Vector3[]; sw: THREE.Vector3[] } = { panel: [], sw: [] };
  let y = H - 0.14;
  for (const kind of fit) {
    const h = kind === 'switch' ? U : kind === 'manager' ? U : U;
    if (kind === 'panel') {
      const b = new THREE.BoxGeometry(0.483, U - 0.004, 0.03); b.translate(0, y, 0.055); panelGeo.push(b);
      for (let i = 0; i < 24; i++) ports.panel.push(new THREE.Vector3(-0.2 + (i + Math.floor(i / 6) * 0.6) * 0.0152, y, 0.072));
    } else if (kind === 'switch') {
      const b = new THREE.BoxGeometry(0.44, U - 0.004, 0.24); b.translate(0, y, -0.05); switchGeo.push(b);
      for (let i = 0; i < 24; i++) ports.sw.push(new THREE.Vector3(-0.19 + i * 0.0145, y + (i % 2 ? 0.008 : -0.008), 0.072));
    } else {
      // A cable manager: a bar with five open rings standing off it.
      const bar = new THREE.BoxGeometry(0.483, U - 0.01, 0.012); bar.translate(0, y, 0.046); ringGeo.push(bar);
      for (let i = 0; i < 5; i++) { const ring = new THREE.TorusGeometry(0.03, 0.004, 5, 10, Math.PI * 1.5); ring.rotateY(Math.PI / 2); ring.translate(-0.2 + i * 0.1, y, 0.085); ringGeo.push(ring); }
    }
    y -= h + (kind === 'manager' ? 0.012 : 0.006);
  }
  const face = portFace();
  g.add(merged(panelGeo, new THREE.MeshStandardMaterial({ map: face, roughness: 0.6, metalness: 0.3 })));
  // The switches carry the same port strip, and their link lights are the one thing on the frame
  // that is lit.
  g.add(merged(switchGeo, new THREE.MeshStandardMaterial({ map: face, roughness: 0.5, metalness: 0.4, emissive: 0xffffff, emissiveMap: linkLights(seed), emissiveIntensity: 1.4 })));
  g.add(merged(ringGeo, new THREE.MeshStandardMaterial({ color: 0x14191d, roughness: 0.6, metalness: 0.4 })));

  // The leads. Each leaves a panel port, hangs in a loop out in front of the frame and comes back
  // into a switch port: forty of them, in the five colours a patching scheme uses, one batch.
  const tubes: THREE.BufferGeometry[] = [];
  const colour = new THREE.Color();
  for (let i = 0; i < 44; i++) {
    const a = ports.panel[Math.floor(r() * ports.panel.length)]!, b = ports.sw[Math.floor(r() * ports.sw.length)]!;
    const out = 0.08 + r() * 0.12, sag = 0.06 + r() * 0.2;
    const side = (r() - 0.5) * 0.08;
    const lo = Math.min(a.y, b.y) - sag;
    const curve = new THREE.CatmullRomCurve3([
      a.clone(), new THREE.Vector3(a.x, a.y - 0.02, a.z + out * 0.7),
      new THREE.Vector3((a.x + b.x) / 2 + side, lo, 0.072 + out),
      new THREE.Vector3(b.x, b.y - 0.02, b.z + out * 0.7), b.clone(),
    ]);
    const tube = new THREE.TubeGeometry(curve, 20, 0.0055, 5, false);
    colour.setHex(LEADS[Math.floor(r() * LEADS.length)]!);
    const rgb = new Float32Array(tube.attributes.position.count * 3);
    for (let v = 0; v < tube.attributes.position.count; v++) colour.toArray(rgb, v * 3);
    tube.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    tubes.push(tube);
  }
  // And the trunk: a dozen of them tied together up the back of one post and over the top.
  for (let i = 0; i < 12; i++) {
    const ox = (r() - 0.5) * 0.03, oz = (r() - 0.5) * 0.03;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(W / 2 + ox, 0.5 + r() * 0.9, -0.06 + oz), new THREE.Vector3(W / 2 + 0.02 + ox, 1.6, -0.07 + oz),
      new THREE.Vector3(W / 2 + 0.02 + ox, H + 0.05, -0.07 + oz), new THREE.Vector3(W / 2 + ox, H + 0.5, -0.3 + oz),
    ]);
    const tube = new THREE.TubeGeometry(curve, 14, 0.006, 5, false);
    colour.setHex(LEADS[i % LEADS.length]!);
    const rgb = new Float32Array(tube.attributes.position.count * 3);
    for (let v = 0; v < tube.attributes.position.count; v++) colour.toArray(rgb, v * 3);
    tube.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    tubes.push(tube);
  }
  const leads = merged(tubes, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 }));
  leads.name = 'leads'; g.add(leads);
  return g;
}

/** One unit's strip of twenty four sockets in four blocks of six, for a panel or a switch. */
function portFace(): THREE.CanvasTexture {
  const w = 512, h = 48;
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#12171b'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 24; i++) {
    const x = 40 + (i + Math.floor(i / 6) * 0.6) * 17;
    ctx.fillStyle = '#05080a'; ctx.fillRect(x, 14, 13, 20);
    ctx.fillStyle = '#39444b'; ctx.fillRect(x + 4, 10, 5, 4);
  }
  ctx.fillStyle = '#4a555c'; ctx.fillRect(8, 20, 8, 8); ctx.fillRect(w - 16, 20, 8, 8);
  return own(c);
}

/** The switches' link lights, as an emissive map over the same strip: most green, a few amber. */
function linkLights(seed: number): THREE.CanvasTexture {
  const w = 512, h = 48;
  const [c, ctx] = canvas(w, h); const r = rng(seed + 9);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 24; i++) {
    if (r() < 0.25) continue;
    const x = 40 + (i + Math.floor(i / 6) * 0.6) * 17;
    ctx.fillStyle = r() > 0.2 ? '#49e08a' : '#ffc23d'; ctx.fillRect(x + 4, 10, 5, 4);
  }
  return own(c);
}

/** The open toolbox on the floor at the foot of the frame. */
export function toolbox(store: AssetStore): THREE.Group { return once(prop(store, 'toolbox'), 0, 0, 0, 0, 1.15); }
