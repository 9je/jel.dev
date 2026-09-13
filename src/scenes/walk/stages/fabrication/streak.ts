import * as THREE from 'three';
import { labSteel } from '../../labs/materials';
import { canvas, own, rng } from '../../labs/textures';
import streak from '../../../../content/streak.json';

/**
 * The shift board: how many days running Jordan has pushed something, drawn the way a plant draws
 * the days it has gone without an injury. Every facility of this kind has one of these boards by the
 * dispatch counter, the number is the only thing on it anybody reads, and somebody has to change it
 * by hand when it goes back to nought.
 *
 * The numbers come from `src/content/streak.json`, which `scripts/streak.mjs` refreshes from the
 * public contribution calendar before every deploy. A day behind is fine. A build that fails because
 * github.com was slow is not, so the script keeps the last snapshot on any error.
 *
 * The count is the headline and the twelve week grid beside it is the working. GitHub's own calendar
 * is a year of grey green squares that says nothing at a glance, which was the whole complaint, so
 * this one is a run of weeks in the building's own blues with the streak set eight times larger than
 * anything else on the board. Nothing else goes on it: a longest run and a year total stood there
 * for one build and both were cut.
 */

const W = 1024, H = 620;
/** The ramp a day's cell is filled with, by its level. The Labs blues, not GitHub's greens: the
 *  board belongs to the building it hangs in. */
const LEVELS = ['#c2cbd1', '#86aedb', '#4b83c4', '#2a5ea6', '#123c74'];
const AMBER = '#f0a441';
const INK = '#1b2530';

/** The two faces the board is printed with: the colour map, and the emissive map that carries only
 *  the things that light up, which is the count and the days with something on them. Drawn twice
 *  from one routine so the glow can never drift from the print. */
function faces(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  return { map: draw(false), glow: draw(true) };
}

function draw(glow: boolean): THREE.CanvasTexture {
  const [c, ctx] = canvas(W, H);
  const r = rng(17);
  const days = String(streak.current);
  const digits = days.padStart(3, '0');

  if (glow) { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H); } else {
    ctx.fillStyle = '#e7eae6'; ctx.fillRect(0, 0, W, H);
    // The board has been outside a loading bay for years. Flecks and a wipe across the middle.
    ctx.fillStyle = 'rgba(90,100,110,0.10)';
    for (let i = 0; i < 900; i++) ctx.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 2);
    ctx.fillStyle = 'rgba(120,130,140,0.07)';
    for (let i = 0; i < 22; i++) ctx.fillRect(0, 150 + r() * 320, W, 1 + r() * 3);
  }

  // The header band. Set to fit the board rather than to a fixed size: at 40 px the line ran off the
  // end of the plate and the board said "DAYS WITHOUT A MISSED COMMI".
  if (!glow) {
    ctx.fillStyle = '#1f4f96'; ctx.fillRect(0, 0, W, 96);
    ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const title = 'DAYS WITHOUT A MISSED COMMIT';
    let px = 42;
    do { ctx.font = `600 ${px}px Michroma, system-ui, sans-serif`; px -= 1; } while (ctx.measureText(title).width > W - 68 && px > 18);
    ctx.fillText(title, 34, 52);
  }

  // The count, in a dark inset with a tile per digit, the way a flip board carries one. It is the
  // only figure on the board. A longest run and a year total stood beside it for one build and
  // Jordan cut both: the board answers one question.
  const x0 = 40, y0 = 152, tw = 150, th = 244, gap = 16;
  digits.split('').forEach((d, i) => {
    const x = x0 + i * (tw + gap);
    if (!glow) {
      ctx.fillStyle = '#10171e'; ctx.fillRect(x, y0, tw, th);
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x, y0 + th / 2 - 1, tw, 2);
    }
    ctx.fillStyle = AMBER;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 172px Michroma, system-ui, sans-serif';
    ctx.fillText(d, x + tw / 2, y0 + th / 2 + 8);
  });
  if (!glow) {
    ctx.textAlign = 'left'; ctx.fillStyle = INK;
    ctx.font = '600 28px Michroma, system-ui, sans-serif';
    ctx.fillText('CURRENT RUN', x0, y0 + th + 40);
  }

  // The working: the last twelve weeks, one cell a day, a column a week.
  const gx = 566, gy = 152, pitch = 36, cell = 30;
  const levels = String(streak.recent);
  for (let col = 0; col < 12; col++) {
    for (let rowN = 0; rowN < 7; rowN++) {
      const level = Number(levels[col * 7 + rowN] ?? 0);
      const x = gx + col * pitch, y = gy + rowN * pitch;
      if (glow) {
        if (level === 0) continue;
        ctx.fillStyle = `rgba(120,170,235,${(0.18 + level * 0.2).toFixed(2)})`;
      } else {
        ctx.fillStyle = LEVELS[Math.min(4, level)]!;
      }
      ctx.fillRect(x, y, cell, cell);
    }
  }
  if (!glow) {
    ctx.fillStyle = '#5b6770'; ctx.font = '600 24px Michroma, system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('LAST TWELVE WEEKS', gx, gy + 7 * pitch + 26);
    ctx.fillStyle = 'rgba(27,37,48,0.55)'; ctx.font = '600 20px Michroma, system-ui, sans-serif';
    ctx.fillText(`READ ${streak.generated}`, x0, H - 34);
    ctx.textAlign = 'right'; ctx.fillText(`GITHUB.COM/${String(streak.login).toUpperCase()}`, W - 34, H - 34);
  }
  return own(c);
}

/**
 * The board on its frame: 1.9 m by 1.15, origin at the centre of the face, facing +z. The count and
 * the worked days are the only lit things on it, so in a bay lit at dusk the number carries and the
 * rest of the board sits at the value of the wall behind it. Two draw calls.
 */
export function streakBoard(): THREE.Group {
  const g = new THREE.Group();
  const w = 1.9, h = (w * H) / W;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.07, h + 0.07, 0.05), labSteel(0x9aa5ad));
  frame.position.z = -0.03; frame.name = 'frame'; g.add(frame);
  const { map, glow } = faces();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
    map, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 0.9, roughness: 0.42, metalness: 0.05,
  }));
  face.name = 'face'; g.add(face);
  return g;
}
