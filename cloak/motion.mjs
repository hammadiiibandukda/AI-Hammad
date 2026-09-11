// Pokes the cloth and watches it settle: does it stay stable, does it come all
// the way home, and how long does that take.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport:{width:900,height:620}, deviceScaleFactor:1 });
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
await p.route('https://cdn.jsdelivr.net/**', r=>r.fulfill({contentType:'text/javascript',
  body: fs.readFileSync(path.join(HERE,'vendor',path.basename(new URL(r.request().url()).pathname)),'utf8')}));
await p.goto('file://'+path.join(HERE,'cloak.html'));
await p.waitForFunction('window.__cloak!==undefined',null,{timeout:20000});
await p.waitForTimeout(1200);

const idleMs = await p.evaluate(()=>window.__cloak.frameMs());
const idle = await p.evaluate(()=>window.__cloak.energy());
console.log(`idle frame cost           ${idleMs.toFixed(1)}ms (software GL)`);
console.log(`idle energy (levitating)  ${idle.toFixed(5)}`);

await p.evaluate(()=>window.__cloak.poke(1));
const frames = [];
const trace = [];
for (let i=0;i<26;i++) {
  const e = await p.evaluate(()=>window.__cloak.energy());
  trace.push(e);
  if ([0,1,2,4,7,12,20].includes(i)) frames.push(await p.screenshot({ type:'jpeg', quality:78 }));
  await p.waitForTimeout(100);
}
console.log('settle trace (energy every 100ms):');
console.log('  ' + trace.map(v=>v.toFixed(4)).join(' '));
// Visually at rest = mean displacement under 0.2% of the mark's width.
const settled = trace.findIndex((v,i)=> i>2 && v < 0.004);
console.log(settled>=0 ? `visually settled after ~${(settled*0.1).toFixed(1)}s` : 'DID NOT SETTLE');
console.log(`finite: ${trace.every(Number.isFinite)}   max: ${Math.max(...trace).toFixed(4)}`);
console.log(`frame cost: ${(await p.evaluate(()=>window.__cloak.frameMs())).toFixed(1)}ms (software GL; real GPU far lower)`);
console.log(`mesh: ${await p.evaluate(()=>JSON.stringify(window.__cloak.stats))}`);

// The real question: after all that, is it the logo again?
const W=848, H=573;
const MAIN='M127.746 146.09C146.728 147.541 155.137 139.361 157.136 136.943C157.136 136.943 145.802 123.19 139.125 113.962C134.576 107.679 128.751 98.7473 125.415 93.5611C124.23 91.7177 121.397 91.793 120.189 93.6256C107.794 112.371 84.9689 126.425 79.8496 129.134C83.8965 127.532 91.2791 132.525 101.275 137.856C101.275 137.856 108.697 141.532 113.726 143.236C120.172 145.418 127.752 146.095 127.752 146.095L127.746 146.09Z';
const DARK='M97.2728 149C97.2728 149 72.2972 140.278 77.789 131.071C81.2884 125.256 89.2806 131.555 101.766 137.854L97.2671 149H97.2728Z';
await p.setViewportSize({width:W,height:H});
const back = await p.evaluate(([w,h,main,dark])=>{
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const g=c.getContext('2d',{willReadFrequently:true});
  g.fillStyle='#FBF8EF'; g.fillRect(0,0,w,h);        // page colour, or transparent reads as ink
  const s=w/84.8388; g.setTransform(s,0,0,s,-72.2972*s,-91.7177*s);
  g.fillStyle='#D0470C'; g.fill(new Path2D(dark)); g.fillStyle='#FF6625'; g.fill(new Path2D(main));
  const R=g.getImageData(0,0,w,h).data;
  window.__cloak.testView(w,h,true);   // keep whatever it settled into
  const b=document.createElement('canvas'); b.width=w; b.height=h;
  const bg=b.getContext('2d',{willReadFrequently:true});
  bg.drawImage(document.getElementById('stage'),0,0,w,h);
  const G=bg.getImageData(0,0,w,h).data;
  const cl=(a,i)=>{const dp=(a[i]-0xFB)**2+(a[i+1]-0xF8)**2+(a[i+2]-0xEF)**2,
                    df=(a[i]-0xFF)**2+(a[i+1]-0x66)**2+(a[i+2]-0x25)**2,
                    db=(a[i]-0xD0)**2+(a[i+1]-0x47)**2+(a[i+2]-0x0C)**2;
                    return (dp<=df&&dp<=db)?0:(df<=db?1:2);};
  let ai=0,au=0;
  for(let i=0;i<w*h;i++){const r=cl(R,i*4),q=cl(G,i*4); if(r>0||q>0){au++; if(r>0&&q>0) ai++;}}
  return au?ai/au:0;
}, [W,H,MAIN,DARK]);
console.log(`silhouette after poke + settle: ${(back*100).toFixed(2)}%`);

const strip = await ctx.newPage();
await strip.setViewportSize({width:1330,height:220});
await strip.setContent(`<body style="margin:0;background:#151515;display:flex;font:10px monospace;color:#aaa">
${frames.map((f,i)=>`<div style="flex:1"><div style="padding:2px">+${[0,100,200,400,700,1200,2000][i]}ms</div><img src="data:image/jpeg;base64,${f.toString('base64')}" style="width:100%"></div>`).join('')}</body>`);
await strip.screenshot({path:'out-settle.png'});
await b.close();
