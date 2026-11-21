"""Furnish and assemble the cutaway house in glTF coordinates (Y up)."""

from math import cos, pi, sin

from miniature_geometry import (
    box,
    lathe,
    orb,
    oval,
    post,
    prism,
    select_collection,
    tube,
    vertical_panel,
)

ANCHORS = {}
HINGES = {}


def door(wall, level, ident, height=1.64, room_color="peach"):
    y = 2.1 * level
    interior = ident.startswith("i")
    # Park open interior leaves along the viewing axis to reveal the appliances.
    front = (wall - 0.37, 0.10) if interior else (wall - 0.30, 0.55)
    back = (wall + 0.37, -0.27) if interior else (wall + 0.23, -0.42)
    top = 1.98 if level < 3 else height + 0.07
    vertical_panel("Partition return", (front[0], 1.03), front, y, y + top, 0.084, room_color)
    vertical_panel("Partition return", back, (back[0], -0.98), y, y + top, 0.084, room_color)
    vertical_panel("Door header", front, back, y + height, y + top, 0.087, room_color)
    for p in (front, back):
        box("Door casing", p[0], y + height / 2, p[1], 0.128, height + 0.04, 0.086, "rim", 0.014)
    vertical_panel("Door casing head", front, back, y + height - 0.012, y + height + 0.055, 0.128, "rim")
    pos = (front[0], y, front[1])
    HINGES[ident] = pos
    ANCHORS[ident] = (front[0] + 0.18, y + min(0.94, height * 0.54), front[1] - 0.18)
    prev = select_collection("hinge_" + ident)

    def interp(f):
        return (front[0] + (back[0] - front[0]) * f, front[1] + (back[1] - front[1]) * f)

    vertical_panel(
        "Painted door",
        interp(0.04),
        interp(0.96),
        y + 0.018,
        y + height - 0.042,
        0.072,
        "coral" if ident.startswith("d") else "turquoise",
        0.026,
    )
    # Recessed soft two-panel faces on either side.
    for offset in (-0.045, 0.045):
        p, q = interp(0.13), interp(0.87)
        p = (p[0] + offset, p[1] + offset * 0.54)
        q = (q[0] + offset, q[1] + offset * 0.54)
        vertical_panel(
            "Raised door panel",
            p,
            q,
            y + 0.13,
            y + height * 0.43,
            0.012,
            "poppy" if ident.startswith("d") else "mint",
            0.007,
        )
        vertical_panel(
            "Raised door panel",
            p,
            q,
            y + height * 0.53,
            y + height - 0.15,
            0.012,
            "poppy" if ident.startswith("d") else "mint",
            0.007,
        )
        k = interp(0.81)
        orb(
            "Door knob",
            k[0] + offset * 1.5,
            y + height * 0.47,
            k[1] + offset * 0.8,
            0.055,
            0.055,
            0.055,
            "gold",
            segments=10,
            rings=6,
        )
    select_collection(prev)


def frame(x, y, z, w, h, kind):
    box("Picture frame", x, y, z, w, h, 0.066, "honey", 0.033)
    box("Picture mat", x, y, z + 0.038, w - 0.060, h - 0.060, 0.021, "porcelain", 0.01)
    box("Printed paper", x, y, z + 0.052, w - 0.12, h - 0.12, 0.016, "sky" if kind == "hills" else "cream", 0.005)
    if kind == "hills":
        prism(
            "Painted hill",
            [
                (x - w * 0.36, y - h * 0.32),
                (x + w * 0.36, y - h * 0.32),
                (x + w * 0.36, y - h * 0.16),
                (x + w * 0.11, y + h * 0.05),
                (x - w * 0.08, y - h * 0.11),
                (x - w * 0.21, y - 0.02),
            ],
            z + 0.061,
            z + 0.064,
            "green",
        )
        orb("Sun print", x + w * 0.19, y + h * 0.15, z + 0.065, w * 0.072, w * 0.072, 0.005, "yellow")
    elif kind == "flower":
        for dx, dy in ((0, 0.068), (0.069, 0.02), (0.043, -0.05), (-0.043, -0.05), (-0.069, 0.02)):
            orb("Printed petal", x + dx, y + dy, z + 0.067, 0.054, 0.06, 0.004, "coral")
        orb("Printed flower centre", x, y, z + 0.074, 0.044, 0.044, 0.005, "yellow")
    else:
        for i, c in enumerate(("terracotta", "gold", "mint")):
            rad = w * (0.27 - 0.050 * i)
            points = [(x + cos(pi * j / 12) * rad, y - h * 0.14 + sin(pi * j / 12) * rad, z + 0.067) for j in range(13)]
            tube("Printed rainbow", points, 0.009, c)


