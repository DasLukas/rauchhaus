// Exercise the learning pages with the same isolated Chrome session as the house suite.
import assert from 'node:assert/strict'

async function renderedDifference(page, first, second) {
  const images = [first, second].map((buffer) => `data:image/png;base64,${buffer.toString('base64')}`)
  return page.evaluate(async (urls) => {
    const pixels = await Promise.all(urls.map(async (url) => {
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = 120
      canvas.height = 96
      const ctx = canvas.getContext('2d')
      // Compare only the scene, independent of the browser's keyboard focus outline.
      const inset = 6
      ctx.drawImage(image, inset, inset, image.width - 2 * inset, image.height - 2 * inset,
        0, 0, canvas.width, canvas.height)
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data
    }))
    let changed = 0
    for (let i = 0; i < pixels[0].length; i += 4) {
      const delta = [0, 1, 2].reduce((sum, ch) => sum + Math.abs(pixels[0][i + ch] - pixels[1][i + ch]), 0)
      if (delta > 35) changed++
    }
    return changed
  }, images)
}

/** The whole trial must stay usable without a scroll or overlapping its navigation. */
async function verifyGuideFits(page) {
  const fits = await page.evaluate(() => {
    const bounds = (selector) => document.querySelector(selector).getBoundingClientRect()
    const header = bounds('.triangle-topbar')
    const strip = bounds('#triangle-study')
    const footer = bounds('.toolbar')
    const inside = (r) => r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1
    const scene = ['.triangle-control', '.triangle-knob', '.stove-canvas'].map(bounds)
    return scrollY === 0 && document.documentElement.scrollHeight <= innerHeight + 1
      && document.documentElement.scrollWidth <= innerWidth + 1
      && [header, strip, footer, bounds('#triangle-next'), bounds('#triangle-end')].every(inside)
      && strip.bottom <= footer.top && scene.every((r) => inside(r) && r.top >= header.bottom && r.bottom <= strip.top)
  })
  assert.ok(fits, 'The scene, current instruction and controls must fit in one viewport')
}

