# Cloaked — living mark

A 3D, interactive version of the Cloaked icon that behaves like the cloth it
depicts. Open `cloak.html` in a browser. No server, no build step; it pulls
three.js from a CDN, so it needs a connection the first time.

- **Grab it and fly it.** Take hold anywhere and the whole cloak follows
  the path of your pointer: the part you hold leads and everything behind
  it comes through the same path after it. It swings round to stream
  behind the way you're flying it and banks into turns. Stop, still
  holding, and it comes upright into the logo in your hand. Let go and it
  carries the throw, curves round and flies home.
- **Drag the empty space** to orbit, right-drag to pan, scroll to zoom,
  double-click to reset the view.
- Leave it alone and it eases back to the mark and levitates there.
- **It flies in** when the page opens. Press **R** to watch it again; grab it
  mid-flight and it's yours.

## The object

Modelled in Blender from the mark itself (`reference-logo.glb`), then fitted
to the logo (`logo.svg`) so that head-on it *is* the logo — nothing about the
form is generated or guessed here. The fit only moves points in the plane of
the screen (2.8% of the width on average), never in depth; see
[the Blender reference](#the-blender-reference). Head-on, the page's rest
pose matches the logo at 98.9% on the outline, 98.8% on the face and 96.9%
on the inside of the curl (`verify.mjs`).

It is **one open sheet**, not a closed surface: rolled 207° around the apex
— a little over half a turn — and twisted down its length. The left edge
curls back under itself, and the dark lobe in the flat artwork is the inside
of that curl. The right edge runs out into the long wing. Seen from above
it's a teardrop; from the side, a narrow blade with the curl looping
underneath. About a quarter as deep as it is wide.

Every earlier version in this repo's history modelled a closed surface of
one kind or another, which is why none of them read right.

It's drawn with real thickness — a face, a back, and a cut edge — rebuilt
from the simulated surface every frame. The face is the logo's orange
`#FF550C` and the back is an ink lining, `#130F02`, which is what the logo
shows in the curl — and what shows whenever the carpet turns over in flight.
Sheen, glare and room light are kept low so the lit face reads as the
logo's orange: `#FF561B` head-on, the lining `#0C0904`.

### Updating the model

Re-export from Blender as `.glb`, then:

```sh
node bake-mesh.mjs path/to/model.glb      # as modelled — what the carpet wants
python blender/fit_logo.py --apply        # fit it to logo.svg head-on
node meshcheck.mjs                        # triangle quality of what's baked in
```

It welds the vertices Blender splits at seams (the simulation needs
connectivity), centres it, scales it to the frame, and embeds it in
`cloak.html`, so the page stays one file. Leave it unsubdivided: a carpet
doesn't want fine resolution, which would only give it somewhere to wrinkle.
`--subdiv N` exists if that ever changes. The fit keeps the model as
modelled beside the fitted pose in the same block, and always fits from it,
so running it twice gives the same answer.

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
- **It hovers.** A slow ripple runs back from whatever's leading — the tip,
  or your hand while you hold it.
- **It's heavy.** No gravity; every point has a critically damped spring to
  where the path says it should be, loose while it's flown so it trails,
  firm at rest so it settles.
- **Self-collision** via a spatial hash, so layers never pass through each
  other — with one exception, below.

**The path it follows.** Whatever is steering the cloak — the entrance,
your pointer, or the flight home — moves one rigid pose: where the logo
should be and which way it should face. Every point of the cloak follows
that pose as it was a moment ago, 0.16s later for every unit of fabric
between it and whatever's leading (measured across the fabric, so the
inside of the curl counts as far from the body). So the lead goes exactly
where it's steered and the rest passes through the same path behind it; the
physics adds the billow and the trail on top. Grabbing it mid-flight takes
over the pose where it is, so nothing jumps.

While you hold it, the pose turns about your hand until the body streams
behind the way it's being flown, fully above 2 units/s (the cloak is 2
units wide) and not at all below 0.25, banking into turns. It turns at most 2 radians a second: spinning it
about the hand any faster — a tight loop — crumples it. Below 0.25 units/s
it comes upright again within about a second. Let go and the lead leaves at
the speed it was thrown (up to 5 units/s), curves round on a Bézier and
lands in 0.9–1.8s, depending on how far it has to come.