def lamp(x, y, z, shade, base="blue", scale=1):
    s = scale
    lathe("Lamp foot", x, y, z, [(0.0, 0.13 * s), (0.025 * s, 0.15 * s), (0.045 * s, 0.13 * s)], base)
    post("Lamp stem", (x, y + 0.02 * s, z), (x, y + 0.32 * s, z), 0.024 * s, base)
    lathe(
        "Pleated lampshade",
        x,
        y,
        z,
        [(0.29 * s, 0.18 * s), (0.305 * s, 0.19 * s), (0.49 * s, 0.108 * s), (0.505 * s, 0.096 * s)],
        shade,
    )
    lathe("Shade lining", x, y, z, [(0.286 * s, 0.152 * s), (0.293 * s, 0.159 * s)], "porcelain")


def pot(x, y, z, scale=1, color="blue", flowers=False):
    s = scale
    lathe(
        "Ceramic flowerpot",
        x,
        y,
        z,
        [(0, 0.13 * s), (0.035 * s, 0.155 * s), (0.23 * s, 0.188 * s), (0.255 * s, 0.192 * s)],
        color,
    )
    lathe("Potting soil", x, y, z, [(0.248 * s, 0.167 * s), (0.26 * s, 0.165 * s)], "umber")
    for j, (dx, dy, dz) in enumerate(
        ((-0.17, 0.60, 0.05), (0.14, 0.77, -0.04), (-0.02, 0.86, -0.06), (0.22, 0.48, 0.10), (-0.24, 0.44, -0.02))
    ):
        top = (x + dx * s, y + dy * s, z + dz * s)
        post("Plant stem", (x, y + 0.24 * s, z), top, 0.011 * s, "deepgreen")
        if flowers:
            for k in range(5):
                a = 2 * pi * k / 5
                orb(
                    "Flower petal",
                    top[0] + 0.043 * s * cos(a),
                    top[1] + 0.043 * s * sin(a),
                    top[2],
                    0.043 * s,
                    0.05 * s,
                    0.023 * s,
                    ("pink", "lemon", "porcelain")[j % 3],
                )
            orb("Pollen", top[0], top[1], top[2] + 0.023 * s, 0.035 * s, 0.035 * s, 0.023 * s, "gold")
        else:
            orb("Leaf", *top, 0.09 * s, 0.16 * s, 0.045 * s, ("fern", "sprout", "leaf")[j % 3], roll=-dx * 2.2)


def pendant(x, ceiling, z, length=0.25, shade="yellow"):
    post("Ceiling fitting", (x, ceiling - 0.06, z), (x, ceiling, z), 0.080, "birch")
    post("Pendant cord", (x, ceiling - length, z), (x, ceiling - 0.03, z), 0.015, "umber")
    lathe(
        "Pendant shade",
        x,
        ceiling - length,
        z,
        [(-0.135, 0.188), (-0.11, 0.20), (-0.055, 0.157), (0.005, 0.089), (0.025, 0.04)],
        shade,
    )
    lathe("Pendant diffuser", x, ceiling - length, z, [(-0.137, 0.171), (-0.132, 0.171)], "porcelain")


def detector(ident, x, y, z):
    lathe("Smoke detector", x, y, z, [(-0.063, 0.105), (-0.052, 0.127), (-0.016, 0.138), (0, 0.123)], "porcelain")
    for dx in (-0.045, 0, 0.045):
        box("Detector grille", x + dx, y - 0.064, z, 0.017, 0.009, 0.055, "silver", 0.004)
    ANCHORS[ident] = (x, y - 0.075, z + 0.03)


def book(x, y, z, w, h, d, c, angle=0):
    box("Book cover", x, y, z, w, h, d, c, 0.012, roll=angle)
    if h > w * 1.4:
        box(
            "Spine mark",
            x + sin(-angle) * h * 0.27,
            y + h * 0.27,
            z + d / 2 + 0.001,
            max(w * 0.68, 0.012),
            0.012,
            0.005,
            "cream",
            0.001,
            roll=angle,
        )


def cushion(x, y, z, w, h, d, c, angle=0):
    box("Piped cushion", x, y, z, w, h, d, c, min(h, d) * 0.30, roll=angle)


def chair(x, y, z, c, back=1.0):
    for dx in (-0.13, 0.13):
        for dz in (-0.12, 0.12):
            post("Chair leg", (x + dx * 1.13, y + 0.005, z + dz * 1.18), (x + dx, y + 0.35, z + dz), 0.032, "honey")
    box("Chair seat", x, y + 0.36, z, 0.38, 0.092, 0.36, c, 0.052)
    for dx in (-0.13, 0.13):
        post(
            "Chair back upright",
            (x + dx, y + 0.36, z - 0.12 * back),
            (x + dx, y + 0.70, z - 0.15 * back),
            0.027,
            "honey",
        )
    box("Chair back", x, y + 0.67, z - 0.15 * back, 0.34, 0.19, 0.058, c, 0.035)


