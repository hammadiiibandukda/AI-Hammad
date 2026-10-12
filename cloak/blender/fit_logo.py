# Fit the cloak's rest pose to the logo, head-on.
#
# The model is Hammad's, from Blender; the logo is the flat artwork. Seen
# straight on, the model's outline and the visible inside of its curl are
# close to the logo but not on it. This finds the smoothest sideways reshaping
# (in the plane of the screen only — depth is left alone) that lines both up,
# and writes the result as a new rest pose next to this file.
#
#   python fit_logo.py [logo.svg]            fit, and write rest-fitted.json
#   python fit_logo.py --apply [logo.svg]    ... and put the fitted pose in cloak.html
#
# Always fits from the model as it came out of Blender, so running it again
# after --apply gives the same answer. Needs numpy, scipy and Pillow. Also
# writes out-fit-logo.png (before and after, over the logo).

import base64, json, math, os, re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy.interpolate import RBFInterpolator
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')] if __name__ == '__main__' else []
SVG = ARGS[0] if ARGS else os.path.join(HERE, '..', 'logo.svg')
sys.path.insert(0, HERE)
from flyin import load_page_mesh, PAGE   # noqa: E402  (bpy is imported there but unused here)

PX = 400                     # pixels per rest unit when drawing either one
WIN = (-1.2, 1.2, -0.9, 0.9) # the window both are drawn in, rest units


# ---- the logo -------------------------------------------------------------

def svg_paths(path):
    """The logo's two shapes as polygons, in SVG units, in drawing order."""
    src = open(path, encoding='utf-8').read()
    out = []
    for d, fill in re.findall(r'<path d="([^"]+)" fill="([^"]+)"', src):
        tok = re.findall(r'[MCLHVZ]|-?\d*\.?\d+(?:e-?\d+)?', d)
        pts, i, cur, cmd = [], 0, (0.0, 0.0), None
        while i < len(tok):
            if tok[i] in 'MCLHVZ':
                cmd = tok[i]; i += 1
                if cmd == 'Z':
                    continue
            n = lambda k: float(tok[i + k])
            if cmd == 'M' or cmd == 'L':
                cur = (n(0), n(1)); pts.append(cur); i += 2
            elif cmd == 'H':
                cur = (n(0), cur[1]); pts.append(cur); i += 1
            elif cmd == 'V':
                cur = (cur[0], n(0)); pts.append(cur); i += 1
            elif cmd == 'C':
                p0, p1, p2, p3 = np.array(cur), np.array((n(0), n(1))), np.array((n(2), n(3))), np.array((n(4), n(5)))
                for t in np.linspace(0, 1, 41)[1:]:
                    m = 1 - t
                    pts.append(tuple(m**3*p0 + 3*m*m*t*p1 + 3*m*t*t*p2 + t**3*p3))
                cur = tuple(p3); i += 6
        out.append((np.array(pts), fill))
    return out


def logo_to_rest(shapes):
    """The page's convention: the artwork's bounds span x -1..1, centred."""
    allp = np.vstack([p for p, _ in shapes])
    lo, hi = allp.min(0), allp.max(0)
    s = 2.0 / (hi[0] - lo[0]); c = (lo + hi) / 2
    return [(np.stack([(p[:, 0] - c[0]) * s, -(p[:, 1] - c[1]) * s], 1), f) for p, f in shapes]


def to_px(xy):
    return np.stack([(xy[..., 0] - WIN[0]) * PX, (WIN[3] - xy[..., 1]) * PX], -1)


def size():
    return int((WIN[1] - WIN[0]) * PX), int((WIN[3] - WIN[2]) * PX)


def draw_logo(shapes):
    """0 page, 1 the orange body, 2 the dark inside of the curl."""
    img = Image.new('L', size(), 0)
    d = ImageDraw.Draw(img)
    for (poly, fill), label in zip(shapes, (2, 1)):   # dark drawn first, body over it
        d.polygon([tuple(p) for p in to_px(poly)], fill=label)
    return np.array(img)


# ---- the model --------------------------------------------------------------

