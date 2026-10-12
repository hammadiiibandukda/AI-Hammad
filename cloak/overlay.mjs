import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadLogo, hex } from './logo.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOGO = loadLogo();
const W = 848, H = Math.round(W * LOGO.box.h / LOGO.box.w);
const knobs = fs.existsSync(path.join(HERE,'fitted-knobs.json'))
  ? JSON.parse(fs.readFileSync(path.join(HERE,'fitted-knobs.json'),'utf8')) : null;

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:1 });
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
await p.route('https://cdn.jsdelivr.net/**', r=>r.fulfill({contentType:'text/javascript',
  body: fs.readFileSync(path.join(HERE,'vendor',path.basename(new URL(r.request().url()).pathname)),'utf8')}));
await p.goto('file://'+path.join(HERE,'cloak.html'));
await p.waitForFunction('window.__cloak!==undefined',null,{timeout:20000});
if (knobs) await p.evaluate(k=>window.__cloak.setKnobs(k), knobs);
await p.evaluate(([w,h])=>window.__cloak.homeView(w,h),[W,H]);
const shot = (await p.screenshot({clip:{x:0,y:0,width:W,height:H}})).toString('base64');

const o = await ctx.newPage();
await o.setViewportSize({width:W*2, height:H+26});
await o.setContent(`<body style="margin:0;background:#111"><canvas id=a width=${W} height=${H}></canvas><canvas id=b width=${W} height=${H}></canvas></body>`);
await o.evaluate(async ([w,h,logo,shotB64,face,lining])=>{
  const ref=document.getElementById('a'), g=ref.getContext('2d');
  g.fillStyle='#FBF8EF'; g.fillRect(0,0,w,h);
  const s=w/logo.box.w; g.setTransform(s,0,0,s,-logo.box.x*s,-logo.box.y*s);
  g.fillStyle=logo.lining.fill; g.fill(new Path2D(logo.lining.d));
  g.fillStyle=logo.face.fill; g.fill(new Path2D(logo.face.d));
  g.setTransform(1,0,0,1,0,0);
  const img=new Image(); img.src='data:image/png;base64,'+shotB64; await img.decode();
  const d=document.getElementById('b'), dg=d.getContext('2d');
  dg.drawImage(img,0,0);
  const R=g.getImageData(0,0,w,h).data, G=dg.getImageData(0,0,w,h).data;
  const out=dg.createImageData(w,h);
  const cls=(a,i)=>{const dp=(a[i]-0xFB)**2+(a[i+1]-0xF8)**2+(a[i+2]-0xEF)**2,
                     df=(a[i]-face[0])**2+(a[i+1]-face[1])**2+(a[i+2]-face[2])**2,
                     db=(a[i]-lining[0])**2+(a[i+1]-lining[1])**2+(a[i+2]-lining[2])**2;
                     return (dp<=df&&dp<=db)?0:(df<=db?1:2);};
  for(let i=0;i<w*h;i++){
    const r=cls(R,i*4), q=cls(G,i*4); let c=[250,248,239];
    if(r===q&&r>0) c=[190,205,190];                 // agree
    else if(r===0&&q>0) c=[255,0,200];              // we painted outside the artwork
    else if(r>0&&q===0) c=[0,190,230];              // artwork has ink we are missing
    else if(r===1&&q===2) c=[120,60,200];           // dark where it should be orange
    else if(r===2&&q===1) c=[255,190,0];            // orange where it should be dark
    out.data[i*4]=c[0]; out.data[i*4+1]=c[1]; out.data[i*4+2]=c[2]; out.data[i*4+3]=255;
  }
  dg.putImageData(out,0,0);
}, [W,H,LOGO,shot,hex(LOGO.face.fill),hex(LOGO.lining.fill)]);
await o.screenshot({path:'out-overlay.png'});
await b.close();