def low_cabinet(x, y, z, w, height, body):
    for dx in (-w * 0.36, w * 0.36):
        for dz in (-0.14, 0.14):
            post("Tapered feet", (x + dx, y, z + dz), (x + dx, y + 0.16, z + dz), 0.028, "oak", 0.041)
    box("Cabinet shell", x, y + height / 2 + 0.09, z, w, height - 0.12, 0.44, body, 0.05)
    box("Cabinet top", x, y + height, z, w + 0.035, 0.052, 0.47, "birch", 0.022)
    for i in (-1, 1):
        xx = x + i * w * 0.235
        box("Cupboard door", xx, y + height * 0.56, z + 0.228, w * 0.455, height * 0.65, 0.035, body, 0.022)
        orb("Cupboard knob", xx - i * w * 0.15, y + height * 0.65, z + 0.256, 0.025, 0.025, 0.022, "cream")


def add_structure():
    select_collection("House structure")
    box("Base plate", 0, -0.075, 0, 6.25, 0.15, 2.19, "birch", 0.041)
    for f in range(3):
        y = f * 2.1
        wallcolor = ("apricot", "peach", "rosewall")[f]
        box("Apartment back", -0.83, y + 1.05, -1.025, 4.55, 2.106, 0.13, wallcolor, 0.012)
        box("Stairwell back", 2.25, y + 1.05, -1.025, 1.71, 2.106, 0.13, "apricot", 0.01)
        box("Right outer wall", 3.06, y + 1.04, 0, 0.10, 2.08, 2.05, "birch", 0.018)
        box("Left outer wall", -3.06, y + 1.04, 0, 0.10, 2.08, 2.05, "birch", 0.018)
        box("Left cutaway edge", -3.06, y + 1.04, 1.025, 0.114, 2.09, 0.049, "rim", 0.016)
        box("Right cutaway edge", 3.06, y + 1.04, 1.025, 0.114, 2.09, 0.049, "rim", 0.016)
        # Floor continues under the apartments. The staircase has real openings.
        top = y + 2.10
        box("Apartment ceiling", -0.846, top - 0.064, 0, 4.53, 0.128, 2.11, "birch", 0.028)
        box("Floor front rim", -0.846, top - 0.070, 1.051, 4.54, 0.122, 0.056, "rim", 0.019)
        box("Landing", 1.51, top - 0.066, 0, 0.49, 0.132, 2.07, "birch", 0.021)
        for side in (-1, 1):
            box("Landing trim", 1.51, top - 0.065, side * 1.026, 0.49, 0.124, 0.045, "rim", 0.014)
        # Fine base trim gives rooms a legible floor-to-wall junction.
        box("Wooden skirting", -0.86, y + 0.047, -0.948, 4.34, 0.096, 0.043, "rim", 0.009)
        door(1.45, f, "d" + str(f), room_color=wallcolor)
        if f in (0, 2):
            door(-0.95, f, "i" + str(f), room_color=wallcolor)
        pendant((0.05, -0.20, -0.12)[f], top - 0.13, -0.37, 0.20, ("mint", "yellow", "coral")[f])
        add_stairs(y)
    # A triangular attic stores real depth behind the roof rim.
    prism("Gable back", [(-3.10, 6.28), (3.10, 6.28), (0, 8.57)], -1.089, -0.968, "birch")
    from math import atan

    angle = atan(0.72)
    for side in (-1, 1):
        cx = side * 1.59
        cy = 8.59 - 0.72 * 1.59
        box("Coral roof", cx, cy, 0.005, 3.99, 0.16, 2.31, "coral", 0.043, roll=-side * angle)
        box("Eave trim", cx, cy - 0.02, 1.144, 3.99, 0.113, 0.073, "rim", 0.026, roll=-side * angle)
        box("Roof lip", cx, cy + 0.042, 1.155, 4.005, 0.072, 0.072, "poppy", 0.024, roll=-side * angle)
        # Batten seams along the roof add scale without intricate textures.
        for k in range(1, 7):
            xx = side * k * 0.46
            box("Roof seam", xx, 8.682 - 0.72 * abs(xx), 0.012, 0.025, 0.026, 2.26, "poppy", 0.01, roll=-side * angle)
    door(1.38, 3, "d3", 1.10, room_color="birch")
    pendant(0, 8.48, -0.30, 0.32, "mint")
    detector("m_bed", -1.85, 6.165, -0.16)
    detector("m_living", -1.00, 4.065, 0.04)
    detector("m_attic", 0.25, 8.32, -0.12)


def add_stairs(y):
    # Two opposing flights share a half landing and an actual floor opening.
    x0, x1 = 1.70, 2.83
    for half in range(2):
        z = 0.51 if half == 0 else -0.42
        lo, hi = (x0, x1) if half == 0 else (x1, x0)
        stairbase = y + half * 1.05
        post("Stair stringer", (lo, stairbase - 0.01, z), (hi, stairbase + 1.04, z), 0.07, "honey")
        for s in range(7):
            a = lo + (hi - lo) * s / 7
            b = lo + (hi - lo) * (s + 1) / 7
            top = stairbase + (s + 1) * 0.15
            box("Stair tread", (a + b) / 2, top - 0.043, z, abs(b - a) + 0.013, 0.086, 0.69, "birch", 0.019)
            box("Riser", a, top - 0.102, z, 0.034, 0.17, 0.67, "apricot", 0.008)
            if s in (0, 3, 6):
                post("Spindle", (a, top - 0.03, z + 0.335), (a, top + 0.30, z + 0.335), 0.022, "rim")
        post("Handrail", (lo, stairbase + 0.43, z + 0.335), (hi, stairbase + 1.42, z + 0.335), 0.039, "honey")
    box("Half landing", 2.92, y + 1.05 - 0.05, 0.04, 0.37, 0.10, 1.67, "birch", 0.023)
    for z in (-0.69, 0.79):
        post("Newel post", (2.98, y + 1.05, z), (2.98, y + 1.45, z), 0.032, "rim")
    post("Landing rail", (2.98, y + 1.45, -0.69), (2.98, y + 1.45, 0.79), 0.034, "honey")


