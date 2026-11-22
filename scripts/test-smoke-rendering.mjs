import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import largeHouse from '../src/simulation/layout.json' with { type: 'json' }

const evidence = process.env.RAUCHHAUS_SCREENSHOTS

async function rendered(page, name) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
  if (name && evidence) await page.screenshot({ path: join(evidence, `${name}.png`) })
}

// Projected jamb markers provide a scale and location for sampling the shared
// stairwell. The two compared images use the same room, camera and elapsed time.
export async function landingColor(page, level, layout = largeHouse) {
  await rendered(page)
  const landing = layout.floors.find((floor) => floor.level === level).landing
  const entrances = layout.doors.filter((door) => door.rooms.includes(landing))
  const below = layout.floors.find((floor) => floor.level === level - 1).landing
  const lowerDoor = layout.doors.find((door) => door.rooms.includes(below))
  const ids = [entrances[0].id, lowerDoor.id, entrances[1]?.id].filter(Boolean)
  const clip = await page.evaluate(
    ({ ids, widthToHeight }) => {
      const overlay = document.querySelector('#markers').getBoundingClientRect()
      const [left, lower, right] = ids.map((id) => {
        // Projected coordinates remain available when the lesson hides the marker.
        const marker = document.querySelector(`[data-marker="${id}"]`)
        return { x: parseFloat(marker.style.left), y: parseFloat(marker.style.top) }
      })
      const height = lower.y - left.y
      const span = right ? Math.abs(right.x - left.x) : height * widthToHeight
      return {
        x: Math.round(overlay.left + left.x + span * 0.24),
        y: Math.round(overlay.top + left.y - height * 0.44),
        width: Math.max(8, Math.round(span * 0.52)),
        height: Math.max(6, Math.round(height * 0.31)),
      }
    },
    { ids, widthToHeight: (layout.dimensions.stairHalfWidth * 2) / layout.dimensions.levelHeight },
  )
  return (await imageStats(page, clip)).rgb
}

async function imageStats(page, clip) {
  const image = await page.screenshot({ clip })
  return page.evaluate(async (data) => {
    const buffer = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([buffer], { type: 'image/png' }))
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const total = [0, 0, 0]
    let sum = 0
    let squares = 0
    for (let i = 0; i < rgba.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) total[channel] += rgba[i + channel]
      const luma = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]
      sum += luma
      squares += luma * luma
    }
    const count = rgba.length / 4
    const luma = sum / count
    return {
      rgb: total.map((channel) => channel / count),
      luma,
      contrast: Math.sqrt(Math.max(0, squares / count - luma * luma)),
    }
  }, image.toString('base64'))
}

