"""Shell, walkable return stair, basement cut and rooftop equipment."""

import json
from math import atan, cos, hypot, sin
from pathlib import Path

from miniature_geometry import box, orb, post, prism, select_collection, tube

LAYOUT = json.loads((Path(__file__).resolve().parents[2] / "src/simulation/layout.json").read_text())
DIMS = LAYOUT["dimensions"]
PITCH = DIMS["levelHeight"]
FRONT, BACK = DIMS["maxZ"], DIMS["minZ"]
CORE = DIMS["stairHalfWidth"]
ROOF = LAYOUT["roof"]
HINGES = {}
ANGLES = {}
ANCHORS = {item["id"]: tuple(item["position"]) for key in ("sources", "detectors") for item in LAYOUT[key]}


def ceiling(x):
    return ROOF["ridgeY"] - ROOF["slope"] * abs(x)


def add_door(d):
    """Paint both faces of a leaf in its wall plane, about its true vertical pin."""
    ident, x, f = d["id"], d["x"], d["floor"]
    y, height = f * PITCH, d["height"]
    top = ceiling(x) - y if f == ROOF["floor"] else DIMS["clearHeight"]
    pivot, latch = d["hingeZ"], d["latchZ"]
    width = pivot - latch
    # The frame faces stop just outside the moving corners, including the reveal.
    for a, b in [(BACK, latch - 0.052), (pivot + 0.052, FRONT)]:
        box(
            "Partition return",
            x,
            y + top / 2,
            (a + b) / 2,
            0.12,
            top,
            b - a,
            "cream",
            0.012,
        )
    box(
        "Door header",
        x,
        y + (height + top) / 2,
        (pivot + latch) / 2,
        0.12,
        top - height,
        width + 0.12,
        "cream",
        0.014,
    )
    for z in [pivot + 0.073, latch - 0.073]:
        box("Door casing", x, y + height / 2, z, 0.156, height, 0.048, "rim", 0.009)
    box(
        "Casing header",
        x,
        y + height + 0.025,
        (pivot + latch) / 2,
        0.156,
        0.05,
        width + 0.18,
        "rim",
        0.010,
    )
    HINGES[ident] = (x, y, pivot)
    ANGLES[ident] = d["openAngle"]
    ANCHORS[ident] = (x, y + 1.06, pivot)
    previous = select_collection("hinge_" + ident)
    color = "turquoise" if ident.startswith("i") else ("denim" if f < 0 else "coral")
    box(
        "Painted apartment door",
        x,
        y + height / 2,
        (pivot + latch) / 2,
        0.056,
        height - 0.052,
        width - 0.055,
        color,
        0.016,
    )
    for side in (-1, 1):
        for cy, h in ((0.49, 0.64), (1.30, 0.74)):
            box(
                "Inset painted panel",
                x + side * 0.031,
                y + cy,
                (pivot + latch) / 2,
                0.012,
                h,
                width - 0.18,
                "mint" if color == "turquoise" else ("blue" if f < 0 else "poppy"),
                0.008,
            )
        box(
            "Handle plate",
            x + side * 0.041,
            y + 0.98,
            latch + 0.14,
            0.020,
            0.15,
            0.063,
            "honey",
            0.009,
        )
        tube(
            "Door lever",
            [
                (x + side * 0.046, y + 1.015, latch + 0.14),
                (x + side * 0.091, y + 1.015, latch + 0.14),
                (x + side * 0.091, y + 1.015, latch + 0.275),
            ],
            0.018,
            "gold",
        )
        if not ident.startswith("i") and f >= 0:
            orb(
                "Peephole",
                x + side * 0.034,
                y + 1.50,
                (pivot + latch) / 2,
                0.009,
                0.026,
                0.026,
                "gold",
                segments=8,
                rings=4,
            )
    select_collection(previous)


# Door centres at the front of the shaft require full-width floor landings.
FRONT_EDGE = 0.82
BACK_EDGE = -0.96
STEP_COUNT = 7
TREADS = []


