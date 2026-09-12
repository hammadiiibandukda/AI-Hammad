import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
const HERE='/home/user/AI-Hammad/cloak'; const W=760,H=513;
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:1 });
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
p.on('console', m=>{ if(m.type()==='error') console.log('CONSOLE', m.text()); });
await p.route('https://cdn.jsdelivr.net/**', r=>r.fulfill({contentType:'text/javascript',
  body: fs.readFileSync(path.join(HERE,'vendor',path.basename(new URL(r.request().url()).pathname)),'utf8')}));
await p.goto('file://'+path.join(HERE,'cloak.html'));
await p.waitForFunction('window.__cloak!==undefined',null,{timeout:20000});
await p.waitForTimeout(500);

const views = [];
await p.evaluate(([w,h])=>window.__cloak.homeView(w,h), [W,H]);
views.push(['home (should be the logo)', await p.screenshot({type:'jpeg',quality:86})]);
for (const [label, th, ph] of [['orbit left 40°',-0.70,0.10],['from below 35°',0.0,-0.62],['behind',Math.PI*0.92,0.12],['top-right',0.85,0.55]]) {
  await p.evaluate(([t,f])=>window.__cloak.orbit(t,f), [th,ph]);
  views.push([label, await p.screenshot({type:'jpeg',quality:86})]);
}
// What colour is the interior of the fold, really? Decode the home shot we
// already captured rather than reading the live WebGL buffer, which is not
// preserved between frames.
await p.evaluate(([w,h])=>window.__cloak.homeView(w,h),[W,H]);
await p.waitForTimeout(140);
const homeShot = (await p.screenshot({clip:{x:0,y:0,width:W,height:H}})).toString('base64');
const probe = await p.evaluate(async ([b64,w,h])=>{
  const img=new Image(); img.src='data:image/png;base64,'+b64; await img.decode();
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(img,0,0);
  const d=g.getImageData(0,0,w,h).data;
  const region=(x0,x1,y0,y1)=>{ let r=0,gg=0,bb=0,n=0;
    for (let y=Math.floor(h*y0); y<h*y1; y++) for (let x=Math.floor(w*x0); x<w*x1; x++) {
      const i=(y*w+x)*4;
      if (Math.abs(d[i]-0xFB)+Math.abs(d[i+1]-0xF8)+Math.abs(d[i+2]-0xEF) < 40) continue;
      r+=d[i]; gg+=d[i+1]; bb+=d[i+2]; n++; }
    return n?[Math.round(r/n),Math.round(gg/n),Math.round(bb/n),n]:null; };
  return { fold: region(0.08,0.30,0.66,0.90), body: region(0.45,0.70,0.25,0.55) };
}, [homeShot,W,H]);
const hex=(a)=>a?'#'+a.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase():'n/a';
console.log(`fold interior  ${hex(probe.fold)}   (artwork draws it #D0470C)`);
console.log(`lit body       ${hex(probe.body)}   (silk is #FF6625)`);

const strip = await ctx.newPage();
await strip.setViewportSize({width:1340,height:560});
await strip.setContent(`<body style="margin:0;background:#141410;color:#999;font:10px monospace;display:flex;flex-wrap:wrap">
${views.map(([l,f])=>`<div style="width:33.33%"><div style="padding:3px">${l}</div><img src="data:image/jpeg;base64,${f.toString('base64')}" style="width:100%"></div>`).join('')}</body>`);
await strip.screenshot({path:path.join(HERE,'out-views.png')});
await b.close();
