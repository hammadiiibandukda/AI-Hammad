# The fly-in, simulated as real cloth in Blender — the reference the page's
# live simulation is tuned against.
#
# Same mesh as the page (read straight out of cloak.html), same path, same
# timing, same camera. Only the tip is steered; everything else is Blender's
# cloth solver: no gravity, self-collision on, the body held loosely to the
# logo pose so it trails and then settles into it.
#
#   python flyin.py [json overrides]           simulate, save positions + .blend
#   python flyin.py '{"render": "preview"}'    ... and render a frame sequence
#
# Needs Blender as a Python module (pip install bpy==4.5.14, Python 3.11).
#
# Writes, next to this file:
#   flyin-positions.bin   float32 [frame][vertex][xyz], page coordinates (Y up)
#   flyin-meta.json       frame rate, counts, and every setting used
#   cloak_flyin.blend     the scene, cache baked in, to open in Blender

import base64, json, math, os, re, sys
import bpy
import numpy as np
from mathutils import Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, '..', 'cloak.html')

SETTINGS = {
    'fps': 30,
    'seconds': 4.0,            # the 2.75s entrance, then time to settle
    # The entrance, exactly as ENTRANCE in cloak.html.
    'duration': 2.6, 'delay': 0.15,
    'path': [[-2.9, 1.8, -0.8], [-1.1, -1.4, 0.7], [1.3, -0.4, 0.3], [0, 0, 0]],
    'turn': [0.3, -1.0, 0.5],
    # The cloth: a thick carpet. Stiffnesses are Blender's units.
    'quality': 40,             # solver steps per frame: a stiff carpet needs many
    'mass': 0.4,
    'air': 3.0,                # air damping: what makes it trail
    'tension': 40.0, 'shear': 40.0, 'bending': 300.0,   # bending far past leather: a carpet
    'tension_damping': 5.0, 'bending_damping': 0.5,
    # How it's held: the tip is pinned and leads; the body is held to the
    # logo pose by goal springs, loose enough to trail.
    'tip_radius': 0.07,        # rest units from the tip that are fully pinned
    'hold': 0.3,               # goal weight across the body
    'hold_tip': 0.6,           # extra goal weight, fading away from the tip
    'pin_flight': 0.3,         # goal stiffness in the air: loose, so it trails
    'pin_stiffness': 15.0,     # ... and once it has landed, firm, so it settles into the logo
    # Self-collision gap. Keep it under the spacing of the thin triangles at
    # the tip, or the solver pushes them apart into dents (0.012 did).
    'self_distance': 0.004, 'collision_quality': 3,
    # The rest pose: 'fitted' lines up with the logo head-on (fit_logo.py),
    # 'page' is the model exactly as the page has it.
    'rest': 'fitted',
    # Look: the logo's colours, orange outside and ink inside.
    'face': '#FF550C', 'lining': '#130F02', 'key': 3.6, 'sheen': 0.15, 'specular': 0.15,
    'thickness': 0.012,
    'smooth': 0,               # subdivision at render time; 2 rounds the curl off the logo
    'render': None,            # None · 'preview' · 'final'
}


def load_page_mesh():
    html = open(PAGE, encoding='utf-8').read()
    data = json.loads(re.search(r'<script type="application/json" id="logo-mesh">(.*?)</script>', html, re.S).group(1))
    rest = np.frombuffer(base64.b64decode(data['positions']), dtype='<f4').reshape(-1, 3).copy()
    tris = np.frombuffer(base64.b64decode(data['indices']), dtype='<u4' if data.get('wide') else '<u2').reshape(-1, 3).astype(int)
    return rest, tris, data.get('source', '?')


def load_rest(S):
    """The rest pose to simulate: the page's mesh, or the same mesh fitted to
    the logo head-on by fit_logo.py."""
    rest, tris, source = load_page_mesh()
    fitted = os.path.join(HERE, 'rest-fitted.json')
    if S.get('rest') == 'fitted' and os.path.exists(fitted):
        data = json.load(open(fitted))
        rest = np.frombuffer(base64.b64decode(data['positions']), dtype='<f4').reshape(-1, 3).copy()
        source += ' fitted to ' + data['fitted_to']
    return rest, tris, source


