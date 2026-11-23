"""Create the cast-iron stove, split firewood and independently dimmable ember seams.

Build in native Blender coordinates, with the viewing glass facing negative Y.
The Fuel and Embers groups share a fixed origin at the centre of the log.
The renderer changes the wood finish and ember glow as fuel is consumed.
"""

from math import cos, exp, pi, radians, sin
from random import Random

import bpy

from miniature_geometry import linear


LOG_CENTER = (0, -0.06, 0.57)


def paint(name, color, *, metallic=0.0, roughness=0.74, emission=0.0, alpha=1.0):
    rgb = tuple(linear(int(color[i : i + 2], 16) / 255) for i in (0, 2, 4))
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*rgb, alpha)
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission:
        shader.inputs["Emission Color"].default_value = (*rgb, 1)
        shader.inputs["Emission Strength"].default_value = emission
    if alpha < 1:
        shader.inputs["Alpha"].default_value = alpha
        material.surface_render_method = "BLENDED"
    return material


def group(name, origin=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.empty_display_size = 0.12
    obj.location = origin
    return obj


class Geometry:
    """Accumulate related editable surfaces into one mesh with named materials."""

    def __init__(self):
        self.vertices = []
        self.faces = []
        self.materials = []
        self.indices = []
        self.smooth = []

    def points(self, points):
        first = len(self.vertices)
        self.vertices.extend(points)
        return list(range(first, len(self.vertices)))

    def face(self, indices, material, smooth=False):
        if material not in self.materials:
            self.materials.append(material)
        self.faces.append(indices)
        self.indices.append(self.materials.index(material))
        self.smooth.append(smooth)

    def bridge(self, first, second, material, smooth=False):
        for i in range(len(first)):
            j = (i + 1) % len(first)
            self.face((first[i], first[j], second[j], second[i]), material, smooth)

    def object(self, name, parent):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        for material in self.materials:
            mesh.materials.append(material)
        mesh.polygons.foreach_set("material_index", self.indices)
        mesh.polygons.foreach_set("use_smooth", self.smooth)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = parent
        return obj


def rectangle(width, height, radius, x, y, z):
    """A rounded contour, counterclockwise as seen through the stove door."""
    radius = max(0.0001, min(radius, width / 2, height / 2))
    for quadrant, (sx, sz) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        for index in range(7):
            angle = (quadrant + index / 6) * pi / 2
            yield (x + sx * (width / 2 - radius) + radius * cos(angle), y,
                   z + sz * (height / 2 - radius) + radius * sin(angle))


def box(geo, center, size, radius, material):
    """Rounded front/back and edge bevels survive the glTF export as geometry."""
    x, y, z = center
    w, d, h = size
    bevel = min(radius * 0.55, d * 0.20, w * 0.15, h * 0.15)
    outer = []
    for inset, depth in ((bevel, d / 2), (0, d / 2 - bevel), (0, -d / 2 + bevel), (bevel, -d / 2)):
        outer.append(geo.points(rectangle(w - 2 * inset, h - 2 * inset, radius - inset, x, y + depth, z)))
    for back, front in zip(outer, outer[1:]):
        geo.bridge(back, front, material)
    geo.face(outer[0][::-1], material)
    geo.face(outer[-1], material)


def casting(geo, profiles, material):
    """Turn a rounded rectangular section around the open viewing aperture."""
    rings = [geo.points(rectangle(w, h, r, 0, y, z)) for w, h, r, y, z in profiles]
    for i, ring in enumerate(rings):
        geo.bridge(ring, rings[(i + 1) % len(rings)], material, True)


def baked_soot(obj):
    """Carry the darkened masonry corners into flat-lit classroom browsers."""
    mesh = obj.data
    attr = mesh.color_attributes.new(name="Soot patina", type='BYTE_COLOR', domain='CORNER')
    for face in mesh.polygons:
        red, green, blue, _ = mesh.materials[face.material_index].diffuse_color
        for index in face.loop_indices:
            x, y, z = mesh.vertices[mesh.loops[index].vertex_index].co
            near = exp(-((x / 1.12) ** 2 + ((z - 0.65) / 0.98) ** 2))
            grain = 0.04 * sin(3 * x + 8 * z + sin(x * 6 + y * 5))
            attr.data[index].color = (red * (0.24 + 0.64 * near + grain), green * (0.31 + 0.56 * near + grain),
                                      blue * (0.42 + 0.43 * near + grain), 1.0)
        face.material_index = 0
    mesh.color_attributes.active_color = attr
    patina = paint("Firebrick with baked soot", "71574A")
    node = patina.node_tree.nodes.new("ShaderNodeVertexColor")
    node.layer_name = attr.name
    shader = patina.node_tree.nodes.get("Principled BSDF")
    patina.node_tree.links.new(node.outputs["Color"], shader.inputs["Base Color"])
    mesh.materials.clear()
    mesh.materials.append(patina)


def cabinet(parent):
    iron = paint("Graphite enamel", "34414A", metallic=0.18, roughness=0.53)
    frame = paint("Cast-iron door", "46525A", metallic=0.22, roughness=0.48)
    deep = paint("Cast recess and grate", "202A2D", metallic=0.12)
    steel = paint("Brushed steel fittings", "86999A", metallic=0.30, roughness=0.42)
    gasket = paint("Graphite glass gasket", "262825")
    pad = paint("Warm slate ash pan", "514840")
    body = Geometry()
    casting(body, [
        (2.85, 2.36, 0.17, 0.65, 1.27), (2.96, 2.44, 0.20, 0.58, 1.27),
        (3.00, 2.48, 0.21, -0.48, 1.26), (2.96, 2.44, 0.20, -0.56, 1.26),
        (2.61, 2.08, 0.14, -0.56, 1.27), (2.61, 2.08, 0.14, 0.59, 1.27),
    ], iron)
    box(body, (0, 0.59, 1.26), (2.81, 0.12, 2.34), 0.12, deep)
    box(body, (0, 0.04, 0.06), (2.73, 1.18, 0.12), 0.055, deep)
    casting(body, [
        (2.84, 2.32, 0.18, -0.54, 1.26), (2.90, 2.38, 0.21, -0.61, 1.26),
        (2.89, 2.37, 0.21, -0.656, 1.26), (2.83, 2.31, 0.193, -0.686, 1.26),
        (2.57, 2.04, 0.17, -0.686, 1.26), (2.48, 1.95, 0.14, -0.665, 1.26),
        (2.45, 1.92, 0.13, -0.633, 1.26), (2.45, 1.92, 0.13, -0.59, 1.26),
    ], frame)
    casting(body, [
        (2.49, 1.96, 0.14, -0.628, 1.26), (2.47, 1.94, 0.14, -0.648, 1.26),
        (2.42, 1.89, 0.12, -0.648, 1.26), (2.41, 1.88, 0.12, -0.608, 1.26),
    ], gasket)
    for z in (0.72, 1.79):
        box(body, (-1.406, -0.660, z), (0.10, 0.11, 0.23), 0.035, deep)
        box(body, (-1.406, -0.706, z), (0.074, 0.07, 0.16), 0.03, steel)
    for z in (1.05, 1.49):
        box(body, (1.352, -0.693, z), (0.080, 0.17, 0.075), 0.025, deep)
    box(body, (1.352, -0.771, 1.27), (0.080, 0.085, 0.54), 0.036, steel)
    for side in (-1, 1):
        for j in range(3):
            box(body, (side * 1.484, 0.02 + j * 0.12, 0.63), (0.022, 0.047, 0.54), 0.014, deep)
    box(body, (0, 0.02, 0.226), (2.59, 1.07, 0.12), 0.040, pad)
    for x in (-0.61, 0.61):
        box(body, (x, -0.015, 0.296), (0.077, 0.85, 0.09), 0.026, deep)
    for y in (-0.23, 0.21):
        box(body, (0, y, 0.302), (2.04, 0.045, 0.040), 0.013, deep)
    ash_colors = [paint("Pale wood ash", "A09A8B"), paint("Cold charcoal", "474541")]
    rng = Random(404)
    for i in range(29):
        x, y = rng.uniform(-1.17, 1.17), rng.uniform(-0.47, 0.31)
        w, d, h = rng.uniform(0.03, 0.10), rng.uniform(0.025, 0.077), rng.uniform(0.011, 0.038)
        ash = ash_colors[i % 2]
        perimeter = body.points((x + w * cos(j * pi / 3) * rng.uniform(0.65, 1.0),
                                 y + d * sin(j * pi / 3) * rng.uniform(0.65, 1.0), 0.286) for j in range(6))
        crown = body.points([(x + w * 0.18, y, 0.286 + h)])[0]
        for j in range(6):
            body.face((perimeter[j], perimeter[(j + 1) % 6], crown), ash)
    body.object("Stove casting and hardware", parent)

    brick = [paint("Firebrick sandstone", "88634F"), paint("Firebrick ochre", "805B4C"),
             paint("Firebrick sienna", "866257")]
    mortar = paint("Firebrick joints", "5C4942")
    lining = Geometry()
    box(lining, (0, 0.55, 1.26), (2.65, 0.06, 2.08), 0.025, mortar)
    for side in (-1, 1):
        box(lining, (side * 1.30, 0.045, 1.26), (0.07, 1.08, 2.08), 0.025, mortar)
    for row in range(4):
        z = 0.28 + (row + 0.5) * 0.484
        seams = (-1.26, -0.43, 0.42, 1.26) if row % 2 == 0 else (-1.26, -0.84, 0.01, 0.85, 1.26)
        for j, (left, right) in enumerate(zip(seams, seams[1:])):
            box(lining, ((left + right) / 2, 0.505, z), (right - left - 0.016, 0.07, 0.468),
                0.020, brick[(row + j) % 3])
        for side in (-1, 1):
            seams = (-0.52, -0.12, 0.53) if row % 2 else (-0.52, 0.15, 0.53)
            for j, (front, rear) in enumerate(zip(seams, seams[1:])):
                box(lining, (side * 1.249, (front + rear) / 2, z), (0.065, rear - front - 0.016, 0.468),
                    0.016, brick[(row + j + 1) % 3])
    baked_soot(lining.object("Staggered firebrick lining", parent))

    glass = Geometry()
    pane = paint("Stove viewing glass", "BACED0", metallic=0.12, roughness=0.29, alpha=0.055)
    # A single surface provides one transparent layer between flame and observer.
    glass.face(glass.points(rectangle(2.47, 1.94, 0.135, 0, -0.635, 1.26)), pane)
    glass.object("Viewing glass", parent)
    highlight = Geometry()
    glint = paint("Soft window glint", "CFEBEE", roughness=0.45, alpha=0.19)
    for x, z, size in ((-1.0, 1.98, 0.25), (-0.89, 2.02, 0.13)):
        points = ((x, -0.638, z), (x + size, -0.638, z + 0.14),
                  (x + size * 0.8, -0.638, z + 0.15), (x - 0.03, -0.638, z + 0.028))
        highlight.face(highlight.points(points), glint)
    highlight.object("Door glass highlights", parent)


# Work along a slightly oblique log axis. The irregular radius is shared by its
# core, raised bark, annual rings and ember streaks so those details stay attached.
AXIS = radians(15)


def log_point(t, angle, lift=0.0, scale=1.0, cap_offset=0.0):
    wave = 1 + 0.034 * sin(3 * angle + 0.55 * t) + 0.021 * sin(7 * angle - 1.5 * t)
    y = (0.290 * wave + lift) * cos(angle) * scale
    z = (0.250 * wave + lift) * sin(angle) * scale
    cut = -0.32 * y * (1 - t) + 0.064 * z * t
    x = -0.98 + 1.96 * t + cut + cap_offset
    return (x * cos(AXIS) - y * sin(AXIS), x * sin(AXIS) + y * cos(AXIS), z + 0.035 * (t - 0.5))


def timber(parent):
    core = Geometry()
    end = paint("Split oak end grain", "CB945B")
    grain = paint("Annual rings", "986132")
    cleft = paint("Deep grain checks", "573B2E")
    bare = paint("Fresh split timber", "BF8852")
    inner_bark = paint("Bark underlayer", "44332D")
    bark = [paint("Oak bark umber", "75503B"), paint("Raised russet bark", "8D6045"),
            paint("Bark shadow", "5B473B"), paint("Charred bark", "423B35")]
    bounds = radians(124), radians(422)
    angles = [bounds[0] + (bounds[1] - bounds[0]) * j / 34 for j in range(35)]
    rings = []
    for t in (0, 0.21, 0.41, 0.62, 0.82, 1):
        rings.append(core.points(log_point(t, a) for a in angles))
    for previous, current in zip(rings, rings[1:]):
        for j in range(len(angles)):
            k = (j + 1) % len(angles)
            core.face((previous[j], previous[k], current[k], current[j]), bare if k == 0 else inner_bark)
    core.face(rings[0][::-1], end)
    core.face(rings[-1], end)
    # Visible growth rings run around the end grain and stop at the split top.
    for t, side in ((0, -1), (1, 1)):
        for fraction in (0.17, 0.33, 0.50, 0.68, 0.84):
            outer = core.points(log_point(t, a, scale=fraction, cap_offset=0.003 * side) for a in angles)
            inner = core.points(log_point(t, a, scale=fraction - 0.022, cap_offset=0.003 * side) for a in angles)
            for j in range(len(angles) - 1):
                quad = (outer[j], outer[j + 1], inner[j + 1], inner[j])
                core.face(quad if side > 0 else quad[::-1], grain)
            if fraction < 0.84:
                arc = [bounds[1] + (bounds[0] + 2 * pi - bounds[1]) * j / 12 for j in range(13)]
                outer = core.points(log_point(t, a, scale=fraction, cap_offset=0.003 * side) for a in arc)
                inner = core.points(log_point(t, a, scale=fraction - 0.022, cap_offset=0.003 * side) for a in arc)
                for j in range(len(arc) - 1):
                    quad = (outer[j], outer[j + 1], inner[j + 1], inner[j])
                    core.face(quad if side > 0 else quad[::-1], grain)
        for angle, length in ((2.9, 0.51), (4.9, 0.66), (6.4, 0.78)):
            scar = core.points((log_point(t, angle - 0.035, scale=0.97, cap_offset=0.005 * side),
                                log_point(t, angle + 0.032, scale=0.97, cap_offset=0.005 * side),
                                log_point(t, angle + 0.045, scale=length, cap_offset=0.005 * side)))
            core.face(scar if side > 0 else scar[::-1], cleft)
    rng = Random(741)
    for row in range(13):
        lo = bounds[0] + (bounds[1] - bounds[0]) * row / 13
        hi = bounds[0] + (bounds[1] - bounds[0]) * (row + 1) / 13
        t = 0.004
        while t < 0.986:
            stop = min(0.996, t + rng.uniform(0.14, 0.32))
            dt = stop - t
            if dt < 0.017:
                break
            # Taper individual bark scales into whippy, irregular ends.
            footprint = ((t, lo + 0.17), (t + 0.12 * dt, lo + 0.047), (stop - 0.13 * dt, lo + 0.017),
                         (stop, lo + 0.13), (stop - 0.09 * dt, hi - 0.048),
                         (t + 0.14 * dt, hi - 0.024), (t + 0.02 * dt, hi - 0.10))
            contour = core.points(log_point(a, b, lift=0.004) for a, b in footprint)
            ridge = core.points([log_point(t + dt * rng.uniform(0.40, 0.60), (lo + hi) / 2,
                                          lift=rng.uniform(0.018, 0.034))])[0]
            color = rng.choice(bark[:3]) if sin((lo + hi) / 2) > -0.43 else rng.choice(bark[2:])
            for j in range(len(contour)):
                core.face((contour[(j + 1) % len(contour)], contour[j], ridge), color)
            t = stop + rng.uniform(0.003, 0.011)
    core.object("Split oak with raised bark and growth rings", parent)


def ember_seams(parent):
    glow = Geometry()
    amber = paint("Ember amber", "FF9A42", roughness=0.90, emission=1.45)
    red = paint("Ember red", "ED5838", roughness=0.93, emission=0.85)
    rng = Random(331)
    for i in range(17):
        t = 0.03 + (i % 5) * 0.18 + rng.uniform(-0.015, 0.025)
        angle = radians(169 + (i // 5) * 18) + rng.uniform(-0.03, 0.045)
        length = min(0.97 - t, rng.uniform(0.09, 0.20))
        lo, hi = [], []
        for j in range(7):
            f = j / 6
            a = angle + sin(f * pi * 1.6 + i) * 0.061 + rng.uniform(-0.030, 0.030)
            half = sin(f * pi) * rng.uniform(0.028, 0.059) + 0.0018
            lo.append(glow.points([log_point(t + length * f, a - half, lift=0.018)])[0])
            hi.append(glow.points([log_point(t + length * f, a + half, lift=0.018)])[0])
        for j in range(6):
            glow.face((lo[j], hi[j], hi[j + 1], lo[j + 1]), amber if (i + j) % 5 == 0 else red)
    glow.object("Incandescent seams under the bark", parent)


def build_stove() -> None:
    """Add the stove casing, fixed split log and independently dimmable embers to the active scene."""
    cabinet(group("Stove"))
    timber(group("Fuel", LOG_CENTER))
    ember_seams(group("Embers", LOG_CENTER))
