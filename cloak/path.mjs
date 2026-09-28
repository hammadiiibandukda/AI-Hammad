// node path.mjs [FOLLOW json] [png] [CARPET json]
// Films the cloak following the pointer along a curving path: an S-bend,
// a loop, a stop while still held, then letting go. The pointer is paced in
// simulated time, so the film shows what a real-time browser would.
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
if (process.argv[2]) await p.evaluate(k=>window.__cloak.follow(k), JSON.parse(process.argv[2]));
if (process.argv[4]) await p.evaluate(k=>window.__cloak.tune(k), JSON.parse(process.argv[4]));
await p.evaluate(()=>document.getElementById('hint').style.display='none');
// Pull the camera back so the whole flight stays in frame, and trace the
// pointer's route over it so you can see whether the cloak keeps to it.
const zoom = +(process.env.ZOOM || 0.55);
await p.evaluate((z)=>{
  window.__cloak.setZoom(z);
  const c = document.createElement('canvas'); c.width = innerWidth; c.height = innerHeight;
  c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9';
  document.body.appendChild(c); const g = c.getContext('2d'); g.fillStyle = 'rgba(19,15,2,.55)';
  addEventListener('pointermove', e => { g.beginPath(); g.arc(e.clientX, e.clientY, 1.6, 0, 7); g.fill(); }, true);
}, zoom);
const clock = () => p.evaluate(()=>window.__cloak.clock());
const until = (t) => p.waitForFunction(`window.__cloak.clock() >= ${t}`, null, {polling:'raf', timeout:60000});
await until(await clock() + 1.5);

// The pointer's route, in pixels, one point per 1/30s of simulated time.
const route = [];
const Z = +(process.env.ZOOM || 0.55), C = [480, 300];
const S = [C[0] + (500-C[0])*Z, C[1] + (400-C[1])*Z];   // take hold low on the body
for (let i = 0; i <= 30; i++) { const u = i/30; route.push([S[0] - 330*u, S[1] - 230*Math.sin(u*Math.PI)*0.9 + 40*u]); }   // swoop up and left
const [lx, ly] = route[route.length-1];
for (let i = 1; i <= 40; i++) { const a = i/40*2*Math.PI; route.push([lx + 140*Math.sin(a) + 330*i/40, ly - 120*(1-Math.cos(a)) + 20*i/40]); }  // a loop, drifting right
const [ex, ey] = route[route.length-1];
for (let i = 1; i <= 20; i++) route.push([ex + 180*i/20, ey + 90*Math.sin(i/20*Math.PI)]);           // an S out to the right

const shots = []; let worst = 0;
const snap = async (label) => { worst = Math.max(worst, await p.evaluate(()=>window.__cloak.overlap()));
  shots.push([label, await p.screenshot({type:'jpeg', quality:80})]); };
await p.mouse.move(...S); await p.mouse.down();
let t;
for (let k = 0; k < route.length; k++) {
  await p.mouse.move(...route[k]);
  t = await clock() + 1/30; await until(t);        // one step per 1/30s of simulation, however long that takes here
  if (k % 9 === 4) await snap(`${(k/30).toFixed(1)}s held`);
}
t = await clock();
t += 0.8; await until(t); await snap('stopped, 0.8s');
t += 1.2; await until(t); await snap('stopped, 2s');
const stopped = await p.evaluate(()=>window.__cloak.feel().creaseMax);
const upright = await p.evaluate(()=>window.__cloak.heading()*180/Math.PI);
await p.mouse.up();
const let_go = await clock();
for (const s of [0.3, 0.7, 1.2, 2.0, 3.0]) { await until(let_go + s); await snap(`let go +${s}s`); }
const st = await p.evaluate(()=>({ off: window.__cloak.offHome(), feel: window.__cloak.feel(), mode: window.__cloak.following() }));
console.log(`worst self-intersection: ${(worst*100).toFixed(1)}%`);
console.log(`2s after stopping, still held: turned ${upright.toFixed(1)}° from upright, sharpest fold ${stopped.toFixed(1)}°`);
console.log(`3s after letting go: ${(st.off*100).toFixed(1)}% off the logo pose, ${st.mode}`);

const sheet = await ctx.newPage();
await sheet.setViewportSize({width:1500,height:500});
await sheet.setContent(`<body style="margin:0;background:#151515;color:#aaa;font:10px monospace">
<div style="display:flex;flex-wrap:wrap">${shots.map(([l,f])=>`<div style="width:20%;box-sizing:border-box;padding:2px">
<div style="padding:2px">${l}</div><img src="data:image/jpeg;base64,${f.toString('base64')}" style="width:100%;display:block"></div>`).join('')}</div></body>`);
await sheet.screenshot({path:path.join(HERE, process.argv[3] || 'out-path.png'), fullPage:true});
await b.close();
