"""Room furnishings, shared appliances and the garden's exposed basement cut."""

from math import cos, pi, sin

import furniture as f
from miniature_geometry import (
    PALETTE,
    PARTS,
    box,
    lathe,
    orb,
    oval,
    part,
    post,
    select_collection,
    tube,
)
from structure import ANCHORS, LAYOUT, PITCH, ceiling, window


def place(kit, anchor, target, scale=1, repaint=None):
    """Place a local furniture assembly about its reference point in the room."""
    room = select_collection("Assembly")
    kit()
    select_collection(room)
    colors = {PALETTE[a]: PALETTE[b] for a, b in (repaint or {}).items()}
    for name, vertices, faces, normals, color in PARTS.pop("Assembly"):
        if name in {
            "Picture frame",
            "Picture mat",
            "Printed paper",
            "Printed petal",
            "Printed flower centre",
        }:
            # Framed pictures belong to the back wall, even with the desk pulled out.
            wall_offset = -1.902 - (target[2] + (-0.929 - anchor[2]) * scale)
        else:
            wall_offset = 0
        coords = [
            (
                target[0] + (x - anchor[0]) * scale,
                target[1] + (y - anchor[1]) * scale,
                target[2] + (z - anchor[2]) * scale + wall_offset,
            )
            for x, y, z in vertices
        ]
        PARTS[room].append((name, coords, faces, normals, colors.get(color, color)))


def at_floor(kit, local, x, level, z, scale=1, repaint=None):
    place(kit, (local[0], 0, local[1]), (x, level * PITCH, z), scale, repaint)


def at_source(kit, local, source, level):
    pos = ANCHORS[source]
    place(kit, local, pos, (pos[1] - level * PITCH) / local[1])


def hoop(name, x, y, z, r, t, color, segments=28):
    """A ring in the frontal plane for tires, drums and loudspeakers."""
    vs, ns, faces = [], [], []
    sides = 6
    for i in range(segments):
        a = 2 * pi * i / segments
        for j in range(sides):
            b = 2 * pi * j / sides
            normal = (cos(a) * cos(b), sin(a) * cos(b), sin(b))
            vs.append((r * cos(a) + t * normal[0], r * sin(a) + t * normal[1], t * normal[2]))
            ns.append(normal)
    for i in range(segments):
        for j in range(sides):
            faces.append(
                (
                    i * sides + j,
                    ((i + 1) % segments) * sides + j,
                    ((i + 1) % segments) * sides + (j + 1) % sides,
                    i * sides + (j + 1) % sides,
                )
            )
    part(name, vs, faces, ns, color, (x, y, z))


def bike(x, y, z, s, paint):
    def p(dx, dy, dz=0):
        return (x + s * dx, y + s * dy, z + s * dz)

    for wx in (-0.51, 0.51):
        xx, yy, zz = p(wx, 0.31)
        hoop("Bicycle tire", xx, yy, zz, 0.284 * s, 0.034 * s, "navy")
        hoop("Wheel rim", xx, yy, zz + 0.006, 0.25 * s, 0.012 * s, "silver", 24)
        for i in range(7):
            a = 2 * pi * i / 7
            post(
                "Spoke",
                (xx, yy, zz),
                (xx + 0.249 * s * cos(a), yy + 0.249 * s * sin(a), zz),
                0.007 * s,
                "silver",
                segments=5,
            )
        orb(
            "Wheel hub",
            xx,
            yy,
            zz,
            0.047 * s,
            0.047 * s,
            0.047 * s,
            "slate",
            segments=8,
            rings=4,
        )
    for a, b in [
        ((-0.51, 0.31), (-0.20, 0.68)),
        ((-0.51, 0.31), (0, 0.30)),
        ((-0.20, 0.68), (0, 0.30)),
        ((-0.20, 0.68), (0.30, 0.69)),
        ((0, 0.30), (0.30, 0.69)),
        ((0.30, 0.69), (0.51, 0.31)),
    ]:
        post(
            "Step-through bicycle frame",
            p(*a, 0.035),
            p(*b, 0.035),
            0.028 * s,
            paint,
            segments=8,
        )
    post("Seat post", p(-0.20, 0.66, 0.035), p(-0.23, 0.79, 0.035), 0.022 * s, "silver")
    box(
        "Leather saddle",
        *p(-0.24, 0.80, 0.035),
        0.24 * s,
        0.07 * s,
        0.16 * s,
        "umber",
        0.027 * s,
    )
    tube(
        "Bicycle handlebar",
        [
            p(0.30, 0.68, 0.035),
            p(0.27, 0.84, 0.035),
            p(0.35, 0.87, 0.035),
            p(0.41, 0.87, 0.17),
        ],
        0.022 * s,
        "silver",
    )
    post("Handlebar grip", p(0.375, 0.87, 0.12), p(0.43, 0.87, 0.20), 0.026 * s, "umber")
    hoop("Chainwheel", *p(0, 0.30, 0.06), 0.09 * s, 0.016 * s, "honey", 16)
    post("Pedal crank", p(0, 0.30, 0.07), p(0.10, 0.26, 0.09), 0.016 * s, "silver")
    box("Pedal", *p(0.11, 0.26, 0.105), 0.09 * s, 0.03 * s, 0.11 * s, "navy", 0.009)
    post("Kickstand", p(-0.08, 0.30, -0.06), p(-0.18, 0.015, -0.2), 0.014 * s, "slate")