def draw_model(rest, tris):
    """Head-on, orthographic, nearest surface wins: 1 where we see the face of
    the carpet, 2 where we see its back — the inside of the curl."""
    w, h = size()
    depth = np.full((h, w), -np.inf)
    label = np.zeros((h, w), np.uint8)
    P = to_px(rest[:, :2]); Z = rest[:, 2]
    for a, b, c in tris:
        n = np.cross(rest[b] - rest[a], rest[c] - rest[a])
        facing = 1 if n[2] > 0 else 2
        pa, pb, pc = P[a], P[b], P[c]
        x0, x1 = int(max(min(pa[0], pb[0], pc[0]), 0)), int(min(max(pa[0], pb[0], pc[0]) + 1, w))
        y0, y1 = int(max(min(pa[1], pb[1], pc[1]), 0)), int(min(max(pa[1], pb[1], pc[1]) + 1, h))
        if x0 >= x1 or y0 >= y1:
            continue
        ys, xs = np.mgrid[y0:y1, x0:x1] + 0.5
        den = (pb[1] - pc[1]) * (pa[0] - pc[0]) + (pc[0] - pb[0]) * (pa[1] - pc[1])
        if abs(den) < 1e-12:
            continue
        l1 = ((pb[1] - pc[1]) * (xs - pc[0]) + (pc[0] - pb[0]) * (ys - pc[1])) / den
        l2 = ((pc[1] - pa[1]) * (xs - pc[0]) + (pa[0] - pc[0]) * (ys - pc[1])) / den
        l3 = 1 - l1 - l2
        inside = (l1 >= -1e-9) & (l2 >= -1e-9) & (l3 >= -1e-9)
        z = l1 * Z[a] + l2 * Z[b] + l3 * Z[c]
        sub_d = depth[y0:y1, x0:x1]
        win = inside & (z > sub_d)
        sub_d[win] = z[win]
        label[y0:y1, x0:x1][win] = facing
    return label


def iou(a, b):
    def one(m, n):
        u = (m | n).sum()
        return (m & n).sum() / u if u else 1.0
    return {'silhouette': one(a > 0, b > 0), 'face': one(a == 1, b == 1), 'inside': one(a == 2, b == 2),
            'spill': ((a > 0) & (b == 0)).sum() / max((b > 0).sum(), 1)}


def edges(label):
    """Outline pixels, and pixels where the face meets the inside of the curl,
    as points in rest units."""
    pad = np.pad(label, 1)
    nb = [pad[1:-1, 2:], pad[1:-1, :-2], pad[2:, 1:-1], pad[:-2, 1:-1]]
    out = (label > 0) & np.any([n == 0 for n in nb], axis=0)
    seam = (label == 1) & np.any([n == 2 for n in nb], axis=0)
    def pts(m):
        ys, xs = np.nonzero(m)
        return np.stack([WIN[0] + (xs + 0.5) / PX, WIN[3] - (ys + 0.5) / PX], 1)
    return pts(out), pts(seam)


# ---- the fit ------------------------------------------------------------------

def fit(src_sets, dst_sets, rounds=(3e-1, 1e-1, 3e-2, 1e-2, 3e-3, 1e-3, 3e-4), iters=6):
    """Symmetric non-rigid ICP with a thin-plate spline: match each model edge
    point to the nearest logo edge point of the same kind and back again, fit
    the smoothest warp through the matches, repeat while letting it bend more."""
    trees = [cKDTree(d) for d in dst_sets]
    warp = lambda p: p
    for smooth in rounds:
        for _ in range(iters):
            A, B = [], []
            for src, dst, tree in zip(src_sets, dst_sets, trees):
                moved = warp(src)
                _, j = tree.query(moved)
                A.append(src); B.append(dst[j])                   # each model point to the logo
                _, k = cKDTree(moved).query(dst)
                A.append(src[k]); B.append(dst)                   # each logo point to the model
            A, B = np.vstack(A), np.vstack(B)
            # thin out duplicates so the solve stays small
            keep = np.unique(np.round(A * 400).astype(int), axis=0, return_index=True)[1]
            rbf = RBFInterpolator(A[keep], B[keep] - A[keep], kernel='thin_plate_spline', smoothing=smooth * len(keep))
            warp = (lambda r: (lambda p: p + r(p)))(rbf)
    return warp


