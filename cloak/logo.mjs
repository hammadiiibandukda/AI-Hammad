// The reference logo, logo.svg: its two shapes, their colours, and the bounds
// of the artwork. The page treats those bounds as x -1..1, centred — the same
// convention blender/fit_logo.py fits the cloak to.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Points along a path made of M, L, H, V, C and Z commands (absolute only,
// which is all the logo uses), 40 per curve.
function sample(d) {
  const tok = d.match(/[MCLHVZ]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const pts = []; let cur = [0, 0], cmd = null, i = 0;
  const n = (k) => parseFloat(tok[i + k]);
  while (i < tok.length) {
    if (/[MCLHVZ]/.test(tok[i])) { cmd = tok[i++]; if (cmd === 'Z') continue; }
    if (cmd === 'M' || cmd === 'L') { cur = [n(0), n(1)]; pts.push(cur); i += 2; }
    else if (cmd === 'H') { cur = [n(0), cur[1]]; pts.push(cur); i += 1; }
    else if (cmd === 'V') { cur = [cur[0], n(0)]; pts.push(cur); i += 1; }
    else if (cmd === 'C') {
      const [p0, p1, p2, p3] = [cur, [n(0), n(1)], [n(2), n(3)], [n(4), n(5)]];
      for (let s = 1; s <= 40; s++) {
        const t = s / 40, m = 1 - t;
        pts.push([0, 1].map(c => m*m*m*p0[c] + 3*m*m*t*p1[c] + 3*m*t*t*p2[c] + t*t*t*p3[c]));
      }
      cur = p3; i += 6;
    } else i++;
  }
  return pts;
}

export function loadLogo(file = path.join(HERE, 'logo.svg')) {
  const src = fs.readFileSync(file, 'utf8');
  // In drawing order: the inside of the curl first, the body over it.
  const [lining, face] = [...src.matchAll(/<path d="([^"]+)" fill="([^"]+)"/g)].map(m => ({ d: m[1], fill: m[2] }));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { d } of [lining, face]) for (const [x, y] of sample(d)) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { lining, face, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
           viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}` };
}

export const hex = (c) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
