# Cloaked — living mark

A 3D, interactive version of the Cloaked icon that behaves like the cloth it
depicts. Open `cloak.html` in a browser. No server, no build step; it pulls
three.js from a CDN, so it needs a connection the first time.

- **Drag the silk** to fly it around. Grab it anywhere and the whole veil
  follows, rippling; let go mid-flick and it carries the throw.
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

There is one fabric and one colour. Everything darker than `#FF6625` on
screen is the silk shading itself: the inside of the sheet is occluded and
turned away from the key light.

### Updating the model

Re-export from Blender as `.glb`, then:

```sh
node bake-mesh.mjs path/to/model.glb            # one subdivision, the default
node bake-mesh.mjs path/to/model.glb --subdiv 0 # as modelled
```

It welds the vertices Blender splits at seams (cloth needs connectivity),
midpoint-subdivides for finer wrinkles — which can't move the surface, as
every new point lies on an existing flat triangle — centres it, scales it to
the frame, and embeds it in `cloak.html`. The page stays one file.

Keep the front facing +Z in Blender's export (the default), and the
topology manifold. Grid Fill gives the solver what it wants.

## The physics

Substepped **XPBD** — six substeps, one solve each — running on the model's
own topology: stretch along every edge, bending across every pair of
triangles that share one. No grid assumed, so it takes whatever comes out
of Blender.

- **No gravity.** Home is a critically damped spring back to the rest
  pose, so releasing the silk eases it home rather than snapping it, and the
  whole sheet is free to be flown around in the meantime. The hold is
  strongest at the tip and falls off quickly down the sheet.
- **Self-collision** via a counting-sort spatial hash, rebuilt once a frame
  and resolved on every substep. Near neighbours in the weave are excluded —
  distance constraints already hold those — so only genuinely separate
  pieces of cloth are candidates.

| | |
|---|---|
| vertices / triangles | 1,825 / 3,456 (481 as modelled, one subdivision) |
| settles after a hard throw | ~0.8s |
| worst self-intersection during a throw | **0.0%** of fabric thickness |
| returns to its rest pose | within 1% |
| CPU per frame | ~5ms (solver, collision, normals) |

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
node lookglb.mjs           # render reference-logo.glb from nine angles
node ortho.mjs             # front / back / side views through the real scene
node motion.mjs            # throw it, trace the settle, check it comes home
node interact.mjs          # real pointer drag and release
node perf.mjs              # where the frame time goes
node verify.mjs            # silhouette against the flat SVG — informational
node playref.mjs           # play the Lottie loader frame by frame
```

## Tuning

`SILK` is the fabric: XPBD compliances (lower is stiffer), `thickness` for
self-collision, and `springHome` / `springHeld` / `damping` for how it comes
home and how freely it flies while held. The form itself belongs to the
Blender file.

## Known limits

- The model's front view matches the flat SVG at about 80% silhouette IoU.
  That's a comparison of two references, not an error: the model is the
  source of truth for the form now, and the SVG is a flat drawing of it.
- The lit silk reads close to `#FF6625` but not exactly, and the inside of
  the curl close to the artwork's `#D0470C` rather than on it — a lighting
  judgement, not a fit.
- Two colours are not reconciled with the live site, which sometimes renders
  the brand orange as `#FF7A00`. This uses `#FF6625` from the supplied icon.
