# Learning module design review

The [wood-stove concept](docs/konzept-verbrennungsdreieck-holzscheit.png) sets the scene for the [interactive experiment](docs/verbrennungsdreieck.webp). Both place the movable triangle beside a single burning log. The annotated tablet view guided the camera angle and the latest changes to the controls.

## The free experiment

The framed module title sits in the same toolbar as the Brandhaus title. Each coloured side has an adjacent label with the pictogram above its name. Colours continue into the triangle from their respective edges, and the dotted guides track the knob as it moves. In the centre, all three conditions are sufficient.

The starting camera shows the stove door, top and right side. Children turn the stove by dragging directly on it. With keyboard focus on the stove, Left and Right turn it and Home restores the starting view. Help and the guided lesson explain the interaction on demand.

The observation area reserves space for the longest wrapped caption at each screen width. The browser test compares the stove canvas bounds before and after cooling the log, including a change from one line of detail to two at 1024 × 768.

The fuel comparison changes the appearance of the full log resting on the grate. The wood darkens and an ash-grey grain becomes visible at the end of the comparison. Moving away from heat instead leaves cooled, brown wood. The guided activity asks children to look for these differences directly through the stove window.

## Responsive layout and checks

The dashboard tiles use stills from the lessons. On a wide screen the triangle and stove share a row. On a narrow portrait screen the stove follows the triangle. During each guided trial the question and its observation share one compact bar below the scene. The browser test checks that the scene, bar and footer remain within the viewport throughout all three trials.

The Chrome checks cover the annotated 1024 × 768 viewport, portrait tablet and phone layouts, touch and keyboard input, direct camera orbit, the Blender flame animation, reduced motion, the guided comparisons and restoration of the free experiment. The Brandhaus browser suite exercises both house layouts and their guided activities. Physical tablet and Safari checks are still open.