# Page coordinates are Y up and face +Z; Blender's are Z up and face -Y.
def to_blender(v):  return Vector((v[0], -v[2], v[1]))
def to_page(v):     return (v[0], v[2], -v[1])
def quat_to_blender(q):  # q as (w, x, y, z) in page space
    return Quaternion((q[0], q[1], -q[3], q[2]))


def euler_xyz(x, y, z):
    """three.js Euler(x, y, z, 'XYZ') as a quaternion (w, x, y, z)."""
    c1, c2, c3 = math.cos(x/2), math.cos(y/2), math.cos(z/2)
    s1, s2, s3 = math.sin(x/2), math.sin(y/2), math.sin(z/2)
    return Quaternion((c1*c2*c3 - s1*s2*s3, s1*c2*c3 + c1*s2*s3, c1*s2*c3 - s1*c2*s3, c1*c2*s3 + s1*s2*c3))


ease_out = lambda x: 1 - (1 - x) ** 3
ease_in_out = lambda x: 4*x*x*x if x < 0.5 else 1 - (-2*x + 2) ** 3 / 2


def bezier(path, t):
    a, b, c, d = (np.array(p, float) for p in path)
    m = 1 - t
    return m*m*m*a + 3*m*m*t*b + 3*m*t*t*c + t*t*t*d


def srgb(hexcode, alpha=1.0):
    c = [int(hexcode[i:i+2], 16) / 255 for i in (1, 3, 5)]
    lin = [x/12.92 if x <= 0.04045 else ((x + 0.055)/1.055) ** 2.4 for x in c]
    return (*lin, alpha)


def build(S):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = S['fps']
    frames = int(round(S['seconds'] * S['fps'])) + 1
    scene.frame_start, scene.frame_end = 1, frames
    scene.use_gravity = False
    scene.gravity = (0, 0, 0)

    rest, tris, source = load_rest(S)
    tip = int(np.argmax(rest[:, 1]))
    pivot = rest[tip].copy()

    # The object's origin is the tip, so its transform is the tip's flight.
    me = bpy.data.meshes.new('Cloak')
    me.from_pydata([to_blender(p - pivot) for p in rest], [], [tuple(t) for t in tris])
    me.update()
    for poly in me.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new('Cloak', me)
    scene.collection.objects.link(obj)
    obj.rotation_mode = 'QUATERNION'

    # Goal weights: the tip pinned outright, the body held loosely, more so
    # nearer the tip — the same shape as the page's anchoring.
    d = np.linalg.norm(rest - pivot, axis=1)
    anchor = (1 - d / d.max()) ** 5
    group = obj.vertex_groups.new(name='Hold')
    for i in range(len(rest)):
        w = 1.0 if d[i] < S['tip_radius'] else min(0.98, S['hold'] + S['hold_tip'] * anchor[i])
        group.add([i], float(w), 'REPLACE')

    cloth = obj.modifiers.new('Cloth', 'CLOTH')
    cs, cc = cloth.settings, cloth.collision_settings
    cs.quality = S['quality']
    cs.mass = S['mass']
    cs.air_damping = S['air']
    cs.bending_model = 'ANGULAR'
    cs.tension_stiffness = cs.compression_stiffness = S['tension']
    cs.shear_stiffness = S['shear']
    cs.bending_stiffness = S['bending']
    cs.tension_damping = cs.compression_damping = cs.shear_damping = S['tension_damping']
    cs.bending_damping = S['bending_damping']
    cs.vertex_group_mass = 'Hold'
    # The hold is loose in the air and firms up over the approach, the same
    # ramp the page uses (smoothstep from 55% of the flight to landing).
    for f in range(1, frames + 1):
        p = ((f - 1) / S['fps'] - S['delay']) / S['duration']
        k = min(max((p - 0.55) / 0.45, 0.0), 1.0)
        cs.pin_stiffness = S['pin_flight'] + (S['pin_stiffness'] - S['pin_flight']) * k * k * (3 - 2 * k)
        cs.keyframe_insert('pin_stiffness', frame=f)
    cs.effector_weights.gravity = 0.0
    cc.use_collision = False
    cc.use_self_collision = True
    cc.self_distance_min = S['self_distance']
    cc.collision_quality = S['collision_quality']
    cloth.point_cache.frame_start, cloth.point_cache.frame_end = 1, frames

    # Fly the tip along the page's entrance, one key per frame.
    start = euler_xyz(*S['turn'])
    for f in range(1, frames + 1):
        t = (f - 1) / S['fps']
        p = max((t - S['delay']) / S['duration'], 0.0)
        if p >= 1:
            off, q = np.zeros(3), Quaternion()
        else:
            off = bezier(S['path'], ease_out(p))
            q = start.slerp(Quaternion(), ease_in_out(min(p / 0.85, 1)))
        obj.location = to_blender(pivot + off)
        obj.rotation_quaternion = quat_to_blender(q)
        obj.keyframe_insert('location', frame=f)
        obj.keyframe_insert('rotation_quaternion', frame=f)
    for fc in obj.animation_data.action.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = 'LINEAR'

    return scene, obj, frames, tip, source, rest


