import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import { site } from '../../../../content/site';
import { grounded, instances, merged, place, type Spot } from '../../merge';
import { papers } from '../../labs/props';
import { labSteel } from '../../labs/materials';
import { controlConsole, controlDesk, monitor, openFile, pinboard, taskChair } from '../../labs/furniture';
import { consoleFace, personnelSheet, timelineScreen } from '../../labs/textures';
import { ASHTRAY, DESK, FILE, GLASS, X1, Z1 } from './layout';

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

/**
 * A cut glass ashtray with a cigar resting in it, life size, origin at the middle of the dish on
 * the worktop. The dish is a lathed bowl rather than two stacked cylinders, because the thing that
 * says glass at this distance is the thickness of the rim catching the lamp. The cigar lies across
 * the rest with its lit end over the bowl, a band a third of the way down, and a cone of ash at the
 * tip with the ember inside it. Five draw calls.
 */
function ashtray(): THREE.Group {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x39434b, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const profile = [
    new THREE.Vector2(0, 0.004), new THREE.Vector2(0.056, 0.004), new THREE.Vector2(0.066, 0.01),
    new THREE.Vector2(0.068, 0.03), new THREE.Vector2(0.056, 0.032), new THREE.Vector2(0.046, 0.014),
    new THREE.Vector2(0, 0.012),
  ];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 28), glass));
  // The rests: two bars across the rim, and the ash somebody knocked off into the bottom.
  const rests: THREE.BufferGeometry[] = [];
  for (const a of [0.5, 0.5 + Math.PI]) {
    rests.push(new THREE.BoxGeometry(0.03, 0.008, 0.016).translate(Math.cos(a) * 0.058, 0.03, Math.sin(a) * 0.058));
  }
  g.add(merged(rests, glass));
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.005, 16), new THREE.MeshStandardMaterial({ color: 0x8e8e8a, roughness: 1 }));
  ash.position.y = 0.0145; g.add(ash);

  const cigar = new THREE.Group();
  const leaf = new THREE.MeshStandardMaterial({ color: 0x5a3517, roughness: 0.78 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0088, 0.0106, 0.108, 12), leaf);
  body.rotation.z = Math.PI / 2; cigar.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0109, 0.0109, 0.015, 12), new THREE.MeshStandardMaterial({ color: 0xb08528, roughness: 0.5, metalness: 0.4 }));
  band.rotation.z = Math.PI / 2; band.position.x = -0.03; cigar.add(band);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0074, 0.0088, 0.022, 12), new THREE.MeshStandardMaterial({ color: 0x9a9a95, roughness: 1 }));
  tip.rotation.z = Math.PI / 2; tip.position.x = 0.064; cigar.add(tip);
  // The ember: the only warm thing in the room that is not the lamp, and small enough that the
  // bloom on the high tier gives it a halo the size of a coal rather than a lamp.
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 10, 8), new THREE.MeshStandardMaterial({
    color: 0x2a0a00, emissive: 0xff5a12, emissiveIntensity: 2.6,
  }));
  ember.scale.set(0.6, 1, 1); ember.position.x = 0.0752; cigar.add(ember);
  cigar.position.set(-0.012, 0.0345, 0.012); cigar.rotation.set(0, 0.55, 0.07);
  g.add(cigar);
  return g;
}

/** Where the cigar's lit end sits inside the ashtray group, so the smoke comes off the coal rather
 *  than off the middle of the dish. */
/** How the ashtray is set down on the top. */
const ASHTRAY_TURN = 0.6;

const EMBER = new THREE.Vector3(0.0752, 0, 0).applyEuler(new THREE.Euler(0, 0.55, 0.07)).add(new THREE.Vector3(-0.012, 0.0345, 0.012));

/** The same point in the room, for the plume the stage hangs off it. The ashtray is set down at a
 *  turn of its own, so the offset turns with it. */
export const CIGAR_TIP: [number, number, number] = (() => {
  const v = EMBER.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ASHTRAY_TURN);
  return [ASHTRAY[0] + v.x, DESK.top + v.y, ASHTRAY[1] + v.z];
})();

/**
 * A cut tumbler with two fingers of bourbon in it, life size, origin at the foot. Built as a wall,
 * a thick base and the liquid inside it, because a glass reads by what the light does at its
 * shoulder and at the meniscus, and both of those want the wall to be open ended. Four draw calls.
 */