def washer(x, y, z, accent):
    box(
        "Front loading washing machine",
        x,
        y + 0.51,
        z,
        0.91,
        1.02,
        0.73,
        "porcelain",
        0.071,
    )
    box("Appliance lid", x, y + 1.027, z, 0.94, 0.066, 0.755, "pale", 0.029)
    zz = z + 0.373
    orb(
        "Washer drum seal",
        x,
        y + 0.436,
        zz,
        0.319,
        0.319,
        0.045,
        "slate",
        segments=24,
        rings=10,
    )
    orb(
        "Washer drum window",
        x,
        y + 0.436,
        zz + 0.026,
        0.251,
        0.251,
        0.061,
        "blue",
        segments=24,
        rings=10,
    )
    hoop("Enamel drum bezel", x, y + 0.436, zz + 0.048, 0.273, 0.033, accent)
    orb(
        "Laundry inside drum",
        x + 0.035,
        y + 0.37,
        zz + 0.080,
        0.16,
        0.066,
        0.012,
        "sky",
        -0.20,
    )
    box("Detergent drawer", x - 0.22, y + 0.844, zz, 0.27, 0.11, 0.037, "silver", 0.012)
    box(
        "Washer status screen",
        x + 0.03,
        y + 0.849,
        zz,
        0.14,
        0.064,
        0.041,
        "navy",
        0.008,
    )
    orb("Cycle dial", x + 0.266, y + 0.858, zz + 0.025, 0.059, 0.059, 0.034, accent)


def shelf(x, y, z, w):
    for dx in (-w / 2, w / 2):
        for dz in (-0.21, 0.21):
            box(
                "Storage shelf upright",
                x + dx,
                y + 0.75,
                z + dz,
                0.052,
                1.50,
                0.052,
                "slate",
                0.010,
            )
    for h in (0.12, 0.71, 1.32):
        box("Storage shelf", x, y + h, z, w + 0.10, 0.067, 0.50, "birch", 0.018)


def carton(x, y, z, w, h, body):
    box("Storage carton", x, y + h / 2, z, w, h, 0.39, body, 0.019)
    box("Packing tape", x, y + h + 0.002, z, 0.078, 0.008, 0.39, "cream", 0.002)
    box(
        "Box label",
        x - 0.07,
        y + h * 0.61,
        z + 0.20,
        0.12,
        0.059,
        0.009,
        "porcelain",
        0.002,
    )


