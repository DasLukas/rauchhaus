"""Rounded model primitives, named paint colors and collection geometry."""

from collections import defaultdict
from math import ceil, cos, pi, sin

from mathutils import Vector

COLORS = {
    "birch": "F2C58D",
    "rim": "FFE0AD",
    "honey": "D89957",
    "oak": "BB794B",
    "umber": "87563D",
    "walnut": "78513F",
    "cream": "FFF0C8",
    "porcelain": "FFFAE5",
    "yellow": "FFC447",
    "gold": "EDA72C",
    "lemon": "FFE06A",
    "apricot": "FFD899",
    "peach": "FFD8A4",
    "rosewall": "FFE1B4",
    "rose": "EFA8AA",
    "pink": "FFB9C1",
    "terracotta": "CA6455",
    "coral": "F16C61",
    "tomato": "DC554C",
    "poppy": "FF8670",
    "blue": "4D9DC5",
    "denim": "467AAB",
    "sky": "90D4E5",
    "pale": "CCEBE6",
    "turquoise": "50B7AA",
    "teal": "2F8F83",
    "mint": "9DD7AE",
    "green": "67B77C",
    "grass": "8FCA77",
    "lime": "B1DB81",
    "fern": "459A68",
    "leaf": "65B971",
    "sprout": "8ED187",
    "deepgreen": "328659",
    "navy": "33485B",
    "screen": "233848",
    "iron": "465360",
    "silver": "B9CED0",
    "lilac": "B2AACF",
    "tangerine": "FF9A48",
}


def linear(s):
    return ((s + 0.055) / 1.055) ** 2.4 if s > 0.04045 else s / 12.92


PALETTE = {k: tuple(linear(int(v[i : i + 2], 16) / 255) for i in (0, 2, 4)) for k, v in COLORS.items()}
PARTS = defaultdict(list)
group = "House structure"


def select_collection(name):
    """Route subsequent shapes to a group; return the previous group."""
    global group
    previous = group
    group = name
    return previous


def point(pos):
    return (pos[0], -pos[2], pos[1])


def pose(vertices, normals, center, yaw=0, roll=0):
    # Roll is in the frontal plane, followed by yaw around the vertical axis.
    cy, sy, cr, sr = cos(yaw), sin(yaw), cos(roll), sin(roll)

    def rot(v):
        u, h = cr * v[0] - sr * v[1], sr * v[0] + cr * v[1]
        return (cy * u + sy * v[2], h, -sy * u + cy * v[2])

    origin = Vector(center)
    return [tuple(origin + Vector(rot(v))) for v in vertices], [rot(n) for n in normals]


def unit(v):
    v = Vector(v)
    return tuple(v.normalized())


def part(name, vertices, faces, normals, color, center=(0, 0, 0), yaw=0, roll=0):
    v, n = pose(vertices, normals, center, yaw, roll)
    PARTS[group].append((name, v, faces, n, PALETTE[color]))