export async function verifyLearningModules(page, dashboardUrl, capture) {
  const modules = new Set()
  const record = (request) => {
    if (request.url().endsWith('.glb')) modules.add(new URL(request.url()).pathname.split('/').pop())
  }
  page.on('request', record)
  const button = (name) => page.getByRole('button', { name, exact: true })
  await page.setViewportSize({ width: 1448, height: 1086 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(dashboardUrl)
  const triangleLink = page.getByRole('link', { name: 'Verbrennungsdreieck', exact: true })
  await triangleLink.waitFor()
  assert.equal(await page.locator('.lesson-card').count(), 2)
  await page.locator('.lesson-preview').evaluateAll(async (images) => {
    await Promise.all(images.map((image) => image.decode()))
  })
  assert.equal(await page.locator('canvas').count(), 0)
  assert.deepEqual([...modules], [])
  await capture('dashboard-desktop')
  await triangleLink.click()
  const readyStove = page.locator('.stove-window:has(.stove-load[hidden]) canvas')
  await readyStove.waitFor()
  assert.equal(await page.getByRole('heading', { name: 'Verbrennungsdreieck', exact: true }).count(), 1)
  assert.equal(await page.locator('.stove-camera, #triangle-hint').count(), 0)
  assert.match(await page.title(), /Verbrennungsdreieck/)
  assert.deepEqual([...modules], ['holzofen.glb'])
  await page.goBack()
  await triangleLink.waitFor()
  await page.goForward()
  await readyStove.waitFor()
  const instrument = page.locator('.triangle-instrument')
  const knob = page.locator('.triangle-knob')
  const stove = page.locator('.stove-canvas')
  const scene = async () => {
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
    return stove.screenshot()
  }
  // Compare a playing Blender clip with the same camera before enabling reduced motion.
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const moving = await scene()
  await page.waitForTimeout(250)
  assert.ok(await renderedDifference(page, moving, await scene()) > 10, 'The exported flame animation should change shape over time')
  assert.equal(await button('Pause').count(), 0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const centre = await scene()
  await capture('verbrennungsdreieck-desktop')
  await stove.press('ArrowRight')
  assert.ok(await renderedDifference(page, centre, await scene()) > 150, 'Camera orbit must change the rendered stove')
  await stove.press('Home')
  const restoredDifference = await renderedDifference(page, centre, await scene())
  assert.ok(restoredDifference < 5, `Home should restore the initial three-quarter view (${restoredDifference} changed pixels)`)

  const box = await stove.boundingBox()
  const x = box.x + box.width * .4
  const y = box.y + box.height * .5
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 110, y, { steps: 5 })
  await page.mouse.up()
  assert.ok(await renderedDifference(page, centre, await scene()) > 150, 'Dragging the stove must orbit the camera')
  await capture('ofen-geschwenkt')
  await stove.press('Home')
  for (let i = 0; i < 5; i++) await knob.press('ArrowUp')
  assert.equal(await instrument.getAttribute('data-fire-state'), 'weak')
  await knob.press('Home')
  assert.equal(await instrument.getAttribute('data-fire-state'), 'steady')

  const board = await page.locator('.triangle-board').boundingBox()
  const tip = { x: board.x + board.width / 2, y: board.y + board.height * .045 }
  await page.mouse.click(board.x + board.width * .875, board.y + board.height * .93)
  assert.equal(await instrument.getAttribute('data-fire-state'), 'out')
  const cooled = await scene()
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tip] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } finally {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await cdp.detach()
  }
  assert.equal(await instrument.getAttribute('data-fire-state'), 'out')
  const spent = await scene()
  assert.ok(await renderedDifference(page, cooled, spent) > 100,
    'The unlit log should look different when fuel is spent than when it is just cold')
  await capture('ofen-verkohlt')
  await stove.press('ArrowLeft')
  const beforeLesson = await scene()
  const originalPosition = await knob.getAttribute('style')

  const study = page.locator('#triangle-study')
  const next = page.locator('#triangle-next')
  await button('Lernimpuls').click()
  await button('Lernimpuls beenden').click()
  assert.equal(await knob.getAttribute('style'), originalPosition)
  await button('Lernimpuls').click()
  for (const factor of ['oxygen', 'heat', 'fuel']) {
    assert.equal(await study.getAttribute('data-factor'), factor)
    assert.equal(await study.getAttribute('data-phase'), 'explore')
    assert.equal(await next.textContent(), 'Zeigen')
    const trail = page.locator('#triangle-study-guide')
    // A vertical SVG path has zero bounding-box width even when its stroke is visible.
    assert.ok(await trail.evaluate((path) => getComputedStyle(path).display !== 'none' && path.getTotalLength() > 0))
    await verifyGuideFits(page)
    if (factor === 'oxygen') {
      const target = await trail.evaluate((path) => {
        const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM())
        return { x: end.x, y: end.y }
      })
      const grip = await knob.boundingBox()
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
      await page.mouse.down()
      await page.mouse.move(target.x, target.y, { steps: 12 })
      await page.mouse.up()
    } else if (factor === 'heat') {
      for (let i = 0; i < 16 && await knob.isEnabled(); i++) await knob.press('Shift+ArrowRight')
    } else {
      await capture('lernimpuls-brennstoff')
      await next.click()
    }
    assert.equal(await study.getAttribute('data-phase'), 'observe')
    assert.ok(await trail.evaluate((path) => getComputedStyle(path).display === 'none'))
    assert.equal(await instrument.getAttribute('data-fire-state'), factor === 'oxygen' ? 'weak' : 'out')
    assert.equal(await next.textContent(), factor === 'fuel' ? 'Fertig' : 'Weiter')
    await verifyGuideFits(page)
    await next.click()
  }
  assert.equal(await study.isHidden(), true)
  assert.equal(await knob.getAttribute('style'), originalPosition)
  assert.ok(await renderedDifference(page, beforeLesson, await scene()) < 5, 'Leaving the lesson must restore the charred log and camera angle')
  await button('Neu starten').click()
  await button('Hilfe').click()
  await page.getByText('Für Erwachsene', { exact: true }).click()
  await page.keyboard.press('Escape')
  for (const [width, height] of [[1024, 768], [820, 1180], [390, 844]]) {
    await page.setViewportSize({ width, height })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    const labels = page.locator('.triangle-label')
    assert.equal(await labels.count(), 3)
    assert.ok(await labels.evaluateAll((items) => items.every((label) => {
      const icon = label.querySelector('svg').getBoundingClientRect()
      const name = label.querySelector('span').getBoundingClientRect()
      return icon.height >= 24 && icon.bottom <= name.top + 1
    })), 'Each factor should have a large pictogram above its name')
    await capture(`verbrennungsdreieck-${width}`)
    const initialStove = await stove.boundingBox()
    const detail = page.locator('.observation-copy:visible > span')
    const initialDetail = await detail.boundingBox()
    const pad = await page.locator('.triangle-board').boundingBox()
    await page.mouse.click(pad.x + pad.width * .875, pad.y + pad.height * .93)
    assert.equal(await instrument.getAttribute('data-fire-state'), 'out')
    assert.deepEqual(await stove.boundingBox(), initialStove, 'Wrapping the observation must keep the stove stationary')
    if (width === 1024) {
      assert.ok((await detail.boundingBox()).height > initialDetail.height, 'Exercise a caption that wraps to a second line')
      await capture('verbrennungsdreieck-1024-abgekuehlt')
    }
    await button('Lernimpuls').click()
    const guidedStove = await stove.boundingBox()
    for (let stage = 0; stage < 6; stage++) {
      await verifyGuideFits(page)
      assert.deepEqual(await stove.boundingBox(), guidedStove, 'Changing the guide text must keep the stove stationary')
      if (width === 1024 && stage === 4) await capture('lernimpuls-brennstoff-1024')
      await next.click()
    }
    assert.ok(await study.isHidden())
    await page.getByRole('link', { name: 'Zur Übersicht' }).click()
    await triangleLink.waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await capture(`dashboard-${width}`)
    await triangleLink.click()
    await readyStove.waitFor()
  }
  await page.getByRole('link', { name: 'Zur Übersicht' }).click()
  await triangleLink.waitFor()
  page.off('request', record)
  console.log('Verified the dashboard, stove orbit and visible fire changes, guided comparisons, touch, keyboard, mobile and tablet views.')
}
