// Checks the triangle quality of the model: thin sliver triangles have
// normals that swing wildly under tiny motions, so a "crease" measured on one
// can be an artefact of its shape rather than a visible fold.
import fs from 'node:fs';
const html = fs.readFileSync('/home/user/AI-Hammad/cloak/cloak.html','utf8');
const data = JSON.parse(html.match(/<script type="application\/json" id="logo-mesh">([\s\S]*?)<\/script>/)[1]);
const P = new Float32Array(Buffer.from(data.positions,'base64').buffer.slice(0));
const raw = Buffer.from(data.indices,'base64');
const I = data.wide ? new Uint32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset+raw.length)) : new Uint16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset+raw.length));
const n = P.length/3;
let tip = 0; for (let i=1;i<n;i++) if (P[i*3+1] > P[tip*3+1]) tip = i;
const d = (a,b)=>Math.hypot(P[a*3]-P[b*3],P[a*3+1]-P[b*3+1],P[a*3+2]-P[b*3+2]);
const tris = [];
for (let t=0;t<I.length;t+=3) {
  const [a,b,c] = [I[t],I[t+1],I[t+2]];
  const ab=d(a,b), bc=d(b,c), ca=d(c,a);
  const s=(ab+bc+ca)/2, area=Math.sqrt(Math.max(0,s*(s-ab)*(s-bc)*(s-ca)));
  const longest = Math.max(ab,bc,ca);
  // Aspect: shortest altitude relative to the longest edge. 0.87 = equilateral.
  const quality = 2*area/(longest*longest);
  tris.push({ a,b,c, quality, longest, fromTip: Math.min(d(a,tip),d(b,tip),d(c,tip)) });
}
tris.sort((x,y)=>x.quality-y.quality);
const bad = tris.filter(t=>t.quality < 0.12);
console.log(`${tris.length} triangles; slivers (altitude < 12% of longest edge): ${bad.length}`);
const near = bad.filter(t=>t.fromTip < 0.35).length;
console.log(`  of which within 0.35 of the tip: ${near}`);
for (const t of tris.slice(0,8)) console.log(`  quality ${t.quality.toFixed(3)}  longest edge ${t.longest.toFixed(3)}  distance from tip ${t.fromTip.toFixed(3)}`);
