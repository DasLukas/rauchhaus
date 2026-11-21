"""Build the editable smoke house and its mobile GLB from the same geometry.

Run with Blender in background mode using --python assets/blender/build_house.py.
The design coordinates below are in glTF space: X right, Y up and Z towards
the open face of the model. Only the Blender boundary converts coordinates.
"""

import sys
from math import cos, pi, sin, sqrt
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

# Blender does not add the directory of a --python script to its import path.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_clearance import validate
from house_rooms import furnish, garden
from miniature_geometry import PARTS, point, unit
from structure import ANCHORS, ANGLES, HINGES, add_structure

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/blender/rauchhaus.blend"
WEB = ROOT / "public/models/rauchhaus.glb"


def contact_shading():
    """Sample nearby solids for gentle, baked contact shadows on mobile."""
    all_vertices, all_faces = [], []
    for collection, entries in PARTS.items():
        # Door positions change while teaching; avoid static painted shadows
        # that would linger at their closed positions after opening.
        if collection.startswith("hinge_"):
            continue
        for _, verts, faces, _, _ in entries:
            offset = len(all_vertices)
            all_vertices.extend(verts)
            all_faces.extend(tuple(offset + i for i in face) for face in faces)
    tree = BVHTree.FromPolygons(all_vertices, all_faces)
    # Deterministic equal-area sphere samples avoid patterned corner shadows.
    directions = []
    golden_angle = pi * (3 - sqrt(5))
    for i in range(52):
        height = 1 - (i + 0.5) * 2 / 52
        radius = sqrt(1 - height * height)
        directions.append(Vector((radius * cos(i * golden_angle), height, radius * sin(i * golden_angle))))
    # A broad frontal softbox gives objects a subtle, directional penumbra
    # behind them. This baked term survives low-resolution tablet shadow maps.
    window = [
        Vector(unit((horizontal, elevation, 1)))
        for elevation in (0.10, 0.34, 0.59, 0.85)
        for horizontal in (-0.65, -0.22, 0.16)
    ]
    cache = {}
    for entries in PARTS.values():
        for _, verts, _, normals, _ in entries:
            for p, n in zip(verts, normals):
                key = (p, n)
                if key in cache:
                    continue
                normal = Vector(n)
                origin = Vector(p) + normal * 0.003
                occ, total = 0.0, 0.0
                for direction in directions:
                    weight = normal.dot(direction)
                    if weight <= 0.04:
                        continue
                    total += weight
                    hit = tree.ray_cast(origin, direction, 1.15)
                    if hit[3] is not None:
                        occ += weight * (1 - hit[3] / 1.15) ** 1.5
                blocked = 0.0
                for direction in window:
                    weight = normal.dot(direction)
                    if weight <= 0:
                        continue
                    hit = tree.ray_cast(origin, direction, 3.15)
                    if hit[3] is not None:
                        blocked += weight * (1 - hit[3] / 3.15) ** 0.72
                cache[key] = (1 - 0.77 * occ / max(total, 0.1)) * (1 - 0.36 * blocked / len(window))
    return cache


def vertex_material():
    mat = bpy.data.materials.new("Matte painted miniature")
    mat.use_nodes = True
    mat.use_backface_culling = True
    tree = mat.node_tree
    shader = tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = 0.79
    shader.inputs["Metallic"].default_value = 0
    att = tree.nodes.new("ShaderNodeVertexColor")
    att.layer_name = "Paint"
    tree.links.new(att.outputs["Color"], shader.inputs["Base Color"])
    return mat


