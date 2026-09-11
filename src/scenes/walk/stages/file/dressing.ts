import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import { site } from '../../../../content/site';
import { grounded, instances, merged, place, repeat, type Spot } from '../../merge';
import { papers } from '../../labs/props';
import { labSteel } from '../../labs/materials';
import { controlConsole, monitor, openFile, pinboard } from '../../labs/furniture';
import { consoleFace, personnelSheet, timelineScreen } from '../../labs/textures';
import { DESK, FILE, X1, Z1 } from './layout';

/** A four drawer steel filing cabinet with the top drawer standing open on its folders, 0.5 by 0.62
 *  on plan and 1.32 tall, origin at floor centre, fronts to +z. Room furniture rather than kit: it
 *  is the one thing in the walk that is literally a personnel file in a drawer, and nothing else on
 *  the site would ever ask for it. Five draw calls. */
function filingCabinet(): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x525c63, roughness: 0.6, metalness: 0.3 });
  const carcass = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.32, 0.62), steel);
  carcass.position.y = 0.66; g.add(carcass);
  const face = new THREE.MeshStandardMaterial({ color: 0x5e686f, roughness: 0.55, metalness: 0.3 });
  const fronts: Spot[] = [[0, 0.5, 0.312], [0, 0.82, 0.312], [0, 1.14, 0.312]];
  g.add(instances(new THREE.BoxGeometry(0.46, 0.29, 0.02), face, fronts));
  g.add(instances(new THREE.BoxGeometry(0.16, 0.025, 0.025), labSteel(0x39434b), fronts.map(([x, y]) => [x, y - 0.06, 0.33] as Spot)));
  // The open one: pulled 0.3 m out, with the tops of its folders standing above the drawer sides.
  const open = new THREE.Group(); open.position.set(0, 0.18, 0.3); g.add(open);
  const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.29, 0.6), face);
  drawer.position.set(0, 0, 0.02); open.add(drawer);
  const folders: THREE.BufferGeometry[] = [];
  for (let z = -0.2; z < 0.26; z += 0.055) folders.push(new THREE.BoxGeometry(0.4, 0.1, 0.008).translate(0, 0.19, z));
  open.add(merged(folders, new THREE.MeshStandardMaterial({ color: 0xd6b979, roughness: 0.9 })));
  return g;
}

/** The lines the form on the open leaf carries, off `site.about` and nothing retyped. The name is
 *  the one derived string: a personnel file is filed under the surname, so the sentence's own
 *  "Jordan Eldridge" is turned round rather than written out again. */
