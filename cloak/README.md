# Cloaked — living mark

A 3D, interactive version of the Cloaked icon that behaves like the cloth it
depicts: it levitates, it takes a grab and a flick, and it always finds its way
back to the logo.

Open `cloak.html` in a browser. No server, no build step. It pulls three.js
from a CDN, so it needs a connection the first time.

## The idea

The mark isn't an abstract shape — it's a drawing of a draped cloth: an apex it
hangs from, two edges sweeping to a left and a right tip, a hem between them,
and the bottom-left corner curled backwards. The dark `#D0470C` is not a second
colour, it's **the reverse side of the fabric**.

So this isn't a 3D thing resembling the logo. It's the object the logo is a
picture of, with one double-sided material — `#FF6625` front, `#D0470C` back —
and the fold generating the dark lobe rather than drawing it.

Two decisions follow from that:

- **The rest pose is built from the artwork, not tuned toward it.** The surface
  is a Coons patch over the four real boundary curves of the SVG, and every bit
  of depth is added in Z only, which cannot move the silhouette. The fold's roll
  is fitted numerically against the original (see below).
- **At rest, the lighting fades to nothing.** Shading ramps with how much the
  cloth is moving, so a settled mark is the flat logo and it only becomes
  three-dimensional while it's alive.

There is no gravity. The rest pose *is* the equilibrium, held by soft springs
that are stiff at the apex and loose at the hem — which is what makes "always
comes back" a property of the simulation rather than an animation.

## Accuracy

Rendered frozen at rest, through the artwork's own viewBox, against the
original SVG:

| | |
|---|---|
| body (front face) | **99.39%** IoU |
| fold (back face) | **89.81%** IoU |
| overall silhouette | **98.87%** IoU |
| painted outside the artwork | 0.24% of frame |
| silhouette after a hard poke and 2.6s settle | **98.85%** |

## Running the checks

```sh
./fetch-vendor.sh          # local three.js, the scripts run offline
node verify.mjs            # rest pose vs the original SVG
node overlay.mjs           # writes out-overlay.png — artwork beside a colour-coded diff
node motion.mjs            # poke it, trace the settle, confirm it lands back on the logo
node interact.mjs          # real pointer drag and release
node fit.mjs [--seed]      # re-fit the fold knobs; writes fitted-knobs.json
```

## Tuning

`KNOBS` shapes the rest pose — `depth`, `bulgePow` and `leftBack` set the drape;
everything starting `curl` describes the rolled hem. `SILK` is the fabric:
raise `bend` and drop `damping` toward wool, or push `springHem` up to make it
snap home harder. Re-run `verify.mjs` after touching the drape knobs.

Resolution is `buildRestMesh(56, 38, 12, KNOBS)` — about 2,400 particles, which
is comfortable on the CPU. If much finer wrinkles are ever wanted, the solver
is the piece to move to a WebGPU compute pass; nothing else would change.

## Known limits

- The fold is the weakest part of the fit at 89.8%. It's the hardest region to
  match because a backward roll has to turn past a right angle before its
  reverse shows, and the artwork's lobe is a specific shape.
- Two colours are not reconciled with the live site, which sometimes renders the
  brand orange as `#FF7A00`. This uses `#FF6625` from the supplied icon.
- CDN dependency means no offline first load. Vendoring three.js next to the
  file fixes that if it's ever needed.
