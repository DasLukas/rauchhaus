# Architecture

## Runtime and boundaries

The application is a static, German-language TypeScript client. Vite builds the entry point, CSS, local font and Three.js renderer. The house selector links to the same page with a house query parameter. The small house is the default. Only the selected GLB is requested, from the same origin. Each page load creates its own camera, markers and simulation. The application has no account system, API, analytics or persistent student records. Reloading starts a clean exploration. Only the repository link in the adult help section navigates off site, after deliberate activation.

## Modules and data flow

| Module | Responsibility |
| --- | --- |
| `src/simulation` | House topology, source locations by room, detector elevations and deterministic transport. Independent of the DOM, Three.js and frame rate. |
| `src/ui` | German learning activity, native dialog, marker buttons, icons, free-session and matched-trial state. |
| `src/scene` | Orthographic camera, physical-object hit testing, indicator projection, lighting and per-room transparent smoke volumes. |
| `src/main.ts` | Connects controls and time updates to the active simulation and presents status changes. |
| `assets/blender` and `public/models` | Source artwork, repeatable generator and batched web export. |

A source selection starts a fresh run with the current door settings. A door change updates connectivity while retaining the existing upper layers. The animation clock advances the active simulation and passes an immutable snapshot to the renderer. The renderer projects interaction anchors to viewport coordinates. The DOM uses those positions for keyboard- and touch-accessible controls. Pause, an open help dialog and a backgrounded page suspend the teaching clock. A guided activity owns a second simulation instance and restores the original experiment on exit. Both trial arms share the same source, initial conditions and observation time, apart from the living-room door setting.

## Smoke model

Every room and landing is a well-mixed upper layer above a lower air zone. The source adds relative smoke, volume and warmth. Door transport depends on upper-layer depth at the lintel, temperature contrast and door permeability. Connected landings carry buoyant gas up the stairwell. Small closed-door leakage, entrained air and cooling are included. Each fixed 1/30-s step computes all transfers from the same starting state, limits donor outflow and conserves smoke tracer. The sloped roof changes the attic volume above a given layer height.

The source decays after its demonstration profile. Closing a door can slow the spread while residual smoke remains visible. The cutaway front acts as a closed boundary. The small house accounts for tracer leaving the stairwell through its exterior entrance. Wind, detailed flame chemistry and toxic exposure are outside the model. Its time scale and transport coefficients serve repeatable qualitative comparisons. The app uses no CFAST runtime or calibrated building prediction.

Each smoke detector compares its local sensor height to the interface and checks local smoke concentration. A quiet symbol and accessible announcement show activation. Source plumes, ceiling layers and opening flows are visualized from the same snapshot. The fragment shader clips against rooms and the roof, depth-tests against furniture, and uses a small repeatable noise volume.

## Asset contract and rendering

The web asset uses glTF coordinates, with positive Y up, X to the right and positive Z toward the viewer. Ground-floor elevation is 0. The storeys are spaced 2.4 model units apart. A right-hand staircase connects four landings in the small house. A central staircase serves the five levels of the large house, including the basement. Each apartment has its own entrance on the landing. Each source, detector and door has one named `anchor_<id>` node. A `hinge_<doorId>` node owns the moving door mesh and its opening-angle metadata. The application positions controls from those nodes. The selected floor plan in `src/simulation/layout-small.json` or `src/simulation/layout.json` supplies the room boundaries, floor elevations, openings and interaction positions to the Blender generator and the teaching model. Doors sit flush in straight partitions and swing a quarter turn into the receiving room. Furniture placement reserves the full swept area of each door leaf and handle. The small house has an interactive entrance through the right wall. Its leaf opens outward onto a side landing.

The GLB batches static geometry and paints vertex colors, including baked contact shading. Separate pivots keep door animation cheap. The renderer limits resolution and reduces it during sustained slow animation. Unchanged paused or empty scenes avoid repeated drawing. The smoke renderer shares a noise texture across rooms and skips empty compartments.

The overview fits the selected house from its lowest storey to the ridge. Tapping a storey focuses its controls and allows panning. The DOM retains each marker's projected anchor and spaces neighbouring targets across the same storey so the two entrance doors stay individually tappable. A short line connects displaced targets to their anchors.

## Build and deployment

Only the checked static artifact is deployed. Pull requests have read access to repository content. Uploading the website and requesting the GitHub Pages OIDC token are restricted to the publishing path on `main`. The deploy job references the Pages environment. Reverting a change on `main` republishes the previous source through the same checks. There is no database migration or server-side application state.
