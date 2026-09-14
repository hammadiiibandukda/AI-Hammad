// Searches the rest-pose knobs so the frozen front view reproduces the artwork.
// Scoring happens inside the page (no megabyte pixel round-trips), so each
// evaluation is a few tens of milliseconds and a few hundred are affordable.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const W = 848, H = 573;

const MAIN = 'M127.746 146.09C146.728 147.541 155.137 139.361 157.136 136.943C157.136 136.943 145.802 123.19 139.125 113.962C134.576 107.679 128.751 98.7473 125.415 93.5611C124.23 91.7177 121.397 91.793 120.189 93.6256C107.794 112.371 84.9689 126.425 79.8496 129.134C83.8965 127.532 91.2791 132.525 101.275 137.856C101.275 137.856 108.697 141.532 113.726 143.236C120.172 145.418 127.752 146.095 127.752 146.095L127.746 146.09Z';
const DARK = 'M97.2728 149C97.2728 149 72.2972 140.278 77.789 131.071C81.2884 125.256 89.2806 131.555 101.766 137.854L97.2671 149H97.2728Z';

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:1 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('ERR', e.message));
await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType:'text/javascript',
  body: fs.readFileSync(path.join(HERE,'vendor',path.basename(new URL(r.request().url()).pathname)),'utf8') }));
await page.goto('file://' + path.join(HERE,'cloak.html'));
await page.waitForFunction('window.__cloak!==undefined', null, { timeout:20000 });

// Reference mask, rasterised once from the original paths at the test size.
await page.evaluate(([w,h,main,dark]) => {
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  const g = c.getContext('2d', { willReadFrequently:true });
  const s = w/84.8388;
  g.setTransform(s,0,0,s,-72.2972*s,-91.7177*s);
  g.fillStyle='#D0470C'; g.fill(new Path2D(dark));
  g.fillStyle='#FF6625'; g.fill(new Path2D(main));
  const px = g.getImageData(0,0,w,h).data;
  const mask = new Uint8Array(w*h);
  for (let i=0;i<w*h;i++) { const a=px[i*4+3]; if (a<128) { mask[i]=0; continue; }
    mask[i] = Math.abs(px[i*4]-0xFF)+Math.abs(px[i*4+1]-0x66) < Math.abs(px[i*4]-0xD0)+Math.abs(px[i*4+1]-0x47) ? 1 : 2; }
  window.__ref = mask;
  window.__buf = document.createElement('canvas'); window.__buf.width=w; window.__buf.height=h;
  window.__bufg = window.__buf.getContext('2d', { willReadFrequently:true });
  window.__score = (knobs) => {
    if (knobs) window.__cloak.setKnobs(knobs);
    window.__cloak.homeView(w,h);
    window.__bufg.clearRect(0,0,w,h);
    window.__bufg.drawImage(document.getElementById('stage'),0,0,w,h);
    const d = window.__bufg.getImageData(0,0,w,h).data;
    let fi=0,fu=0,bi=0,bu=0,ai=0,au=0,spill=0;
    for (let i=0;i<w*h;i++) {
      const r=d[i*4],gg=d[i*4+1],b=d[i*4+2];
      const dp=(r-0xFB)**2+(gg-0xF8)**2+(b-0xEF)**2;
      const df=(r-0xFF)**2+(gg-0x66)**2+(b-0x25)**2;
      const db=(r-0xD0)**2+(gg-0x47)**2+(b-0x0C)**2;
      const got = (dp<=df && dp<=db) ? 0 : (df<=db ? 1 : 2);
      const ref = window.__ref[i];
      if (got===1||ref===1) { fu++; if (got===1&&ref===1) fi++; }
      if (got===2||ref===2) { bu++; if (got===2&&ref===2) bi++; }
      if (got>0||ref>0) { au++; if (got>0&&ref>0) ai++; }
      if (got>0&&ref===0) spill++;
    }
    return { front: fu?fi/fu:1, back: bu?bi/bu:0, sil: au?ai/au:1, spill: spill/(w*h) };
  };
}, [W,H,MAIN,DARK]);