def box(name, x, y, z, w, h, d, color, radius=0.035, yaw=0, roll=0):
    """A true rounded solid with flat faces, rounded corners and analytic normals."""
    half = [w / 2, h / 2, d / 2]
    r = min(radius, min(half) * 0.85)
    vs, ns, fs = [], [], []
    # Submillimetre seams and thin cabinetry do not need the same tessellation
    # as the soft, rounded silhouette of the sofa or the refrigerator.
    if r < 0.003:
        for axis in range(3):
            u, v = (axis + 1) % 3, (axis + 2) % 3
            for sign in (-1, 1):
                first = len(vs)
                for du, dv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                    raw = [0.0, 0.0, 0.0]
                    raw[axis], raw[u], raw[v] = sign * half[axis], du * half[u], dv * half[v]
                    normal = [0.0, 0.0, 0.0]
                    normal[axis] = sign
                    vs.append(tuple(raw))
                    ns.append(tuple(normal))
                face = tuple(range(first, first + 4))
                fs.append(face if sign > 0 else face[::-1])
        part(name, vs, fs, ns, color, (x, y, z), yaw, roll)
        return
    steps = [
        sorted({-a, -a + r, a - r, a}) if r < 0.028 else sorted({-a, -a + r * 0.52, -a + r, a - r, a - r * 0.52, a})
        for a in half
    ]
    # Interpolate baked illumination across large visible surfaces; only the
    # inward-facing structural faces need a high sampling density.
    wall = name in {
        "Apartment back",
        "Stairwell back",
        "Right outer wall",
        "Left outer wall",
        "Partition return",
        "Door header",
    }
    slab = name in {"Base plate", "Apartment ceiling", "Landing", "Half landing", "Coral roof"}
    furnishings = group not in {"House structure", "Garden"} and not group.startswith("hinge_")

    def light_samples(values, pitch):
        inner = values[-2] if r < 0.028 else values[-3]
        count = max(1, ceil(2 * inner / pitch))
        return sorted(set(values) | {-inner + 2 * inner * i / count for i in range(1, count)})

    # Face axes in cyclic order yield outward normals at the positive face.
    for axis in range(3):
        u, v = (axis + 1) % 3, (axis + 2) % 3
        for sign in (-1, 1):
            first = len(vs)
            across, along = steps[u], steps[v]
            if (
                (wall and axis == half.index(min(half)))
                or (slab and axis == 1)
                or (furnishings and sign == 1 and axis in (1, 2) and min(half[u], half[v]) > 0.11)
            ):
                pitch = 0.135 if furnishings else 0.145
                across, along = light_samples(across, pitch), light_samples(along, pitch)
            for a in across:
                for b in along:
                    raw = [0.0, 0.0, 0.0]
                    raw[axis], raw[u], raw[v] = sign * half[axis], a, b
                    clamped = [min(t - r, max(-t + r, p)) for t, p in zip(half, raw)]
                    norm = unit([p - q for p, q in zip(raw, clamped)])
                    vs.append(tuple(q + r * n for q, n in zip(clamped, norm)))
                    ns.append(norm)
            stride = len(along)
            for i in range(len(across) - 1):
                for j in range(stride - 1):
                    k = first + i * stride + j
                    face = (k, k + stride, k + stride + 1, k + 1)
                    fs.append(face if sign > 0 else face[::-1])
    part(name, vs, fs, ns, color, (x, y, z), yaw, roll)


def orb(name, x, y, z, rx, ry, rz, color, roll=0, yaw=0, segments=14, rings=8):
    vs, ns, fs = [(0, ry, 0)], [(0, 1, 0)], []
    for i in range(1, rings):
        phi = pi * i / rings
        for j in range(segments):
            theta = 2 * pi * j / segments
            vx, vy, vz = sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta)
            vs.append((rx * vx, ry * vy, rz * vz))
            ns.append(unit((vx / rx, vy / ry, vz / rz)))
    bot = len(vs)
    vs.append((0, -ry, 0))
    ns.append((0, -1, 0))
    for j in range(segments):
        q = (j + 1) % segments
        fs.append((0, 1 + q, 1 + j))
        for i in range(rings - 2):
            a, b = 1 + i * segments + j, 1 + i * segments + q
            fs.append((a, b, b + segments, a + segments))
        fs.append((bot, bot - segments + j, bot - segments + q))
    part(name, vs, fs, ns, color, (x, y, z), yaw, roll)


def lathe(name, x, y, z, profile, color, segments=18, depth=1.0, yaw=0):
    """Surface of revolution with smooth rings and separate flat end caps."""
    vs, ns, fs = [], [], []
    for i, (yy, rr) in enumerate(profile):
        y0, r0 = profile[max(0, i - 1)]
        y1, r1 = profile[min(len(profile) - 1, i + 1)]
        for j in range(segments):
            c, s = cos(2 * pi * j / segments), sin(2 * pi * j / segments)
            vs.append((rr * c, yy, rr * s * depth))
            ns.append(unit(((y1 - y0) * c, -(r1 - r0), (y1 - y0) * s / depth)))
    for i in range(len(profile) - 1):
        for j in range(segments):
            a, b = i * segments + j, i * segments + (j + 1) % segments
            fs.append((a, a + segments, b + segments, b))
    for i, sign in ((0, -1), (len(profile) - 1, 1)):
        if sign == 1 and (name == "Grass cover" or "rug" in name or name == "Play mat"):
            height, radius = profile[i]
            first = len(vs)
            vs.append((0, height, 0))
            ns.append((0, 1, 0))
            rings = max(2, ceil(radius / 0.15))
            for k in range(1, rings + 1):
                for j in range(segments):
                    theta = 2 * pi * j / segments
                    dist = radius * k / rings
                    vs.append((dist * cos(theta), height, dist * sin(theta) * depth))
                    ns.append((0, 1, 0))
                offset = first + 1 + (k - 1) * segments
                for j in range(segments):
                    a, b = offset + j, offset + (j + 1) % segments
                    fs.append((first, b, a) if k == 1 else (a - segments, b - segments, b, a))
            continue
        first = len(vs)
        for j in range(segments):
            vs.append(vs[i * segments + j])
            ns.append((0, sign, 0))
        order = list(range(first, first + segments))
        fs.append(tuple(order[::-1] if sign == 1 else order))
    part(name, vs, fs, ns, color, (x, y, z), yaw)