def rail_run(x, y, z1, z2, height, rise):
    points = [(x, y + height, z1), (x, y + height + rise, z2)]
    post("Oak handrail", *points, 0.043, "honey", segments=10)
    for k in range(5):
        t = k / 4
        z = z1 + (z2 - z1) * t
        base = y + rise * t
        post(
            "Stair baluster",
            (x, base - 0.06, z),
            (x, base + height, z),
            0.022 if k in (0, 4) else 0.016,
            "slate",
            segments=8,
        )
    post(
        "Guard lower rail",
        (x, y + 0.19, z1),
        (x, y + 0.19 + rise, z2),
        0.015,
        "slate",
        segments=8,
    )


def flights(level):
    y = level * PITCH
    mid = y + PITCH / 2
    box(
        "Half landing",
        0,
        mid - 0.07,
        (BACK_EDGE + BACK) / 2,
        CORE * 2 - 0.11,
        0.14,
        BACK_EDGE - BACK,
        "limestone",
        0.017,
    )
    # Left flight runs away from the facade; right flight returns to the storey landing.
    for idx, (side, low, begin, end) in enumerate([(-1, y, FRONT_EDGE, BACK_EDGE), (1, mid, BACK_EDGE, FRONT_EDGE)]):
        riser = (PITCH / 2) / STEP_COUNT
        tread = (end - begin) / STEP_COUNT
        cx = side * 0.707
        path = [(begin, low)]
        for i in range(STEP_COUNT):
            top = low + (i + 1) * riser
            z = begin + (i + 0.5) * tread
            box(
                "Limestone tread",
                cx,
                top - 0.106,
                z,
                1.19,
                0.212,
                abs(tread) + 0.012,
                "limestone",
                0.015,
            )
            box(
                "Terrazzo nosing",
                cx,
                top - 0.021,
                z - tread * 0.47,
                1.18,
                0.042,
                0.028,
                "warmgrey",
                0.008,
            )
            path.append((begin + (i + 1) * tread, top))
        TREADS.append((level, idx, path))
        for edge in (-0.53, 0.53):
            post(
                "Stair carriage",
                (cx + edge, low - 0.12, begin),
                (cx + edge, low + PITCH / 2 - 0.14, end),
                0.084,
                "warmgrey",
                segments=6,
            )
        # Inner guard and an accessible timber handrail at the outside wall.
        rail_run(side * 0.128, low, begin, end, 0.73, PITCH / 2)
        post(
            "Wall handrail",
            (side * 1.285, low + 0.77, begin),
            (side * 1.285, low + 0.77 + PITCH / 2, end),
            0.04,
            "honey",
        )
    tube(
        "Half-landing handrail",
        [
            (-0.128, mid + 0.73, BACK_EDGE),
            (-0.128, mid + 0.73, BACK_EDGE - 0.08),
            (0.128, mid + 0.73, BACK_EDGE - 0.08),
            (0.128, mid + 0.73, BACK_EDGE),
        ],
        0.041,
        "honey",
    )
    # The floor landing connects the returning inner handrail to the next ascending flight.
    if level < 2:
        tube(
            "Storey handrail turn",
            [
                (0.128, y + PITCH + 0.73, FRONT_EDGE),
                (0.128, y + PITCH + 0.73, FRONT_EDGE + 0.08),
                (-0.128, y + PITCH + 0.73, FRONT_EDGE + 0.08),
                (-0.128, y + PITCH + 0.73, FRONT_EDGE),
            ],
            0.041,
            "honey",
        )


def window(x, y, w, h, trim="rim"):
    z = BACK + 0.093
    box("Window surround", x, y, z, w + 0.09, h + 0.10, 0.076, trim, 0.047)
    box("Sky through window", x, y, z + 0.049, w, h, 0.036, "window", 0.024)
    # Glazing highlights and the centre mullion read at the whole-house scale.
    box("Window mullion", x, y, z + 0.078, 0.055, h, 0.038, "porcelain", 0.008)
    box(
        "Window transom",
        x,
        y + h * 0.20,
        z + 0.078,
        w,
        0.041,
        0.038,
        "porcelain",
        0.008,
    )
    box("Window sill", x, y - h * 0.50, z + 0.103, w + 0.16, 0.055, 0.22, trim, 0.014)


