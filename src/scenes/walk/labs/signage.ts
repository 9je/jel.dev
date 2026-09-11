import * as THREE from 'three';
import type { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { merged } from '../merge';
import { LABS, labSteel } from './materials';
import { stencilTexture } from '../textures';
import { tapeStripe } from './textures';

/** Michroma's average advance as a fraction of the em, measured over the capitals in
 *  `public/fonts/michroma.typeface.json`. Only the fallback needs it: with the typeface parsed the
 *  real advances come out of the glyph table. */
const AVERAGE_ADVANCE = 0.95;

/**
 * Extruded signage lettering, Michroma cut out of the typeface JSON. Origin at the left baseline:
 * `geometry.center()` is deliberately not called, so a caller that wants the run centred over a
 * lintel measures the box and offsets it itself.
 *
 * The typeface arrives over the network (see `ctx.typeface`), and a sign is not worth losing the
 * room over, so a null font falls back to a flat stencil plane of about the same width.
 */
export function signLetters(font: Font | null, text: string, opts: { size: number; depth: number; color?: number; emissive?: number; emissiveIntensity?: number; tube?: boolean }): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color: opts.color ?? LABS.panel,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    metalness: opts.tube ? 0 : 0.35,
    roughness: opts.tube ? 0.3 : 0.45,
  });
  if (font) {
    // curveSegments 4 and no bevel: at sign scale the extra tessellation is invisible and a bevelled
    // run of eight letters is thousands of triangles for an edge nobody reads. A neon run is the
    // exception: a rounded edge is what makes a lit stroke read as glass tube rather than a slab of
    // acrylic, and one sign of eight letters can afford it.
    const bevel = opts.tube ? { bevelEnabled: true, bevelThickness: opts.depth * 0.35, bevelSize: opts.size * 0.012, bevelSegments: 2 } : { bevelEnabled: false };
    const geometry = new TextGeometry(text, { font, size: opts.size, depth: opts.depth, curveSegments: opts.tube ? 6 : 4, ...bevel });
    if (!opts.tube) return new THREE.Mesh(geometry, material);
    // An extrude puts its caps in one material group and its walls in another. A tube's walls fall
    // away from the eye, so they carry half the front's light: at full brightness the run read as
    // blocks of lit acrylic, every side face as hot as the stroke.
    const walls = material.clone(); walls.emissiveIntensity = material.emissiveIntensity * 0.45; walls.roughness = 0.5;
    return new THREE.Mesh(geometry, [material, walls]);
  }
  const w = Math.max(opts.size, text.length * opts.size * AVERAGE_ADVANCE);
  const px = 128;
  const map = stencilTexture(text, {
    width: Math.max(64, Math.round((px * w) / opts.size)),
    height: px,
    color: '#' + new THREE.Color(opts.color ?? LABS.panel).getHexString(),
    font: `600 ${Math.round(px * 0.72)}px Michroma, system-ui, sans-serif`,
    alpha: 1,
    flecks: false,
  });
  material.map = map; material.transparent = true; material.depthWrite = false;
  if (opts.emissiveIntensity) material.emissiveMap = map;
  const geometry = new THREE.PlaneGeometry(w, opts.size);
  // Match the extruded run's origin: left edge on x 0, the cap height sitting on the baseline.
  geometry.translate(w / 2, opts.size / 2, 0);
  return new THREE.Mesh(geometry, material);
}

/**
 * A backlit sign box: dark steel carcass, a white acrylic face lit from behind, the text stencilled
 * on it in the dado blue, and a thin accent strip along the bottom edge. Origin at the centre of the
 * face, so hanging one over a door is a single position. Four draw calls.
 *
 * The lettering is its own plane rather than the face's colour map: a stencil is clear everywhere it
 * is not ink, and a clear map on an opaque material multiplies the face down to black instead of
 * leaving the acrylic white.
 */