def create_mesh(name, entries, collection, material, shade, origin=None):
    vertices, faces, normals, colors = [], [], [], []
    if origin is None:
        lows = [min(v[k] for _, vs, _, _, _ in entries for v in vs) for k in range(3)]
        highs = [max(v[k] for _, vs, _, _, _ in entries for v in vs) for k in range(3)]
        origin = tuple((a + b) / 2 for a, b in zip(lows, highs))
    for _, vs, fs, ns, base in entries:
        offset = len(vertices)
        vertices.extend(point((v[0] - origin[0], v[1] - origin[1], v[2] - origin[2])) for v in vs)
        faces.extend(tuple(offset + j for j in face) for face in fs)
        normals.extend(point(n) for n in ns)
        for v, n in zip(vs, ns):
            ao = shade[(v, n)]
            colors.extend((base[0] * ao, base[1] * ao, base[2] * ao, 1.0))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    mesh.normals_split_custom_set_from_vertices(normals)
    att = mesh.color_attributes.new(name="Paint", type="BYTE_COLOR", domain="POINT")
    att.data.foreach_set("color", colors)
    mesh.color_attributes.active_color = att
    obj = bpy.data.objects.new(name, mesh)
    obj.location = point(origin)
    collection.objects.link(obj)
    mesh.materials.append(material)
    return obj


def empty(name, pos, coll):
    obj = bpy.data.objects.new(name, None)
    coll.objects.link(obj)
    obj.location = point(pos)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.12
    return obj


def make_scene(editable, shade):
    scene = bpy.context.scene
    material = vertex_material()
    glass = material.copy()
    glass.name = "Clear entrance glazing"
    glass.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = 0.20
    glass.surface_render_method = "BLENDED"
    for title, entries in PARTS.items():
        moving = title.startswith("hinge_")
        coll = bpy.data.collections.new(title if not moving else "Door " + title[6:])
        scene.collection.children.link(coll)
        parent = None
        if moving:
            ident = title[6:]
            parent = empty(title, HINGES[ident], coll)
            parent["openAngle"] = ANGLES[ident]
        batches = [(entry[0], [entry]) for entry in entries] if editable else [(title + " surfaces", entries)]
        for name, batch in batches:
            obj = create_mesh(
                name,
                batch,
                coll,
                glass if title == "Entrance glazing" else material,
                shade,
            )
            if parent:
                obj.parent = parent
                obj.location -= parent.location
    interaction = bpy.data.collections.new("Interaction anchors")
    scene.collection.children.link(interaction)
    for ident, loc in ANCHORS.items():
        anchor = empty("anchor_" + ident, loc, interaction)
        anchor["id"] = ident


def studio():
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("Front cutaway")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 20.4
    cam = bpy.data.objects.new("Front cutaway", cam_data)
    scene.collection.objects.link(cam)
    cam.location = point((-3.2, 7.68, 22))
    target = Vector(point((0, 4.23, 0)))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    def area(name, where, power, color, size):
        light = bpy.data.lights.new(name, "AREA")
        light.energy = power
        light.color = color
        light.shape = "DISK"
        light.size = size
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = point(where)
        obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()

    area("Large warm key", (-7, 15, 11), 2100, (1, 0.87, 0.70), 7)
    area("Soft light into the cut", (0, 3, 12), 1350, (1, 0.94, 0.82), 11)
    area("Soft sky fill", (8, 7, 6), 1200, (0.76, 0.88, 1), 7)
    area("Rim light", (-1, 10, -5), 1120, (1, 0.9, 0.75), 5)
    world = bpy.data.worlds.new("Blue sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.28, 0.73, 0.90, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.63
    scene.world = world
    scene.render.engine = "CYCLES"
    scene.view_settings.view_transform = "Standard"
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    for screen in bpy.data.screens:
        for area_ui in screen.areas:
            if area_ui.type == "VIEW_3D":
                space = area_ui.spaces.active
                space.region_3d.view_perspective = "CAMERA"
                space.shading.color_type = "VERTEX"
                space.overlay.show_overlays = False


def build():
    import time

    started = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    add_structure()
    furnish()
    garden()
    validate()
    print("Sampling miniature contact shadows", flush=True)
    shade = contact_shading()
    make_scene(True, shade)
    studio()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    make_scene(False, shade)
    bpy.ops.export_scene.gltf(
        filepath=str(WEB),
        export_format="GLB",
        export_texcoords=False,
        export_normals=True,
        export_vertex_color="ACTIVE",
        export_animations=False,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
    )
    print(
        f"Built {len(ANCHORS)} interaction anchors and {len(HINGES)} hinged doors in {time.monotonic() - started:.1f}s"
    )


if __name__ == "__main__":
    build()
