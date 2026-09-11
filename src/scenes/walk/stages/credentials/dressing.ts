import * as THREE from 'three';
import type { Hotspot, StageContext } from '../types';
import { grounded, place } from '../../merge';
import { papers } from '../../labs/props';
import { gurney, tripodCamera, hardCase, cableCoil, tarpWall } from '../../labs/furniture';
import { labSteel } from '../../labs/materials';
import { surface } from '../../materials';
import { stencilTexture } from '../../textures';
import { X0, X1, H, PLATE_X, PLATE_Z, PLATE_TURN } from './layout';
import certs from '../../../../content/certs.json';

/** Whatever the dressing has to clean up itself. The badge textures load out of band, so the stage
 *  has to be able to tell the dressing it is gone. */
export interface Dressing { hotspots: Hotspot[]; dispose(): void }

/** The ink on a plate: dark enough to read as print on a lit panel rather than as a second light. */
const INK = '#1e2c3a';

/** The bench sits north of the near cert plates, far enough up the hall that its far end does not
 *  cut across the bottom of a plate frame in the hold's frame at t 0.70. */
const BENCH_Z = -7.4;

export async function buildDressing(ctx: StageContext, root: THREE.Group): Promise<Dressing> {
  const { store, pace } = ctx;
  const add = async (o: THREE.Object3D) => { root.add(o); await pace(); };
  // A badge image can land after the stage was disposed (a page swap, or a fallback, mid load).
  // Assigning it then would hang a live texture off a material nobody will ever dispose again, so a
  // late callback throws its texture away instead.
  let disposed = false;
  const badges: THREE.Texture[] = [];
  const hotspots: Hotspot[] = [];

  // The six certifications, three per side of the aisle, at the same three z so the hold sees them
  // as matched pairs. Each plate is a lit sign, not a lamp: the face carries just enough emissive to
  // separate it from the white room, the cyan strip along its head is the only bright thing on it,
  // and the ink is dark. The first pass ran the face at 0.9 under a pair of 7 intensity points and
  // the badges went to paper white.
  const loader = new THREE.TextureLoader();
  const certList = certs as { id: string; name: string; issuer: string; badgeImage: string }[];
  certList.forEach((c, i) => {
    const side = i < 3 ? 'west' : 'east'; const z = PLATE_Z[side][i % 3]; const x = PLATE_X[side];
    // One group per plate so the pointer can pick a single certification, built facing +z in its own
    // space and then turned onto its wall plus the quarter radian that squares it to the aisle.
    const plate = new THREE.Group(); plate.name = c.id;
    plate.position.set(x, 0, z);
    plate.rotation.y = side === 'west' ? Math.PI / 2 + PLATE_TURN : -Math.PI / 2 - PLATE_TURN;
    root.add(plate);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.9, 0.08), labSteel(0x9aa5ad));
    frame.position.y = 1.75; plate.add(frame);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.76), new THREE.MeshStandardMaterial({ color: 0xf2f6f8, emissive: 0xffffff, emissiveIntensity: 0.32 }));
    face.position.set(0, 1.75, 0.045); plate.add(face);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0x0c161c, emissive: 0x6ec1d6, emissiveIntensity: 1.8 }));
    edge.position.set(0, 2.71, 0.05); plate.add(edge);

    const badge = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    badge.position.set(0, 2.05, 0.05); plate.add(badge);
    hotspots.push({ id: c.id, kind: 'cert', label: c.name, object: plate, stop: 'credentials' });
    loader.load(c.badgeImage, (t) => {
      if (disposed) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace; t.userData.owned = true; badges.push(t);
      const m = badge.material as THREE.MeshBasicMaterial; m.map = t; m.opacity = 1; m.needsUpdate = true;
    }, undefined, () => { /* name only */ });

    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.4), new THREE.MeshBasicMaterial({ map: stencilTexture(c.name, { width: 768, height: 200, color: INK, font: '600 64px Michroma, system-ui, sans-serif', alpha: 1, flecks: false }), transparent: true, depthWrite: false }));
    label.position.set(0, 1.15, 0.055); plate.add(label);
    const issuer = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.2), new THREE.MeshBasicMaterial({ map: stencilTexture(c.issuer, { width: 512, height: 100, color: INK, font: '400 44px Michroma, system-ui, sans-serif', alpha: 0.85, flecks: false }), transparent: true, depthWrite: false }));
    issuer.position.set(0, 0.93, 0.055); plate.add(issuer);
  });
  await pace();

  // Inside the glass, the shoot Terragroup left set up (ref 14): a sheeted gurney down the west
  // side, a camera on its tripod across the aisle and flight cases open on the floor. The gurney
  // sits at x -81.4 rather than on the lab's centre line, where `cameraAt` puts the walk within
  // 0.1 m of it. From -81.4 the camera clears it by 1.7 m to the trolley's centre, and standing it
  // under the near plates rather than beside the hold keeps it a prop instead of the subject.
  //
  // It stands a metre further south than it did. At -18.6 the trolley's head end sat 4.8 m out, which
  // is far enough back that its sheet rose above the bottom edge of the near CCNA plate and cut the
  // plate's frame off. A metre closer drops the whole trolley below the plate and takes nothing out
  // of the frame, because its foot was already past the bottom right corner.
  await add(place(gurney(), -81.4, 0, -19.6, Math.PI + 0.15));
  await add(place(tripodCamera(), -77.4, 0, -21, -2.5));
  // The stacked pair stands off the east glass rather than against it: from the hold the wall line
  // is behind the page's own certification card, and a case parked there is a case nobody sees.
  await add(place(hardCase(), -77.8, 0, -16.2, 0.2));
  await add(place(hardCase(), -77.8, 0.45, -16.2, -0.35));
  await add(place(hardCase(0xd6691f), -81.6, 0, -15.2, 1.1));

  // Outside, along the hall. A coil of yellow cable off the ceiling and a blue tarp slung down the
  // east wall are the two notes of colour in a room that is otherwise white on white.
  await add(place(cableCoil(), -76.4, H - 1.8, -9, 0));
  await add(place(tarpWall(8, 3.2), X1 - 0.1, 1.9, -8, -Math.PI / 2));

  // A bench along the east wall, with the lab's own instruments on it. The first pass forced every
  // material to LABS.panel, a hair off white with nothing on it, so in the brightest room on the
  // walk the bench was the second brightest thing in the frame and read as a greybox slab. It gets
  // the lab's own tile at a fine pitch instead: a real map, normal and AO, in a mid grey that sits
  // under the plates it stands beneath rather than beside them.
  const bench = store.model('desk');
  const benchMat = surface(store.texture('lab_tile'), 2.2, 0.9, 0.5);
  benchMat.color.setHex(0x93a3ac); benchMat.roughness = 0.45; benchMat.metalness = 0.15;
  bench.traverse((o) => { if (o instanceof THREE.Mesh) o.material = benchMat; });
  bench.position.set(X1 - 1.2, 0, BENCH_Z); bench.rotation.y = Math.PI / 2;
  await add(bench);

  const onBench = (name: string, z: number, ry: number) => place(grounded(store.model(name)), X1 - 1.2, 0.76, z, ry);
  await add(onBench('microscope', BENCH_Z - 1.0, 0.5));
  await add(onBench('chemistry_set', BENCH_Z + 1.1, -0.4));
  await add(place(grounded(store.model('medical_box')), X1 - 1.0, 0.76, BENCH_Z - 0.3, 0.4));

  // A stool knocked over beside the bench, a wheelchair parked up the hall and a stripped bed frame
  // stood on its edge against the west wall: the room was cleared out in a hurry.
  const tipped = store.model('stool_2'); tipped.rotation.x = Math.PI / 2;
  await add(place(grounded(tipped), -77.5, 0, -9.7, 1.1));
  await add(place(grounded(store.model('wheelchair')), -76.2, 0, 2.2, 2.4));
  const leaning = store.model('bed_frame'); leaning.rotation.z = Math.PI / 2 - 0.22;
  await add(place(grounded(leaning), -82.4, 0, -8, Math.PI / 2));

  const tote = (x: number, z: number, ry: number) => place(grounded(store.model('tote')), x, 0, z, ry);
  await add(tote(X1 - 1.2, -12, 0.3));

  await add(papers([[X1 - 2.4, 0, -9.2, 0.5], [X1 - 2.0, 0, -6.4, 1.3], [X0 + 2.2, 0, -11.6, 0.9]]));

  // disposeObject() reaches the badge textures through their materials, so this is belt and braces
  // for the ones already assigned and the only cleanup for one still in flight.
  return { hotspots, dispose() { disposed = true; for (const t of badges) t.dispose(); badges.length = 0; } };
}
