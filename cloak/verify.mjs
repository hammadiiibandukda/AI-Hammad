// Renders the frozen rest pose through the artwork's own viewBox and diffs it
// against the original SVG, so "the logo is accurate" is a number, not a view.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const W = 848, H = 573;                       // viewBox 84.8388 x 57.2823, x10
const VIEWBOX = '72.2972 91.7177 84.8388 57.2823';
const MAIN = 'M127.746 146.09C146.728 147.541 155.137 139.361 157.136 136.943C157.136 136.943 145.802 123.19 139.125 113.962C134.576 107.679 128.751 98.7473 125.415 93.5611C124.23 91.7177 121.397 91.793 120.189 93.6256C107.794 112.371 84.9689 126.425 79.8496 129.134C83.8965 127.532 91.2791 132.525 101.275 137.856C101.275 137.856 108.697 141.532 113.726 143.236C120.172 145.418 127.752 146.095 127.752 146.095L127.746 146.09Z';
const DARK = 'M97.2728 149C97.2728 149 72.2972 140.278 77.789 131.071C81.2884 125.256 89.2806 131.555 101.766 137.854L97.2671 149H97.2728Z';

const REF_HTML = `<body style="margin:0"><svg width="${W}" height="${H}" viewBox="${VIEWBOX}" shape-rendering="crispEdges">
<rect x="0" y="0" width="234" height="234" fill="#FBF8EF"/>
<path d="${DARK}" fill="#D0470C"/><path d="${MAIN}" fill="#FF6625"/></svg></body>`;

const classify = (buf, i) => {
  const r = buf[i], g = buf[i+1], b = buf[i+2];
  const d = (cr,cg,cb) => (r-cr)**2 + (g-cg)**2 + (b-cb)**2;
  const page = d(0xFB,0xF8,0xEF), front = d(0xFF,0x66,0x25), back = d(0xD0,0x47,0x0C);
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
console.log(`silhouette IoU ${(r.silhouette*100).toFixed(2)}%   front ${(r.front*100).toFixed(2)}%   back(fold) ${(r.back*100).toFixed(2)}%   spill ${r.spillPct.toFixed(2)}%`);

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
