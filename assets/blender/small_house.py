"""The small front-cut dollhouse, from its garden path to the attic reading nook."""

from math import sin

import furniture as f
from house_rooms import at_floor, at_source
from miniature_geometry import box, orb, oval, post, select_collection, tube
from structure import BACK, LAYOUT, PITCH, ceiling, window


def street_entrance():
    """Extend the stair landing through the right wall to a paved, accessible path."""
    select_collection("House structure")
    door = LAYOUT["exteriorDoor"]
    x = door["x"]
    z = (door["hingeZ"] + door["latchZ"]) / 2
    box("Entry landing slab", x + 0.64, -0.069, z, 1.36, 0.138, 1.63, "limestone", 0.025)
    box("Welcome mat", x + 0.36, 0.004, z, 0.47, 0.008, 0.70, "sagebox", 0.004)
    for i in range(4):
        box("Mat stripe", x + 0.22 + 0.09 * i, 0.009, z, 0.018, 0.004, 0.63, "teal", 0.001)
    box("Canopy soffit", x + 0.50, 2.12, z, 1.13, 0.075, 1.74, "birch", 0.025)
    box("Patinated entrance canopy", x + 0.50, 2.18, z, 1.17, 0.064, 1.8, "teal", 0.022)
    for zz in (z - 0.67, z + 0.67):
        post("Canopy bracket", (x + 0.07, 1.83, zz), (x + 0.86, 2.09, zz), 0.031, "honey")

    for level in (1, 2, 3):
        box("Masonry floor course", x, level * PITCH - 0.065, 0, 0.154, 0.154, 4.02, "rim", 0.012)
        for i in range(2):
            box(
                "Sandstone corner block",
                x + 0.066,
                level * PITCH + 0.17 + i * 0.25,
                1.74 - i * 0.10,
                0.035,
                0.128,
                0.31 + 0.12 * i,
                "rim",
                0.011,
            )
    # The front of the mailbox column faces the cut, and stands beside the landing.
    xx, zz = x + 0.32, z - 0.93
    for dx in (-0.22, 0.22):
        box("Mailbox column foot", xx + dx, 0.49, zz, 0.046, 0.98, 0.068, "slate", 0.009)
    box("Postbox backing", xx, 1.015, zz, 0.64, 0.61, 0.095, "teal", 0.028)
    for col in range(2):
        for row in range(2):
            bx, by = xx - 0.15 + col * 0.30, 0.88 + row * 0.246
            box("Letter box", bx, by, zz + 0.07, 0.274, 0.219, 0.079, "sagebox", 0.02)
            box("Envelope slot", bx, by + 0.044, zz + 0.114, 0.176, 0.028, 0.009, "slate", 0.003)
            box("Nameplate", bx - 0.018, by - 0.038, zz + 0.115, 0.112, 0.035, 0.008, "porcelain", 0.002)
    x_light = x + 0.16
    box("Porch light mounting", x + 0.07, 1.72, z - 0.69, 0.06, 0.17, 0.14, "teal", 0.018)
    tube(
        "Porch light arch",
        [(x + 0.08, 1.75, z - 0.70), (x_light + 0.06, 1.79, z - 0.70), (x_light + 0.115, 1.74, z - 0.70)],
        0.021,
        "teal",
    )
    orb("Enamel porch shade", x_light + 0.115, 1.73, z - 0.70, 0.142, 0.045, 0.132, "teal")
    orb("Porch light globe", x_light + 0.115, 1.626, z - 0.70, 0.100, 0.116, 0.102, "lemon")


def curtains(x, y, width, height, paint):
    window(x, y, width, height)
    post(
        "Curtain rod",
        (x - width * 0.59, y + height * 0.54, BACK + 0.215),
        (x + width * 0.59, y + height * 0.54, BACK + 0.215),
        0.024,
        "honey",
    )
    for sign in (-1, 1):
        for i in range(3):
            dx = sign * (width * 0.50 + i * 0.054)
            box(
                "Linen curtain fold",
                x + dx,
                y,
                BACK + 0.193 + 0.019 * (i % 2),
                0.082,
                height * 1.06,
                0.056,
                paint,
                0.024,
            )
        box(
            "Curtain tie",
            x + sign * (width * 0.5 + 0.055),
            y - height * 0.12,
            BACK + 0.225,
            0.147,
            0.041,
            0.044,
            "honey",
            0.011,
        )


