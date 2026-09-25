# Cloaked — living mark

A 3D, interactive version of the Cloaked icon that behaves like the cloth it
depicts. Open `cloak.html` in a browser. No server, no build step; it pulls
three.js from a CDN, so it needs a connection the first time.

- **Grab it and fly it.** Take hold anywhere and the whole carpet follows,
  billowing as it goes; let go mid-flick and it carries the throw.
- **Drag the empty space** to orbit, right-drag to pan, scroll to zoom,
  double-click to reset the view.
- Leave it alone and it eases back to the mark and levitates there.

## The object

Modelled in Blender from the mark itself (`reference-logo.glb`) and used as
the cloth's rest pose directly — nothing about the form is generated or
guessed here.

It is **one open sheet**, not a closed surface: rolled 207° around the apex
— a little over half a turn — and twisted down its length. The left edge
curls back under itself, and the dark lobe in the flat artwork is the inside
of that curl. The right edge runs out into the long wing. Seen from above
it's a teardrop; from the side, a narrow blade with the curl looping
underneath. About a quarter as deep as it is wide.

Every earlier version in this repo's history modelled a closed surface of
one kind or another, which is why none of them read right.

It's drawn with real thickness — a face, a back, and a cut edge — rebuilt
from the simulated surface every frame. There is one fabric and one colour:
everything darker than `#FF6625` on screen is shading. The back of the
carpet is the inside of the curl, occluded and turned away from the key
light.

### Updating the model

Re-export from Blender as `.glb`, then:

```sh
node bake-mesh.mjs path/to/model.glb   # as modelled — what the carpet wants
node meshcheck.mjs                     # triangle quality of what's baked in
```

It welds the vertices Blender splits at seams (the simulation needs
connectivity), centres it, scales it to the frame, and embeds it in
`cloak.html`, so the page stays one file. Leave it unsubdivided: a carpet
doesn't want fine resolution, which would only give it somewhere to wrinkle.
`--subdiv N` exists if that ever changes.

Keep the front facing +Z in Blender's export (the default), and the topology
manifold.

**One thing worth fixing in Blender if you're in there anyway:** Grid Fill
squeezes the grid together where it converges at the tip, which leaves 91
sliver triangles, 58 of them near the tip — some only 0.3% as tall as they
are long. The simulation copes (shape matching works on whole patches, not
single triangles), but slivers are ill-conditioned for physics and shading.
Fewer curve points near the apex before Grid Fill, or a Remesh pass after,
would clean it up.

## The physics

Substepped **XPBD**, eight substeps, running on the model's own topology. The
fabric is a thick carpet, not silk:

- **It doesn't stretch** — stiff constraints along every edge.
- **It can't crease.** Bending is resisted between neighbouring faces and
  again two and three steps apart, the rim has a stiffer binding like a real
  rug's bound edge, and — the part that actually does it — **local shape
  matching**: every point owns a small patch of the surface that finds the
  rotation best fitting its current shape to its rest shape and pulls toward
  it. A crease inside any patch is expensive; a broad curve spread over many
  patches is cheap. Point-to-point links alone can't capture that
  distinction, which is why the first carpet attempt still creased.
- **It flies.** Air pushes back on its faces — resisting face-first motion,
  allowing edgeways — which is what makes it billow and trail when it's
  swung, and what stops it shivering.
- **It hovers.** A slow ripple runs from the tip down to the hem.
- **It's heavy.** No gravity; home is a critically damped spring back to the
  rest pose, so letting go eases it back — the whole carpet moving as one
  piece — rather than snapping it.
- **Self-collision** via a spatial hash, so layers never pass through each
  other.

Measured with `feel.mjs` on the same mesh, swinging it around in a loop by
its wing:

| | silk (before) | carpet (now) |
|---|---|---|
| sharpest fold between two faces | **151°** | **24°** |
| 1 in 20 folds sharper than | 40° | 6° |
| roughness while swinging | 0.05 | 0.01 |
| roughness at idle — the jiggle | 0.03 | 0.01 |

(Folds on sliver triangles are excluded from both columns: a sliver's
normal swings wildly under tiny motions, which reads as a fold nobody can
see.)

| | |
|---|---|
| vertices / triangles | 481 / 864, as modelled |
| after a big drag, 3s on | within 1.2% of its width of rest |
| worst self-intersection during a throw | **0.0%** of its thickness |
| CPU per frame | ~7ms here (solver, collision, shell) |

## The reference loader

`reference-loader.json` is Cloaked's own Lottie loader, and it is the best
reference we have for the object: 45 frames at 24fps of the mark turning.

What it says, measured (`measref.mjs`, `playref.mjs`, `cmpref.mjs`):

- **It disagrees with the static SVG.** Its rest frame matches the supplied
  mark at only **81.6%** IoU, and it has **no dark lobe at all** — the whole
  mark is one orange, filled `#FF6625` and `#FF550C`, with `#FBF8EF` used as
  a cutting shape. There is no `#D0470C` anywhere in it.
- **The motion is:** 16 frames at rest, an anticipation swell to +23% area,
  a turn through frames 24-33, then a settle back over frames 34-44.
- **At its thinnest the silhouette is 29% of the rest area and 56% of the
  rest width** — which is a direct measurement of the object's depth, the
  quantity every earlier version had to invent.

## Running the checks

```sh
./fetch-vendor.sh          # local three.js + addons, so the scripts run offline
node feel.mjs [tag] [json] # how carpet-like: crease and roughness, idle and swinging
node settle.mjs [json]     # how it comes home after a big drag
node interact.mjs          # real pointer drag and release
node motion.mjs            # throw it, check it's stable and stays out of itself
node perf.mjs              # where the frame time goes
node ortho.mjs             # front / back / side views through the real scene
node lookglb.mjs           # render reference-logo.glb from nine angles
node meshcheck.mjs         # triangle quality of the baked mesh
node verify.mjs            # silhouette against the flat SVG — informational
node playref.mjs           # play the Lottie loader frame by frame
```

`feel.mjs` and `settle.mjs` take a JSON object of `CARPET` overrides, so a
setting can be tried without editing the page.

## Tuning

Everything about how it moves is in `CARPET`:

- `shape` — how hard each patch holds its shape. The main carpet-versus-cloth
  dial: lower and it drapes more, higher and it gets board-like.
- `bend`, `bend2`, `bend3`, `hem` — bending compliances, lower is stiffer.
- `aero` — how much it billows and trails when swung.
- `wave`, `waveLength`, `waveSpeed` — the hovering ripple.
- `springHome`, `damping` — how it comes home; `springHeld` — how freely it
  flies while held.
- `render` — how thick it looks; `thickness` — how close layers may come.

The form itself belongs to the Blender file.

## Known limits

- The model's front view matches the flat SVG at about 80% silhouette IoU.
  That's a comparison of two references, not an error: the model is the
  source of truth for the form now, and the SVG is a flat drawing of it.
- The lit face reads close to `#FF6625` but not exactly, and the inside of
  the curl close to the artwork's `#D0470C` rather than on it — a lighting
  judgement, not a fit.
- Two colours are not reconciled with the live site, which sometimes renders
  the brand orange as `#FF7A00`. This uses `#FF6625` from the supplied icon.
