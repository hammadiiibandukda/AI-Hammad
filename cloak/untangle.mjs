// The untangling safeguard: a released carpet that keeps touching itself
// should drop collision after a moment, and pick it back up once clear.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
const HERE='/home/user/AI-Hammad/cloak';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({viewport:{width:900,height:620}})).newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
await p.route('https://cdn.jsdelivr.net/**', r=>r.fulfill({contentType:'text/javascript',
  body: fs.readFileSync(path.join(HERE,'vendor',path.basename(new URL(r.request().url()).pathname)),'utf8')}));
await p.goto('file://'+path.join(HERE,'cloak.html'));
await p.waitForFunction('window.__cloak!==undefined',null,{timeout:20000});
await p.waitForFunction('!window.__cloak.flying()', null, {timeout:40000});
await p.waitForTimeout(600);
const st = () => p.evaluate(()=>({ un: window.__cloak.untangling(), pairs: window.__cloak.pairs() }));
console.log('settled          ', JSON.stringify(await st()));
// Make the solver report self-contact while the carpet sits released, the
// way a real tangle would, and watch the switch.
await p.evaluate(()=>{
  const c = window.__cloak._cloth;
  c._realPairs = c.buildPairs;
  c.buildPairs = function () { this._realPairs(); this.pairCount = Math.max(this.pairCount, 3); };
  window.__cloak.poke(0.3);       // keep it moving, so the broad phase runs
});
// A real tangle holds the carpet away from rest, so keep it stirred the way
// being stuck would. Headless frames are slow and dt is capped, so give the
// switch simulated time rather than wall-clock time.
const stir = async (ms) => { for (let t=0; t<ms; t+=150) { await p.evaluate(()=>window.__cloak.poke(0.25)); await p.waitForTimeout(150); } };
await stir(300);   console.log('touching, early  ', JSON.stringify(await st()), ' <- still colliding');
await stir(2600);  console.log('touching, later  ', JSON.stringify(await st()), ' <- should be untangling');
await p.evaluate(()=>{ const c = window.__cloak._cloth; c.buildPairs = c._realPairs; });
await p.waitForTimeout(500);  console.log('clear again      ', JSON.stringify(await st()), ' <- colliding again');
await b.close();
