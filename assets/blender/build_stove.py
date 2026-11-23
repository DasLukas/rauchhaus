"""Build the editable classroom stove and its self-contained animated glTF model.

Run with Blender in background mode using --python assets/blender/build_stove.py.
All geometry uses Blender Z-up coordinates; the viewer looks toward positive Y.
"""

import sys
from math import cos, pi, sin, sqrt
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from stove_model import build_stove, group

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/blender/holzofen.blend"
WEB = ROOT / "public/models/holzofen.glb"
FPS = 24
POSES = 8
FRAMES_PER_POSE = 5
LOOP_FRAMES = POSES * FRAMES_PER_POSE

# Position along the log, offset across it, half-width, height, lean and timing.
TONGUES = (
    (-0.79, -0.04, 0.16, 0.31, -0.08, 0.22),
    (-0.60, 0.078, 0.17, 0.68, 0.14, 1.73),
    (-0.35, -0.085, 0.21, 0.42, -0.10, 4.08),
    (-0.13, 0.06, 0.205, 1.03, 0.19, 0.85),
    (0.08, -0.065, 0.215, 0.49, 0.055, 3.27),
    (0.28, 0.095, 0.135, 0.76, -0.11, 5.08),
    (0.51, -0.035, 0.19, 0.61, 0.12, 2.48),
    (0.76, -0.11, 0.145, 0.30, -0.065, 4.88),
)
# Extra rings near the tips hold the curved silhouettes when a key blends.
LEVELS = (0.0, 0.075, 0.17, 0.28, 0.40, 0.53, 0.66, 0.77, 0.86, 0.93, 0.975, 1.0)
RADIAL_SEGMENTS = 12


def smoothstep(value):
    t = min(1, max(0, value))
    return t * t * (3 - 2 * t)


def flame_paint():
    """Paint a continuous hot inner tongue and amber rim onto each 3D flame."""
    image = bpy.data.images.new("Flame core and amber edge", width=128, height=128, alpha=False)
    pixels = []
    for row in range(128):
        v = row / 127
        for column in range(128):
            theta = (column / 127 - 0.5) * 2 * pi
            # The inner core curves gently across the actual rising flame; the
            # opposite surface also has a hot centre visible when orbiting.
            lateral = abs(sin(theta) + 0.16 * sin(7 * v) * (1 - v))
            gold = smoothstep((1.10 - 0.58 * v ** 2 - lateral) / 0.69)
            core = smoothstep((0.78 * (1 - (v / 0.76) ** 1.5) - lateral) / 0.46)
            outer = (0.99, 0.28 + 0.13 * v, 0.035)
            yellow = (1.0, 0.70, 0.12)
            hot = (1.0, 0.92, 0.51)
            for edge, middle, center in zip(outer, yellow, hot):
                pixels.append((edge * (1 - gold) + middle * gold) * (1 - core) + center * core)
            pixels.append(1.0)
    image.pixels.foreach_set(pixels)
    image.pack()
    material = bpy.data.materials.new("Luminous amber and yellow flame")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.014, 0.005, 0.001, 1)
    shader.inputs["Roughness"].default_value = 1.0
    shader.inputs["Specular IOR Level"].default_value = 0.0
    shader.inputs["Emission Strength"].default_value = 1.55
    texture = material.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image = image
    texture.extension = "EXTEND"
    texture.location = (-340, 0)
    material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Emission Color"])
    return material


def flame_shape(time):
    """Return the same welded ring topology in a different phase of the flame loop."""
    verts = []
    for x, depth, width, height, lean, offset in TONGUES:
        beat = 2 * pi * time
        length = height * (1 + 0.115 * sin(beat + offset) + 0.065 * sin(2 * beat - offset))
        for f in LEVELS:
            bend = 0.135 * sin(1.9 * pi * f + beat + offset) + 0.071 * sin(3 * pi * f - 2 * beat + offset)
            cx = x + lean * f + height * bend * f ** 1.4
            cy = 0.255 * x + depth + f * (0.050 * sin(beat + offset + 3.5 * f) + 0.038 * cos(offset))
            z = -0.027 + length * f
            wave = 1 + 0.115 * sin(4.5 * f - beat + offset) + 0.06 * sin(11 * f + 2 * beat)
            radius = width * (0.61 + 0.82 * sqrt(f)) * (1 - f) ** 0.88 * wave
            # A tiny final ring avoids degenerate triangles when exporting morphs.
            radius = max(0.0012, radius)
            turn = offset * 0.09 + 0.37 * sin(pi * f + beat + offset) * f
            for j in range(RADIAL_SEGMENTS):
                theta = 2 * pi * (j / RADIAL_SEGMENTS - 0.5)
                asymmetric = 1 + 0.10 * sin(3 * theta + offset + f * 3.4)
                rx, ry = sin(theta) * radius * asymmetric, -cos(theta) * radius * 0.59 * asymmetric
                verts.append((cx + rx * cos(turn) - ry * sin(turn), cy + rx * sin(turn) + ry * cos(turn), z))
    return verts