def kitchen_and_dining():
    select_collection("Ground floor - kitchen and dining")
    # Thin grout lines are just visible beneath the kitchen's freestanding objects.
    for x in (-2.77, -2.35, -1.93, -1.51):
        box("Kitchen tile joint", x, 0.001, 0.06, 0.012, 0.003, 1.94, "honey", 0.001)
    for z in (-0.67, -0.25, 0.17, 0.59, 0.99):
        box("Kitchen tile joint", -2.14, 0.002, z, 1.68, 0.003, 0.010, "honey", 0.001)
    # The kitchen appliances align with the first room's real counters.
    box("Refrigerator feet", -2.70, 0.065, -0.49, 0.43, 0.13, 0.50, "oak", 0.025)
    box("Retro refrigerator", -2.70, 0.75, -0.50, 0.51, 1.44, 0.61, "yellow", 0.095)
    for h, cy in ((0.84, 0.55), (0.45, 1.23)):
        box("Fridge door", -2.70, cy, -0.165, 0.51, h, 0.124, "lemon", 0.056)
        box("Fridge handle", -2.52, cy - 0.014, -0.086, 0.037, 0.21, 0.043, "porcelain", 0.018)
    box("Oven kickboard", -1.95, 0.061, -0.47, 0.55, 0.12, 0.50, "oak", 0.016)
    box("Oven body", -1.95, 0.40, -0.46, 0.62, 0.69, 0.64, "denim", 0.042)
    box("Stove top", -1.95, 0.731, -0.46, 0.65, 0.045, 0.67, "iron", 0.023)
    for dx in (-0.165, 0.165):
        for dz in (-0.16, 0.16):
            lathe("Enamel hotplate", -1.95 + dx, 0.751, -0.46 + dz, [(0, 0.102), (0.016, 0.089)], "navy", 14)
    box("Oven window rim", -1.95, 0.36, -0.126, 0.51, 0.36, 0.032, "sky", 0.043)
    box("Oven glass", -1.95, 0.36, -0.098, 0.42, 0.27, 0.024, "navy", 0.033)
    box("Oven handle", -1.95, 0.567, -0.064, 0.45, 0.043, 0.052, "silver", 0.016)
    for i in range(3):
        orb("Oven knob", -2.13 + i * 0.17, 0.653, -0.115, 0.037, 0.037, 0.023, "porcelain")
    lathe(
        "Enamel casserole",
        -1.95,
        0.765,
        -0.39,
        [(0, 0.119), (0.008, 0.148), (0.122, 0.152), (0.136, 0.156)],
        "terracotta",
    )
    lathe("Casserole lid", -1.95, 0.9, -0.39, [(0, 0.155), (0.017, 0.145), (0.031, 0.074)], "poppy")
    orb("Casserole knob", -1.95, 0.954, -0.39, 0.034, 0.027, 0.034, "honey")
    for sign in (-1, 1):
        box("Pot handle", -1.95 + sign * 0.165, 0.86, -0.39, 0.064, 0.040, 0.058, "coral", 0.016)
    box("Range hood stem", -1.96, 1.68, -0.75, 0.21, 0.29, 0.22, "cream", 0.028)
    box("Range hood", -1.96, 1.47, -0.69, 0.72, 0.095, 0.46, "cream", 0.042)
    box("Sink cupboard", -1.39, 0.365, -0.55, 0.43, 0.68, 0.54, "green", 0.033)
    box("Sink countertop", -1.39, 0.717, -0.50, 0.46, 0.052, 0.62, "cream", 0.024)
    oval("Sink rim", -1.39, 0.746, -0.46, 0.159, 0.105, 0.014, "silver")
    oval("Sink bowl", -1.39, 0.756, -0.46, 0.131, 0.076, 0.012, "iron")
    tube(
        "Tap spout",
        [(-1.36, 0.75, -0.67), (-1.36, 0.93, -0.67), (-1.36, 0.96, -0.61), (-1.36, 0.93, -0.55)],
        0.016,
        "silver",
    )
    box("Sink cabinet panel", -1.39, 0.386, -0.264, 0.34, 0.51, 0.036, "mint", 0.023)
    orb("Sink cabinet knob", -1.27, 0.56, -0.236, 0.029, 0.029, 0.018, "cream")
    box("Kitchen shelf", -1.45, 1.20, -0.78, 0.48, 0.05, 0.31, "honey", 0.018)
    for i, col in enumerate(("turquoise", "cream", "coral")):
        lathe("Spice jar", -1.61 + i * 0.145, 1.23, -0.75, [(0, 0.051), (0.131, 0.052), (0.142, 0.045)], col, 14)
        lathe("Cork lid", -1.61 + i * 0.145, 1.369, -0.75, [(0, 0.046), (0.025, 0.046)], "honey", 14)
    # Dining cabinet with a visible single unlit candle.
    low_cabinet(0.77, 0, -0.57, 0.70, 0.66, "yellow")
    lathe("Ceramic candle saucer", 0.75, 0.693, -0.34, [(0, 0.109), (0.024, 0.125), (0.036, 0.127)], "coral")
    lathe("Wax candle", 0.75, 0.728, -0.34, [(0, 0.069), (0.259, 0.067), (0.266, 0.060)], "poppy")
    post("Unlit wick", (0.75, 0.987, -0.34), (0.755, 1.017, -0.34), 0.010, "umber")
    frame(0.68, 1.42, -0.929, 0.58, 0.48, "flower")
    oval("Dining rug", 0.04, 0.012, 0.18, 0.74, 0.52, 0.020, "mint")
    for dx in (-0.32, 0.32):
        for dz in (-0.19, 0.19):
            post(
                "Table leg",
                (0.05 + dx * 1.13, 0.015, 0.12 + dz * 1.14),
                (0.05 + dx, 0.60, 0.12 + dz),
                0.037,
                "honey",
                0.05,
            )
    box("Dining table", 0.05, 0.62, 0.12, 0.91, 0.094, 0.62, "birch", 0.065)
    lathe("Fruit bowl", 0.06, 0.668, 0.12, [(0, 0.068), (0.019, 0.095), (0.06, 0.151), (0.074, 0.156)], "turquoise")
    for dx, dz, col in ((-0.065, 0, "coral"), (0.07, 0.032, "yellow"), (0.01, -0.065, "sprout")):
        orb("Fruit", 0.06 + dx, 0.764, 0.12 + dz, 0.062, 0.06, 0.060, col)
        post("Fruit stalk", (0.06 + dx, 0.81, 0.12 + dz), (0.065 + dx, 0.84, 0.12 + dz), 0.006, "umber", segments=6)
    chair(-0.52, 0, 0.02, "pink")
    chair(0.55, 0, 0.39, "turquoise", -1)


