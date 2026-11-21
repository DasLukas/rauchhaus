# Das Rauchhaus

[Open the published version from main](https://daslukas.github.io/rauchhaus/)

A one-page, touch-first 3D teaching tool for primary-school children aged 6–10. Each level has one selectable smoke source. Its orange marker sits beside the object on the wall. Choose an orange smoke source or tap a turquoise marker to open a door. Observe the plume, the ceiling layer and the shared stairwell. The optional guided activity repeats the same television scenario with the apartment door open and closed. Classroom use needs a WebGL 2 browser and a connection to load the site. The application runs entirely on the device after loading.

![The small house with the staircase and outside entrance on the right](docs/rauchhaus-klein.png)

**Kleines Haus** is the default. Four apartments share a staircase on the right across the ground floor, two upper storeys and the attic. A glazed entrance through the right exterior wall leads directly onto the ground-floor landing. Its own door control opens the entrance.

Use **Großes Haus** above the scene to explore the larger building. Selecting a different house starts a fresh experiment in that house. The selected layout can be bookmarked with `?haus=klein` or `?haus=gross`.

![The large house with its central staircase and basement](docs/rauchhaus.png)

The large house has eight apartments around one continuous staircase. Each full storey pairs a one-room home with a two-room home, alternating sides. A glazed entrance, mailboxes, handrails and half-landings mark the common circulation space. The basement contains a bicycle store and a shared laundry. Start the washing-machine experiment and try opening or closing the laundry door. Photovoltaic panels are visible on the roof.

## Develop locally

Install Node.js 24.15 or later and npm. Both versioned GLB files are ready to serve. Blender is needed only when changing the artwork.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. To view this branch on a tablet, serve the local development instance on a trusted network with `npm run dev -- --host 0.0.0.0`. To preview exactly what will be deployed, run `npm run build` followed by `npm run preview`.

## Verification

| Command | Verifies |
| --- | --- |
| `npm run lint` | Static analysis |
| `npm test` | Room filling, long-run smoke balance, detector responses, door changes, time-step invariance and the matched learning trials |
| `npm run check:model` | Editable Blender source and self-contained WebGL export, including all control anchors, moving doors and mesh budgets |
| `npm run build` | TypeScript types and production bundle in `dist/` |
| `npm run check` | All four checks above |
| `npm run test:browser` | Compares smoke at the bedroom doorway and on the shared landings, measures furniture contrast in dense smoke, and checks floor navigation and touch targets in installed Chrome. Run the build first. |

The browser test starts Chrome with its sandbox enabled and a new temporary profile, then closes the instance and removes the profile. It exercises the actual washing-machine control and detector in the app. A rendering fixture advances the television, laundry and desk-lamp experiments to repeatable observation points. The desk-lamp tests follow smoke through the attic door and, with that door closed, down to the lower landings. Set `RAUCHHAUS_TEST_URL` to test an existing deployment, or `RAUCHHAUS_SCREENSHOTS` to save evidence in a directory of your choice. Running the smoke source while reviewing a tablet in both orientations is part of release verification. On physical devices, check tap accuracy, swipe separation, frame rate and readability. A simulator is useful for Safari behavior and layout.

## Editing the house

Open the editable [small house](assets/blender/rauchhaus-klein.blend) or [large house](assets/blender/rauchhaus.blend) to inspect the furnished rooms, landscape, lighting, doors and anchors. The [Blender Python generator](assets/blender/build_house.py) builds the individual editable objects and the batched web version. Change the generator for reproducible artwork updates, then run the following from the project root with Blender 5.3 available.

```sh
# Small house
blender --background --python-exit-code 1 --python assets/blender/build_house.py -- --small
# Large house
blender --background --python-exit-code 1 --python assets/blender/build_house.py
npm run check:model
```

Before exporting, Blender checks each complete door and handle against nearby geometry at one-degree intervals. It also checks the stair treads, landings, headroom and open stairwell between floors. The generator replaces the selected house’s versioned `.blend` and `.glb` files. Save hand-modeled changes separately before regenerating. See the [architecture and model contract](ARCHITECTURE.md) for the shared layout and coordinates.

## Development and publishing

Use short-lived branches and pull requests against `main`. GitHub Actions installs the lockfile, runs the checks and tests the production website in Chrome. A successful run on `main` publishes the checked artifact to GitHub Pages. Choose **GitHub Actions** as the Pages source when deploying a fork. The static bundle supports project-relative URLs and can also be served from another static web host.

## Teaching basis

Warm smoke rises to the ceiling. As the upper layer deepens, its lower edge reaches the top of an open door. Smoke then passes beneath the lintel, rises on the receiving side and spreads along the next ceiling. Closing the door reduces further transfer while smoke already in the room persists. The demonstration uses a light-to-dark grey palette to show increasing smoke loading. Its clock and colours are teaching choices. Real fire development, escape times and safe occupancy cannot be inferred from the animation.

To see a room fill, choose the desk lamp in the small house. Open the bedroom, landing and attic doors on the smoke path. The early plume is easy to follow. The teaching target is about 60% of the playroom volume occupied by the upper layer at 25 model seconds and about 80% at 40–45 seconds. The attic fills later. A source stays active throughout free exploration. Pause freezes the experiment, and restarting or selecting another source starts with clear rooms. Each guided television trial pauses at 40 model seconds for comparison.

To follow smoke downstairs, repeat the desk-lamp experiment with its apartment door open and the attic apartment door closed. Watch the upper landings first. As smoke accumulates, the layer reaches the stair opening and spreads under the ceiling of the first-floor landing. The ground-floor landing follows later. The lower apartment doors can stay closed throughout.

In the large house, start the ground-floor kettle and open its apartment door. Smoke reaching the attic landing initially mixes with clear air and appears lighter than the smoke near the source. With a sustained supply, smoke continues to mix between occupied layers. Watch how the railing at the top gradually becomes harder to see.

- NIST describes the onset of doorway flow and the opposing lower air current in section 3.4.2 of its [CFAST model guide](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1026r1.pdf).
- In full-scale apartment experiments, corridor visibility dropped sooner at 1.5 m above the floor than at 0.3 m after the apartment door opened. See figure 8 of [De Witte, Johansson and van Hees (2025)](https://doi.org/10.1177/07349041251377639).
- Experiments with an upstairs fire in a two-storey building showed that smoke can descend through vertical connections and that its distribution depends on ventilation. [Qi et al. (2024)](https://doi.org/10.1016/j.jobe.2024.111264).
- Full-scale stairwell experiments tracked light attenuation at each landing. With no upper outlet, the first smoke reaching the upper levels was dilute and the concentration there increased as smoke continued to enter. [Nii et al., figures 3 and 4](https://publications.iafss.org/publications/aofst/6/1b-1/view/aofst_6-1b-1.pdf).
- The renderer attenuates background light exponentially along a sightline, following the slice rendering approach in section 4.3.1 of the [NIST Smokeview technical reference](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1017-2.pdf).
- [Fire Safety Research Institute’s full-scale open/closed door comparison](https://fsri.org/program-update/close-you-doze-series-after)
- [German Fire Services Association and vfdb guidance](https://www.feuerwehrverband.de/app/uploads/2020/05/DFV_vfdb_Fachempfehlung_Verhalten_Brandfall_2019b.pdf)
- [Hardy et al. on guided exploration in primary science education](https://www.uni-muenster.de/imperia/md/content/didaktik_des_sachunterrichts/dokumente/literaturmoeller/article.pdf). The study concerned floating and sinking. The prediction, observation and comparison sequence applies that instructional approach here.

## Licensing

Code and technical documentation use the [MIT License](LICENSE). Original 3D artwork, graphics and German educational content use [CC BY 4.0](public/licenses/CC-BY-4.0.txt). Suggested credit: “Das Rauchhaus, DasLukas and contributors,” with a link to this repository, a link to the license and a description of adaptations. The locally served Nunito font uses the [SIL Open Font License](public/licenses/Nunito-OFL.txt). Three.js uses the [MIT License](public/licenses/Three-MIT.txt).
