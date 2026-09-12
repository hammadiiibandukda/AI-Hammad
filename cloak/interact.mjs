// Drives the real pointer path: grab the hem, drag it away, let go, and check
// the mark finds its way back to the artwork on its own.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
const HERE='/home/user/AI-Hammad/cloak';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport:{width:900,height:620}, deviceScaleFactor:1 });
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
await p.route('https://cdn.jsdelivr.net/**', r=>r.fulfill({contentType:'text/javascript',
  body: fs.readFileSync(path.join(HERE,'vendor',path.basename(new URL(r.request().url()).pathname)),'utf8')}));
await p.goto('file://'+path.join(HERE,'cloak.html'));
await p.waitForFunction('window.__cloak!==undefined',null,{timeout:20000});
await p.waitForTimeout(800);

const idle = await p.evaluate(()=>window.__cloak.energy());
const shots = [];
const snap = async (label) => shots.push([label, await p.screenshot({type:'jpeg', quality:80})]);
await snap('at rest');

// Grab low and to the right of centre, where the hem hangs.
await p.mouse.move(560, 430); await p.mouse.down();
for (let i=1;i<=12;i++) { await p.mouse.move(560-i*22, 430-i*16); await p.waitForTimeout(28); }
await snap('dragged');
const dragged = await p.evaluate(()=>window.__cloak.energy());
await p.mouse.up();
await p.waitForTimeout(350); await snap('released');
await p.waitForTimeout(2600);
await snap('settled');
const after = await p.evaluate(()=>window.__cloak.energy());
console.log(`energy while dragged ${dragged.toFixed(4)} -> 3s after release ${after.toFixed(4)}`);
console.log(dragged > 0.02 ? 'drag moved the cloth' : 'WARNING: drag had no effect');
console.log(`idle energy is ${idle.toFixed(4)} (the levitation drift)`);
console.log(`settled to ${(after/idle).toFixed(1)}x idle` + (after < idle*3 ? '  — returned to rest' : '  — WARNING: did not return'));

const strip = await ctx.newPage();
await strip.setViewportSize({width:1300,height:250});
await strip.setContent(`<body style="margin:0;background:#151515;display:flex;font:10px monospace;color:#aaa">
${shots.map(([l,f])=>`<div style="flex:1"><div style="padding:3px">${l}</div><img src="data:image/jpeg;base64,${f.toString('base64')}" style="width:100%"></div>`).join('')}</body>`);
await strip.screenshot({path:path.join(HERE,'out-interact.png')});
await b.close();