**The entrance.** The lead is the tip, on a swooping Bézier arc from
off-screen upper left, turning from banked and edge-on to face-on as it
lands; the rest of the cloak comes through the same arc behind it. The
spring is loosened to a third in the air, and the hovering ripple runs up to
five times harder, fading out on the approach. 0.15s of empty page, 2.6s of
flight.

Every path runs on simulated time, so a slow frame slows the path and the
fabric together rather than leaving the cloak behind its path.

**Untangling.** The rest pose never touches itself, so a carpet that keeps
touching itself for 0.8s after it's been let go is tangled — and
self-collision is exactly what would stop it finding its way back. So it
lets the layers pass through each other until they're clear, then turns
collision back on. It always gets home. Never while held or during the
entrance.

**Coming home clean.** Each shape-matching patch remembers its rotation from
the last step, which is what makes it cheap. But a patch that's nearly a
straight strip can't tell how far it's been twisted about its own length, so
after a big turn — the entrance, a hard swing — it keeps a stale twist that
the fabric settles into. The patches forget their rotations when the carpet
lands, is let go, or comes to rest upright in your hand. Without that, the
carpet sat 1.3% off the mark with a 6° fold three seconds after the fly-in;
with it, 0.3% and no fold. (Easing them back all the time instead squashed
the curl at the start of a fast drag.)

Measured with `feel.mjs` (silk on the model as modelled, carpet on the fitted pose), swinging it around in a loop by
its wing:

| | silk (before) | carpet (now) |
|---|---|---|
| sharpest fold between two faces | **151°** | **18°** |
| 1 in 20 folds sharper than | 40° | 4° |
| roughness while swinging | 0.05 | 0.01 |
| roughness at idle — the jiggle | 0.03 | 0.01–0.02 |

(Folds on sliver triangles are excluded from both columns: a sliver's
normal swings wildly under tiny motions, which reads as a fold nobody can
see.)

| | |
|---|---|
| vertices / triangles | 481 / 864, as modelled |
| after a big drag, 3s on | within 0.1% of its width of rest |
| after the fly-in, 3s on | within 0.3% |
| flown through an S-bend and a loop | 0.0% self-intersection; upright in the hand 2s after stopping |
| worst self-intersection during a throw | **0.0%** of its thickness |
| CPU per frame | ~7ms here (solver, collision, shell) |

## The Blender reference

`blender/` holds the fly-in simulated as real cloth in Blender — what the
page's live simulation is tuned against. It runs the page's own mesh (read
out of `cloak.html`, then fitted to the logo — below), along the page's path,
with the page's timing, camera and lights, so the two can be compared point
for point.

**The logo.** `logo.svg` is the reference: the body `#FF550C`, the inside of
the curl `#130F02`. Seen head-on, the Blender model matched it at 92% on the
outline and 80% on the inside of the curl — its upper-left edge bowed out
where the logo's curves in, and the top edge of the curl sat low.
`fit_logo.py` reshapes the rest pose in the plane of the screen only (depth
is untouched) to line both up: the smoothest thin-plate-spline warp that
matches the model's outline and the seam between its face and the inside of
the curl to the logo's, found by matching nearest edge points both ways and
letting it bend a little more each round. Points move 2.8% of the width on
average, 5.3% at most. The lining is ink, so the inside of the cloak shows
dark whenever it turns over in flight, not just in the curl.

Only the tip is steered: it's pinned to the path. Everything else is
Blender's cloth solver — no gravity, self-collision on, air damping, and the
body held to the logo pose by goal springs that are loose in the air (0.3)
and firm up over the approach (15), the same ramp the page uses. The carpet
is bending stiffness 300 (past leather) with 40 solver steps a frame; a
stiff cloth with too few steps goes unstable and creases.

One thing that matters: the self-collision gap has to be smaller than the
spacing of the thin triangles at the tip. At 0.012 the solver pushed them
apart into permanent dents along the right edge; at 0.004 it lands clean.

