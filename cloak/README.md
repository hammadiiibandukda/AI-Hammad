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

The mark is a drawing of a veil thrown over something: **a hollow cone, pinched
at the apex and open at the hem**, with the bottom-left of the hem rolled
backwards. The dark `#D0470C` in the flat artwork is not a second colour — it is
the **inside** of that fold, in shadow.

So there is one fabric here and one colour. Everything darker than `#FF6625` on
screen is the silk shading itself: the fold turns away from the key light, and
every surface facing away from the camera is the cone's occluded interior. Orbit
underneath and you can see up into it.

## How the rest pose stays the logo

Accuracy is built in, not tuned toward:

- The front of the cone is a **Coons patch over the four real boundary curves**
  of the SVG. Depth is added in **Z only**, which cannot move the silhouette.
- Depth splits into a centre line both halves share and a bulge that **vanishes
  at u=0 and u=1**, so the back half meets the front exactly along the
  silhouette and closes the cone with no seam and no change to the outline.
- The fold's roll was fitted numerically against the original artwork.
- The camera is **orthographic on purpose**: under perspective the left tip,
  which sits well behind the right, would shrink by about 6% and the home view
  would stop being the logo.

| | |
|---|---|
| body silhouette | **99.32%** IoU against the SVG |
| fold, reading as the dark tone | **55.6%** — see Known limits |
| overall silhouette | **94.37%** |
| painted outside the artwork | 0.13% of frame |
| after a hard throw and 2.6s settle | **93.08%** |
| worst self-intersection during a throw | **0.0%** of fabric thickness |
| depth ÷ width | **0.35**, matching the orthographic reference |

## The physics

Substepped **XPBD** — six substeps, one solve each — which is far steadier than
iterating one big step and gives stiffness that doesn't drift with resolution.

- **No gravity.** Home is a critically damped spring back to the rest pose, so
  releasing the silk eases it home rather than snapping it, and the whole sheet
  is free to be flown around in the meantime. It settles in well under a second.
- **Self-collision** via a counting-sort spatial hash, rebuilt once a frame and
  resolved on every substep. Near neighbours in the weave are excluded — they
  are already held by distance constraints — so only genuinely separate pieces
  of cloth are candidates, which is what keeps the pair list short.
- **Hoop constraints** across the hem stop the cone's mouth collapsing.
- The **apex is welded** to a single point. The artwork's apex is a rounded cap
  barely a hundredth of the mark wide; spread across the grid it becomes a row
  of near-coincident points that makes the top shiver.

About 2,900 particles. Solver and normals cost ~8ms of CPU per frame; drawing is
GPU-cheap.

## Running the checks

```sh
./fetch-vendor.sh          # local three.js, so the scripts run offline
node verify.mjs            # rest pose vs the original SVG
node overlay.mjs           # writes out-overlay.png — artwork beside a colour-coded diff
node look2.mjs             # home + orbit views, and the measured interior colour
node motion.mjs            # throw it, trace the settle, confirm it lands back on the logo
node interact.mjs          # real pointer drag and release
node perf.mjs              # where the frame time goes
node fit.mjs [--seed]      # re-fit the fold knobs; writes fitted-knobs.json
```

## Tuning

`KNOBS` shapes the rest pose — `depth`, `bulgePow` and `leftBack` set the drape,
`backDepth` the hidden half, everything starting `curl` the rolled hem. `SILK`
is the fabric: XPBD compliances (lower is stiffer), `thickness` for
self-collision, and `springHome` / `springHeld` / `damping` for how it comes
home. Re-run `verify.mjs` after touching the drape knobs.

## Known limits

- **The fold and the depth are in tension.** Matched to the reference side
  view the shell is about a third as deep as it is wide, and at that depth
  there simply isn't enough geometry turned away from the camera to fill the
  flat artwork's dark lobe — the fold reads 55.6% instead of the 87% a much
  deeper scroll reached. The reference front view shows a smaller dark lip
  than the SVG does, so the open question is which of the two is the target:
  the flat mark, or the drawn object. If it is the flat mark, the rest of the
  darkness has to come from shadow rather than from turned-away geometry.
- The lit body measures about `#FB7142` against the brand's `#FF6625`, and the
  fold interior about `#A2472B` against `#D0470C`. The two-tone reading is
  right; the exact values are a lighting judgement, not a fit.
- Two colours are not reconciled with the live site, which sometimes renders the
  brand orange as `#FF7A00`. This uses `#FF6625` from the supplied icon.
