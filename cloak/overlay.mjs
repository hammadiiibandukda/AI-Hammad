import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const W=848,H=573;
const MAIN='M127.746 146.09C146.728 147.541 155.137 139.361 157.136 136.943C157.136 136.943 145.802 123.19 139.125 113.962C134.576 107.679 128.751 98.7473 125.415 93.5611C124.23 91.7177 121.397 91.793 120.189 93.6256C107.794 112.371 84.9689 126.425 79.8496 129.134C83.8965 127.532 91.2791 132.525 101.275 137.856C101.275 137.856 108.697 141.532 113.726 143.236C120.172 145.418 127.752 146.095 127.752 146.095L127.746 146.09Z';
const DARK='M97.2728 149C97.2728 149 72.2972 140.278 77.789 131.071C81.2884 125.256 89.2806 131.555 101.766 137.854L97.2671 149H97.2728Z';
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
await o.evaluate(async ([w,h,main,dark,shotB64])=>{
  const ref=document.getElementById('a'), g=ref.getContext('2d');
  g.fillStyle='#FBF8EF'; g.fillRect(0,0,w,h);
  const s=w/84.8388; g.setTransform(s,0,0,s,-72.2972*s,-91.7177*s);
  g.fillStyle='#D0470C'; g.fill(new Path2D(dark));
  g.fillStyle='#FF6625'; g.fill(new Path2D(main));
  g.setTransform(1,0,0,1,0,0);
  const img=new Image(); img.src='data:image/png;base64,'+shotB64; await img.decode();
  const d=document.getElementById('b'), dg=d.getContext('2d');
  dg.drawImage(img,0,0);
  const R=g.getImageData(0,0,w,h).data, G=dg.getImageData(0,0,w,h).data;
  const out=dg.createImageData(w,h);
  const cls=(a,i)=>{const dp=(a[i]-0xFB)**2+(a[i+1]-0xF8)**2+(a[i+2]-0xEF)**2,
                     df=(a[i]-0xFF)**2+(a[i+1]-0x66)**2+(a[i+2]-0x25)**2,
                     db=(a[i]-0xD0)**2+(a[i+1]-0x47)**2+(a[i+2]-0x0C)**2;
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
}, [W,H,MAIN,DARK,shot]);
await o.screenshot({path:'out-overlay.png'});
await b.close();
