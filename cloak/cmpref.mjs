// Does the loader's rest frame actually agree with the SVG I was given?
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
const HERE='/home/user/AI-Hammad/cloak'; const S=600;
const MAIN='M127.746 146.09C146.728 147.541 155.137 139.361 157.136 136.943C157.136 136.943 145.802 123.19 139.125 113.962C134.576 107.679 128.751 98.7473 125.415 93.5611C124.23 91.7177 121.397 91.793 120.189 93.6256C107.794 112.371 84.9689 126.425 79.8496 129.134C83.8965 127.532 91.2791 132.525 101.275 137.856C101.275 137.856 108.697 141.532 113.726 143.236C120.172 145.418 127.752 146.095 127.752 146.095L127.746 146.09Z';
const DARK='M97.2728 149C97.2728 149 72.2972 140.278 77.789 131.071C81.2884 125.256 89.2806 131.555 101.766 137.854L97.2671 149H97.2728Z';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({viewport:{width:S,height:S}});
const p = await ctx.newPage();
await p.setContent(`<body style="margin:0;background:#FBF8EF"><div id="a" style="width:${S}px;height:${S}px"></div></body>`);
await p.addScriptTag({ content: fs.readFileSync(path.join(HERE,'vendor/lottie.min.js'),'utf8') });
await p.evaluate((d)=>{ window.anim = lottie.loadAnimation({ container: document.getElementById('a'),
  renderer:'svg', loop:false, autoplay:false, animationData:d }); },
  JSON.parse(fs.readFileSync(path.join(HERE,'reference-loader.json'),'utf8')));
await p.evaluate(()=>window.anim.goToAndStop(0, true));
await p.waitForTimeout(120);
const loader = (await p.screenshot()).toString('base64');

// Normalise both to their bounding boxes, then overlay.
const res = await p.evaluate(async ([b64,s,main,dark])=>{
  const load = async (src)=>{ const i=new Image(); i.src=src; await i.decode(); return i; };
  const maskOf = (ctx2,s)=>{ const d=ctx2.getImageData(0,0,s,s).data; const m=new Uint8Array(s*s);
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
    for (let y=0;y<s;y++) for (let x=0;x<s;x++){ const i=(y*s+x)*4;
      const ink = d[i+3]>100 && (Math.abs(d[i]-0xFB)+Math.abs(d[i+1]-0xF8)+Math.abs(d[i+2]-0xEF) > 40);
      if (ink){ m[y*s+x]=1; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } }
    return {m,x0,x1,y0,y1}; };

  const c1=document.createElement('canvas'); c1.width=c1.height=s;
  const g1=c1.getContext('2d',{willReadFrequently:true});
  g1.fillStyle='#FBF8EF'; g1.fillRect(0,0,s,s);
  g1.drawImage(await load('data:image/png;base64,'+b64),0,0);
  const A = maskOf(g1,s);

  const c2=document.createElement('canvas'); c2.width=c2.height=s;
  const g2=c2.getContext('2d',{willReadFrequently:true});
  g2.fillStyle='#FBF8EF'; g2.fillRect(0,0,s,s);
  const k=s/90; g2.setTransform(k,0,0,k,-70*k,-88*k);
  g2.fillStyle='#D0470C'; g2.fill(new Path2D(dark));
  g2.fillStyle='#FF6625'; g2.fill(new Path2D(main));
  g2.setTransform(1,0,0,1,0,0);
  const B = maskOf(g2,s);

  // Rescale B's box onto A's box and compare
  const aw=A.x1-A.x0, ah=A.y1-A.y0, bw=B.x1-B.x0, bh=B.y1-B.y0;
  let inter=0, uni=0;
  for (let y=0;y<ah;y++) for (let x=0;x<aw;x++) {
    const av = A.m[(A.y0+y)*s + (A.x0+x)];
    const bx = B.x0 + Math.round(x*bw/aw), by = B.y0 + Math.round(y*bh/ah);
    const bv = B.m[by*s+bx];
    if (av||bv) uni++; if (av&&bv) inter++;
  }
  return { iou: inter/uni, loaderAspect: aw/ah, svgAspect: bw/bh };
}, [loader, S, MAIN, DARK]);
console.log(`loader frame 0 vs the SVG mark, both normalised to their bounding box:`);
console.log(`  silhouette IoU ${(res.iou*100).toFixed(1)}%`);
console.log(`  aspect  loader ${res.loaderAspect.toFixed(3)}   svg ${res.svgAspect.toFixed(3)}`);
await b.close();
