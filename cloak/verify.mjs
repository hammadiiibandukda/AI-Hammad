// Renders the frozen rest pose through the logo's own bounds and diffs it
// against logo.svg, so "the logo is accurate" is a number, not a view.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { loadLogo, hex } from './logo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOGO = loadLogo();
const W = 848, H = Math.round(W * LOGO.box.h / LOGO.box.w);

const REF_HTML = `<body style="margin:0"><svg width="${W}" height="${H}" viewBox="${LOGO.viewBox}" shape-rendering="crispEdges">
<rect x="${LOGO.box.x - 10}" y="${LOGO.box.y - 10}" width="${LOGO.box.w + 20}" height="${LOGO.box.h + 20}" fill="#FBF8EF"/>
<path d="${LOGO.lining.d}" fill="${LOGO.lining.fill}"/><path d="${LOGO.face.d}" fill="${LOGO.face.fill}"/></svg></body>`;

const [FACE, LINING] = [hex(LOGO.face.fill), hex(LOGO.lining.fill)];
const classify = (buf, i) => {
  const r = buf[i], g = buf[i+1], b = buf[i+2];
  const d = (cr,cg,cb) => (r-cr)**2 + (g-cg)**2 + (b-cb)**2;
  const page = d(0xFB,0xF8,0xEF), front = d(...FACE), back = d(...LINING);
  if (page <= front && page <= back) return 0;
  return front <= back ? 1 : 2;
};

function compare(a, b) {
  const stats = { front:{i:0,u:0}, back:{i:0,u:0}, any:{i:0,u:0}, n:0, spill:0 };
  for (let p = 0; p < W*H; p++) {
    const ca = classify(a, p*4), cb = classify(b, p*4);
    for (const [key, cls] of [['front',1],['back',2]]) {
      const A = ca===cls, B = cb===cls;
      if (A && B) stats[key].i++;
      if (A || B) stats[key].u++;
    }
    const A = ca>0, B = cb>0;
    if (A && B) stats.any.i++;
    if (A || B) stats.any.u++;
    if (A && !B) stats.spill++;            // ink outside the artwork
    stats.n++;
  }
  const iou = (s) => s.u ? s.i/s.u : 1;
  return { front: iou(stats.front), back: iou(stats.back), silhouette: iou(stats.any),
           spillPct: 100*stats.spill/stats.n };
}

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport:{ width:W, height:H }, deviceScaleFactor:1 });

const ref = await ctx.newPage();
await ref.setContent(REF_HTML);
const refBuf = await sharpless(await ref.screenshot({ clip:{x:0,y:0,width:W,height:H} }));

const page = await ctx.newPage();
page.on('console', m => { if (m.type()==='error') console.log('  [page error]', m.text()); });
page.on('pageerror', e => console.log('  [page error]', e.message));
await page.route('https://cdn.jsdelivr.net/**', (route) => {
  const file = path.basename(new URL(route.request().url()).pathname);
  route.fulfill({ contentType: 'text/javascript',
                  body: fs.readFileSync(path.join(HERE, 'vendor', file), 'utf8') });
});
await page.goto('file://' + path.join(HERE, 'cloak.html'));
await page.waitForFunction('window.__cloak !== undefined', null, { timeout: 20000 });
console.log('mesh:', await page.evaluate('JSON.stringify(window.__cloak.stats)'));

const knobArg = process.argv[2] ? JSON.parse(process.argv[2]) : null;
if (knobArg) await page.evaluate((k) => window.__cloak.setKnobs(k), knobArg);
await page.evaluate(([w,h]) => window.__cloak.homeView(w,h), [W,H]);
await page.waitForTimeout(120);
const shotPath = path.join(HERE, 'out-rest.png');
await page.screenshot({ path: shotPath, clip:{x:0,y:0,width:W,height:H} });
const gotBuf = await sharpless(fs.readFileSync(shotPath));

const r = compare(gotBuf, refBuf);
console.log(`silhouette IoU ${(r.silhouette*100).toFixed(2)}%   face ${(r.front*100).toFixed(2)}%   inside of the curl ${(r.back*100).toFixed(2)}%   spill ${r.spillPct.toFixed(2)}%`);

// Overlay: green = agree, magenta = we painted where the artwork is empty,
// cyan = the artwork has ink we are missing.
const overlay = await ctx.newPage();
await overlay.setViewportSize({ width:W, height:H });
await overlay.evaluate(() => {});
fs.writeFileSync(path.join(HERE,'out-ref.png'), await ref.screenshot({ clip:{x:0,y:0,width:W,height:H} }));
await browser.close();

// Decode PNG through the browser rather than adding an image dependency.
async function sharpless(png) {
  const p = await ctx.newPage();
  await p.setContent('<canvas id=c></canvas>');
  const data = await p.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.getElementById('c'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img,0,0);
    return Array.from(x.getImageData(0,0,c.width,c.height).data);
  }, Buffer.from(png).toString('base64'));
  await p.close();
  return Uint8ClampedArray.from(data);
}
