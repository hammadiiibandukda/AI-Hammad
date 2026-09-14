// The loader is a turntable. Measuring each frame's silhouette gives the
// object's real proportions at every angle — the reference the depth needs.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
const HERE='/home/user/AI-Hammad/cloak'; const S=400;
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({viewport:{width:S,height:S}})).newPage();
await p.setContent(`<body style="margin:0;background:#FBF8EF"><div id="a" style="width:${S}px;height:${S}px"></div></body>`);
await p.addScriptTag({ content: fs.readFileSync(path.join(HERE,'vendor/lottie.min.js'),'utf8') });
await p.evaluate((d)=>{ window.anim = lottie.loadAnimation({ container: document.getElementById('a'),
  renderer:'svg', loop:false, autoplay:false, animationData:d }); },
  JSON.parse(fs.readFileSync(path.join(HERE,'reference-loader.json'),'utf8')));

const rows = [];
for (let f=0; f<45; f++) {
  await p.evaluate((fr)=>window.anim.goToAndStop(fr, true), f);
  await p.waitForTimeout(40);
  const shot = (await p.screenshot()).toString('base64');
  const box = await p.evaluate(async ([b64,s])=>{
    const img=new Image(); img.src='data:image/png;base64,'+b64; await img.decode();
    const c=document.createElement('canvas'); c.width=s; c.height=s;
    const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
    const d=g.getImageData(0,0,s,s).data;
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,n=0;
    for (let y=0;y<s;y++) for (let x=0;x<s;x++) {
      const i=(y*s+x)*4;
      if (Math.abs(d[i]-0xFB)+Math.abs(d[i+1]-0xF8)+Math.abs(d[i+2]-0xEF) < 40) continue;
      n++; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
    }
    return n ? { w:x1-x0, h:y1-y0, area:n, x0, y0 } : null;
  }, [shot, S]);
  rows.push([f, box]);
}
const w0 = rows[0][1].w, a0 = rows[0][1].area;
console.log('frame  width  height   area%   width% of frame 0');
for (const [f,b] of rows) {
  if (!b) { console.log(String(f).padStart(4), '   (empty)'); continue; }
  console.log(String(f).padStart(4), String(b.w).padStart(6), String(b.h).padStart(7),
              (100*b.area/a0).toFixed(1).padStart(7), (100*b.w/w0).toFixed(1).padStart(8));
}
const min = rows.filter(r=>r[1]).reduce((m,r)=> r[1].area < m[1].area ? r : m);
console.log(`\nnarrowest at frame ${min[0]}: width ${min[1].w}px (${(100*min[1].w/w0).toFixed(1)}% of the rest width), area ${(100*min[1].area/a0).toFixed(1)}%`);
await b.close();
