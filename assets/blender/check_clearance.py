"""Geometry-based checks for moving leaves and the continuous central stair."""

from math import cos, hypot, sin

from mathutils.bvhtree import BVHTree
from miniature_geometry import PARTS
from structure import BACK_EDGE, FRONT_EDGE, HINGES, LAYOUT, PITCH, STEP_COUNT


def bounds(entries):
    vertices = [v for _, vs, *_ in entries for v in vs]
    return tuple((min(p[axis] for p in vertices), max(p[axis] for p in vertices)) for axis in range(3))


def joined(entries):
    vertices, faces = [], []
    for _, vs, fs, *_ in entries:
        offset = len(vertices)
        vertices.extend(vs)
        faces.extend(tuple(offset + i for i in face) for face in fs)
    return vertices, faces


def touches(a, b):
    return all(amax >= bmin and bmax >= amin for (amin, amax), (bmin, bmax) in zip(a, b))


def check_swings():
    """Sweep actual leaf/lever meshes and test every potentially touching obstacle.

    A one-degree increment moves any vertex less than 17 mm. The static BVH is
    inflated by 10 mm so adjacent samples also cover intervening angles. Separate
    circumscribed disk pairs prove that independently moving doors cannot meet.
    """
    solids = [
        (group, e, bounds([e])) for group, entries in PARTS.items() if not group.startswith("hinge_") for e in entries
    ]
    disks = []
    for d in LAYOUT["doors"]:
        ident = d["id"]
        px, _, pz = HINGES[ident]
        vs, fs = joined(PARTS["hinge_" + ident])
        radius = max(hypot(x - px, z - pz) for x, _, z in vs)
        swept = (
            (px - radius - 0.01, px + radius + 0.01),
            (min(p[1] for p in vs) - 0.01, max(p[1] for p in vs) + 0.01),
            (pz - radius - 0.01, pz + radius + 0.01),
        )
        candidates = [(g, e) for g, e, b in solids if touches(swept, b)]
        fixed_vertices, fixed_faces = joined([e for _, e in candidates])
        tree = BVHTree.FromPolygons(fixed_vertices, fixed_faces, epsilon=0.010)
        for i in range(91):
            a = d["openAngle"] * i / 90
            c, s = cos(a), sin(a)
            rotated = [(px + c * (x - px) + s * (z - pz), y, pz - s * (x - px) + c * (z - pz)) for x, y, z in vs]
            hits = tree.overlap(BVHTree.FromPolygons(rotated, fs))
            if hits:
                indices = {h[0] for h in hits}
                offset = 0
                names = []
                for group, e in candidates:
                    if any(offset <= k < offset + len(e[2]) for k in indices):
                        names.append(group + "/" + e[0])
                    offset += len(e[2])
                raise ValueError(f"Door {ident}, angle {i}°, collision with {set(names)}")
        for other, f, x, z, r in disks:
            if f == d["floor"] and hypot(px - x, pz - z) <= radius + r:
                raise ValueError(f"Overlapping independent door sweeps: {other}, {ident}")
        disks.append((ident, d["floor"], px, pz, radius))
    print(f"All {len(disks)} door sweeps clear with handles, 91 samples each.", flush=True)


def check_stairs():
    """Ray-test finished tread meshes, end/half landings, headroom and slab holes."""
    entries = PARTS["House structure"]
    steps = BVHTree.FromPolygons(
        *joined([e for e in entries if e[0] in {"Limestone tread", "Landing", "Half landing", "Terrazzo nosing"}])
    )
    architecture = BVHTree.FromPolygons(*joined(entries))

    def floor_at(x, y, z):
        hit = steps.ray_cast((x, y + 0.045, z), (0, -1, 0), 0.09)
        if hit[0] is None or abs(hit[0].y - y) > 0.014:
            raise ValueError(f"Missing walkable surface at {x:.2f}, {y:.2f}, {z:.2f}")
        above = architecture.ray_cast((x, y + 0.04, z), (0, 1, 0), 1.98)
        if above[0] is not None:
            raise ValueError(f"Stair headroom at {(x, y, z)}: {above[3]:.2f} m")

    for level in range(-1, 3):
        low = level * PITCH
        for side, y, z0, z1 in [
            (-1, low, FRONT_EDGE, BACK_EDGE),
            (1, low + PITCH / 2, BACK_EDGE, FRONT_EDGE),
        ]:
            for i in range(STEP_COUNT):
                z = z0 + (z1 - z0) * (i + 0.5) / STEP_COUNT
                for dx in (-0.35, 0, 0.35):
                    floor_at(side * 0.707 + dx, y + (i + 1) * PITCH / 2 / STEP_COUNT, z)
        # Traverse the landing at both ends, including the turn across the core.
        for x in (-0.88, 0, 0.88):
            floor_at(x, low + PITCH / 2, BACK_EDGE - 0.50)
            floor_at(x, low + PITCH, FRONT_EDGE + 0.32)
        for x in (-0.98, 0.98):
            floor_at(x, low, FRONT_EDGE + 0.30)
        # The central eye is genuinely open between all floors.
        if architecture.ray_cast((0, low + 0.02, 0), (0, 1, 0), PITCH)[0] is not None:
            raise ValueError(f"Central stair eye is blocked above level {level}")
    print(
        "Eight flights have continuous walkable treads, clear headroom and usable landings.",
        flush=True,
    )


def validate():
    check_swings()
    check_stairs()
