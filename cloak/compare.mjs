// Renders the two readings of the fold side by side: rolled away from the
// viewer, and rolled toward it. The fit scores are close enough that this is
// an eye call, not a metric one.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
const HERE='/home/user/AI-Hammad/cloak'; const W=620,H=420;

const BACKWARD = { curlSign: 1, leftBack:0.601, leftPow:2.3262, backDepth:0.92, curlLen:1.0024,
  curlEndFrac:0.8828, curlTaper:3.2, curlAngle:5.0917, curlAngleEnd:0.7145, curlEase:1.2788,
  curlOpen:0.4943, curlLift:0.954, curlAxis:-1.768 };
const FORWARD = { curlSign:-1, leftBack:0.1654, leftPow:4.709, backDepth:0.6632, curlLen:1.2243,
  curlEndFrac:0.6407, curlTaper:1.9142, curlAngle:5.1547, curlAngleEnd:0.5569, curlEase:1.2867,
  curlOpen:0.5909, curlLift:1.2746, curlAxis:1.7202 };

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({viewport:{width:W,height:H}, deviceScaleFactor:1});
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
await p.route('https://cdn.jsdelivr.net/**', r=>r.fulfill({contentType:'text/javascript',
  body: fs.readFileSync(path.join(HERE,'vendor',path.basename(new URL(r.request().url()).pathname)),'utf8')}));
await p.goto('file://'+path.join(HERE,'cloak.html'));
await p.waitForFunction('window.__cloak!==undefined',null,{timeout:20000});

const rows = [];
for (const [label, knobs] of [['rolled AWAY from viewer', BACKWARD], ['rolled TOWARD viewer', FORWARD]]) {
  const shots = [];
  await p.evaluate((k)=>window.__cloak.setKnobs(k), knobs);
  await p.evaluate(([w,h])=>window.__cloak.homeView(w,h),[W,H]);
  await p.waitForTimeout(130);
  shots.push(await p.screenshot({type:'jpeg',quality:88}));
  for (const [th,ph] of [[-0.55,0.12],[0.10,-0.55]]) {
    await p.evaluate(([t,f])=>window.__cloak.orbit(t,f),[th,ph]);
    await p.waitForTimeout(130);
    shots.push(await p.screenshot({type:'jpeg',quality:88}));
  }
  rows.push([label, shots]);
}

const ref = `<svg width="${W}" height="${H}" viewBox="60 86 109 68" style="background:#FBF8EF">
<path d="M97.2728 149C97.2728 149 72.2972 140.278 77.789 131.071C81.2884 125.256 89.2806 131.555 101.766 137.854L97.2671 149H97.2728Z" fill="#D0470C"/>
<path d="M127.746 146.09C146.728 147.541 155.137 139.361 157.136 136.943C157.136 136.943 145.802 123.19 139.125 113.962C134.576 107.679 128.751 98.7473 125.415 93.5611C124.23 91.7177 121.397 91.793 120.189 93.6256C107.794 112.371 84.9689 126.425 79.8496 129.134C83.8965 127.532 91.2791 132.525 101.275 137.856C101.275 137.856 108.697 141.532 113.726 143.236C120.172 145.418 127.752 146.095 127.752 146.095L127.746 146.09Z" fill="#FF6625"/></svg>`;

const sheet = await ctx.newPage();
await sheet.setViewportSize({width:1340, height:640});
await sheet.setContent(`<body style="margin:0;background:#1b1b18;color:#aaa;font:11px monospace">
<div style="display:flex;align-items:center"><div style="width:25%;padding:6px">the artwork</div></div>
<div style="display:flex"><div style="width:25%">${ref.replace(`width="${W}" height="${H}"`,'width="100%"')}</div>
<div style="width:75%;padding:8px;line-height:1.7">left column = head-on (the logo view)<br>middle = orbited left<br>right = seen from below, looking into the cone</div></div>
${rows.map(([l,shots])=>`<div style="padding:6px 8px;color:#FF9A6A">${l}</div>
<div style="display:flex">${shots.map(f=>`<div style="width:33.33%"><img src="data:image/jpeg;base64,${f.toString('base64')}" style="width:100%"></div>`).join('')}</div>`).join('')}
</body>`);
await sheet.screenshot({path:path.join(HERE,'out-fold-compare.png'), fullPage:true});
await b.close();
console.log('ok');
