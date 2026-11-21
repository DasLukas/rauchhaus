# Das Rauchhaus

[Open the published version from main](https://daslukas.github.io/rauchhaus/)

A one-page, touch-first 3D teaching tool for primary-school children aged 6–10. Choose an orange smoke source or tap a turquoise marker to open a door. Observe the plume, the ceiling layer and the shared stairwell. The optional guided activity repeats the same television scenario with the apartment door open and closed. Classroom use needs a WebGL 2 browser and a connection to load the site. The application runs entirely on the device after loading.

![Central stairwell with apartments on both sides and a cutaway basement](docs/rauchhaus.png)

This branch has eight apartments around one continuous staircase. Each full storey pairs a one-room home with a two-room home, alternating sides. A glazed entrance, mailboxes, handrails and half-landings mark the common circulation space. The basement contains a bicycle store and a shared laundry. Start the washing-machine experiment and try opening or closing the laundry door. Photovoltaic panels are visible on the roof.

## Develop locally

Install Node.js 24.15 or later and npm. The versioned GLB is ready to serve. Blender is needed only when changing the artwork.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. To view this branch on a tablet, serve the local development instance on a trusted network with `npm run dev -- --host 0.0.0.0`. To preview exactly what will be deployed, run `npm run build` followed by `npm run preview`.

## Verification

| Command | Verifies |
| --- | --- |
| `npm run lint` | Static analysis |
| `npm test` | Room transport, detector responses, source and door changes, time-step invariance and the matched learning trials |
| `npm run check:model` | Editable Blender source and self-contained WebGL export, including all control anchors, moving doors and mesh budgets |
| `npm run build` | TypeScript types and production bundle in `dist/` |
| `npm run check` | All four checks above |
| `npm run test:browser` | Compares rendered smoke on the shared landings for both the television and washing-machine experiments, and checks floor navigation and touch targets in installed Chrome. Run the build first. |

The browser test starts Chrome with its sandbox enabled and a new temporary profile, then closes the instance and removes the profile. It exercises the actual washing-machine control and detector in the app. A rendering fixture advances two laundry scenarios to 32 model seconds and compares the same ground-floor landing in both images. Set `RAUCHHAUS_TEST_URL` to test an existing deployment, or `RAUCHHAUS_SCREENSHOTS` to save evidence in a directory of your choice. Running the smoke source while reviewing a tablet in both orientations is part of release verification. On physical devices, check tap accuracy, swipe separation, frame rate and readability. A simulator is useful for Safari behavior and layout.

## Editing the house

Open [the editable Blender model](assets/blender/rauchhaus.blend) to inspect the furnished rooms, landscape, lighting, doors and anchors. The [Blender Python generator](assets/blender/build_house.py) builds the individual editable objects and the batched web version. Change the generator for reproducible artwork updates, then run the following from the project root with Blender 5.3 available.

```sh
blender --background --python assets/blender/build_house.py
npm run check:model
```

Before exporting, Blender checks each complete door and handle against nearby geometry at one-degree intervals. It also checks the stair treads, landings, headroom and open stairwell between floors. The generator replaces the versioned `.blend` and `public/models/rauchhaus.glb`. Save hand-modeled changes separately before regenerating. See the [architecture and model contract](ARCHITECTURE.md) for the shared layout and coordinates.

## Development and publishing

Use short-lived branches and pull requests against `main`. GitHub Actions installs the lockfile, runs the checks and tests the production website in Chrome. A successful run on `main` publishes the checked artifact to GitHub Pages. Choose **GitHub Actions** as the Pages source when deploying a fork. The static bundle supports project-relative URLs and can also be served from another static web host.

## Teaching basis

The house uses a qualitative upper/lower-zone model. Warm smoke rises, forms an upper layer, and transfers through openings. Existing smoke persists when a door closes. The modeled effects support classroom observation. Real fire development, escape times and safe occupancy cannot be inferred from the animation.

- [NIST two-zone fire and smoke modeling](https://pages.nist.gov/cfast/)
- [Fire Safety Research Institute’s full-scale open/closed door comparison](https://fsri.org/program-update/close-you-doze-series-after)
- [German Fire Services Association and vfdb guidance](https://www.feuerwehrverband.de/app/uploads/2020/05/DFV_vfdb_Fachempfehlung_Verhalten_Brandfall_2019b.pdf)
- [Hardy et al. on guided exploration in primary science education](https://www.uni-muenster.de/imperia/md/content/didaktik_des_sachunterrichts/dokumente/literaturmoeller/article.pdf). The study concerned floating and sinking. The prediction, observation and comparison sequence applies that instructional approach here.

## Licensing

Code and technical documentation use the [MIT License](LICENSE). Original 3D artwork, graphics and German educational content use [CC BY 4.0](public/licenses/CC-BY-4.0.txt). Suggested credit: “Das Rauchhaus, DasLukas and contributors,” with a link to this repository, a link to the license and a description of adaptations. The locally served Nunito font uses the [SIL Open Font License](public/licenses/Nunito-OFL.txt). Three.js uses the [MIT License](public/licenses/Three-MIT.txt).
