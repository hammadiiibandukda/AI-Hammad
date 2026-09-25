// Films the entrance: the cloak flying in and landing in the logo pose.
// Also checks it stays sound in the air and actually lands home.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport:{width:960,height:600}, deviceScaleFactor:1 });
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
await p.route('https://cdn.jsdelivr.net/**', r=>r.fulfill({contentType:'text/javascript',
  body: fs.readFileSync(path.join(HERE,'vendor',path.basename(new URL(r.request().url()).pathname)),'utf8')}));
await p.goto('file://'+path.join(HERE,'cloak.html'));
await p.waitForFunction('window.__cloak!==undefined',null,{timeout:20000});
await p.waitForFunction('!window.__cloak.flying()', null, {timeout:40000});
await p.evaluate(()=>document.getElementById('hint').style.display='none');

// Replay it from a clean start so the timing is ours. Marks are in simulated
// time — a slow headless frame slows the flight and the physics together.
const total = await p.evaluate((o)=>window.__cloak.flyIn(o), process.argv[2] ? JSON.parse(process.argv[2]) : null);
const delay = Math.max(0, -(await p.evaluate(()=>window.__cloak.clock())));   // the beat before take-off
const marks = [0.15, 0.4, 0.65, 0.9, 1.15, 1.4, 1.7, 2.0, 2.35, 2.75, 3.3, 4.2, 5.2, 6.4];
const shots = []; let worst = 0, bad = false, untangled = false;
for (const m of marks) {
  await p.waitForFunction(`window.__cloak.clock() >= ${m - delay}`, null, {polling:'raf', timeout:60000});
  const st = await p.evaluate(()=>({ ov: window.__cloak.overlap(), off: window.__cloak.offHome(), fly: window.__cloak.flying(),
                                     e: window.__cloak.energy(), un: window.__cloak.untangling() }));
  if (st.un) untangled = true;
  worst = Math.max(worst, st.ov); if (!Number.isFinite(st.e)) bad = true;
  shots.push([`${m.toFixed(2)}s${st.fly?'':' · landed'}`, await p.screenshot({type:'jpeg',quality:80})]);
}
const off = await p.evaluate(()=>window.__cloak.offHome());
console.log(`entrance: ${total.toFixed(2)}s (${(total-2.6).toFixed(2)}s delay + 2.60s flight)`);
console.log(`finite throughout: ${!bad}   worst self-intersection in flight: ${(worst*100).toFixed(1)}%   needed untangling: ${untangled}`);
console.log(`after landing: on average ${(off*100).toFixed(1)}% of its width from the logo pose` + (off < 0.025 ? '  — home' : '  — not home'));

const sheet = await ctx.newPage();
await sheet.setViewportSize({width:1500,height:500});
await sheet.setContent(`<body style="margin:0;background:#151515;color:#aaa;font:10px monospace">
<div style="display:flex;flex-wrap:wrap">${shots.map(([l,f])=>`<div style="width:16.66%;box-sizing:border-box;padding:2px">
<div style="padding:2px">${l}</div><img src="data:image/jpeg;base64,${f.toString('base64')}" style="width:100%;display:block"></div>`).join('')}</div></body>`);
await sheet.screenshot({path:path.join(HERE, process.argv[3] || 'out-intro.png'), fullPage:true});
await b.close();