export function signBox(text: string, opts: { w: number; h: number; accent?: number; on?: boolean }): THREE.Group {
  const { w, h } = opts;
  const g = new THREE.Group();
  // The carcass stops a centimetre short of the face rather than flush with it. Flush, the box's
  // front and the face plane are coplanar, and at hall distance the depth buffer cannot separate
  // them: the lit face breaks into vertical bands of carcass across whichever half of the sign the
  // camera is off axis from.
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.09, h + 0.09, 0.09), labSteel(LABS.steel));
  frame.position.z = -0.055; frame.name = 'frame'; g.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: opts.on ? 0.6 : 0,
  }));
  face.name = 'face'; g.add(face);
  const tw = w * 0.92, th = h * 0.74;
  // A clean sign: flecks off, or the punched wear reads as damage on a lit white face.
  const map = stencilTexture(text, { width: 1024, height: Math.max(64, Math.round((1024 * th) / tw)), color: '#2455A4', font: '600 320px Michroma, system-ui, sans-serif', alpha: 1, flecks: false });
  const ink = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
  ink.position.z = 0.004; ink.name = 'text'; g.add(ink);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, 0.03), new THREE.MeshStandardMaterial({
    color: 0x101820, emissive: opts.accent ?? LABS.dado, emissiveIntensity: opts.on ? 2.2 : 0.25,
  }));
  strip.position.set(0, -h / 2 - 0.055, 0.01); strip.name = 'strip'; g.add(strip);
  return g;
}

const TAPE_H = 0.07;
const TAPE_SEGMENTS = 3;
/** A couple of degrees of twist along the run, so a strip catches the light down its length instead
 *  of reading as one flat ribbon. */
const ROLL = 0.04;

/**
 * Barrier tape between two points, hanging by `sag` at the middle over three segments and rolled a
 * little about its own run so it catches the light along its length.
 *
 * Two single sided planes, never one double sided one: a `DoubleSide` plane shows the stripe
 * mirrored from behind, so the lettering ran backwards from one side of every taped room. The back
 * plane is the same run turned about y, and its own clone of the stripe with `repeat.x` negated,
 * which walks the texture the other way along the run and lands the words the right way round for a
 * reader standing on that side. Two draw calls whatever the run's length.
 */
export function tapeStrip(a: [number, number, number], b: [number, number, number], sag = 0.05): THREE.Group {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  // Sampled points on a parabola through both ends with its belly `sag` below the chord.
  const point = (t: number) => new THREE.Vector3().lerpVectors(start, end, t).setY(THREE.MathUtils.lerp(start.y, end.y, t) - sag * 4 * t * (1 - t));
  const nodes = Array.from({ length: TAPE_SEGMENTS + 1 }, (_, i) => point(i / TAPE_SEGMENTS));
  const lengths = nodes.slice(1).map((p, i) => p.distanceTo(nodes[i]));
  const run = lengths.reduce((s, l) => s + l, 0);

  const front: THREE.BufferGeometry[] = [], back: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3();
  let travelled = 0;
  for (let i = 0; i < TAPE_SEGMENTS; i++) {
    const p0 = nodes[i], p1 = nodes[i + 1], len = lengths[i];
    const u0 = travelled / run, u1 = (travelled + len) / run;
    travelled += len;
    // A frame with the run along local x and the plane standing up: y is up with the run's own lean
    // taken out, z is the face normal.
    x.subVectors(p1, p0).normalize();
    y.copy(up).addScaledVector(x, -up.dot(x));
    if (y.lengthSq() < 1e-6) y.set(0, 0, 1).addScaledVector(x, -x.z); // a vertical run has no lean to remove
    y.normalize();
    z.crossVectors(x, y).normalize();
    // The roll is about the run, not about the face: a lean in the plane of the tape would swing
    // each segment's ends past its neighbours' and open a step at every joint.
    const place = new THREE.Matrix4().makeBasis(x, y, z)
      .multiply(new THREE.Matrix4().makeRotationX(ROLL))
      .setPosition(new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5));

    const f = new THREE.PlaneGeometry(len, TAPE_H);
    spanU(f, u0, u1);
    front.push(f.applyMatrix4(place));

    const bk = new THREE.PlaneGeometry(len, TAPE_H);
    bk.rotateY(Math.PI);
    // UVs are set after the turn, so the same point of the run carries the same u on both faces and
    // the negated repeat is what does the reversing.
    spanU(bk, u1, u0);
    back.push(bk.applyMatrix4(place));
  }

  const map = tapeStripe(); map.repeat.x = run / 2;
  const mirrored = map.clone(); mirrored.wrapS = THREE.RepeatWrapping; mirrored.repeat.x = -run / 2;
  const g = new THREE.Group();
  g.add(merged(front, new THREE.MeshStandardMaterial({ map, roughness: 0.6, side: THREE.FrontSide })));
  g.add(merged(back, new THREE.MeshStandardMaterial({ map: mirrored, roughness: 0.6, side: THREE.FrontSide })));
  return g;
}

/** Remap a plane's u from its own 0..1 to the run's `from`..`to`, so three segments tile one
 *  continuous stripe instead of three copies of the whole thing. */
function spanU(geometry: THREE.PlaneGeometry, from: number, to: number): void {
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, from + uv.getX(i) * (to - from));
  uv.needsUpdate = true;
}