def number_plate(x, y, z, text):
    """Raised floor sign; segment lettering also appears in the small web export."""
    box("Blue enamel floor sign", x, y, z, 0.43, 0.31, 0.052, "denim", 0.035)
    segments = {
        "K": [
            ((-0.07, -0.09), (-0.07, 0.09)),
            ((-0.07, 0), (0.065, 0.095)),
            ((-0.07, 0), (0.075, -0.095)),
        ],
        "E": [
            ((0.07, 0.09), (-0.07, 0.09)),
            ((-0.07, 0.09), (-0.07, -0.09)),
            ((-0.07, 0), (0.05, 0)),
            ((-0.07, -0.09), (0.07, -0.09)),
        ],
        "1": [
            ((-0.045, 0.04), (0.022, 0.09)),
            ((0.022, 0.09), (0.022, -0.09)),
            ((-0.048, -0.09), (0.08, -0.09)),
        ],
        "2": [
            ((-0.07, 0.09), (0.07, 0.09)),
            ((0.07, 0.09), (0.07, 0.01)),
            ((0.07, 0.01), (-0.07, -0.03)),
            ((-0.07, -0.03), (-0.07, -0.09)),
            ((-0.07, -0.09), (0.07, -0.09)),
        ],
        "D": [
            ((-0.06, -0.09), (-0.06, 0.09)),
            ((-0.06, 0.09), (0.02, 0.09)),
            ((0.02, 0.09), (0.07, 0.05)),
            ((0.07, 0.05), (0.07, -0.05)),
            ((0.07, -0.05), (0.02, -0.09)),
            ((0.02, -0.09), (-0.06, -0.09)),
        ],
    }
    for a, b in segments[text]:
        post(
            "Floor sign lettering",
            (x + a[0], y + a[1], z + 0.032),
            (x + b[0], y + b[1], z + 0.032),
            0.011,
            "porcelain",
            segments=6,
        )


def entrance():
    """A slim glazed vestibule fits the cut edge of the street-facing ground floor."""
    x, z = -0.31, FRONT + 0.007
    for dx in (-0.51, 0.51):
        box("Entrance jamb", x + dx, 0.99, z, 0.072, 1.98, 0.10, "teal", 0.016)
    for h in (0.082, 0.72, 1.94):
        box("Entrance crossbar", x, h, z, 0.99, 0.068, 0.082, "teal", 0.013)
    select_collection("Entrance glazing")
    box("Glass door pane", x, 1.0, z, 0.94, 1.82, 0.018, "window", 0.003)
    select_collection("House structure")
    post(
        "Entrance pull",
        (x + 0.35, 0.74, z + 0.072),
        (x + 0.35, 1.11, z + 0.072),
        0.025,
        "gold",
    )
    box("Entrance canopy fascia", x, 2.04, z + 0.14, 1.58, 0.07, 0.64, "teal", 0.024)
    for dx in (-0.54, 0.54):
        post(
            "Canopy bracket",
            (x + dx, 1.88, z - 0.13),
            (x + dx, 2.03, z + 0.31),
            0.021,
            "slate",
        )
    # A small gooseneck porch light mounts to the outside of the left jamb.
    box("Porch light plate", x - 0.51, 1.63, z + 0.07, 0.09, 0.16, 0.05, "teal", 0.012)
    tube(
        "Porch light arm",
        [(x - 0.51, 1.67, z + 0.085), (x - 0.54, 1.72, z + 0.16), (x - 0.69, 1.72, z + 0.18)],
        0.024,
        "teal",
    )
    orb("Porch light diffuser", x - 0.69, 1.59, z + 0.18, 0.102, 0.112, 0.103, "lemon", segments=14, rings=8)
    orb("Enamel porch shade", x - 0.69, 1.685, z + 0.18, 0.143, 0.045, 0.132, "teal", segments=16, rings=6)
    box("Mailbox mounting rail", 0.72, 1.0, z, 0.69, 0.64, 0.055, "honey", 0.019)
    for row in range(4):
        for col in range(2):
            xx = 0.563 + 0.315 * col
            yy = 0.79 + row * 0.135
            box("Letter box", xx, yy, z + 0.045, 0.288, 0.122, 0.085, "sagebox", 0.012)
            box(
                "Letter slot",
                xx,
                yy + 0.022,
                z + 0.092,
                0.19,
                0.018,
                0.008,
                "navy",
                0.002,
            )
            box(
                "Name tag",
                xx - 0.025,
                yy - 0.025,
                z + 0.092,
                0.074,
                0.029,
                0.008,
                "porcelain",
                0.001,
            )
    for xx in (0.47, 0.97):
        post("Mailbox feet", (xx, 0, z), (xx, 0.76, z), 0.028, "slate")
    box("Front doorstep", x, -0.058, FRONT + 0.20, 1.44, 0.13, 0.46, "limestone", 0.024)
    box("Entrance mat", x, 0.012, FRONT - 0.34, 1.0, 0.024, 0.46, "teal", 0.012)