function fileLines(): string[] {
  const about = site.about;
  // 'Jordan Eldridge. 23. Self-taught. Platform Developer at a compliance-focused MSP.'
  const [who = '', , origin = '', role = ''] = about.line.split('. ');
  const [first = '', last = ''] = who.split(' ');
  return [
    `${last.toUpperCase()}, ${first.slice(0, 1)}.`,
    role.replace(/\.$/, ''),
    origin,
    ...about.timeline.map((t) => `${t.when} ${t.what}`),
    about.email,
    about.github.replace(/^https?:\/\//, ''),
  ];
}

/**
 * The control room, dressed for one frame.
 *
 * A four metre desk run under the window with a keyed console on it, three screens, a radio and a
 * shift's worth of paperwork, and at the north end of it, where the copy column in the page leaves
 * the frame clear, a manila folder open under a desk lamp with Jordan's own record typed on the
 * leaf. The chair is pushed back and turned. Two of the three screens are dead and the third is
 * showing the same record the folder carries.
 *
 * The one bold thing is the lamp pool on the file. Everything else in here is a third of its value
 * or less: the console's keys are lit at 0.35, the live screen at 1.1 on a 0.5 m panel, and the
 * ceiling runs at 0.4. A control room with its lights up is an office, and the reference is an
 * office at the end of a shift with the yard still working outside it.
 */
export async function buildDressing(ctx: StageContext, root: THREE.Group): Promise<{ hotspots: Hotspot[] }> {
  const { store, anchors, pace } = ctx;
  const add = async (o: THREE.Object3D) => { root.add(o); await pace(); };
  const hotspots: Hotspot[] = [];
  const TOP = DESK.top;

  // ---- The desk run ----------------------------------------------------------------------------
  // Three of the office desks end to end, long axis along z, fronts west to the room. One batch, so
  // a six metre run costs what one desk costs.
  await add(repeat(store.model('desk'), [
    [DESK.x, 0, 29, -Math.PI / 2], [DESK.x, 0, 31, -Math.PI / 2], [DESK.x, 0, 33, -Math.PI / 2],
  ]));

  // ---- The exhibit -----------------------------------------------------------------------------
  // One group: the pointer picks the folder, the form on it and the lamp over it as one thing.
  const exhibit = new THREE.Group(); exhibit.name = 'personnel-file';
  const folder = openFile(personnelSheet(fileLines()));
  // Turned so the propped leaf faces the lens rather than the desk. The hold is west south west of
  // the folder, and 1.14 radians is the heading from the folder back to it: the form is the only
  // thing in this room anybody is meant to read, and square to the desk it reads edge on.
  place(folder, FILE.x, TOP, FILE.z, 1.14);
  exhibit.add(folder);

  // The mug, on its side where it was knocked over, and the ring it left. Not a prop for its own
  // sake: a tidy desk under a lamp reads as a set, and one thing out of place is what makes it a
  // desk somebody left.
  const mug = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xdfe3e2, roughness: 0.45 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 14), white);
  body.rotation.z = Math.PI / 2; body.position.y = 0.04; mug.add(body);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 6, 14), white);
  handle.position.set(0.01, 0.04, 0.04); mug.add(handle);
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), new THREE.MeshStandardMaterial({ color: 0x5a4126, transparent: true, opacity: 0.35, roughness: 0.9, depthWrite: false }));
  stain.rotation.x = -Math.PI / 2; stain.position.set(-0.07, 0.004, 0.01); mug.add(stain);
  place(mug, DESK.x - 0.35, TOP, FILE.z - 0.52, 0.7);
  exhibit.add(mug);
  await add(exhibit);

  // The lamp, at the back of the desk with its head over the folder. Its bulb is the room's one
  // warm light, declared in lighting.ts at the head's own height.
  const lamp = grounded(store.model('desk_lamp'));
  // Turned so the head looks back over the folder toward the lens. At -2.24 it faced the window.
  place(lamp, DESK.x + 0.35, TOP, FILE.z + 0.55, 0.9);
  await add(lamp);

  // The anchor a pinned panel would hang off, half a metre in front of the folder. Nothing in the
  // page carries `data-anchor="file"` yet: the pinned rule in walk.css draws no ground of its own,
  // because the flagship bay it was written for brings its own card, and the stop body pinned to it
  // would be a column of unbacked white text standing over the room. The anchor is registered all
  // the same, so the day that rule grows a surface the panel lands beside the exhibit.
  anchors.set('file', new THREE.Vector3(FILE.x - 0.35, 1.15, FILE.z - 0.2));
  hotspots.push({ id: 'file', kind: 'project', label: 'Personnel file', object: exhibit, stop: 'file' });

  // ---- The screens -----------------------------------------------------------------------------
  // One alive, two dead. The live one is the record typed up, so the folder and the screen say the
  // same thing twice and the room reads as one person's file rather than as a set of props.
  const live = monitor({ alive: true, face: timelineScreen(site.about.timeline) });
  await add(place(live, DESK.x + 0.3, TOP, 33.2, -Math.PI / 2 - 0.3));
  for (const [z, turn] of [[29.7, -Math.PI / 2 + 0.1], [28.6, -Math.PI / 2 - 0.15]] as [number, number][]) {
    await add(place(monitor({ alive: false }), DESK.x + 0.3, TOP, z, turn));
  }

  // ---- The console -----------------------------------------------------------------------------
  // Keyed, two keys lit amber, a gooseneck standing beside it. The console is the piece that names
  // the room: a desk with screens is any office, a desk with a bank of keys and a microphone on it
  // is somewhere a person talks to a loading yard.
  await add(place(controlConsole(consoleFace()), DESK.x - 0.1, TOP, 32.2, -Math.PI / 2));

  const mic = new THREE.Group(); mic.name = 'mic';
  const steel = labSteel(0x7d878e);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.02, 12), steel); base.position.y = 0.01; mic.add(base);
  const stem = (len: number, lean: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, len, 6), steel); m.position.set(0, y, z); m.rotation.x = lean; return m; };
  mic.add(stem(0.35, -0.15, 0.19, -0.026), stem(0.35, -0.9, 0.47, -0.19));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1b2129, roughness: 0.7, metalness: 0.2 }));
  head.position.set(0, 0.58, -0.33); mic.add(head);
  await add(place(mic, DESK.x - 0.33, TOP + 0.01, 32.95, 1.9));

  // ---- The shift's paperwork -------------------------------------------------------------------
  const prop = (key: string) => grounded(store.model(key));
  await add(place(prop('radio'), DESK.x - 0.18, TOP, 33.75, -1.2));
  await add(place(prop('binder'), DESK.x - 0.15, TOP, 30.2, 0.5));
  await add(place(prop('clipboard'), DESK.x - 0.2, TOP, 29.2, -0.4));
  await add(place(prop('notepads'), DESK.x - 0.05, TOP, 28.5, 1.1));
  await add(place(prop('stationery'), DESK.x + 0.16, TOP, 30.7, 0.3));

  // The chair, pushed back from the console and swung north, which is the last thing a person does
  // before they leave a desk. It stands clear of the folder in the settled frame on purpose: a
  // 0.8 m chair a metre nearer the lens covers a 0.3 m file completely.
  const chair = store.model('office_chair');
  await add(place(chair, -68.6, 0, 32.55, 1.25));

  // ---- The walls -------------------------------------------------------------------------------
  // The board of paperwork on the north wall, which is the only warm surface in the room that is
  // not the lamp. The camera reads the north wall from the corner west, so it hangs at x -65.5.
  const board = pinboard(1.3, 0.85);
  await add(place(board, -65.2, 1.9, Z1 - 0.06, Math.PI));

  // The cabinet the file came out of, standing under the board. Four drawers, the top one open on
  // its own row of folders, and the frame's whole right hand third has something in it: the settled
  // shot reads from the lamp on the left to the board on the right, and without this there were six
  // metres of empty floor between them.
  await add(place(filingCabinet(), -64.9, 0, Z1 - 0.36, Math.PI));

  const cam = store.model('security_camera');
  await add(place(cam, X1 - 0.35, 2.85, Z1 - 0.4, -2.4));

  // Blinds over the top of the window, half drawn: a slatted band rather than a modelled blind.
  const slats: THREE.BufferGeometry[] = [];
  for (let y = 2.6; y > 2.1; y -= 0.06) slats.push(new THREE.BoxGeometry(0.02, 0.04, 5.9).translate(X1 - 0.1, y, 30));
  await add(merged(slats, new THREE.MeshStandardMaterial({ color: 0x8d979d, roughness: 0.85 })));

  // Paper on the floor where the chair rolled over it.
  const floor: Spot[] = [[-68.4, 0, 33.3, 0.5], [-69.0, 0, 32.2, 1.8], [-68.6, 0, 29.6, 2.6], [-66.4, 0, 33.5, 0.9]];
  await add(papers(floor));

  return { hotspots };
}