def living_room():
    select_collection("First floor - living room")
    y = 2.1
    for i, z in enumerate((-0.78, -0.46, -0.14, 0.18, 0.50, 0.82)):
        box("Floorboard seam", -0.84, y + 0.001, z, 4.34, 0.003, 0.009, "honey", 0.001)
        for x in (-2.3, -0.6, 0.92) if i % 2 else (-1.55, 0.15):
            box("Floorboard joint", x, y + 0.0015, z + 0.16, 0.009, 0.003, 0.31, "honey", 0.001)
    pot(-2.77, y, -0.65, 0.85, "turquoise")
    low_cabinet(-2.10, y, -0.52, 1.18, 0.49, "denim")
    post("TV neck", (-2.10, y + 0.512, -0.61), (-2.10, y + 0.66, -0.61), 0.045, "navy")
    box("Television stand", -2.10, y + 0.53, -0.59, 0.39, 0.031, 0.22, "navy", 0.012)
    box("Television case", -2.10, y + 0.924, -0.60, 0.99, 0.62, 0.121, "navy", 0.050)
    box("Television glass", -2.10, y + 0.934, -0.533, 0.90, 0.522, 0.027, "screen", 0.025)
    # A moonlit landscape gives the dark TV screen an identifiable screen image.
    prism(
        "Distant ridge",
        [
            (-2.51, y + 0.698),
            (-1.70, y + 0.698),
            (-1.70, y + 0.89),
            (-1.88, y + 1.023),
            (-2.05, y + 0.858),
            (-2.25, y + 1.006),
            (-2.51, y + 0.855),
        ],
        -0.516,
        -0.513,
        "denim",
    )
    prism(
        "Foreground ridge",
        [
            (-2.51, y + 0.698),
            (-1.70, y + 0.698),
            (-1.70, y + 0.769),
            (-1.95, y + 0.88),
            (-2.19, y + 0.783),
            (-2.40, y + 0.884),
            (-2.51, y + 0.827),
        ],
        -0.512,
        -0.510,
        "teal",
    )
    orb("Screen moon", -2.36, y + 1.088, -0.509, 0.045, 0.045, 0.005, "cream", segments=16, rings=8)
    orb("Standby light", -1.72, y + 0.65, -0.528, 0.016, 0.009, 0.008, "mint")
    for x in (-0.72, 0.62):
        for z in (-0.57, 0.04):
            post("Sofa foot", (x, y, z), (x, y + 0.19, z), 0.048, "oak", 0.064)
    box("Sofa base", -0.050, y + 0.255, -0.26, 1.80, 0.26, 0.94, "tomato", 0.088)
    box("Sofa back", -0.050, y + 0.572, -0.631, 1.74, 0.68, 0.23, "coral", 0.106)
    for x in (-0.45, 0.35):
        box("Sofa back pillow", x, y + 0.645, -0.519, 0.78, 0.50, 0.18, "poppy", 0.095)
        box("Sofa seat", x, y + 0.422, -0.18, 0.756, 0.225, 0.67, "coral", 0.085)
    for x in (-0.922, 0.822):
        box("Rolled arm", x, y + 0.448, -0.26, 0.181, 0.459, 0.91, "poppy", 0.086)
    cushion(-0.597, y + 0.655, -0.356, 0.304, 0.307, 0.126, "lemon", -0.18)
    cushion(0.49, y + 0.652, -0.353, 0.297, 0.291, 0.139, "turquoise", 0.19)
    frame(-0.25, y + 1.425, -0.924, 0.82, 0.51, "hills")
    oval("Woven rug", -0.30, y + 0.011, 0.49, 1.01, 0.444, 0.02, "blue")
    oval("Woven rug border", -0.30, y + 0.024, 0.49, 0.93, 0.386, 0.009, "sky")
    oval("Woven rug centre", -0.30, y + 0.030, 0.49, 0.887, 0.354, 0.008, "blue")
    for dx, dz in ((-0.4, -0.12), (0.39, -0.12), (0, 0.16)):
        post(
            "Coffee table foot",
            (-0.22 + dx, y + 0.039, 0.5 + dz),
            (-0.22 + dx * 0.83, y + 0.356, 0.5 + dz * 0.78),
            0.032,
            "honey",
            0.043,
        )
    box("Rounded coffee table", -0.22, y + 0.385, 0.5, 1.03, 0.074, 0.48, "birch", 0.076)
    book(-0.38, y + 0.445, 0.47, 0.209, 0.033, 0.156, "rose")
    lathe("Ceramic mug", 0.061, y + 0.422, 0.51, [(0, 0.048), (0.09, 0.055), (0.103, 0.058)], "turquoise", 16)
    orb("Cup of tea", 0.061, y + 0.524, 0.51, 0.047, 0.005, 0.047, "umber")
    tube(
        "Mug handle",
        [(0.107, y + 0.497, 0.51), (0.155, y + 0.495, 0.51), (0.157, y + 0.459, 0.51), (0.109, y + 0.454, 0.51)],
        0.011,
        "turquoise",
    )