def post(name, a, b, r, color, r2=None, segments=10):
    a, b = Vector(a), Vector(b)
    direction = (b - a).normalized()
    basis = direction.cross(Vector((0, 0, 1)) if abs(direction.z) < 0.9 else Vector((1, 0, 0))).normalized()
    other = direction.cross(basis)
    vs, ns, fs = [], [], []
    for origin, rad in ((a, r), (b, r if r2 is None else r2)):
        for j in range(segments):
            n = basis * cos(2 * pi * j / segments) + other * sin(2 * pi * j / segments)
            vs.append(tuple(origin + rad * n))
            ns.append(tuple(n))
    for j in range(segments):
        q = (j + 1) % segments
        fs.append((j, q, segments + q, segments + j))
    for i, sign in ((0, -1), (segments, 1)):
        first = len(vs)
        for j in range(segments):
            vs.append(vs[i + j])
            ns.append(tuple(direction * sign))
        order = list(range(first, first + segments))
        fs.append(tuple(order if sign == 1 else order[::-1]))
    part(name, vs, fs, ns, color)


def tube(name, points, r, color):
    for i in range(1, len(points)):
        post(name, points[i - 1], points[i], r, color)
    for p in points[1:-1]:
        orb(name, *p, r, r, r, color, segments=8, rings=4)


def prism(name, outline, z1, z2, color):
    # Front faces use counter-clockwise XY coordinates.
    vs, ns, fs = [], [], []
    for z, normal in ((z1, (0, 0, -1)), (z2, (0, 0, 1))):
        if name == "Gable back" and z == z2:
            # Barycentric subdivision keeps the gable silhouette exact.
            left, right, ridge = (Vector(p) for p in outline)
            resolution = ceil((right - left).length / 0.145)
            rows = []
            for row in range(resolution + 1):
                points = []
                for column in range(resolution + 1 - row):
                    sample = left + (right - left) * (column / resolution) + (ridge - left) * (row / resolution)
                    points.append(len(vs))
                    vs.append((sample.x, sample.y, z))
                    ns.append(normal)
                rows.append(points)
            for row in range(resolution):
                for col in range(resolution - row):
                    fs.append((rows[row][col], rows[row][col + 1], rows[row + 1][col]))
                    if col + 1 < len(rows[row + 1]):
                        fs.append((rows[row][col + 1], rows[row + 1][col + 1], rows[row + 1][col]))
            continue
        base = len(vs)
        vs.extend((x, y, z) for x, y in outline)
        ns.extend([normal] * len(outline))
        ids = tuple(range(base, len(vs)))
        fs.append(ids[::-1] if z == z1 else ids)
    for j, a in enumerate(outline):
        b = outline[(j + 1) % len(outline)]
        n = unit((b[1] - a[1], a[0] - b[0], 0))
        base = len(vs)
        vs.extend(((a[0], a[1], z1), (b[0], b[1], z1), (b[0], b[1], z2), (a[0], a[1], z2)))
        ns.extend([n] * 4)
        fs.append(tuple(range(base, base + 4)))
    part(name, vs, fs, ns, color)


def oval(name, x, y, z, rx, rz, thickness, color):
    lathe(
        name,
        x,
        y,
        z,
        [(-thickness / 2, rx * 0.98), (-thickness * 0.26, rx), (thickness * 0.26, rx), (thickness / 2, rx * 0.98)],
        color,
        40,
        rz / rx,
    )


def vertical_panel(name, a, b, low, high, thickness, color, r=0.018):
    # Local +Z traces the panel between its two endpoints.
    from math import atan2, hypot

    dx, dz = b[0] - a[0], b[1] - a[1]
    box(
        name,
        (a[0] + b[0]) / 2,
        (low + high) / 2,
        (a[1] + b[1]) / 2,
        thickness,
        high - low,
        hypot(dx, dz),
        color,
        r,
        atan2(dx, dz),
    )