def apply_to_page(fitted, svg_name):
    """Put the fitted pose in the page, keeping the model as modelled beside it."""
    html = open(PAGE, encoding='utf-8').read()
    m = re.search(r'(<script type="application/json" id="logo-mesh">)(.*?)(</script>)', html, re.S)
    data = json.loads(m.group(2))
    data.setdefault('modelled', data['positions'])
    data['positions'] = base64.b64encode(fitted.astype('<f4').tobytes()).decode()
    data['fittedTo'] = svg_name
    html = html[:m.start(2)] + json.dumps(data, separators=(',', ':')) + html[m.end(2):]
    open(PAGE, 'w', encoding='utf-8').write(html)


def main():
    rest, tris, source = load_page_mesh(modelled=True)
    logo = logo_to_rest(svg_paths(SVG))
    target = draw_logo(logo)
    before = draw_model(rest, tris)
    s0 = iou(before, target)

    rng = np.random.default_rng(0)
    def thin(p, n):
        return p if len(p) <= n else p[rng.choice(len(p), n, replace=False)]
    mo, ms = edges(before); lo, ls = edges(target)
    warp = fit([thin(mo, 700), thin(ms, 300)], [thin(lo, 1400), thin(ls, 600)])

    fitted = rest.copy()
    fitted[:, :2] = warp(rest[:, :2])
    after = draw_model(fitted, tris)
    s1 = iou(after, target)

    # How much the fabric had to stretch or shrink to get there.
    E = {tuple(sorted((t[i], t[(i + 1) % 3]))) for t in tris for i in range(3)}
    E = np.array(sorted(E))
    ratio = np.linalg.norm(fitted[E[:, 0]] - fitted[E[:, 1]], axis=1) / np.linalg.norm(rest[E[:, 0]] - rest[E[:, 1]], axis=1)
    move = np.linalg.norm(fitted - rest, axis=1)

    fmt = lambda s: f"outline {s['silhouette']*100:.1f}%  face {s['face']*100:.1f}%  inside of the curl {s['inside']*100:.1f}%  spill {s['spill']*100:.1f}%"
    print('before:', fmt(s0))
    print('after: ', fmt(s1))
    print(f'moved on average {move.mean()/2*100:.1f}% of the width, at most {move.max()/2*100:.1f}%; '
          f'edges stretched {ratio.min():.2f}x to {ratio.max():.2f}x')

    out = {'source': source, 'fitted_to': os.path.basename(SVG), 'wide': len(rest) > 65535,
           'positions': base64.b64encode(fitted.astype('<f4').tobytes()).decode(),
           'before': {k: round(float(v), 4) for k, v in s0.items()},
           'after': {k: round(float(v), 4) for k, v in s1.items()}}
    json.dump(out, open(os.path.join(HERE, 'rest-fitted.json'), 'w'))
    if '--apply' in sys.argv:
        apply_to_page(fitted, os.path.basename(SVG))
        print('cloak.html now runs the fitted pose')

    # Before and after, over the logo: grey agrees, magenta is cloak where the
    # logo is empty, cyan is logo the cloak misses, yellow is face/inside mixed up.
    def overlay(got):
        img = np.full(got.shape + (3,), (0xFB, 0xF8, 0xEF), np.uint8)
        img[(got > 0) & (target > 0) & (got == target)] = (0xBE, 0xCC, 0xBE)
        img[(got > 0) & (target > 0) & (got != target)] = (0xFF, 0xBB, 0x00)
        img[(got > 0) & (target == 0)] = (0xFF, 0x00, 0xC8)
        img[(got == 0) & (target > 0)] = (0x00, 0xC0, 0xE6)
        return Image.fromarray(img)
    a, b = overlay(before), overlay(after)
    sheet = Image.new('RGB', (a.width * 2 + 8, a.height), (21, 21, 21))
    sheet.paste(a, (0, 0)); sheet.paste(b, (a.width + 8, 0))
    sheet.save(os.path.join(HERE, '..', 'out-fit-logo.png'))


if __name__ == '__main__':
    main()