def upper_rooms():
    select_collection("Second floor - bedroom and playroom")
    y = 4.2
    # Bed, cheerful quilt and bedside reading light.
    low_cabinet(-2.64, y, -0.60, 0.45, 0.39, "blue")
    lamp(-2.63, y + 0.425, -0.43, "lemon", "blue", 0.73)
    for x in (-2.16, -1.40):
        for z in (-0.48, 0.45):
            post("Bed foot", (x, y + 0.004, z), (x, y + 0.29, z), 0.052, "honey")
    box("Bed frame", -1.78, y + 0.283, -0.018, 0.98, 0.187, 1.34, "birch", 0.052)
    box("Headboard", -1.78, y + 0.475, -0.642, 1.015, 0.65, 0.11, "honey", 0.057)
    box("Mattress", -1.78, y + 0.42, -0.038, 0.985, 0.24, 1.29, "porcelain", 0.079)
    box("Quilt", -1.78, y + 0.506, 0.157, 1.01, 0.152, 0.89, "yellow", 0.064)
    box("Quilt trim", -1.78, y + 0.582, -0.175, 0.981, 0.028, 0.101, "lemon", 0.014)
    for dx in (-0.32, -0.1, 0.12, 0.34):
        for dz in (0.085, 0.35):
            orb("Quilt stitch", -1.78 + dx, y + 0.586, dz, 0.014, 0.004, 0.014, "cream", segments=8, rings=4)
    cushion(-1.78, y + 0.588, -0.438, 0.654, 0.153, 0.303, "pink")
    frame(-2.13, y + 1.36, -0.925, 0.63, 0.51, "rainbow")
    oval("Play mat", 0.081, y + 0.011, 0.38, 0.75, 0.412, 0.019, "sky")
    # Small cupboard and task lamp beside the drawing desk.
    for xx in (0.1, 0.97):
        for zz in (-0.70, -0.35):
            post("Desk leg", (xx, y, zz), (xx, y + 0.62, zz), 0.039, "honey")
    box("Art desk", 0.53, y + 0.643, -0.53, 1.05, 0.086, 0.56, "birch", 0.045)
    lamp(0.63, y + 0.69, -0.43, "turquoise", "blue", 0.617)
    book(0.32, y + 0.704, -0.39, 0.222, 0.027, 0.169, "coral")
    lathe("Pencil pot", 0.89, y + 0.687, -0.64, [(0, 0.061), (0.152, 0.073)], "yellow")
    for j, c in enumerate(("coral", "turquoise", "denim")):
        post(
            "Pencil", (0.86 + j * 0.025, y + 0.788, -0.64), (0.85 + j * 0.034, y + 0.928, -0.645), 0.009, c, segments=6
        )
    chair(0.31, y, 0.02, "mint", -1)
    frame(0.18, y + 1.421, -0.929, 0.64, 0.48, "flower")
    # Pull-along toy train sits in front of the desk.
    for off, c in ((-0.20, "coral"), (0.07, "yellow"), (0.35, "green")):
        xx = 0.05 + off
        box("Toy wagon", xx, y + 0.15, 0.43, 0.24, 0.125, 0.17, c, 0.026)
        for dx in (-0.065, 0.067):
            for zz in (0.328, 0.532):
                orb("Toy wheel", xx + dx, y + 0.077, zz, 0.048, 0.050, 0.018, "denim", segments=12, rings=6)
    box("Engine cab", -0.168, y + 0.258, 0.43, 0.111, 0.13, 0.14, "sky", 0.02)
    lathe("Train chimney", -0.075, y + 0.202, 0.43, [(0, 0.026), (0.059, 0.021), (0.076, 0.033)], "navy", 12)


