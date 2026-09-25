// Bakes a Blender .glb into cloak.html as the cloth's rest pose.
//
//   node bake-mesh.mjs [model.glb] [--subdiv N]
//
// Welds the vertices Blender splits at seams (the simulation needs
// connectivity), then centres it and scales it to the width the scene is
// framed for. Leave it as modelled: the carpet wants a coarse mesh, since
// fine resolution only gives it somewhere to wrinkle. --subdiv N midpoint-
// subdivides (which cannot move the surface) if a finer mesh is ever wanted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const src = args.find(a => a.endsWith('.glb')) || path.join(HERE, 'reference-logo.glb');
const subdiv = args.includes('--subdiv') ? Math.max(0, parseInt(args[args.indexOf('--subdiv') + 1], 10) || 0) : 0;

// ---- read the glb --------------------------------------------------------
const buf = fs.readFileSync(src);
let off = 12, json, bin;
while (off < buf.readUInt32LE(8)) {
  const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
  const body = buf.subarray(off + 8, off + 8 + len);
  if (type === 0x4E4F534A) json = JSON.parse(body.toString('utf8'));
  if (type === 0x004E4942) bin = body;
  off += 8 + len;
}
const read = (i) => {
  const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type];
  const [get, size] = { 5126: ['readFloatLE', 4], 5125: ['readUInt32LE', 4], 5123: ['readUInt16LE', 2] }[a.componentType];
  const stride = bv.byteStride || size * n, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const out = [];
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out.push(bin[get](base + k * stride + c * size));
  return out;
};
const prim = json.meshes[0].primitives[0];
const rawP = read(prim.attributes.POSITION), rawI = read(prim.indices);

// ---- weld ------------------------------------------------------------------
let P = [], I = [];
const seen = new Map();
const remap = [];
for (let v = 0; v < rawP.length / 3; v++) {
  const k = [0, 1, 2].map(c => rawP[v * 3 + c].toFixed(5)).join(',');
  if (!seen.has(k)) { seen.set(k, P.length / 3); P.push(rawP[v * 3], rawP[v * 3 + 1], rawP[v * 3 + 2]); }
  remap.push(seen.get(k));
}
for (let t = 0; t < rawI.length; t += 3) {
  const a = remap[rawI[t]], b = remap[rawI[t + 1]], c = remap[rawI[t + 2]];
  if (a !== b && b !== c && a !== c) I.push(a, b, c);
}

// ---- midpoint subdivision --------------------------------------------------
for (let s = 0; s < subdiv; s++) {
  const mid = new Map(), next = [];
  const m = (a, b) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (!mid.has(k)) { mid.set(k, P.length / 3); for (let c = 0; c < 3; c++) P.push((P[a * 3 + c] + P[b * 3 + c]) / 2); }
    return mid.get(k);
  };
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]], ab = m(a, b), bc = m(b, c), ca = m(c, a);
    next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  I = next;
}

// ---- centre and scale to the frame the scene expects ----------------------
const n = P.length / 3;
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], P[v * 3 + c]); hi[c] = Math.max(hi[c], P[v * 3 + c]); }
const k = 2.0 / (hi[0] - lo[0]);
const mid3 = [0, 1, 2].map(c => (lo[c] + hi[c]) / 2);
for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++) P[v * 3 + c] = (P[v * 3 + c] - mid3[c]) * k;

// ---- how far round the apex the sheet actually wraps -----------------------
let tip = 0;
for (let v = 1; v < n; v++) if (P[v * 3 + 1] > P[tip * 3 + 1]) tip = v;
const tx = P[tip * 3], tz = P[tip * 3 + 2];
const angles = [];
for (let v = 0; v < n; v++) {
  const dx = P[v * 3] - tx, dz = P[v * 3 + 2] - tz;
  if (Math.hypot(dx, dz) > 0.15) angles.push(Math.atan2(dz, dx));
}
angles.sort((a, b) => a - b);
let gap = 0;                                   // largest empty arc = the part it doesn't cover
for (let i = 0; i < angles.length; i++) {
  const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + 2 * Math.PI;
  gap = Math.max(gap, next - angles[i]);
}
const wrapDeg = (2 * Math.PI - gap) * 180 / Math.PI;

// ---- splice into cloak.html ------------------------------------------------
const b64 = (arr) => Buffer.from(arr.buffer).toString('base64');
const payload = JSON.stringify({
  source: path.basename(src), subdiv, verts: n, tris: I.length / 3,
  positions: b64(Float32Array.from(P)),
  indices: b64(n < 65536 ? Uint16Array.from(I) : Uint32Array.from(I)),
  wide: n >= 65536,
});
const html = fs.readFileSync(path.join(HERE, 'cloak.html'), 'utf8');
const open = '<script type="application/json" id="logo-mesh">', close = '</script>';
const block = `${open}${payload}${close}`;
const out = html.includes(open)
  ? html.replace(new RegExp(`${open}[\\s\\S]*?${close}`), () => block)
  : html.replace('<script type="importmap">', `${block}\n\n<script type="importmap">`);
fs.writeFileSync(path.join(HERE, 'cloak.html'), out);

console.log(`${path.basename(src)} -> ${n} verts, ${I.length / 3} tris (welded, subdiv ${subdiv})`);
console.log(`size after scaling: ${(2).toFixed(2)} x ${((hi[1] - lo[1]) * k).toFixed(3)} x ${((hi[2] - lo[2]) * k).toFixed(3)}`);
console.log(`wraps ${wrapDeg.toFixed(0)}° around the apex (open over the remaining ${(360 - wrapDeg).toFixed(0)}°)`);
console.log(`embedded ${(block.length / 1024).toFixed(1)} KB`);