function tumbler(): THREE.Group {
  const g = new THREE.Group();
  // The wall carries enough opacity to have a silhouette. Under 0.2 the glass disappeared and all
  // that was left on the desk was the liquid, which read as a clay cup.
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xe8f2f7, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.32, side: THREE.DoubleSide });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.032, 0.094, 22, 1, true), glass);
  wall.position.y = 0.047; g.add(wall);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.033, 0.018, 22), glass);
  base.position.y = 0.009; g.add(base);
  // Opaque, and darker than it looks in a glass: read through a pale wall at 0.26 the first pour
  // came out pink. Bourbon is a deep amber that the lamp lights from the side.
  const bourbon = new THREE.Mesh(new THREE.CylinderGeometry(0.0344, 0.0322, 0.04, 22), new THREE.MeshStandardMaterial({
    color: 0x7a3206, roughness: 0.07, metalness: 0.08, emissive: 0x933c06, emissiveIntensity: 0.18,
  }));
  bourbon.position.y = 0.038; g.add(bourbon);
  // One cube, mostly under: ice that floats proud of the surface is ice in a glass of water.
  const ice = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.021, 0.021), new THREE.MeshPhysicalMaterial({
    color: 0xeef6fa, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.4,
  }));
  ice.position.set(0.006, 0.046, -0.004); ice.rotation.set(0.4, 0.7, 0.2); g.add(ice);
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
 * A six metre built desk under the window with a keyed console on it, three screens and a shift's
 * worth of paperwork, and at the north end of it, where the copy column in the page leaves
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
  // One built desk, six metres of it, front edge west to the room and the instrument tier along the
  // back for the screens. It was three of the office desk model stood end to end, and that is what
  // Jordan saw: "3 desks in a row for some reason". Four draw calls.
  const desk = controlDesk({ len: DESK.z1 - DESK.z0, depth: DESK.back - DESK.front, top: TOP, tier: DESK.tier, tierDepth: DESK.tierBack - DESK.back });
  desk.position.set(DESK.front, 0, (DESK.z0 + DESK.z1) / 2);
  await add(desk);

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
  // It stands on the worktop, not on the line the instrument tier stands on: at x -67.15 its base
  // was buried in the tier and the lamp read as hanging in the air over the desk.
  place(lamp, DESK.back - 0.22, TOP, FILE.z + 0.5, 0.9);
  await add(lamp);

  // What the person at this desk was doing a minute ago: a cigar still going in the ashtray and a
  // glass poured. Both stand in the lamp's pool between the file and the console, clear of the
  // folder the eye lands on and clear of the console's own footprint.
  await add(place(ashtray(), ASHTRAY[0], TOP, ASHTRAY[1], ASHTRAY_TURN));
  await add(place(tumbler(), GLASS[0], TOP, GLASS[1], 0));

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
  // The live one is a large panel rather than a desk monitor. At four metres from the lens a 0.5 m
  // screen renders its type at about seven pixels whatever is drawn on it, which is the whole of the
  // note "screen hard to read". At 1.9 times the size, with three lines set large, it reads.
  const TIER = TOP + DESK.tier;
  const live = monitor({ alive: true, size: 1.9, face: timelineScreen(site.about.timeline) });
  await add(place(live, DESK.tierBack - 0.2, TIER, 32.9, -Math.PI / 2 - 0.22));
  for (const [z, turn] of [[29.7, -Math.PI / 2 + 0.1], [28.6, -Math.PI / 2 - 0.15]] as [number, number][]) {
    await add(place(monitor({ alive: false }), DESK.tierBack - 0.2, TIER, z, turn));
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
  // Paperwork, and only paperwork. The transceiver that stood at the north end was a piece of field
  // radio kit in an office, and the loose stationery sat with its pencils a centimetre off the top:
  // "random military equipment", "floating penicls". What is left is what a shift leaves behind.
  const prop = (key: string) => grounded(store.model(key));
  await add(place(prop('binder'), DESK.x - 0.15, TOP, 30.2, 0.5));
  await add(place(prop('clipboard'), DESK.x - 0.2, TOP, 29.2, -0.4));
  await add(place(prop('notepads'), DESK.x - 0.05, TOP, 28.5, 1.1));

  // The chair, pushed back from the console and swung north, which is the last thing a person does
  // before they leave a desk. It stands clear of the folder in the settled frame on purpose: a
  // 0.8 m chair a metre nearer the lens covers a 0.3 m file completely.
  await add(place(taskChair(), -68.6, 0, 32.55, 1.25));

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