def basement():
    y = -PITCH
    select_collection("Bicycle cellar")
    bike(-5.74, y, -0.31, 1.28, "turquoise")
    bike(-3.97, y, -0.66, 1.04, "coral")
    shelf(-2.48, y, -1.32, 1.12)
    for xx, yy, w, h, c in [
        (-2.75, 0.159, 0.49, 0.34, "honey"),
        (-2.21, 0.159, 0.48, 0.41, "sagebox"),
        (-2.54, 0.745, 0.73, 0.42, "honey"),
        (-2.27, 1.355, 0.39, 0.27, "rose"),
    ]:
        carton(xx, y + yy, -1.31, w, h, c)
    shelf(-5.6, y, -1.58, 1.56)
    for xx, w, h, c in [(-6.02, 0.54, 0.28, "honey"), (-5.39, 0.58, 0.38, "sagebox")]:
        carton(xx, y + 1.355, -1.57, w, h, c)
    window(-4.18, y + 1.71, 0.89, 0.37)
    select_collection("Laundry")
    x, _, z = ANCHORS["s_washer"]
    washer(x, y, z, "turquoise")
    washer(x + 1.15, y, z - 0.03, "indigo")
    shelf(5.93, y, -1.24, 1.05)
    for row in range(2):
        for k, c in enumerate(("rose", "pale", "lemon")):
            box(
                "Folded towels",
                5.87,
                y + 0.2 + row * 0.59 + k * 0.078,
                -1.21,
                0.62,
                0.08,
                0.34,
                c,
                0.032,
            )
    for dx, c in ((-0.18, "mint"), (0.20, "blue")):
        lathe(
            "Detergent bottle",
            5.92 + dx,
            y + 1.355,
            -1.24,
            [(0, 0.087), (0.23, 0.096), (0.28, 0.066), (0.32, 0.051)],
            c,
            14,
        )
        lathe(
            "Bottle cap",
            5.92 + dx,
            y + 1.674,
            -1.24,
            [(0, 0.055), (0.057, 0.055)],
            "porcelain",
            14,
        )
    x, z = 5.44, 0.04
    lathe(
        "Laundry basket",
        x,
        y,
        z,
        [(0, 0.20), (0.048, 0.22), (0.36, 0.30), (0.40, 0.306)],
        "honey",
        22,
        0.75,
    )
    for k in range(4):
        lathe(
            "Basket weave",
            x,
            y + 0.07 + k * 0.083,
            z,
            [(0, 0.23 + k * 0.018), (0.017, 0.232 + k * 0.018)],
            "birch",
            22,
            0.75,
        )
    for dx, col in [(-0.08, "pink"), (0.084, "sky")]:
        orb("Laundry", x + dx, y + 0.395, z, 0.15, 0.074, 0.132, col)
    window(3.69, y + 1.72, 1.17, 0.41)


def kettle():
    x, _, z = ANCHORS["s_kettle"]
    f.low_cabinet(x, 0, z, 1.63, 0.675, "teal")
    lathe(
        "Electric kettle",
        x,
        0.705,
        z,
        [(0, 0.103), (0.028, 0.142), (0.17, 0.153), (0.25, 0.113), (0.264, 0.104)],
        "poppy",
    )
    lathe("Kettle lid", x, 0.96, z, [(0, 0.115), (0.027, 0.106), (0.040, 0.046)], "cream")
    tube(
        "Kettle handle",
        [
            (x + 0.108, 0.917, z),
            (x + 0.2, 0.90, z),
            (x + 0.2, 0.773, z),
            (x + 0.12, 0.761, z),
        ],
        0.022,
        "cream",
    )
    post(
        "Kettle spout",
        (x - 0.115, 0.842, z),
        (x - 0.204, 0.926, z),
        0.041,
        "poppy",
        0.029,
    )
    f.pot(x + 0.48, 0.706, z, 0.46, "lemon")
    window(x, 0.0 + 1.56, 1.27, 0.64)
    at_floor(f.armchair, (0.33, -0.28), -3.37, 0, -0.48, 1.23)
    at_floor(f.salon_table, (-0.22, 0.5), -3.76, 0, 0.56, 0.87)
    f.frame(-3.46, 1.51, -1.90, 0.85, 0.57, "hills")
    f.pendant(-4.45, 2.27, -0.61, 0.26, "turquoise")


def ground():
    select_collection("Garden flat")
    kettle()
    select_collection("Kitchen and dining")
    at_source(f.stove_suite, (-1.95, 0.90, -0.39), "s_stove", 0)
    at_source(f.sideboard_candle, (0.75, 1.00, -0.34), "s_candle", 0)
    at_floor(f.dining_set, (0.05, 0.12), 3.02, 0, 0.43, 0.95)
    f.pendant(3.04, 2.27, -0.16, 0.23)
    window(6.54, 1.47, 0.52, 0.65)


