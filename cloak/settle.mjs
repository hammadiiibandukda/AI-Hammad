// Traces how the carpet comes home after a big drag: decaying (just slow) or
// plateaued (stuck in a pose it can't get out of).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
const HERE='/home/user/AI-Hammad/cloak';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({viewport:{width:900,height:620}});
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
await p.route('https://cdn.jsdelivr.net/**', r=>r.fulfill({contentType:'text/javascript',
  body: fs.readFileSync(path.join(HERE,'vendor',path.basename(new URL(r.request().url()).pathname)),'utf8')}));
await p.goto('file://'+path.join(HERE,'cloak.html'));
await p.waitForFunction('window.__cloak!==undefined',null,{timeout:20000});
await p.waitForFunction('!window.__cloak.flying()', null, {timeout:40000});   // let the entrance land
if (process.argv[2]) await p.evaluate(k=>window.__cloak.tune(k), JSON.parse(process.argv[2]));
await p.waitForTimeout(1200);
const idle = await p.evaluate(()=>window.__cloak.energy());
// Simulated seconds throughout: a slow headless frame slows the physics too.
const later = async (s) => { const t = await p.evaluate(()=>window.__cloak.clock()) + s;
  await p.waitForFunction(`window.__cloak.clock() >= ${t}`, null, {polling:'raf', timeout:60000}); };
await p.mouse.move(560, 430); await p.mouse.down();
for (let i=1;i<=12;i++) { await p.mouse.move(560-i*22, 430-i*16); await later(1/30); }
await p.mouse.up();
const trace=[];
for (let i=0;i<24;i++) { await later(0.25); trace.push(await p.evaluate(()=>window.__cloak.energy())/idle); }
console.log(`${process.argv[2]||'current'}`);
console.log('  x idle, every 250ms: ' + trace.map(v=>v.toFixed(1)).join(' '));
const at = trace.findIndex(v=>v<2); console.log(at>=0 ? `  within 2x idle after ${((at+1)*0.25).toFixed(2)}s` : '  never within 2x idle in 6s');
if (process.argv[3]) await p.screenshot({path: path.join(HERE, process.argv[3])});
await b.close();