const evalKnobs = (k) => page.evaluate((kk) => window.__score(kk), k);
// Back-face lobe is what we are solving for; front and spill act as guards so
// the fold cannot win by creeping over the body or outside the artwork.
const objective = (r) => r.back + 0.5*r.sil - 9.0*r.spill - 8.0*Math.max(0, 0.985 - r.front);

// Stage 2 only: the body's outline is exact by construction, so these knobs
// exist to shape the crease and the roll, not to buy silhouette accuracy.
// Depth is now fixed by the orthographic reference, so the fit only shapes
// the fold. leftPow tilts the crease without changing how deep the shell is.
const BOUNDS = {
  leftPow:[1.20,7.00],
  curlRadius:[0.015,0.30], foldReach:[0.10,0.85],
  curlAngle:[1.80,4.40], curlAngleEnd:[0.20,1.20], curlEase:[0.25,1.60],
  curlEndFrac:[0.05,1.00], curlTaper:[0.40,3.20],
  curlLift:[-1.80,1.80], curlAxis:[-2.80,2.80],
};
const KEYS = Object.keys(BOUNDS);
const clampK = (k) => { const o={}; for (const key of KEYS) o[key]=Math.min(BOUNDS[key][1],Math.max(BOUNDS[key][0],k[key])); return o; };

let best = await page.evaluate(() => ({ ...window.__cloak.knobs }));
if (fs.existsSync(path.join(HERE,'fitted-knobs.json')) && process.argv.includes('--seed'))
  best = { ...best, ...JSON.parse(fs.readFileSync(path.join(HERE,'fitted-knobs.json'),'utf8')) };
let bestR = await evalKnobs(best), bestS = objective(bestR);
console.log(`start   front ${(bestR.front*100).toFixed(1)}  back ${(bestR.back*100).toFixed(1)}  sil ${(bestR.sil*100).toFixed(1)}`);

// Random restarts to find the basin, then shrinking coordinate descent.
for (let trial=0; trial < (process.argv.includes('--seed') ? 80 : 260); trial++) {
  const cand = {}; for (const k of KEYS) cand[k] = BOUNDS[k][0] + Math.random()*(BOUNDS[k][1]-BOUNDS[k][0]);
  const r = await evalKnobs(cand), s = objective(r);
  if (s > bestS) { bestS=s; bestR=r; best=cand;
    console.log(`random  front ${(r.front*100).toFixed(1)}  back ${(r.back*100).toFixed(1)}  sil ${(r.sil*100).toFixed(1)}`); }
}
for (let scale of [0.35,0.20,0.11,0.06,0.03,0.015,0.008]) {
  let improved = true, pass = 0;
  while (improved && pass++ < 6) {
    improved = false;
    for (const key of KEYS) {
      const span = (BOUNDS[key][1]-BOUNDS[key][0])*scale;
      for (const dir of [1,-1]) {
        const cand = clampK({ ...best, [key]: best[key] + dir*span });
        const r = await evalKnobs(cand), s = objective(r);
        if (s > bestS + 1e-6) { bestS=s; bestR=r; best=cand; improved=true; }
      }
    }
  }
  console.log(`scale ${scale.toFixed(3)}  front ${(bestR.front*100).toFixed(1)}  back ${(bestR.back*100).toFixed(1)}  sil ${(bestR.sil*100).toFixed(1)}  spill ${(bestR.spill*100).toFixed(2)}`);
}

console.log('\nBEST KNOBS');
console.log(JSON.stringify(Object.fromEntries(KEYS.map(k=>[k, +best[k].toFixed(4)])), null, 2));
console.log(`front ${(bestR.front*100).toFixed(2)}%  back ${(bestR.back*100).toFixed(2)}%  silhouette ${(bestR.sil*100).toFixed(2)}%  spill ${(bestR.spill*100).toFixed(3)}%`);
fs.writeFileSync(path.join(HERE,'fitted-knobs.json'), JSON.stringify(Object.fromEntries(KEYS.map(k=>[k,+best[k].toFixed(4)])), null, 2));
await browser.close();
