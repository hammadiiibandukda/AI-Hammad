// Measures how carpet-like the motion is: idle, while being dragged around,
// and after letting go. Prints the numbers and writes a filmstrip.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const tag = process.argv[2] || 'now';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport:{width:900,height:620}, deviceScaleFactor:1 });
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
await p.route('https://cdn.jsdelivr.net/**', r=>r.fulfill({contentType:'text/javascript',
  body: fs.readFileSync(path.join(HERE,'vendor', path.basename(new URL(r.request().url()).pathname)),'utf8')}));
await p.goto('file://'+path.join(HERE,'cloak.html'));
await p.waitForFunction('window.__cloak!==undefined',null,{timeout:20000});
await p.waitForFunction('!window.__cloak.flying()', null, {timeout:40000});   // let the entrance land
// Measure idle once it has truly settled from the entrance, not while the
// landing is still dying away. Simulated seconds, so a slow frame can't cut it short.
const landed = await p.evaluate(()=>window.__cloak.clock());
await p.waitForFunction(`window.__cloak.clock() >= ${landed + 5}`, null, {polling:'raf', timeout:60000});
if (process.argv[3]) console.log('  tune', JSON.stringify(await p.evaluate((k)=>{ const r = window.__cloak.tune(k); return { constraints: r.constraints, ...k }; }, JSON.parse(process.argv[3]))));
await p.waitForTimeout(1500);

// Wait for s seconds of simulation from now, however long that takes here.
const later = async (s) => { const t = await p.evaluate(()=>window.__cloak.clock()) + s;
  await p.waitForFunction(`window.__cloak.clock() >= ${t}`, null, {polling:'raf', timeout:60000}); };

const sample = async (n, gap) => {
  const out = [];
  for (let i=0;i<n;i++) { out.push(await p.evaluate(()=>window.__cloak.feel())); await p.waitForTimeout(gap); }
  const avg = k => out.reduce((s,o)=>s+o[k],0)/out.length;
  const max = k => Math.max(...out.map(o=>o[k]));
  return { creaseMax: max('creaseMax'), creaseP95: avg('creaseP95'), roughness: avg('roughness') };
};

const idle = await sample(8, 120);
const shots = [];
const snap = async (l) => shots.push([l, await p.screenshot({type:'jpeg',quality:80})]);
await snap('idle');

// Grab the wing and swing it around in a loop, the way you'd fly it.
await p.mouse.move(600, 420); await p.mouse.down();
const during = [];
for (let i=0;i<28;i++) {
  const a = i/28 * Math.PI * 2;
  await p.mouse.move(600 - 170*Math.sin(a) - i*3, 420 - 150*(1-Math.cos(a))*0.6);
  await later(1/30);                         // one step per 1/30s of simulation
  if (i % 3 === 0) during.push(await p.evaluate(()=>window.__cloak.feel()));
  if (i === 9 || i === 18) await snap('swinging ' + (i===9?'1':'2'));
}
await snap('held');
await p.mouse.up();
await later(0.26); await snap('let go');
const drag = {
  creaseMax: Math.max(...during.map(o=>o.creaseMax)),
  creaseP95: during.reduce((s,o)=>s+o.creaseP95,0)/during.length,
  roughness: during.reduce((s,o)=>s+o.roughness,0)/during.length,
};
await later(2.2); await snap('settled');
const after = await p.evaluate(()=>({ e: window.__cloak.energy(), ov: window.__cloak.overlap() }));

const f = (o) => `crease max ${o.creaseMax.toFixed(1).padStart(5)}°   crease p95 ${o.creaseP95.toFixed(1).padStart(5)}°   roughness ${o.roughness.toFixed(2)}`;
console.log(`[${tag}]  mesh ${JSON.stringify(await p.evaluate(()=>window.__cloak.stats))}`);
console.log(`  idle     ${f(idle)}`);
console.log(`  swinging ${f(drag)}`);
console.log(`  settled  energy ${after.e.toFixed(4)}   overlap ${(after.ov*100).toFixed(1)}%   frame ${(await p.evaluate(()=>window.__cloak.frameMs())).toFixed(1)}ms`);

const sheet = await ctx.newPage();
await sheet.setViewportSize({width:1500,height:230});
await sheet.setContent(`<body style="margin:0;background:#151515;display:flex;font:10px monospace;color:#aaa">
${shots.map(([l,f])=>`<div style="flex:1"><div style="padding:3px">${tag}: ${l}</div><img src="data:image/jpeg;base64,${f.toString('base64')}" style="width:100%"></div>`).join('')}</body>`);
await sheet.screenshot({path:path.join(HERE,`out-feel-${tag}.png`)});
await b.close();
