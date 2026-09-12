import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
const HERE='/home/user/AI-Hammad/cloak';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({viewport:{width:900,height:620}})).newPage();
p.on('pageerror', e=>console.log('PAGEERROR:', e.message));
await p.route('https://cdn.jsdelivr.net/**', r=>r.fulfill({contentType:'text/javascript',
  body: fs.readFileSync(path.join(HERE,'vendor',path.basename(new URL(r.request().url()).pathname)),'utf8')}));
await p.goto('file://'+path.join(HERE,'cloak.html'));
await p.waitForFunction('window.__cloak!==undefined',null,{timeout:20000});
await p.waitForTimeout(1500);
console.log('verts/tris:', await p.evaluate(()=>JSON.stringify(window.__cloak.stats)));
console.log('idle  frame', (await p.evaluate(()=>window.__cloak.frameMs())).toFixed(1)+'ms',
            ' pairs', await p.evaluate(()=>window.__cloak.pairs()));
// Break down where the time goes.
const split = await p.evaluate(()=>window.__cloak.profile(40));
console.log('breakdown (ms/frame, software GL):', JSON.stringify(split));
await p.evaluate(()=>window.__cloak.poke(1));
await p.waitForTimeout(500);
console.log('thrown frame', (await p.evaluate(()=>window.__cloak.frameMs())).toFixed(1)+'ms',
            ' pairs', await p.evaluate(()=>window.__cloak.pairs()),
            ' overlap', (await p.evaluate(()=>window.__cloak.overlap())*100).toFixed(1)+'%');
await b.close();