def room_details():
    """Fit furniture around four actual source objects and leave each door arc open."""
    y = 0
    select_collection("Ground floor kitchen")
    at_source(f.stove, (-1.95, 0.90, -0.39), "s_stove", 0)
    at_floor(f.sink, (-1.39, -0.50), -2.89, 0, -1.14, 1.01)
    at_floor(f.refrigerator, (-2.70, -0.50), -2.04, 0, -1.16, 1.04)
    oval("Kitchen rug", -2.78, 0.013, 0.01, 0.63, 0.33, 0.018, "mint")
    select_collection("Breakfast room")
    at_floor(f.dining_set, (0.05, 0.12), 0.04, 0, 0.15, 1.25)
    f.low_cabinet(0.52, 0, -1.40, 1.06, 0.66, "teal")
    f.pot(0.68, 0.695, -1.43, 0.54, "lemon", True)
    curtains(-0.52, 1.54, 1.00, 0.69, "rose")
    f.pendant(0.05, 2.27, -0.02, 0.21, "yellow")

    y = PITCH
    select_collection("Living room")
    at_source(f.television, (-2.10, 1.08, -0.52), "s_tv", 1)
    at_floor(f.sofa, (-0.05, -0.26), -0.42, 1, -0.63, 1.23)
    at_floor(f.salon_table, (-0.22, 0.50), -0.62, 1, 0.57, 1.05)
    f.pot(-3.83, y, -0.46, 0.98, "sky")
    curtains(-0.63, y + 1.57, 1.06, 0.69, "mint")
    f.pendant(-2.1, y + 2.27, -0.17, 0.18, "turquoise")

    y = 2 * PITCH
    select_collection("Bedroom")
    at_floor(f.bed, (-1.78, -0.02), -2.85, 2, -0.40, 1.30, {"yellow": "indigo", "lemon": "sky", "pink": "mint"})
    f.low_cabinet(-3.83, y, -1.12, 0.49, 0.46, "turquoise")
    f.pot(-3.83, y + 0.49, -1.12, 0.43, "rose")
    oval("Bedroom rug", -2.85, y + 0.013, 0.67, 0.60, 0.35, 0.017, "rose")
    curtains(-2.85, y + 1.62, 0.92, 0.63, "lemon")
    select_collection("Children's room")
    at_source(f.desk, (0.63, 0.99, -0.43), "s_desk", 2)
    f.low_cabinet(-0.96, y, -1.20, 0.47, 0.53, "mint")
    f.book(-0.96, y + 0.584, -1.17, 0.22, 0.045, 0.18, "coral")
    at_floor(f.toy_train, (0.05, 0.43), 0.10, 2, 0.42, 1.42)
    oval("Play mat", 0.04, y + 0.012, 0.43, 0.81, 0.47, 0.019, "mint")
    f.pendant(-0.24, y + 2.27, -0.18, 0.21, "coral")

    y = 3 * PITCH
    select_collection("Attic reading flat")
    at_floor(f.bookcase, (-1.2, -0.59), -3.25, 3, -1.45, 1.4)
    at_source(f.reading_lamp, (-0.15, 1.05, -0.42), "s_attic", 3)
    at_floor(f.armchair, (0.33, -0.28), 0.50, 3, -0.79, 1.38)
    at_floor(f.salon_table, (-0.22, 0.50), -0.75, 3, 0.41, 0.90)
    f.pot(-3.85, y, 0.15, 0.86, "rose", True)
    curtains(-2.13, y + 1.72, 1.04, 0.86, "sky")
    f.frame(0.72, y + 1.79, -1.90, 0.66, 0.51, "flower")
    for xx in (-3.49, -1.56, 0.85):
        box("Attic timber", xx, ceiling(xx) - 0.062, -0.09, 0.134, 0.135, 3.76, "honey", 0.025)


def garden():
    """A shallow grassy island continues at street level along the side entrance."""
    select_collection("Garden")
    box("Island earth", 0.12, -0.29, -0.10, 12.66, 0.39, 5.06, "soil", 0.15)
    box("Island grass", 0.12, -0.10, -0.10, 12.72, 0.14, 5.10, "grass", 0.059)
    # The unexcavated ground storey has a finished floor below the first stair.
    landing = LAYOUT["dimensions"]
    stair_w = landing["stairHalfWidth"] * 2
    box("Ground floor stair base", landing["stairEyeX"], -0.046, 0, stair_w, 0.086, 4, "limestone", 0.012)
    # The foundation ties both the flat and the common stair to the garden plot.
    box("Stone foundation", 0, -0.13, 0, 8.70, 0.19, 4.12, "warmgrey", 0.032)
    x = LAYOUT["exteriorDoor"]["x"]
    z = (LAYOUT["exteriorDoor"]["hingeZ"] + LAYOUT["exteriorDoor"]["latchZ"]) / 2
    for col in range(2):
        for row in range(3):
            box(
                "Garden path paver",
                x + 1.55 + col * 0.40,
                -0.018,
                z - 0.49 + row * 0.50,
                0.385,
                0.042,
                0.48,
                "limestone",
                0.013,
            )
    f.tree(-5.33, -0.032, -1.03, 1.22)
    f.tree(5.54, -0.032, -1.66, 0.94)
    for side in (-1, 1):
        for i in range(5):
            xx = side * (4.58 + (i % 3) * 0.49)
            zz = (-1.98 + (i // 3) * 0.59) if side == 1 else (0.39 + (i // 3) * 0.47)
            h = 0.22 + 0.048 * (i % 3)
            orb("Garden bush", xx, h - 0.046, zz, 0.25, h, 0.24, ("fern", "sprout", "leaf")[i % 3])
            if i % 2 == 0:
                for j in range(3):
                    orb(
                        "Garden blossom",
                        xx + (j - 1) * 0.085,
                        2 * h - 0.058 + 0.019 * sin(j),
                        zz + 0.095,
                        0.043,
                        0.045,
                        0.033,
                        "pink" if i == 0 else "lemon",
                        segments=9,
                        rings=5,
                    )
