// Pokes the cloth and watches it settle: does it stay stable, does it come all
// the way home, and how long does that take.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogo, hex } from './logo.mjs';
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
await p.waitForFunction('!window.__cloak.flying()', null, {timeout:40000});   // let the entrance land
await p.waitForTimeout(1200);

const idleMs = await p.evaluate(()=>window.__cloak.frameMs());
const idle = await p.evaluate(()=>window.__cloak.energy());
console.log(`idle frame cost           ${idleMs.toFixed(1)}ms (software GL)`);
console.log(`idle energy (levitating)  ${idle.toFixed(5)}`);

await p.evaluate(()=>window.__cloak.poke(1));
const frames = [];
const trace = [];
const overlaps = [];
for (let i=0;i<26;i++) {
  const e = await p.evaluate(()=>window.__cloak.energy());
  const ov = await p.evaluate(()=>window.__cloak.overlap());
  trace.push(e); overlaps.push(ov);
  if ([0,1,2,4,7,12,20].includes(i)) frames.push(await p.screenshot({ type:'jpeg', quality:78 }));
  await p.waitForTimeout(100);
}
console.log('settle trace (energy every 100ms):');
console.log('  ' + trace.map(v=>v.toFixed(4)).join(' '));
// Visually at rest = mean displacement under 0.2% of the mark's width.
const settled = trace.findIndex((v,i)=> i>2 && v < idle*1.8);
console.log(settled>=0 ? `visually settled after ~${(settled*0.1).toFixed(1)}s` : 'DID NOT SETTLE');
console.log(`finite: ${trace.every(Number.isFinite)}   max energy: ${Math.max(...trace).toFixed(4)}`);
const worstOverlap = Math.max(...overlaps);
console.log(`worst self-intersection during the throw: ${(worstOverlap*100).toFixed(1)}% of fabric thickness`);
console.log(worstOverlap < 0.25 ? 'cloth stayed out of itself' : 'WARNING: cloth passed through itself');
console.log(`collision pairs tracked: ${await p.evaluate(()=>window.__cloak.pairs())}`);
console.log(`frame cost: ${(await p.evaluate(()=>window.__cloak.frameMs())).toFixed(1)}ms (software GL; real GPU far lower)`);
console.log(`mesh: ${await p.evaluate(()=>JSON.stringify(window.__cloak.stats))}`);

// The real question: after all that, is it the logo again?
const LOGO = loadLogo();
const W=848, H=Math.round(W*LOGO.box.h/LOGO.box.w);
await p.setViewportSize({width:W,height:H});
const back = await p.evaluate(([w,h,logo,face,lining])=>{
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const g=c.getContext('2d',{willReadFrequently:true});
  g.fillStyle='#FBF8EF'; g.fillRect(0,0,w,h);        // page colour, or transparent reads as ink
  const s=w/logo.box.w; g.setTransform(s,0,0,s,-logo.box.x*s,-logo.box.y*s);
  g.fillStyle=logo.lining.fill; g.fill(new Path2D(logo.lining.d)); g.fillStyle=logo.face.fill; g.fill(new Path2D(logo.face.d));
  const R=g.getImageData(0,0,w,h).data;
  window.__cloak.homeView(w,h,true);   // keep whatever it settled into
  const b=document.createElement('canvas'); b.width=w; b.height=h;
  const bg=b.getContext('2d',{willReadFrequently:true});
  bg.drawImage(document.getElementById('stage'),0,0,w,h);
  const G=bg.getImageData(0,0,w,h).data;
  const cl=(a,i)=>{const dp=(a[i]-0xFB)**2+(a[i+1]-0xF8)**2+(a[i+2]-0xEF)**2,
                    df=(a[i]-face[0])**2+(a[i+1]-face[1])**2+(a[i+2]-face[2])**2,
                    db=(a[i]-lining[0])**2+(a[i+1]-lining[1])**2+(a[i+2]-lining[2])**2;
                    return (dp<=df&&dp<=db)?0:(df<=db?1:2);};
  let ai=0,au=0;
  for(let i=0;i<w*h;i++){const r=cl(R,i*4),q=cl(G,i*4); if(r>0||q>0){au++; if(r>0&&q>0) ai++;}}
  return au?ai/au:0;
}, [W,H,LOGO,hex(LOGO.face.fill),hex(LOGO.lining.fill)]);
console.log(`silhouette after poke + settle: ${(back*100).toFixed(2)}%`);

const strip = await ctx.newPage();
await strip.setViewportSize({width:1330,height:220});
await strip.setContent(`<body style="margin:0;background:#151515;display:flex;font:10px monospace;color:#aaa">
${frames.map((f,i)=>`<div style="flex:1"><div style="padding:2px">+${[0,100,200,400,700,1200,2000][i]}ms</div><img src="data:image/jpeg;base64,${f.toString('base64')}" style="width:100%"></div>`).join('')}</body>`);
await strip.screenshot({path:'out-settle.png'});
await b.close();