def animate_fire():
    parent = group("Flames", (0, -0.06, 0.78))
    verts = flame_shape(0)
    faces, uv_faces = [], []
    per_tongue = len(LEVELS) * RADIAL_SEGMENTS
    for tongue in range(len(TONGUES)):
        start = tongue * per_tongue
        for k in range(len(LEVELS) - 1):
            lower = start + k * RADIAL_SEGMENTS
            upper = lower + RADIAL_SEGMENTS
            for i in range(RADIAL_SEGMENTS):
                j = (i + 1) % RADIAL_SEGMENTS
                faces.append((lower + i, lower + j, upper + j, upper + i))
                u0, u1 = i / RADIAL_SEGMENTS, (i + 1) / RADIAL_SEGMENTS
                uv_faces.append(((u0, LEVELS[k]), (u1, LEVELS[k]), (u1, LEVELS[k + 1]), (u0, LEVELS[k + 1])))
        for k in (0, len(LEVELS) - 1):
            cap = tuple(start + k * RADIAL_SEGMENTS + j for j in range(RADIAL_SEGMENTS))
            faces.append(cap if k else cap[::-1])
            uv_faces.append([(0.5, LEVELS[k])] * RADIAL_SEGMENTS)
    mesh = bpy.data.meshes.new("Flame ribbons in the round")
    mesh.from_pydata(verts, [], faces)
    mesh.polygons.foreach_set("use_smooth", [True] * len(faces))
    mesh.update()
    uv = mesh.uv_layers.new(name="Flame colour")
    uv.uv.foreach_set("vector", [value for face in uv_faces for pair in face for value in pair])
    obj = bpy.data.objects.new("Dancing flame tongues", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    mesh.materials.append(flame_paint())
    obj.shape_key_add(name="Rest silhouette")
    for phase in range(1, POSES):
        key = obj.shape_key_add(name=f"Flicker {phase}")
        key.data.foreach_set("co", [n for point in flame_shape(phase / POSES) for n in point])
        for moment in range(POSES + 1):
            key.value = float(moment == phase)
            key.keyframe_insert(data_path="value", frame=1 + moment * FRAMES_PER_POSE)
    mesh.shape_keys.animation_data.action.name = "Wood fire loop"


def preview_studio():
    """Add editor-only framing and illumination; runtime lights belong to the app."""
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new("Cool daylight")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.42, 0.72, 0.83, 1)
    background.inputs["Strength"].default_value = 0.50
    target = Vector((0, 0, 1.23))
    studio = bpy.data.collections.new("Preview studio")
    scene.collection.children.link(studio)
    for name, position, strength, size, color in (
        ("Softbox", (-3.5, -4, 5), 440, 4.2, (1.0, 0.87, 0.71)),
        ("Blue fill", (3, -2, 3.6), 240, 3.0, (0.72, 0.91, 1.0)),
    ):
        lamp = bpy.data.lights.new(name, "AREA")
        obj = bpy.data.objects.new(name, lamp)
        studio.objects.link(obj)
        obj.location = position
        obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()
        lamp.energy, lamp.shape, lamp.size, lamp.color = strength, "DISK", size, color
    light = bpy.data.lights.new("Firebox bounce", "POINT")
    obj = bpy.data.objects.new("Firebox bounce", light)
    studio.objects.link(obj)
    obj.location = (0, -0.10, 1.16)
    light.energy, light.color, light.shadow_soft_size = 11, (1.0, 0.38, 0.105), 0.24
    camera = bpy.data.cameras.new("Stove front")
    obj = bpy.data.objects.new("Stove front", camera)
    studio.objects.link(obj)
    obj.location = (-0.78, -7.0, 1.55)
    obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()
    camera.type, camera.ortho_scale = "ORTHO", 3.72
    scene.camera = obj
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1000, 800
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
            area.spaces.active.shading.type = 'MATERIAL'
            area.spaces.active.shading.use_scene_lights = True


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "Wood stove"
    scene.frame_start, scene.frame_end = 1, 1 + LOOP_FRAMES
    scene.render.fps = FPS
    build_stove()
    animate_fire()
    web_objects = list(scene.objects)
    preview_studio()
    scene.frame_set(1)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.preferences.filepaths.file_preview_type = 'NONE'
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in web_objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(WEB), export_format='GLB', use_selection=True, export_yup=True,
        export_cameras=False, export_lights=False, export_animations=True,
        export_animation_mode='ACTIONS', export_frame_range=True, export_force_sampling=True,
        export_anim_slide_to_zero=True,
        export_morph=True, export_morph_normal=False,
    )


if __name__ == '__main__':
    main()