def attic():
    select_collection("Attic - reading room")
    y = 6.3
    # Low objects follow both roof pitches. The bookcase has open, usable bays.
    bx = -1.20
    box("Bookcase back", bx, y + 0.51, -0.76, 0.83, 1.04, 0.058, "honey", 0.015)
    for xx in (bx - 0.42, bx + 0.42):
        box("Bookcase side", xx, y + 0.54, -0.59, 0.060, 1.08, 0.37, "birch", 0.019)
    for yy in (0.072, 0.54, 1.03):
        box("Bookcase shelf", bx, y + yy, -0.58, 0.90, 0.070, 0.40, "birch", 0.026)
    for row in range(2):
        for j, (w, h, c) in enumerate(
            (
                (0.072, 0.29, "teal"),
                (0.087, 0.36, "coral"),
                (0.06, 0.30, "lemon"),
                (0.081, 0.25, "denim"),
                (0.08, 0.34, "mint"),
            )
        ):
            xx = bx - 0.29 + j * 0.112
            book(xx, y + 0.111 + row * 0.47 + h / 2, -0.51, w, h, 0.20, c, 0.12 if j == 4 else 0)
    oval("Soft reading rug", -0.39, y + 0.012, 0.20, 0.85, 0.51, 0.022, "turquoise")
    for xx in (0.08, 0.57):
        for zz in (-0.48, -0.05):
            post("Armchair foot", (xx, y, zz), (xx, y + 0.16, zz), 0.046, "oak")
    box("Reading armchair", 0.33, y + 0.255, -0.29, 0.723, 0.32, 0.73, "tomato", 0.096)
    box("Armchair back", 0.33, y + 0.52, -0.595, 0.705, 0.61, 0.19, "coral", 0.09)
    box("Armchair back pillow", 0.33, y + 0.58, -0.48, 0.57, 0.403, 0.14, "poppy", 0.060)
    box("Armchair seat", 0.33, y + 0.414, -0.235, 0.54, 0.152, 0.49, "poppy", 0.061)
    for xx in (0.012, 0.646):
        box("Armchair arm", xx, y + 0.429, -0.262, 0.128, 0.29, 0.63, "coral", 0.06)
    # Floor lamp shade hangs over the reading chair.
    lathe("Floor lamp base", -0.26, y, -0.58, [(0, 0.14), (0.037, 0.16), (0.060, 0.12)], "blue")
    tube(
        "Bent floor lamp stem",
        [
            (-0.26, y + 0.045, -0.58),
            (-0.26, y + 1.12, -0.58),
            (-0.252, y + 1.20, -0.58),
            (-0.204, y + 1.24, -0.55),
            (-0.155, y + 1.22, -0.51),
            (-0.15, y + 1.12, -0.43),
        ],
        0.025,
        "honey",
    )
    lathe(
        "Reading lamp shade",
        -0.15,
        y + 1.035,
        -0.42,
        [(-0.058, 0.132), (-0.039, 0.15), (0.06, 0.109), (0.09, 0.045)],
        "yellow",
    )
    for dx, dz in ((-0.19, -0.05), (0.16, -0.07), (0.01, 0.15)):
        post(
            "Side table foot",
            (-0.52 + dx, y + 0.028, 0.43 + dz),
            (-0.52 + dx * 0.80, y + 0.32, 0.43 + dz * 0.8),
            0.028,
            "honey",
        )
    oval("Side table", -0.52, y + 0.34, 0.43, 0.262, 0.20, 0.045, "birch")
    book(-0.53, y + 0.383, 0.43, 0.168, 0.036, 0.138, "denim")
    pot(-1.90, y, -0.43, 0.55, "coral")
    # A small trailing plant breaks the straight bookcase silhouette.
    lathe("Plant saucer", -0.91, y + 1.075, -0.58, [(0, 0.092), (0.027, 0.105)], "cream")
    lathe("Trailing planter", -0.91, y + 1.092, -0.58, [(0, 0.071), (0.124, 0.097)], "turquoise")
    stems = [
        (-0.90, y + 1.20, -0.58),
        (-0.80, y + 1.24, -0.53),
        (-0.72, y + 1.16, -0.45),
        (-0.70, y + 1.00, -0.41),
        (-0.76, y + 0.89, -0.40),
        (-0.74, y + 0.73, -0.39),
    ]
    tube("Trailing stem", stems, 0.012, "fern")
    for i, (x, yy, zz) in enumerate(stems[1:]):
        side = 1 if i % 2 else -1
        orb(
            "Trailing leaf",
            x + side * 0.045,
            yy - 0.025,
            zz + 0.018,
            0.044,
            0.075,
            0.022,
            ("sprout", "leaf", "fern")[i % 3],
            roll=side * 0.41,
        )
    for x, yy, angle in ((-0.87, 1.25, 0.60), (-0.94, 1.28, -0.33), (-0.99, 1.23, -0.81)):
        orb("Trailing leaf", x, y + yy, -0.58, 0.037, 0.078, 0.026, "sprout", roll=angle)