def roof():
    select_collection("House structure")
    half = DIMS["maxX"] + 0.22
    ridge = ROOF["ridgeY"]
    slope = ROOF["slope"]
    angle = atan(slope)
    for side in (-1, 1):
        x = side * half * 0.5
        roll = -side * angle
        y = ceiling(x)
        box(
            "Coral roof",
            x,
            y + 0.10,
            0,
            hypot(half, half * slope),
            0.21,
            4.48,
            "coral",
            0.036,
            roll=roll,
        )
        box(
            "Cut rafter",
            x,
            y + 0.015,
            2.235,
            hypot(half, half * slope),
            0.117,
            0.085,
            "rim",
            0.023,
            roll=roll,
        )
        for t in (-1.6, -0.86, -0.12, 0.62, 1.36):
            box(
                "Roof seam",
                x,
                y + 0.212,
                t,
                hypot(half, half * slope) - 0.11,
                0.009,
                0.014,
                "poppy",
                0.002,
                roll=roll,
            )
    post("Ridge cap", (0, ridge + 0.17, -2.24), (0, ridge + 0.17, 2.24), 0.085, "tomato")
    # The PV array follows the actual western roof plane. Its edge projects above
    # the clay roof, including when viewed from the shallow cutaway camera.
    for xx in (-5.38, -3.34, -1.30):
        for zz in (-1.15, 0.13, 1.41):
            base = ceiling(xx) + 0.30
            box(
                "Solar panel frame",
                xx,
                base,
                zz,
                1.98,
                0.072,
                1.16,
                "silver",
                0.023,
                roll=angle,
            )
            box(
                "Photovoltaic module",
                xx,
                base + 0.039,
                zz,
                1.89,
                0.026,
                1.085,
                "solar",
                0.012,
                roll=angle,
            )
            for j in (-0.61, -0.30, 0, 0.30, 0.61):
                box(
                    "Solar cell divider",
                    xx + j * cos(angle),
                    base + 0.055 + j * sin(angle),
                    zz,
                    0.012,
                    0.006,
                    1.064,
                    "pvgrid",
                    0.001,
                    roll=angle,
                )
            for j in (-0.27, 0, 0.27):
                box(
                    "Solar busbar",
                    xx,
                    base + 0.055,
                    zz + j,
                    1.86,
                    0.006,
                    0.013,
                    "pvgrid",
                    0.001,
                    roll=angle,
                )