/** Render selected model times against the GLB served by the tested site. */
export async function verifySmoke(page) {
  const bundle = await build({
    configFile: false,
    base: './',
    logLevel: 'error',
    build: {
      write: false,
      lib: {
        entry: fileURLToPath(new URL('./smoke-render.mjs', import.meta.url)),
        name: 'SmokeTest',
        formats: ['iife'],
      },
    },
  })
  const output = Array.isArray(bundle) ? bundle[0].output : bundle.output
  const entry = output.find((file) => file.type === 'chunk' && file.isEntry)
  assert.ok(entry, 'Could not build the smoke rendering fixture')
  await page.setViewportSize({ width: 1000, height: 760 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const url = new URL(page.url())
  for (const [house, verify] of [
    ['gross', verifyLargeHouse],
    ['klein', verifyDesk],
  ]) {
    url.searchParams.set('haus', house)
    const fixture = await mountFixture(page, url, entry.code)
    try {
      await verify(page, fixture)
      await verifyFire(page, fixture, house)
      const source = house === 'gross' ? 's_kettle' : 's_stove'
      const phase = await fixture.evaluate((f, id) => f.freeFire(id), source)
      assert.equal(phase, 'flashover', `Free experiment at ${source} should reach flashover in ${house}`)
      await rendered(page, `freier-versuch-${house}-flashover`)
      await fixture.evaluate((f) => f.showSurfaceFlamesOnly())
      const surfaces = await flamePixels(page, fixture)
      assert.ok(surfaces.count > 80, `Furnishings should visibly burn through the smoke at ${source} in ${house} (${surfaces.count} pixels)`)
    } finally {
      await fixture.dispose()
    }
  }
}

/** Measure flame emission against a frozen reference with identical smoke and camera. */
async function verifyFire(page, fixture, house) {
  const observations = {}
  for (const phase of ['local', 'rollover', 'flashover']) {
    assert.equal(await fixture.evaluate((f, phase) => f.fireObservation(phase), phase), phase)
    observations[phase] = await flamePixels(page, fixture, observations.local, `flammen-${house}-${phase}`)
  }
  const { local, rollover, flashover } = observations
  console.log(`Visible flame pixels in ${house}:`, observations)
  assert.ok(local.count > 45, 'The source should have a visible local flame')
  assert.ok(rollover.upperRemote > 50, 'Gas flames should be visible above and away from the TV')
  assert.ok(flashover.lowerRemote > rollover.lowerRemote + 80, 'Additional flames should reach furnishings below the TV and away from it')
  if (house === 'klein') await verifyLivingRoomSurfaces(page, fixture)

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  try {
    await verifyGasSequence(page, fixture, local, house)
  } finally {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  }
}

// Read the same camera and volume twice; subtracting chroma removes warm furniture.
async function flamePixels(page, fixture, source, name, regions = {}) {
  await rendered(page, name)
  const flames = await page.screenshot()
  await fixture.evaluate((f) => f.hideFlames())
  await rendered(page)
  const smoke = await page.screenshot()
  return page.evaluate(async ({ images, source, regions }) => {
    const frames = []
    for (const data of images) {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0)
      frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
      bitmap.close()
    }
    const [on, off] = frames
    let count = 0
    let left = on.width
    let right = 0
    let top = on.height
    let bottom = 0
    let upperRemote = 0
    let lowerRemote = 0
    const columns = new Array(Math.ceil(on.width / 16)).fill(0)
    const thickness = new Uint16Array(on.width)
    const boxes = Object.entries(regions)
    const regionPixels = Object.fromEntries(boxes.map(([name]) => [name, 0]))
    for (let i = 0; i < on.data.length; i += 4) {
      const red = on.data[i]
      const blue = on.data[i + 2]
      const addedWarmth = (red - blue) - (off.data[i] - off.data[i + 2])
      if (red - blue < 45 || addedWarmth < 35) continue
      const x = (i / 4) % on.width
      const y = Math.floor(i / 4 / on.width)
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
      if (source && (x < source.left - 10 || x > source.right + 10)) {
        if (y < (source.top + source.bottom) / 2) upperRemote++
        if (y > source.bottom + 10) lowerRemote++
      }
      columns[Math.floor(x / 16)]++
      thickness[x]++
      for (const [name, box] of boxes) {
        if (x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height)
          regionPixels[name]++
      }
      count++
    }
    const litColumns = columns.flatMap((pixels, column) => pixels >= 15 ? [column] : [])
    // Column occupancy measures local luminous thickness even where a tongue bends.
    const sections = thickness.filter((pixels) => pixels > 0).sort()
    const bodyThickness = sections[Math.floor(sections.length * 0.75)] ?? 0
    const thicknessRatio = count ? bodyThickness / (right - left + 1) : 0
    return { count, left, right, top, bottom, upperRemote, lowerRemote, litColumns, regionPixels, thicknessRatio }
  }, { images: [flames.toString('base64'), smoke.toString('base64')], source, regions })
}

async function verifyLivingRoomSurfaces(page, fixture) {
  // These small patches follow the broad leaves left of the TV and the seat
  // cushion on its right. Both sit below the upper gas layer in this view.
  const regions = await jambPatches(page, 'd0', 'd1', {
    plant: ['s_tv', -2.56, 0.02, 0.65, 0.69],
    sofa: ['s_tv', 0.47, -0.12, 0.48, 0.62],
  })
  for (const phase of ['rollover', 'flashover']) {
    await fixture.evaluate((f, phase) => {
      f.fireObservation(phase)
      f.showSurfaceFlamesOnly()
    }, phase)
    const { regionPixels } = await flamePixels(page, fixture, null, undefined, regions)
    for (const [name, pixels] of Object.entries(regionPixels)) {
      if (phase === 'rollover') assert.equal(pixels, 0, `The ${name} should still be unlit at rollover`)
      else assert.ok(pixels > 35, `Expected visible fire on the ${name} at flashover, saw ${pixels} pixels`)
    }
  }
}

async function verifyGasSequence(page, fixture, source, house) {
  const frames = []
  for (let step = 0; step <= 16; step++) {
    const offset = step * 0.34
    await fixture.evaluate((f, offset) => f.gasFrame(offset, false), offset)
    const pixels = await flamePixels(page, fixture, source)
    frames.push({ offset, ...pixels })
  }
  const visible = frames.filter((frame) => frame.count >= 45)
  assert.ok(visible.length >= 3, `Several gas flame observations should be visible in ${house}`)
  // Compare well-developed patches. An emerging tip may occupy just a few pixels.
  const widest = visible.toSorted((a, b) => (b.right - b.left) - (a.right - a.left)).slice(0, 3)
  const ratios = widest.map((frame) => frame.thicknessRatio).sort((a, b) => a - b)
  console.log(`Gas flame thickness / length in ${house}:`, ratios)
  assert.ok(ratios[1] < 0.18, `Expected slender gas tongues in ${house}, measured ${ratios[1]}`)
  assert.ok(frames.some((frame) => !frame.count), `Gas flames should extinguish between bursts in ${house}`)
  // Require a patch to disappear over its whole neighbourhood while a new,
  // separated patch appears. Small contour changes of a fixed flame fail this.
  function hasNewPatch(current, previous) {
    return current.litColumns.some((x) => previous.litColumns.every((old) => Math.abs(old - x) > 1))
  }
  assert.ok(
    visible.some((a, i) => visible.slice(i + 1).some((b) => hasNewPatch(a, b) && hasNewPatch(b, a))),
    `Gas flames should go out locally and reappear elsewhere in ${house}`,
  )
  const brightest = visible.reduce((a, b) => a.count > b.count ? a : b)
  await fixture.evaluate((f, offset) => f.gasFrame(offset, true), brightest.offset)
  const low = await flamePixels(page, fixture, source)
  assert.ok(!low.count || low.bottom <= source.bottom + 10, `Gas flames should stay above the floor in ${house}`)
  console.log(`Verified moving gas flames in ${house} across ${frames.length} frames.`)
}

async function mountFixture(page, url, code) {
  // Replace only the document in this browser. Relative model requests still
  // reach the production preview (or supplied Pages URL) at its original base.
  await page.route(
    url.href,
    (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><link rel="icon" href="./haus.svg">
        <style>
          body { margin: 0; background: #9ee5f5 }
          #viewport, #markers { position: absolute; inset: 0 }
          #markers { visibility: hidden }
        </style>
        <div id="viewport"></div><div id="markers"></div>`,
      }),
    { times: 1 },
  )
  await page.goto(url.href)
  await page.addScriptTag({ content: code })
  return page.evaluateHandle(() => window.SmokeTest.mount())
}

async function verifyLargeHouse(page, fixture) {
  await verifyKettleStairs(page, fixture)
  const colors = []
  for (const open of [false, true]) {
    assert.equal(await fixture.evaluate((f, open) => f.laundry(open), open), true)
    colors.push(await landingColor(page, 0))
    if (evidence) {
      await page.screenshot({
        path: join(evidence, `keller-${open ? 'offen' : 'geschlossen'}.png`),
      })
    }
  }
  const difference = Math.hypot(...colors[1].map((value, i) => value - colors[0][i]))
  assert.ok(
    difference > 9,
    `Laundry door should visibly affect the central ground-floor landing (RGB distance ${difference.toFixed(1)})`,
  )
  console.log(`Rendered laundry comparison (ground-floor RGB distance ${difference.toFixed(1)}).`)
  await verifyDoorway(page, fixture)
}

/** Follow one source from the first diluted smoke to a sustained, smoke-filled stairwell. */
async function verifyKettleStairs(page, fixture) {
  await fixture.evaluate((f) => f.startKettle(true))
  await rendered(page)
  const patches = await jambPatches(page, 'd0l', 'd1', {
    atticWall: ['d3', 0.48, 1.61, 1.45, 0.75],
    atticRail: ['d3', 0.33, 0.1, 1.0, 0.82],
    firstFloor: ['d1', 0.48, 0.94, 1.45, 0.6],
  })
  async function observe(delta, name) {
    const time = await fixture.evaluate((f, seconds) => f.advance(seconds), delta)
    await rendered(page, `wasserkocher-${name}-${time}s`)
    return {
      attic: (await imageStats(page, patches.atticWall)).luma,
      rail: (await imageStats(page, patches.atticRail)).contrast,
      lower: (await imageStats(page, patches.firstFloor)).luma,
    }
  }
  const clear = await observe(0, 'offen')
  const early = await observe(60, 'offen')
  const late = await observe(120, 'offen')
  const prolonged = await observe(120, 'offen')
  await fixture.evaluate((f) => f.startKettle(false))
  const closed = await observe(300, 'geschlossen')
  console.log('Kettle staircase wall luma and railing contrast:', {
    clear,
    early,
    late,
    prolonged,
    closed,
  })
  assert.ok(
    early.attic > early.lower + 20 && early.attic < clear.attic - 5,
    'The first smoke reaching the attic should be visible and lighter than near the fire floor',
  )
  assert.ok(
    late.attic < early.attic - 20 && prolonged.attic < late.attic - 12,
    'Sustained supply should visibly darken the upper landing beyond the first diluted smoke',
  )
  assert.ok(
    prolonged.rail < 0.55 * clear.rail && prolonged.rail < 0.7 * closed.rail,
    'Dense smoke should obscure the attic railing more with the source apartment door open',
  )
}

// Sample the same piece of furniture or opening after changing floor or zoom.
// The two jamb anchors one storey apart give the projected unit scale.
function jambPatches(page, lower, upper, boxes) {
  return page.evaluate(
    ({ lower, upper, boxes }) => {
      const anchor = (id) => document.querySelector(`[data-marker="${id}"]`).style
      const scale = (parseFloat(anchor(lower).top) - parseFloat(anchor(upper).top)) / 2.4
      return Object.fromEntries(
        Object.entries(boxes).map(([name, [id, dx, dy, w, h]]) => {
          const origin = anchor(id)
          return [
            name,
            {
              x: Math.round(parseFloat(origin.left) + dx * scale),
              y: Math.round(parseFloat(origin.top) - dy * scale),
              width: Math.round(w * scale),
              height: Math.round(h * scale),
            },
          ]
        }),
      )
    },
    { lower, upper, boxes },
  )
}

async function verifyDoorway(page, fixture) {
  async function render(seconds, openAt, name) {
    await fixture.evaluate(
      (f, [seconds, openAt]) => f.television(seconds, openAt),
      [seconds, openAt],
    )
    await rendered(page, `tuer-${name}`)
  }
  await render(0, 0, 'klar')
  const patches = await jambPatches(page, 'd0l', 'd1', {
    television: ['i1', 0.65, 0.95, 1.55, 0.9],
    lintel: ['i1', -0.6, 1.13, 0.4, 0.29],
    farCeiling: ['i1', -2.35, 1.16, 0.4, 0.22],
    lowerBedroom: ['i1', -1.5, -0.1, 0.8, 0.36],
  })
  const sample = (name) => imageStats(page, patches[name])
  const clearTV = await sample('television')
  await render(7, 20, 'erste-schicht')
  const earlyTV = await sample('television')
  await render(20, 20, 'vor-uebertritt')
  const before = {}
  for (const name of ['lintel', 'farCeiling', 'lowerBedroom'])
    before[name] = (await sample(name)).luma
  await render(20.6, 20, 'uebertritt')
  const dimming = {}
  for (const name of Object.keys(before)) dimming[name] = before[name] - (await sample(name)).luma
  assert.ok(dimming.lintel > 20, 'Smoke should be visible just inside the open bedroom lintel')
  assert.ok(
    Math.abs(dimming.farCeiling) < 0.2 * dimming.lintel,
    'The current should reach the lintel before the far wall',
  )
  assert.ok(Math.abs(dimming.lowerBedroom) < 5, 'The lower bedroom should initially remain clear')
  await render(40, 20, 'nachbarraum')
  assert.ok(
    before.farCeiling - (await sample('farCeiling')).luma > 35,
    'The ceiling current should reach the far side of the bedroom',
  )
  await render(56, 60, 'dicht')
  const denseTV = await sample('television')
  assert.ok(
    denseTV.luma < 0.5 * earlyTV.luma,
    'Developed smoke should look darker than early smoke',
  )
  assert.ok(
    denseTV.contrast < 0.28 * clearTV.contrast,
    'Dense smoke should obscure the television and the wall behind it',
  )
  console.log(
    `Bedroom lintel dimmed by ${dimming.lintel.toFixed(1)} luma levels after opening, far ceiling by ${dimming.farCeiling.toFixed(1)}. TV contrast in dense smoke: ${((100 * denseTV.contrast) / clearTV.contrast).toFixed(1)}% of clear.`,
  )
}

/** Follow the desk plume through two rooms, the open stair eye and the pitched attic. */
async function verifyDesk(page, fixture) {
  await page.setViewportSize({ width: 760, height: 900 })
  async function view(floor, name) {
    await fixture.evaluate((f, value) => f.view(value), floor)
    await rendered(page, name && `schreibtisch-${name}`)
  }
  const advance = (seconds) => fixture.evaluate((f, dt) => f.advance(dt), seconds)
  await fixture.evaluate((f) => f.startDesk(true))
  await view(2)
  const rooms = await jambPatches(page, 'd2', 'd3', {
    desk: ['d2', -1.85, 0.58, 0.88, 0.6],
    bed: ['i2', -1.67, 0.42, 0.55, 0.5],
    lowerLanding: ['d2', 0.25, 0.88, 0.4, 0.37],
    atticLanding: ['d3', 1.45, 0.43, 0.45, 0.45],
  })
  const clearDesk = (await imageStats(page, rooms.desk)).luma
  const clearBed = (await imageStats(page, rooms.bed)).luma
  const clearLowerLanding = (await imageStats(page, rooms.lowerLanding)).luma
  const clearAtticLanding = (await imageStats(page, rooms.atticLanding)).luma
  const deskLuma = {}
  let upperDimmingAt25 = 0
  let elapsed = 0
  for (const second of [7, 25, 45, 90]) {
    elapsed = await advance(second - elapsed)
    assert.equal(elapsed, second)
    await view(null, `${second}s-uebersicht`)
    await view(2, `${second}s-detail`)
    deskLuma[second] = (await imageStats(page, rooms.desk)).luma
    if (second === 25) {
      const lowerDimming = clearLowerLanding - (await imageStats(page, rooms.lowerLanding)).luma
      upperDimmingAt25 = clearAtticLanding - (await imageStats(page, rooms.atticLanding)).luma
      assert.ok(
        lowerDimming > upperDimmingAt25 + 25,
        'Smoke should first gather on the landing by the playroom',
      )
    }
    if (second === 45) {
      const upperDimming = clearAtticLanding - (await imageStats(page, rooms.atticLanding)).luma
      assert.ok(
        upperDimming > upperDimmingAt25 + 20,
        'The smoke rising through the stair eye should subsequently obscure the attic landing',
      )
      const bed = (await imageStats(page, rooms.bed)).luma
      assert.ok(
        clearBed - bed > 25,
        `Smoke should visibly obscure the neighbouring bed by 45 s (${clearBed.toFixed(1)} → ${bed.toFixed(1)})`,
      )
    }
  }
  assert.ok(
    deskLuma[7] > 0.8 * clearDesk,
    'The desk should initially remain visible below the layer',
  )
  assert.ok(
    deskLuma[45] < 0.65 * deskLuma[7],
    `The descending layer should obscure the desk by 45 s (${deskLuma[7].toFixed(1)} → ${deskLuma[45].toFixed(1)})`,
  )
  assert.ok(
    deskLuma[90] < 0.65 * clearDesk,
    'The sustained source should keep the desk obscured at 90 s',
  )
  await view(3, 'dach-offen-90s')
  const attic = await jambPatches(page, 'd2', 'd3', {
    shelf: ['d3', -4.35, 1.25, 1.1, 0.6],
    lintel: ['d3', -0.45, 1.13, 0.28, 0.35],
    upperPlume: ['d3', -0.82, 1.95, 0.35, 0.24],
    roof: ['d3', -1.85, 2.45, 0.65, 0.3],
  })
  const luma = async (id) => (await imageStats(page, attic[id])).luma
  const openShelf = await luma('shelf')
  await fixture.evaluate((f) => f.startDesk(false))
  await advance(60)
  await advance(30)
  await rendered(page, 'schreibtisch-dach-geschlossen-90s')
  const closedShelf = await luma('shelf')
  assert.ok(
    closedShelf - openShelf > 25,
    `The open attic door should obscure more of the bookcase by 90 s (${closedShelf.toFixed(1)} → ${openShelf.toFixed(1)})`,
  )

  // First compare identical door-leaf geometry without any new flow. This keeps
  // the swinging leaf and its shadow out of the measured change at the lintel.
  await fixture.evaluate((f) => f.startDesk(false))
  await advance(60)
  await rendered(page, 'schreibtisch-dach-vor-oeffnen')
  await fixture.evaluate((f) => f.setAtticDoor(true))
  await rendered(page, 'schreibtisch-dach-geoeffnet')
  const lintelBefore = await luma('lintel')
  const upperBefore = await luma('upperPlume')
  const roofBefore = await luma('roof')
  const shelfBefore = await luma('shelf')
  await advance(0.2)
  await rendered(page, 'schreibtisch-dach-nach-0-2s')
  const earlyUpperChange = Math.abs(upperBefore - (await luma('upperPlume')))
  await advance(0.4)
  await rendered(page, 'schreibtisch-dach-nach-0-6s')
  const lintelDimming = lintelBefore - (await luma('lintel'))
  const shelfChange = Math.abs(shelfBefore - (await luma('shelf')))
  await advance(3.4)
  await rendered(page, 'schreibtisch-dach-nach-4s')
  const lateUpperDimming = upperBefore - (await luma('upperPlume'))
  const roofDimming = roofBefore - (await luma('roof'))
  console.log(
    `Desk render: furniture luma ${JSON.stringify(deskLuma)}, attic lintel dimming ${lintelDimming.toFixed(1)}, early bookcase change ${shelfChange.toFixed(1)}, upper plume change at 0.2/4 seconds ${earlyUpperChange.toFixed(1)}/${lateUpperDimming.toFixed(1)}, subsequent roof dimming ${roofDimming.toFixed(1)}.`,
  )
  assert.ok(lintelDimming > 9, 'The first incoming smoke should be visible under the attic lintel')
  assert.ok(
    shelfChange < 5,
    'Smoke should reach the opening before it obscures distant low furniture',
  )
  assert.ok(
    lateUpperDimming > 12 && earlyUpperChange < 0.25 * lateUpperDimming,
    'Opening the attic door should start a rising plume before it reaches the upper wall',
  )
  assert.ok(roofDimming > 9, 'The incoming current should reach the pitched ceiling')
  await verifyDescendingStairs(page, fixture)
}

/** Compare the two landings below the source with the attic and lower apartments closed. */
async function verifyDescendingStairs(page, fixture) {
  await fixture.evaluate((f) => {
    f.startDesk(false)
    f.view(1)
  })
  await rendered(page)
  const patches = await jambPatches(page, 'd0', 'd1', {
    firstEye: ['d1', 1.56, 1.15, 0.52, 0.25],
    firstSteps: ['d1', 1.56, -0.15, 0.52, 0.35],
    groundEye: ['d0', 1.56, 1.15, 0.52, 0.25],
    living: ['d1', -2.5, 1.15, 0.65, 0.25],
  })
  async function sample() {
    const result = {}
    for (const [name, clip] of Object.entries(patches)) {
      result[name] = (await imageStats(page, clip)).luma
    }
    return result
  }
  const clear = await sample()
  async function dimming(seconds, name) {
    const elapsed = await fixture.evaluate((f, dt) => f.advance(dt), seconds)
    await rendered(page, `treppenraum-${name}-${elapsed}s`)
    const current = await sample()
    return Object.fromEntries(Object.keys(clear).map((id) => [id, clear[id] - current[id]]))
  }
  const earlyTime = 45
  const firstTime = 75
  const groundTime = 120
  const early = await dimming(earlyTime, 'frueh')
  const first = await dimming(firstTime - earlyTime, 'erster-stock')
  const ground = await dimming(groundTime - firstTime, 'erdgeschoss')
  await fixture.evaluate((f) => f.startDesk(false, false))
  const closed = await dimming(groundTime, 'wohnungstuer-geschlossen')
  console.log('Smoke dimming below the desk fire:', { early, first, ground, closed })
  assert.ok(
    Math.abs(early.firstEye) < 5 && Math.abs(early.groundEye) < 5,
    'Both landings below the desk should initially stay clear',
  )
  assert.ok(
    first.firstEye > 15 && first.firstEye > first.firstSteps + 10 && Math.abs(first.groundEye) < 5,
    'Smoke should enter under the first-floor stair eye before reaching the steps or ground floor',
  )
  assert.ok(
    ground.groundEye > 15 && ground.firstEye > ground.living + 20,
    'Smoke should reach the ground-floor landing while the closed first-floor apartment stays clearer',
  )
  assert.ok(
    ground.firstEye > closed.firstEye + 15 && ground.groundEye > closed.groundEye + 10,
    'Closing the source apartment should reduce visible smoke on both lower landings',
  )
}
