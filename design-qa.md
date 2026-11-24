# Learning module design review

The [wood-stove concept](docs/konzept-verbrennungsdreieck-holzscheit.png) sets the scene for the [interactive experiment](docs/verbrennungsdreieck.webp). Both place the movable triangle beside a single burning log. The annotated tablet view guided the camera angle and the latest changes to the controls.

## The free experiment

The framed module title sits in the same toolbar as the Brandhaus title. Each coloured side has an adjacent label with the pictogram above its name. Colours continue into the triangle from their respective edges, and the dotted guides track the knob as it moves. In the centre, all three conditions are sufficient.

The starting camera shows the stove door, top and right side. Children turn the stove by dragging directly on it. With keyboard focus on the stove, Left and Right turn it and Home restores the starting view. Help and the guided lesson explain the interaction on demand.

The observation area reserves space for the longest wrapped caption at each screen width. The browser test compares the stove canvas bounds before and after cooling the log, including a change from one line of detail to two at 1024 × 768.

In the fuel comparison the top of the log recedes while the lower bark stays in place. A little ash remains at the end. In the cooling trial the flames go out while the log is still visible at its original size. Children can identify each outcome through the stove window.

## Responsive layout and checks

The dashboard tiles use stills from the lessons. On a wide screen the free experiment centers the triangle and stove together between the header and footer. The browser test measures the clearance on both sides when opening the lesson and when returning from a guided trial. It includes 1080 × 810 and 1080 × 700 to cover full and reduced landscape heights on the school iPad. On a narrow portrait screen the stove follows the triangle. During each guided trial the question and its observation share one compact bar below the scene. The browser test checks that the scene, bar and footer remain within the viewport throughout all three trials.

The Chrome checks cover the annotated 1024 × 768 viewport, portrait tablet and phone layouts, touch and keyboard input, direct camera orbit, the Blender flame animation, reduced motion, the guided comparisons and restoration of the free experiment. The Brandhaus browser suite exercises both house layouts and their guided activities. Safari on a simulated ninth-generation iPad running iPadOS 26.5 also passed the landscape layout check on entry, in native fullscreen and after leaving the guide. Verification on a physical school iPad running 16.7.1 is still open.
