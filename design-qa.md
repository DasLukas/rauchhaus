# Learning module design review

The [wood-stove concept](docs/konzept-verbrennungsdreieck-holzscheit.png) sets the scene for the [interactive experiment](docs/verbrennungsdreieck.webp). Both place the movable triangle beside a single burning log. The annotated tablet view guided the camera angle and the latest changes to the controls.

## The free experiment

The framed module title sits in the same toolbar as the Brandhaus title. Each coloured side has a large pictogram above its name. Colours continue into the triangle from their respective edges, and the dotted guides track the knob as it moves. In the centre, all three conditions are sufficient.

The starting camera shows the stove door, top and right side. Children turn the stove by dragging directly on it. With keyboard focus on the stove, Left and Right turn it and Home restores the starting view. Help and the guided lesson explain the interaction on demand.

The fuel comparison changes the appearance of the full log resting on the grate. The wood darkens and an ash-grey grain becomes visible at the end of the comparison. Moving away from heat instead leaves cooled, brown wood. The guided activity uses these distinct appearances in its prediction pictures and observations.

## Responsive layout and checks

The dashboard tiles use stills from the lessons. On a wide screen the triangle and stove share a row. On a narrow portrait screen the stove follows the triangle, and the guided prediction and discussion panels can scroll into view.

The Chrome checks cover the annotated 1024 × 768 viewport, portrait tablet and phone layouts, touch and keyboard input, direct camera orbit, the Blender flame animation, reduced motion, the guided comparisons and restoration of the free experiment. The Brandhaus browser suite exercises both house layouts and their guided activities. Physical tablet and Safari checks are still open.