def garden():
    select_collection("Garden")
    lathe(
        "Sandy island edge",
        0,
        -0.18,
        -0.02,
        [(-0.158, 4.91), (-0.105, 5.07), (0.078, 5.10), (0.135, 4.99)],
        "birch",
        72,
        0.42,
    )
    lathe(
        "Grass cover",
        0,
        -0.042,
        -0.02,
        [(-0.071, 4.99), (-0.030, 5.01), (0.006, 4.97), (0.032, 4.92)],
        "grass",
        72,
        0.42,
    )

    def tree(x, y, z, s):
        post("Tree trunk", (x, y, z), (x - 0.028 * s, y + 1.32 * s, z), 0.131 * s, "oak", 0.095 * s)
        for dx, dy, dz in ((-0.34, 1.32, 0.030), (0.32, 1.52, -0.025), (0.09, 1.73, 0.105)):
            post("Tree branch", (x, y + 0.72 * s, z), (x + dx * s, y + dy * s, z + dz * s), 0.073 * s, "oak", 0.037 * s)
        for dx, dy, dz, rx, ry, rz, c in (
            (-0.245, 1.48, -0.03, 0.57, 0.62, 0.468, "leaf"),
            (0.259, 1.67, -0.04, 0.55, 0.72, 0.48, "fern"),
            (0.055, 1.99, -0.05, 0.61, 0.70, 0.54, "sprout"),
            (-0.08, 1.68, 0.215, 0.592, 0.71, 0.44, "leaf"),
        ):
            orb(
                "Soft tree canopy", x + dx * s, y + dy * s, z + dz * s, rx * s, ry * s, rz * s, c, segments=20, rings=12
            )

    tree(-3.98, -0.006, -0.34, 0.86)
    tree(4.12, -0.004, -0.34, 1.09)
    for x, z, s in ((-3.76, 0.70, 0.68), (3.85, 0.75, 0.74), (-3.42, -0.81, 0.52), (4.54, 0.30, 0.46)):
        for dx, dy, k in ((-0.16, 0.15, 0.17), (0, 0.22, 0.22), (0.19, 0.15, 0.16)):
            orb("Shrub", x + dx * s, dy * s - 0.012, z, k * s, k * s, k * 0.9 * s, "sprout" if dx == 0 else "leaf")
    for x, z, c in (
        (-3.58, 0.91, "porcelain"),
        (-3.77, 0.82, "yellow"),
        (-3.42, 0.82, "pink"),
        (3.64, 0.92, "yellow"),
        (3.86, 0.76, "pink"),
        (4.05, 0.86, "porcelain"),
        (3.74, 1.14, "porcelain"),
    ):
        h = 0.128 + (abs(x) * 0.40 % 1) * 0.09
        post("Flower stem", (x, 0, z), (x, h, z), 0.011, "fern", segments=6)
        for i in range(5):
            a = i * 2 * pi / 5
            orb("Daisy petal", x + 0.048 * cos(a), h + 0.048 * sin(a), z, 0.048, 0.048, 0.021, c, segments=8, rings=4)
        orb("Daisy centre", x, h, z + 0.018, 0.037, 0.037, 0.02, "gold", segments=10, rings=5)
    for j, (x, z) in enumerate(((-4.20, 0.28), (-3.34, 0.50), (3.56, 1.29), (4.34, 0.18), (-3.29, 1.1))):
        for k in range(3):
            orb(
                "Grass blades",
                x + (k - 1) * 0.035,
                0.048,
                z,
                0.021,
                0.071,
                0.018,
                "fern",
                roll=(k - 1) * -0.33,
                segments=8,
                rings=4,
            )


ANCHORS.update(
    {
        "s_stove": (-1.95, 0.85, -0.39),
        "s_candle": (0.75, 0.99, -0.34),
        "s_tv": (-2.10, 3.18, -0.52),
        "s_lamp": (-2.63, 4.98, -0.43),
        "s_desk": (0.63, 5.19, -0.43),
        "s_attic": (-0.15, 7.28, -0.42),
    }
)
