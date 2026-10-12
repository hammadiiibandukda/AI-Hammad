// The page's fly-in against the Blender reference, moment by moment.
//
//   node compare.mjs [frames_dir] [out.png]
//
// Both run the same mesh along the same path with the same timing, so they
// can be compared point for point: how far apart they are, and how sharply
// each one is folding. frames_dir holds Blender's renders (flyin.py with
// "render"); without it you get the numbers and the page's frames only.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const framesDir = process.argv[2];
const outPng = process.argv[3] || path.join(ROOT, 'out-compare.png');

const meta = JSON.parse(fs.readFileSync(path.join(HERE, 'flyin-meta.json'), 'utf8'));
const buf = fs.readFileSync(path.join(HERE, 'flyin-positions.bin'));
const ref = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const N = meta.vertices, delay = meta.settings.delay;
const refAt = (t) => { const f = Math.min(Math.round(t * meta.fps), meta.frames - 1); return ref.subarray(f*N*3, (f+1)*N*3); };

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport:{width:960,height:600}, deviceScaleFactor:1 });
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
await p.route('https://cdn.jsdelivr.net/**', r=>r.fulfill({contentType:'text/javascript',
  body: fs.readFileSync(path.join(ROOT,'vendor',path.basename(new URL(r.request().url()).pathname)),'utf8')}));
await p.goto('file://'+path.join(ROOT,'cloak.html'));
await p.waitForFunction('window.__cloak!==undefined',null,{timeout:20000});
await p.waitForFunction('!window.__cloak.flying()', null, {timeout:60000});
await p.evaluate(()=>document.getElementById('hint').style.display='none');

// Folds, measured the way the page's feel() does: change in angle between
// neighbouring faces, skipping sliver triangles.
const embedded = JSON.parse(fs.readFileSync(path.join(ROOT, 'cloak.html'), 'utf8')
  .match(/<script type="application\/json" id="logo-mesh">([\s\S]*?)<\/script>/)[1]);
const bytes = (b64) => { const u = Buffer.from(b64, 'base64'); return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength); };
const rest = new Float32Array(bytes(embedded.positions));
const indices = embedded.wide ? new Uint32Array(bytes(embedded.indices)) : new Uint16Array(bytes(embedded.indices));
const hinges = (() => {
  const L = (u,v) => Math.hypot(rest[u*3]-rest[v*3], rest[u*3+1]-rest[v*3+1], rest[u*3+2]-rest[v*3+2]);
  const q = (a,b,c) => { const ab=L(a,b), bc=L(b,c), ca=L(c,a), s=(ab+bc+ca)/2, m=Math.max(ab,bc,ca);
    return 2*Math.sqrt(Math.max(0, s*(s-ab)*(s-bc)*(s-ca)))/(m*m); };
  const map = new Map();
  for (let t=0; t<indices.length; t+=3) for (let e=0; e<3; e++) {
    const a=indices[t+e], bb=indices[t+(e+1)%3], c=indices[t+(e+2)%3], k=a<bb?a*1e6+bb:bb*1e6+a;
    (map.get(k) || map.set(k, [a,bb]).get(k)).push(c);
  }
  return [...map.values()].filter(h => h.length===4 && q(h[0],h[1],h[2])>=0.12 && q(h[0],h[1],h[3])>=0.12);
})();
const angle = (P, [a,bb,c,d]) => {
  const e=[P[bb*3]-P[a*3],P[bb*3+1]-P[a*3+1],P[bb*3+2]-P[a*3+2]];
  const u=[P[c*3]-P[a*3],P[c*3+1]-P[a*3+1],P[c*3+2]-P[a*3+2]], w=[P[d*3]-P[a*3],P[d*3+1]-P[a*3+1],P[d*3+2]-P[a*3+2]];
  const n1=[e[1]*u[2]-e[2]*u[1], e[2]*u[0]-e[0]*u[2], e[0]*u[1]-e[1]*u[0]];
  const n2=[w[1]*e[2]-w[2]*e[1], w[2]*e[0]-w[0]*e[2], w[0]*e[1]-w[1]*e[0]];
  const l=Math.hypot(...n1)*Math.hypot(...n2)||1;
  return Math.acos(Math.max(-1, Math.min(1, (n1[0]*n2[0]+n1[1]*n2[1]+n1[2]*n2[2])/l)));
};
const restAngles = hinges.map(h => angle(rest, h));
const fold = (P) => Math.max(...hinges.map((h,k) => Math.abs(angle(P,h)-restAngles[k]))) * 180/Math.PI;
let x0=Infinity, x1=-Infinity; for (let i=0;i<N;i++) { x0=Math.min(x0,rest[i*3]); x1=Math.max(x1,rest[i*3]); }
const width = x1 - x0;

// Replay the page's entrance from a clean start and sample it on Blender's clock.
const times = [0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.4, 2.8, 3.4];
await p.evaluate(()=>window.__cloak.flyIn());
const rows = [];
for (const t of times) {
  await p.waitForFunction(`window.__cloak.clock() >= ${t - delay}`, null, {polling:'raf', timeout:60000});
  const P = await p.evaluate(()=>Array.from(window.__cloak._cloth.pos));
  const R = refAt(t);
  let d = 0; for (let i=0;i<N;i++) d += Math.hypot(P[i*3]-R[i*3], P[i*3+1]-R[i*3+1], P[i*3+2]-R[i*3+2]);
  rows.push({ t, apart: d/N/width, pageFold: fold(P), refFold: fold(R), shot: await p.screenshot({type:'jpeg', quality:80}) });
}
console.log('  time   page vs Blender   sharpest fold: page   Blender');
for (const r of rows) console.log(`  ${r.t.toFixed(1)}s   ${(r.apart*100).toFixed(1).padStart(5)}% apart       ${r.pageFold.toFixed(0).padStart(4)}°     ${r.refFold.toFixed(0).padStart(4)}°`);
console.log(`  average ${(rows.reduce((s,r)=>s+r.apart,0)/rows.length*100).toFixed(1)}% of its width apart`);

const blenderShot = (t) => {
  if (!framesDir) return null;
  const f = path.join(framesDir, String(Math.round(t*meta.fps)+1).padStart(4,'0') + '.png');
  return fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
};
const sheet = await ctx.newPage();
await sheet.setViewportSize({width:1500, height:600});
const cell = 'width:16.66%;box-sizing:border-box;padding:2px';
const img = 'width:100%;display:block;aspect-ratio:1.6;background:#FBF8EF';
await sheet.setContent(`<body style="margin:0;background:#151515;color:#aaa;font:10px monospace">
${[0, 6].map(k => `
<div style="display:flex;flex-wrap:wrap">${rows.slice(k, k+6).map(r => { const s = blenderShot(r.t); return `<div style="${cell}">
<div style="padding:2px">Blender ${r.t.toFixed(1)}s</div>${s ? `<img src="data:image/png;base64,${s}" style="${img}">` : `<div style="${img}"></div>`}</div>`; }).join('')}</div>
<div style="display:flex;flex-wrap:wrap">${rows.slice(k, k+6).map(r => `<div style="${cell}">
<div style="padding:2px">page ${r.t.toFixed(1)}s · ${(r.apart*100).toFixed(1)}% apart</div><img src="data:image/jpeg;base64,${r.shot.toString('base64')}" style="${img}"></div>`).join('')}</div>`).join('')}
</body>`);
await sheet.screenshot({path: outPng, fullPage:true});
console.log('wrote', outPng);
await b.close();