def add_structure():
    select_collection("House structure")
    left, right = DIMS["minX"], DIMS["maxX"]
    width = right - left
    for floor in LAYOUT["floors"]:
        f = floor["level"]
        y = f * PITCH
        for room in (r for r in LAYOUT["rooms"] if r["floor"] == f):
            a, b = room["minX"], room["maxX"]
            c = (a + b) * 0.5
            hall = room["id"] == floor["landing"]
            walls = (
                "chalk"
                if hall
                else ("basement" if f < 0 else ("apricot", "rosewall", "peach", "cream")[(f + (1 if c > 0 else 0)) % 4])
            )
            h = ceiling(max(abs(a), abs(b))) - y if f == 3 else DIMS["clearHeight"]
            box(
                "Stairwell back" if hall else "Apartment back",
                c,
                y + h / 2,
                BACK,
                b - a,
                h,
                0.12,
                walls,
                0.014,
            )
            if f == 3:
                outline = [(a, y + h), (b, y + h)]
                if a < 0 < b:
                    outline.append((0, ceiling(0)))
                elif c < 0:
                    outline.append((b, ceiling(b)))
                else:
                    outline.append((a, ceiling(a)))
                prism("Attic back", outline, BACK - 0.06, BACK + 0.06, walls)
            if not hall:
                box(
                    "Apartment ceiling",
                    c,
                    y - 0.065,
                    0,
                    b - a,
                    0.13,
                    FRONT - BACK,
                    "birch",
                    0.018,
                )
                box(
                    "Floor front rim",
                    c,
                    y - 0.06,
                    FRONT,
                    b - a,
                    0.12,
                    0.062,
                    "rim",
                    0.014,
                )
                box(
                    "Skirting",
                    c,
                    y + 0.065,
                    BACK + 0.08,
                    b - a - 0.12,
                    0.13,
                    0.042,
                    "rim",
                    0.014,
                )
                if f >= 0:
                    width_r = b - a
                    for j in range(1, 6):
                        z = BACK + j * (FRONT - BACK) / 6
                        box(
                            "Parquet seam",
                            c,
                            y + 0.003,
                            z,
                            width_r - 0.14,
                            0.004,
                            0.009,
                            "honey",
                            0.001,
                        )
            else:
                for xx in (-0.88, 0.88):
                    box(
                        "Stair dado",
                        xx,
                        y + 0.49,
                        BACK + 0.073,
                        0.88,
                        0.88,
                        0.043,
                        "sagebox",
                        0.012,
                    )
                window(0, y + 1.52, 1.04, 0.86, "porcelain")
                # Put the landing sign and frosted light near the apartment doors.
                # Both are legible from the cut face and sit outside the tread runs.
                number_plate(1.14, y + 2.07, FRONT - 0.016, ["K", "E", "1", "2", "D"][f + 1])
                post("Plaque bracket", (1.14, y + 2.07, FRONT - 0.055), (CORE, y + 2.07, FRONT - 0.055), 0.021, "slate")
                box("Sconce backplate", -CORE + 0.07, y + 1.97, 0.56, 0.055, 0.24, 0.18, "slate", 0.018)
                orb("Landing sconce", -CORE + 0.105, y + 1.97, 0.56, 0.092, 0.124, 0.083, "lemon")
                depth = FRONT - FRONT_EDGE
                box(
                    "Landing",
                    0,
                    y - 0.066,
                    FRONT - depth / 2,
                    2 * CORE,
                    0.132,
                    depth,
                    "limestone",
                    0.018,
                )
                box(
                    "Landing edge",
                    0,
                    y - 0.06,
                    FRONT,
                    2 * CORE,
                    0.12,
                    0.06,
                    "warmgrey",
                    0.011,
                )
                if f < 3:
                    flights(f)
                if f in (-1, 3):
                    # Unused side of the terminal landing is guarded.
                    side = 1 if f < 0 else -1
                    rail_run(side * 0.1, y, FRONT_EDGE, FRONT_EDGE + 0.015, 0.73, 0)
                    post(
                        "Final landing guard",
                        (side * 0.13, y + 0.73, FRONT_EDGE),
                        (side * 1.28, y + 0.73, FRONT_EDGE),
                        0.04,
                        "honey",
                    )
                    for step in range(1, 6):
                        x = side * (0.13 + step * 0.22)
                        post(
                            "Final guard baluster",
                            (x, y, FRONT_EDGE),
                            (x, y + 0.73, FRONT_EDGE),
                            0.02,
                            "slate",
                        )
        if f == -1:
            box(
                "Basement foundation",
                0,
                y - 0.14,
                0,
                width + 0.12,
                0.16,
                FRONT - BACK + 0.12,
                "warmgrey",
                0.027,
            )
        for xx in (left, right):
            h = ceiling(xx) - y if f == 3 else DIMS["clearHeight"]
            box(
                "Left outer wall" if xx < 0 else "Right outer wall",
                xx,
                y + h / 2,
                0,
                0.12,
                h,
                FRONT - BACK,
                "basement" if f < 0 else "birch",
                0.015,
            )
            box("Sanded cut edge", xx, y + h / 2, FRONT, 0.13, h, 0.06, "rim", 0.012)
    for d in LAYOUT["doors"]:
        add_door(d)
    entrance()
    roof()
