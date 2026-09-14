// Renders the same four orthographic views as the reference sheet, so the
// model's depth can be compared against it directly rather than guessed at.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
const HERE='/home/user/AI-Hammad/cloak'; const W=520, H=Math.round(520*0.675/1.0);  // artwork aspect
const knobs = process.argv[2] ? JSON.parse(process.argv[2]) : null;
const tag = process.argv[3] || '';

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({viewport:{width:W,height:H}, deviceScaleFactor:1});
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
await p.route('https://cdn.jsdelivr.net/**', r=>r.fulfill({contentType:'text/javascript',
  body: fs.readFileSync(path.join(HERE,'vendor',path.basename(new URL(r.request().url()).pathname)),'utf8')}));
await p.goto('file://'+path.join(HERE,'cloak.html'));
await p.waitForFunction('window.__cloak!==undefined',null,{timeout:20000});
if (knobs) await p.evaluate(k=>window.__cloak.setKnobs(k), knobs);
await p.evaluate(([w,h])=>window.__cloak.homeView(w,h),[W,H]);
await p.evaluate(()=>{ document.getElementById('hint').style.display='none'; window.__cloak.setZoom(0.5); });

// Measure the silhouette of each view so depth can be compared as a number.
const measure = async () => {
  await p.waitForTimeout(120);
  const shot = (await p.screenshot({clip:{x:0,y:0,width:W,height:H}})).toString('base64');
  const box = await p.evaluate(async ([b64,w,h])=>{
    const img=new Image(); img.src='data:image/png;base64,'+b64; await img.decode();
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
    const d=g.getImageData(0,0,w,h).data;
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      const i=(y*w+x)*4;
      if (Math.abs(d[i]-0xFB)+Math.abs(d[i+1]-0xF8)+Math.abs(d[i+2]-0xEF) < 40) continue;
      if (x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
    }
    return x1<x0 ? null : { w:x1-x0, h:y1-y0 };
  }, [shot,W,H]);
  return { shot, box };
};

const views = [];
for (const [label, th, ph] of [['FRONT',0,0], ['BACK',Math.PI,0], ['SIDE (from left)',-Math.PI/2,0], ['SIDE (from right)',Math.PI/2,0]]) {
  if (th !== 0) await p.evaluate(([t,f])=>window.__cloak.orbit(t,f),[th,ph]);
  else await p.evaluate(()=>window.__cloak.setZoom(0.5));
  const m = await measure();
  views.push([label, m.shot, m.box]);
}
const front = views[0][2], side = views[2][2];
console.log(`front silhouette  ${front.w} x ${front.h} px`);
console.log(`side silhouette   ${side.w} x ${side.h} px`);
console.log(`depth / width = ${(side.w/front.w).toFixed(3)}${tag ? '   ['+tag+']' : ''}`);

const sheet = await ctx.newPage();
await sheet.setViewportSize({width:1120, height:960});
await sheet.setContent(`<body style="margin:0;background:#1b1b18;color:#999;font:12px monospace">
<div style="padding:8px 10px;color:#FF9A6A">${tag || 'current model'} — orthographic views, same scale</div>
<div style="display:flex;flex-wrap:wrap">
${views.map(([l,s,box])=>`<div style="width:50%;box-sizing:border-box;padding:4px">
<div style="padding:3px">${l} &nbsp;<span style="color:#666">${box.w}×${box.h}</span></div>
<img src="data:image/png;base64,${s}" style="width:100%;display:block"></div>`).join('')}
</div></body>`);
await sheet.screenshot({path:path.join(HERE,'out-ortho'+(tag?'-'+tag:'')+'.png'), fullPage:true});
await b.close();