def simulate(scene, obj, frames):
    """Step the solver frame by frame and read the cloth back each time, in
    Blender's world space."""
    out = np.zeros((frames, len(obj.data.vertices), 3), dtype='<f4')
    for f in range(1, frames + 1):
        scene.frame_set(f)
        ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mw = ev.matrix_world
        for i, v in enumerate(ev.data.vertices):
            out[f - 1, i] = mw @ v.co
    if not np.isfinite(out).all():
        raise SystemExit('solver blew up: non-finite positions')
    return out


def page_space(world):
    """Blender world positions to the page's coordinates."""
    return np.stack([world[..., 0], world[..., 2], -world[..., 1]], axis=-1).astype('<f4')


def write_pc2(path, world):
    """A point cache Blender's Mesh Cache modifier can play back."""
    frames, verts, _ = world.shape
    with open(path, 'wb') as fh:
        fh.write(b'POINTCACHE2\0')
        fh.write(np.array([1, verts], '<i4').tobytes())
        fh.write(np.array([1.0, 1.0], '<f4').tobytes())      # first frame, one sample per frame
        fh.write(np.array([frames], '<i4').tobytes())
        fh.write(world.astype('<f4').tobytes())


def playback(scene, obj, pc2, S):
    """A copy of the cloak that plays the cached motion back, for rendering.
    Rendering the cloth object itself would re-run the solver from scratch."""
    me = obj.data.copy()
    me.name = 'Cloak (baked)'
    baked = bpy.data.objects.new('Cloak (baked)', me)
    scene.collection.objects.link(baked)
    cache = baked.modifiers.new('Baked fly-in', 'MESH_CACHE')
    cache.cache_format, cache.filepath = 'PC2', pc2
    cache.frame_start, cache.frame_scale = 0, 1
    solid = baked.modifiers.new('Thickness', 'SOLIDIFY')
    solid.thickness, solid.offset = S['thickness'], 0.0
    solid.material_offset, solid.material_offset_rim = 1, 0     # the inner shell is the lining
    smooth = baked.modifiers.new('Smooth', 'SUBSURF')
    smooth.levels, smooth.render_levels = 0, S['smooth']
    smooth.show_render = S['smooth'] > 0
    obj.hide_render = True
    return baked