def middle():
    y = PITCH
    select_collection("First floor west")
    at_source(f.bedside, (-2.63, 0.78, -0.43), "s_lamp", 1)
    at_floor(f.bed, (-1.78, -0.02), -5.03, 1, -0.38, 1.22)
    f.frame(-5.26, y + 1.63, -1.90, 0.77, 0.51, "hills")
    at_source(f.television, (-2.1, 1.08, -0.52), "s_tv", 1)
    at_floor(f.armchair, (0.33, -0.28), -3.63, 1, 0.07, 1.0)
    oval("Living rug", -2.89, y + 0.017, 0.25, 0.66, 0.47, 0.021, "mint")
    f.pot(-1.93, y, -1.28, 0.81, "rose")
    select_collection("First floor east")
    x, yy, z = ANCHORS["s_radio"]
    f.low_cabinet(x, y, z, 1.19, 0.53, "mint")
    box("Retro radio", x, yy - 0.098, z, 0.53, 0.30, 0.20, "yellow", 0.041)
    hoop("Radio speaker", x - 0.105, yy - 0.097, z + 0.112, 0.085, 0.013, "honey", 16)
    orb("Loudspeaker", x - 0.105, yy - 0.097, z + 0.108, 0.074, 0.074, 0.013, "umber")
    for h in (-0.071, -0.12):
        box(
            "Radio tuning scale",
            x + 0.106,
            yy + h,
            z + 0.108,
            0.113,
            0.017,
            0.016,
            "cream",
            0.003,
        )
    post(
        "Radio aerial",
        (x + 0.15, yy + 0.045, z),
        (x + 0.283, yy + 0.316, z),
        0.008,
        "silver",
        segments=6,
    )
    at_floor(f.sofa, (-0.05, -0.26), 5.77, 1, -0.65, 1.03)
    at_floor(f.salon_table, (-0.22, 0.5), 5.43, 1, 0.54, 0.90)
    window(5.74, y + 1.57, 1.18, 0.74)
    f.pot(2.67, y, -0.97, 0.83, "blue")
    f.frame(3.40, y + 1.61, -1.90, 0.67, 0.48, "flower")
    f.pendant(4.76, y + 2.27, -0.5, 0.27, "mint")


def upper():
    y = 2 * PITCH
    select_collection("Second floor west")
    at_floor(
        f.sofa,
        (-0.05, -0.26),
        -5.46,
        2,
        -0.69,
        1.14,
        {"coral": "teal", "poppy": "turquoise", "tomato": "green"},
    )
    at_floor(f.salon_table, (-0.22, 0.5), -5.61, 2, 0.60, 0.90)
    at_source(f.reading_lamp, (-0.15, 1.05, -0.42), "s_floorlamp", 2)
    at_floor(f.bookcase, (-1.20, -0.59), -2.51, 2, -1.42, 1.12)
    window(-5.62, y + 1.56, 1.28, 0.73)
    f.frame(-3.03, y + 1.64, -1.90, 0.64, 0.49, "hills")
    select_collection("Second floor east")
    at_source(f.desk, (0.63, 0.99, -0.43), "s_desk", 2)
    at_floor(f.toy_train, (0.05, 0.43), 3.30, 2, 0.50, 1.28)
    oval("Play mat", 3.21, y + 0.014, 0.49, 0.63, 0.38, 0.018, "mint")
    at_source(f.bedside, (-2.63, 0.78, -0.43), "s_bed2", 2)
    at_floor(
        f.bed,
        (-1.78, -0.02),
        6.39,
        2,
        -0.35,
        0.91,
        {"yellow": "indigo", "lemon": "sky", "pink": "mint"},
    )
    window(6.23, y + 1.56, 0.80, 0.65)
    f.pot(4.78, y, -1.51, 0.76, "turquoise")
    f.pendant(3.35, y + 2.27, -0.5, 0.21, "coral")