/** Barrier tape strung between two floor points at a height. The rooms that string tape across a
 *  gangway call this; the run itself is a `tapeStrip`. */
export function tapeLine(a: [number, number], b: [number, number], y = 1.0): THREE.Object3D {
  return tapeStrip([a[0], y, a[1]], [b[0], y, b[1]]);
}

/**
 * Two tapes corner to corner across an opening `w` by `h`, with a KEEP OUT plate at the crossing.
 * Origin at the floor centre of the opening, the cross standing in the xy plane. Six draw calls.
 */
export function tapeCross(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(tapeStrip([-w / 2, 0.05, 0], [w / 2, h - 0.05, 0], 0.08));
  g.add(tapeStrip([w / 2, 0.05, 0], [-w / 2, h - 0.05, 0], 0.08));
  const plate = signBox('KEEP OUT', { w: Math.min(0.9, w * 0.34), h: 0.22, accent: LABS.warn });
  plate.position.set(0, h / 2, 0.03); plate.name = 'plate';
  g.add(plate);
  return g;
}

export interface DoorwaySpec { w: number; h: number; depth: number; axis: 'x' | 'z'; sign?: string; tape?: boolean; floor: THREE.Material; wall: THREE.Material }

/**
 * The transition between two rooms: a steel frame in the wall plane and a short vestibule behind it,
 * lit by one strip in its ceiling. Origin at the floor centre of the opening, which is the wall
 * plane itself, so the vestibule straddles it by half `depth` either way. `axis` is the direction
 * the walk passes through, and the sign hangs over the +z (or +x) face.
 *
 * Four draw calls bare, eight with a sign, fourteen with the tape cross as well.
 */
export function doorway(spec: DoorwaySpec): THREE.Group {
  const { w, h, depth } = spec;
  const g = new THREE.Group();
  const half = depth / 2;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, depth), spec.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.012; floor.name = 'floor'; g.add(floor);

  // Ceiling and both reveals share the room's wall material, so they are one mesh.
  const shell: THREE.BufferGeometry[] = [];
  const ceiling = new THREE.PlaneGeometry(w, depth); ceiling.rotateX(Math.PI / 2); ceiling.translate(0, h, 0); shell.push(ceiling);
  for (const side of [-1, 1]) {
    const reveal = new THREE.PlaneGeometry(depth, h);
    reveal.rotateY(side * -Math.PI / 2); reveal.translate((side * w) / 2, h / 2, 0);
    shell.push(reveal);
  }
  const shellMesh = merged(shell, spec.wall); shellMesh.name = 'shell'; g.add(shellMesh);

  // The frame: two posts and a header on a 0.25 m section, standing in the wall plane. Each stands a
  // centimetre clear of the opening rather than flush with it, for the reason the sign box's carcass
  // does: flush, a post's inner face is the reveal's own plane and the header's underside is the
  // ceiling's, both pairs facing the same way, and the depth buffer cannot separate them. The jambs
  // then break into bands of frame and reveal as the camera moves through the doorway. A centimetre
  // of daylight behind the frame is a centimetre of the reveal, which is what is drawn there anyway.
  const section = 0.25, clear = 0.01;
  const frame: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) { const post = new THREE.BoxGeometry(section, h + section, section); post.translate(side * ((w + section) / 2 + clear), (h + section) / 2 + clear, 0); frame.push(post); }
  const header = new THREE.BoxGeometry(w + section * 2 + clear * 2, section, section); header.translate(0, h + section / 2 + clear, 0); frame.push(header);
  const frameMesh = merged(frame, labSteel(0x2b3740)); frameMesh.name = 'frame'; g.add(frameMesh);

  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, depth - 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: LABS.cold, emissiveIntensity: 1.5 }));
  strip.position.y = h - 0.04; strip.name = 'strip'; g.add(strip);

  if (spec.sign) {
    const sign = signBox(spec.sign, { w: Math.min(2.2, w * 0.72), h: 0.42, on: true });
    // Clear of the header's own 0.25 m section, standing proud of the wall it is bolted to.
    sign.position.set(0, h + 0.35, half + 0.12);
    sign.name = 'sign'; g.add(sign);
  }
  if (spec.tape) {
    const tape = tapeCross(w, h);
    tape.position.z = 0.16; tape.name = 'tape'; g.add(tape);
  }

  // Built along z, then turned a quarter when the walk passes along x instead.
  if (spec.axis === 'x') g.rotation.y = Math.PI / 2;
  return g;
}