def stage(scene, S, rest):
    """Camera, lights and material, matching the page."""
    obj = scene.objects['Cloak (baked)']
    # Orange outside, ink inside: in the logo the inside of the curl is #130F02.
    def fabric(name, colour, sheen):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = srgb(colour)
        bsdf.inputs['Roughness'].default_value = 0.62
        bsdf.inputs['Sheen Weight'].default_value = sheen
        bsdf.inputs['Sheen Roughness'].default_value = 0.5
        bsdf.inputs['Sheen Tint'].default_value = srgb('#FFCDB4')
        bsdf.inputs['Specular IOR Level'].default_value = S['specular']
        obj.data.materials.append(mat)
    fabric('Carpet', S['face'], S['sheen'])
    fabric('Lining', S['lining'], 0.0)

    # Orthographic, head-on, framed like a 960x600 page.
    cam_data = bpy.data.cameras.new('Camera')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2 * 0.675 * 1.30 * (960 / 600)
    cam = bpy.data.objects.new('Camera', cam_data)
    centre = (rest.min(axis=0) + rest.max(axis=0)) / 2
    cam.location = to_blender(centre) + Vector((0, -6, 0))
    cam.rotation_euler = (math.pi / 2, 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def sun(name, page_dir, colour, strength, angle):
        light = bpy.data.lights.new(name, 'SUN')
        light.color = srgb(colour)[:3]
        light.energy = strength
        light.angle = math.radians(angle)
        ob = bpy.data.objects.new(name, light)
        ob.rotation_mode = 'QUATERNION'
        ob.rotation_quaternion = (-to_blender(page_dir)).to_track_quat('-Z', 'Y')
        scene.collection.objects.link(ob)
    sun('Key', (-2.4, 3.2, 2.8), '#FFF1E4', S['key'], 6)
    sun('Fill', (3.0, -0.6, 1.4), '#F0E4E0', 0.35, 20)

    # Sky above, the brand's dark bounce below — the page's hemisphere light.
    world = bpy.data.worlds.new('World')
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes['Background']
    coord, sep, ramp = nt.nodes.new('ShaderNodeTexCoord'), nt.nodes.new('ShaderNodeSeparateXYZ'), nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(coord.outputs['Normal'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = 0.0, srgb('#7A2600')
    ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = 1.0, srgb('#FFF3E6')
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.45

    # The soft ground shadow under it, where the page puts it.
    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, float(rest[:, 1].min()) - 0.65))
    floor = bpy.context.active_object
    floor.is_shadow_catcher = True

    r = scene.render
    r.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24 if S['render'] == 'preview' else 96
    scene.cycles.use_denoising = True
    r.film_transparent = True
    r.resolution_x, r.resolution_y = 960, 600
    r.resolution_percentage = 50 if S['render'] == 'preview' else 100
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'


def main():
    S = dict(SETTINGS)
    if len(sys.argv) > 1 and sys.argv[1].strip():
        S.update(json.loads(sys.argv[1]))
    out_dir = S.get('out', HERE)
    scene, obj, frames, tip, source, rest = build(S)
    world = simulate(scene, obj, frames)
    pos = page_space(world)
    pos.tofile(os.path.join(out_dir, 'flyin-positions.bin'))
    pc2 = os.path.join(out_dir, 'flyin.pc2')
    write_pc2(pc2, world)
    kept = {k: v for k, v in S.items() if k not in ('out', 'frames_dir', 'save', 'render', 'render_step', 'render_frames')}
    json.dump({'fps': S['fps'], 'frames': frames, 'vertices': pos.shape[1], 'tip': tip,
               'source': source, 'blender': bpy.app.version_string, 'settings': kept,
               'layout': 'float32 little-endian [frame][vertex][x,y,z], page coordinates (Y up), world space'},
              open(os.path.join(out_dir, 'flyin-meta.json'), 'w'), indent=2)
    print(f'simulated {frames} frames of {pos.shape[1]} vertices')

    # Where it lands, head-on, against the logo.
    import fit_logo
    logo = fit_logo.draw_logo(fit_logo.logo_to_rest(fit_logo.svg_paths(fit_logo.SVG)))
    landed = fit_logo.iou(fit_logo.draw_model(pos[-1], load_page_mesh()[1]), logo)
    print('landed against the logo: ' + '  '.join(f'{k} {v*100:.1f}%' for k, v in landed.items()))
    meta = json.load(open(os.path.join(out_dir, 'flyin-meta.json')))
    meta['landed_vs_logo'] = {k: round(float(v), 4) for k, v in landed.items()}
    json.dump(meta, open(os.path.join(out_dir, 'flyin-meta.json'), 'w'), indent=2)

    playback(scene, obj, pc2, S)
    stage(scene, S, rest)
    if S.get('save', True):
        # The cache sits next to the .blend, so point at it relatively.
        scene.objects['Cloak (baked)'].modifiers['Baked fly-in'].filepath = '//flyin.pc2'
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, 'cloak_flyin.blend'), compress=True)
    if S['render']:
        frames_dir = S.get('frames_dir') or os.path.join(out_dir, 'frames')
        os.makedirs(frames_dir, exist_ok=True)
        step = S.get('render_step', 1)
        for f in S.get('render_frames') or range(1, frames + 1, step):
            scene.frame_set(f)
            scene.render.filepath = os.path.join(frames_dir, f'{f:04d}.png')
            bpy.ops.render.render(write_still=True)
        print(f'rendered to {frames_dir}')


if __name__ == "__main__":
    main()