def attic():
    y = 3 * PITCH
    select_collection("Attic reading room")
    at_floor(f.bookcase, (-1.20, -0.59), -5.74, 3, -1.49, 1.26)
    at_source(f.reading_lamp, (-0.15, 1.05, -0.42), "s_attic", 3)
    at_floor(f.armchair, (0.33, -0.28), -2.81, 3, -0.71, 1.32)
    oval("Reading rug", -3.25, y + 0.016, -0.14, 1.05, 0.61, 0.021, "mint")
    window(-4.33, y + 1.58, 1.00, 0.78)
    f.pot(-6.39, y, 0.14, 0.69, "blue")
    select_collection("Attic sleeping nook")
    at_source(f.reading_lamp, (-0.15, 1.05, -0.42), "s_loft", 3)
    at_floor(
        f.bed,
        (-1.78, -0.02),
        5.72,
        3,
        -0.43,
        1.20,
        {"yellow": "turquoise", "lemon": "mint", "pink": "rose"},
    )
    at_floor(f.bookcase, (-1.2, -0.59), 2.6, 3, -1.41, 1.17)
    window(5.11, y + 1.57, 0.89, 0.63)
    f.frame(3.43, y + 1.83, -1.90, 0.66, 0.51, "hills")
    oval("Bedroom rug", 4.04, y + 0.015, 0.1, 0.67, 0.45, 0.019, "rose")
    for side in (-1, 1):
        # Exposed attic purlins add scale and echo the roof's timber cut edges.
        for x in (2.7, 5.9):
            box(
                "Exposed oak purlin",
                side * x,
                ceiling(x) - 0.056,
                -0.14,
                0.12,
                0.14,
                3.57,
                "honey",
                0.020,
            )


def furnish():
    basement()
    ground()
    middle()
    upper()
    attic()


def detectors():
    select_collection("House structure")
    for det in LAYOUT["detectors"]:
        x, y, z = det["position"]
        # The anchor is the indicator on the front face of the vented housing.
        center_z = z - 0.19
        lathe("Smoke alarm housing", x, y, center_z,
              [(-0.055, 0.145), (-0.038, 0.185), (0.045, 0.20), (0.095, 0.21),
               (0.15, 0.20)], "porcelain", 24)
        for angle in (-1.1, -0.72, -0.38, 0.38, 0.72, 1.1):
            box("Alarm intake slot", x + 0.19 * sin(angle), y + 0.013,
                center_z + 0.19 * cos(angle), 0.043, 0.024, 0.015,
                "slate", 0.005, yaw=angle)
        orb("Alarm indicator lens", x, y, z, 0.029, 0.026, 0.014,
            "terracotta", segments=10, rings=4)


def garden():
    select_collection("Garden")
    box("Earth sample base", 0, -2.66, -0.08, 18.82, 0.24, 4.92, "stone", 0.087)
    for side in (-1, 1):
        x = side * 8.14
        box("Earth bank", x, -1.27, -0.23, 2.20, 2.55, 3.91, "soil", 0.13)
        box("Grass cover", x, -0.005, -0.23, 2.30, 0.13, 4.0, "grass", 0.10)
        for i in range(10):
            xx = x + ((i * 43) % 97) / 97 * 1.9 - 0.96
            yy = -2.22 + ((i * 31) % 89) / 89 * 1.75
            orb(
                "Embedded pebble",
                xx,
                yy,
                1.723,
                0.046 + (i % 3) * 0.025,
                0.035 + (i % 2) * 0.021,
                0.024,
                "stone",
                segments=9,
                rings=5,
            )
        f.tree(side * 8.46, 0.055, -0.92, 1.35 if side < 0 else 1.12)
        for i in range(4):
            xx = side * (7.35 + i * 0.41)
            zz = 0.55 + (0.36 if i % 2 else 0)
            orb(
                "Garden foliage",
                xx,
                0.235,
                zz,
                0.22,
                0.25 + (i % 3) * 0.07,
                0.20,
                ("leaf", "lime", "sprout", "fern")[i],
            )
            if i in (0, 2):
                for j in range(3):
                    orb(
                        "Wildflower",
                        xx - 0.086 + j * 0.08,
                        0.49 + 0.031 * (j % 2),
                        zz + 0.115,
                        0.041,
                        0.047,
                        0.033,
                        "lemon" if i == 0 else "pink",
                        segments=9,
                        rings=5,
                    )
