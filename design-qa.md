# Learning module design review

The [approved wood-stove concept](docs/konzept-verbrennungsdreieck-holzscheit.png) and the [implemented free experiment](docs/verbrennungsdreieck.webp) both show a centred control and a burning log at 1448 × 1086. The implementation was captured in Chrome at 1448 × 1086 CSS pixels with a device scale factor of 1.

## Desktop comparison

The single knob sits at equal distances from the three labelled sides. The side colours, thermometer, air and wood symbols, cream controls, rounded Nunito lettering and blue background carry across from the concept and the Brandhaus interface. The live view uses a slightly elevated camera: the upper casting and the depth of the firebox stay visible during horizontal orbit. The dashboard, learning lightbulb, pause and fullscreen controls are available alongside the experiment.

The stove window was reviewed separately in the frontal and turned positions. The first rendering gave the refractory bricks nearly uniform light and the camera offered few depth cues. The final housing has a darker lining, directional shadows and warm internal light. The final close-up shows the curved flame tips, ember seams and the log’s cut end across the permitted orbit. The initial turn arrows were hard to identify as controls. The final arrows sit in cream buttons on either side of the camera label.

## Responsive layout and interactions

The two classroom activities fit side by side on desktop and stack on a narrow screen. The previews are stills taken from the lesson scenes. The triangle appears above the stove on a narrow portrait screen. At 390 × 844 the free experiment now fits its complete toolbar. An earlier resize capture repeated part of the header at the foot of the image. After removing unnecessary clipping and tightening spacing, fresh captures showed the hint and reset controls in their intended positions. The longer guided lesson scrolls vertically; the prediction options and actions respond to taps.

Chrome checks covered mobile and tablet viewports, touch input, keyboard control, dragging along the oxygen guide, camera reset, live animation, reduced motion, prediction and discussion, and returning to the free experiment. The full browser suite also exercised the two Brandhaus layouts and their guided activities. Testing on physical tablets and in Safari remains open.

final result: passed
