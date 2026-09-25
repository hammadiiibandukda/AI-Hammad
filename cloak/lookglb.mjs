// Renders Hammad's Blender model from all sides so the form can be read
// directly, instead of inferred.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import fs from 'node:fs';
const HERE='/home/user/AI-Hammad/cloak'; const S=440;

const page = `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#FBF8EF"><canvas id="c" width="${S}" height="${S}"></canvas>
<script type="importmap">{"imports":{"three":"./vendor/three.module.js","three/addons/":"./vendor/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias:true, preserveDrawingBuffer:true });
r.setClearColor(0xFBF8EF, 1);
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(r);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
scene.add(new THREE.HemisphereLight(0xFFF3E6, 0x7A2600, 0.5));
const key = new THREE.DirectionalLight(0xFFF1E4, 2.4); key.position.set(-2.4,3.2,2.8); scene.add(key);
const cam = new THREE.OrthographicCamera(-1,1,1,-1,0.01,100);
window.ready = new Promise(res => {
  new GLTFLoader().load('./reference-logo.glb', (g) => {
    const root = g.scene;
    root.traverse(o => { if (o.isMesh) o.material = new THREE.MeshPhysicalMaterial({
      color: 0xFF6625, roughness:0.55, side: THREE.DoubleSide, flatShading:false }); });
    scene.add(root);
    const box = new THREE.Box3().setFromObject(root);
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    window.info = { center:c.toArray().map(v=>+v.toFixed(3)), size:sz.toArray().map(v=>+v.toFixed(3)) };
    const R = Math.max(sz.x, sz.y, sz.z) * 0.62;
    window.view = (theta, phi) => {
      const d = 10;
      cam.left=-R; cam.right=R; cam.top=R; cam.bottom=-R; cam.updateProjectionMatrix();
      cam.position.set(c.x + d*Math.sin(theta)*Math.cos(phi), c.y + d*Math.sin(phi), c.z + d*Math.cos(theta)*Math.cos(phi));
      cam.lookAt(c); r.render(scene, cam);
    };
    res();
  }, undefined, e => { window.err = String(e); res(); });
});
</script></body></html>`;
fs.writeFileSync(path.join(HERE,'_lookglb.html'), page);

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files'] });
const ctx = await b.newContext({viewport:{width:S,height:S}});
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
p.on('console', m=>{ if (m.type()==='error') console.log('CONSOLE', m.text().slice(0,200)); });
await p.goto('file://'+path.join(HERE,'_lookglb.html'));
await p.waitForFunction('window.ready !== undefined', null, {timeout:15000});
await p.evaluate(()=>window.ready);
const err = await p.evaluate(()=>window.err);
if (err) { console.log('load error', err); process.exit(1); }
console.log('model', JSON.stringify(await p.evaluate(()=>window.info)));

const views = [
  ['FRONT  (+Z)',0,0], ['BACK  (-Z)',Math.PI,0], ['RIGHT  (+X)',Math.PI/2,0], ['LEFT  (-X)',-Math.PI/2,0],
  ['TOP  (+Y)',0,Math.PI/2-0.001], ['BOTTOM  (-Y)',0,-Math.PI/2+0.001],
  ['3/4 front-left',-0.6,0.35], ['3/4 front-right',0.6,0.35], ['3/4 below',0.3,-0.5],
];
const shots=[];
for (const [l,t,ph] of views) {
  await p.evaluate(([t,ph])=>window.view(t,ph),[t,ph]);
  await p.waitForTimeout(80);
  shots.push([l, await p.screenshot({type:'jpeg',quality:86})]);
}
const sh = await ctx.newPage();
await sh.setViewportSize({width:1340,height:1400});
await sh.setContent(`<body style="margin:0;background:#1b1b18;color:#aaa;font:11px monospace">
<div style="display:flex;flex-wrap:wrap">${shots.map(([l,s])=>`<div style="width:33.33%;box-sizing:border-box;padding:3px">
<div style="padding:2px">${l}</div><img src="data:image/jpeg;base64,${s.toString('base64')}" style="width:100%;display:block"></div>`).join('')}</div></body>`);
await sh.screenshot({path:path.join(HERE,'out-glb-views.png'), fullPage:true});
await b.close();
console.log('ok');
