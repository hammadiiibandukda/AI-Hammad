// Plays the supplied Lottie loader and samples it, so the reference is
// something we can look at frame by frame rather than infer from JSON.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
const HERE='/home/user/AI-Hammad/cloak'; const S=200;
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({viewport:{width:S,height:S}, deviceScaleFactor:1});
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
await p.setContent(`<body style="margin:0;background:#FBF8EF"><div id="a" style="width:${S}px;height:${S}px"></div></body>`);
await p.addScriptTag({ content: fs.readFileSync(path.join(HERE,'vendor/lottie.min.js'),'utf8') });
const data = JSON.parse(fs.readFileSync(path.join(HERE,'reference-loader.json'),'utf8'));
const info = await p.evaluate((d)=>{
  window.anim = lottie.loadAnimation({ container: document.getElementById('a'),
    renderer:'svg', loop:false, autoplay:false, animationData:d });
  return { totalFrames: window.anim.totalFrames, fr: d.fr };
}, data);
console.log('frames', info.totalFrames, 'fps', info.fr);

const frames = Array.from({length:45},(_,i)=>i);
const shots = [];
for (const f of frames) {
  await p.evaluate((fr)=>window.anim.goToAndStop(fr, true), f);
  await p.waitForTimeout(60);
  shots.push([f, await p.screenshot({type:'png'})]);
}
const sheet = await ctx.newPage();
await sheet.setViewportSize({width:1280, height:1500});
await sheet.setContent(`<body style="margin:0;background:#1b1b18;color:#999;font:11px monospace">
<div style="padding:8px">the supplied loader, frame by frame (24fps, 45 frames)</div>
<div style="display:flex;flex-wrap:wrap">
${shots.map(([f,s])=>`<div style="width:11.11%;box-sizing:border-box;padding:2px">
<div style="padding:2px">frame ${f}</div>
<img src="data:image/png;base64,${s.toString('base64')}" style="width:100%;display:block"></div>`).join('')}
</div></body>`);
await sheet.screenshot({path:path.join(HERE,'out-reference-all.png'), fullPage:true});
await b.close();
console.log('ok');