```sh
python blender/fit_logo.py [logo.svg]         # fit the rest pose to the logo head-on
python blender/flyin.py                       # simulate; writes the files below
python blender/flyin.py '{"render": "preview"}'   # ... and render every frame
node blender/compare.mjs [frames_dir]          # the page against it, moment by moment
```

It needs Blender as a Python module: `pip install bpy==4.5.14` on Python
3.11. It writes `flyin-positions.bin` (every vertex, every frame, page
coordinates), `flyin.pc2` (the same motion as a point cache Blender's Mesh
Cache modifier plays) and `cloak_flyin.blend` — open that in Blender: the
`Cloak` object is the live cloth sim, `Cloak (baked)` plays the cache back.

| | |
|---|---|
| frames | 121 at 30fps — 0.15s of empty page, 2.6s of flight, 1.25s to settle |
| landed, head-on, against the logo | outline 99.5% · face 99.5% · inside of the curl 97.3% · 0.2% spills outside it |
| rendered colour, lit face / inside | `#FF5118` / `#18130D` (logo: `#FF550C` / `#130F02`) |
| sharpest fold in flight | 34° (page: 6°) |
| page against it in flight | up to 1.4 widths apart: the page runs about half a second behind its own path |
| page against it at rest | 0.2% apart — the same fitted pose |

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
node path.mjs [json]       # fly it through an S-bend and a loop, stop, let go
node intro.mjs [json]      # film the fly-in: stays sound in the air, lands home
node untangle.mjs          # the untangling safeguard switches off and back on
node motion.mjs            # throw it, check it's stable and stays out of itself
node perf.mjs              # where the frame time goes
node ortho.mjs             # front / back / side views through the real scene
node lookglb.mjs           # render reference-logo.glb from nine angles
node meshcheck.mjs         # triangle quality of the baked mesh
node verify.mjs            # head-on against logo.svg: outline, face, inside of the curl
node playref.mjs           # play the Lottie loader frame by frame
```

`feel.mjs` and `settle.mjs` take a JSON object of `CARPET` overrides,
`intro.mjs` one of `ENTRANCE` overrides and `path.mjs` one of `FOLLOW`
overrides, so a setting can be tried without editing the page. The checks
pace the pointer and read results in simulated time, since headless frames
here are slow.

## Tuning

Everything about how it moves is in `CARPET`:

- `shape` — how hard each patch holds its shape. The main carpet-versus-cloth
  dial: lower and it drapes more, higher and it gets board-like.
- `bend`, `bend2`, `bend3`, `hem` — bending compliances, lower is stiffer.
- `aero` — how much it billows and trails when swung.
- `wave`, `waveLength`, `waveSpeed` — the hovering ripple.
- `springHome`, `damping` — how it comes home; `springHeld` — how closely it
  keeps to its path while you fly it.
- `render` — how thick it looks; `thickness` — how close layers may come.

How it follows your pointer is in `FOLLOW`: `lag` (how far behind the path
each part runs), `turn`, `turnTime` and `turnRate` (swinging round to
stream behind), `uprightTime`, `bank`, `slow`/`fast` (the speeds between
upright and streaming), `flutter`, and `home`, `carry` and `fling` for the
flight home.

The fly-in is in `ENTRANCE`: `duration`, `delay`, the `path` (Bézier
offsets from home), the starting `turn`, how `loose` the spring is in the
air, and the extra `flutter`.

The form itself belongs to the Blender file.

## Known limits

- In flight the page still runs about half a second behind its own path,
  where the Blender reference keeps the tip on it; matching that motion is
  the next step.
- The lit face reads `#FF561B` against the logo's `#FF550C`, and the lining
  `#0C0904` against `#130F02` — as close as lighting a 3D surface allows,
  and it varies as the carpet turns.
- Both SVGs' viewBoxes were taken from the curves' control points, not the
  drawn shape, so the logo's true proportions (1.417 wide to 1 tall) are
  used for framing, not the viewBox.
- The live site sometimes renders the brand orange as `#FF7A00`; this uses
  `#FF550C` from `logo.svg`.
