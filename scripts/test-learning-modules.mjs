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
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
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
  const controls = page.locator('.stove-camera')
  await controls.waitFor()
  assert.match(await page.title(), /Verbrennungsdreieck/)
  assert.deepEqual([...modules], ['holzofen.glb'])
  await page.goBack()
  await triangleLink.waitFor()
  await page.goForward()
  await controls.waitFor()
  const instrument = page.locator('.triangle-instrument')
  const knob = page.locator('.triangle-knob')
  const stove = page.locator('.stove-canvas')
  const scene = async () => {
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
    return stove.screenshot()
  }
  // Compare a playing Blender clip with the same camera before freezing the reference pose.
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const moving = await scene()
  await page.waitForTimeout(250)
  assert.ok(await renderedDifference(page, moving, await scene()) > 10, 'The exported flame animation should change shape over time')
  await button('Pause').click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await stove.press('Home')
  const centre = await scene()
  await capture('verbrennungsdreieck-desktop')
  await stove.press('ArrowRight')
  await button('Ofen von vorne zeigen').waitFor()
  assert.ok(await renderedDifference(page, centre, await scene()) > 150, 'Camera orbit must change the rendered stove')
  await stove.press('Home')
  await button('Ofen von vorne zeigen').waitFor({ state: 'hidden' })
  const restoredDifference = await renderedDifference(page, centre, await scene())
  assert.ok(restoredDifference < 5, `Home should restore the front view (${restoredDifference} changed pixels)`)

  const box = await stove.boundingBox()
  const x = box.x + box.width * .4
  const y = box.y + box.height * .5
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 110, y, { steps: 5 })
  await page.mouse.up()
  await button('Ofen von vorne zeigen').waitFor()
  await capture('ofen-geschwenkt')
  await button('Ofen von vorne zeigen').click()
  for (let i = 0; i < 5; i++) await knob.press('ArrowUp')
  assert.equal(await instrument.getAttribute('data-fire-state'), 'weak')
  await knob.press('Home')
  assert.equal(await instrument.getAttribute('data-fire-state'), 'steady')

  const board = await page.locator('.triangle-board').boundingBox()
  const tip = { x: board.x + board.width / 2, y: board.y + board.height * .045 }
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
  assert.ok(await renderedDifference(page, centre, await scene()) > 100, 'The fuel-depleted specimen must visibly lose wood and flames')
  await button('Ofen nach links schwenken').click()
  const originalPosition = await knob.getAttribute('style')

  const study = page.locator('#triangle-study')
  const next = page.locator('#triangle-next')
  await button('Lernimpuls').click()
  await button('Lernimpuls beenden').click()
  assert.equal(await knob.getAttribute('style'), originalPosition)
  await button('Lernimpuls').click()
  for (const factor of ['oxygen', 'heat', 'fuel']) {
    assert.equal(await study.getAttribute('data-factor'), factor)
    assert.equal(await study.getAttribute('data-phase'), 'predict')
    if (factor === 'oxygen') {
      const picture = page.locator('#triangle-predictions [data-choice]').first()
      await picture.click()
      assert.equal(await picture.getAttribute('aria-pressed'), 'true')
      await capture('lernimpuls-vermutung')
    }
    await next.click()
    assert.equal(await study.getAttribute('data-phase'), 'explore')
    const trail = page.locator('#triangle-study-guide')
    if (factor === 'oxygen') {
      await trail.waitFor()
      const target = await trail.evaluate((path) => {
        const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM())
        return { x: end.x, y: end.y }
      })
      const grip = await knob.boundingBox()
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
      await page.mouse.down()
      await page.mouse.move(target.x, target.y, { steps: 12 })
      await page.mouse.up()
      await page.locator('#triangle-study[data-phase="discuss"]').waitFor()
    } else {
      assert.ok(await trail.isHidden())
      await button('Beobachtung zeigen').click()
    }
    assert.equal(await instrument.getAttribute('data-fire-state'), factor === 'oxygen' ? 'weak' : 'out')
    if (factor === 'oxygen') {
      await next.click()
      await button('Beobachtung zeigen').click()
      assert.equal(await instrument.getAttribute('data-fire-state'), 'out')
    }
    await next.click()
  }
  assert.equal(await study.getAttribute('data-phase'), 'transfer')
  await next.click()
  await button('Weiter entdecken').click()
  assert.equal(await study.isHidden(), true)
  assert.equal(await knob.getAttribute('style'), originalPosition)
  assert.equal(await button('Weiter').isVisible(), true)
  assert.equal(await button('Ofen von vorne zeigen').isVisible(), true)
  await button('Neu starten').click()
  await button('Hilfe').click()
  await page.getByText('Für Erwachsene', { exact: true }).click()
  await page.keyboard.press('Escape')
  for (const [width, height] of [[820, 1180], [390, 844]]) {
    await page.setViewportSize({ width, height })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await capture(`verbrennungsdreieck-${width}`)
    await page.getByRole('link', { name: 'Zur Übersicht' }).click()
    await triangleLink.waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await capture(`dashboard-${width}`)
    await triangleLink.click()
    await controls.waitFor()
  }
  await page.getByRole('link', { name: 'Zur Übersicht' }).click()
  await triangleLink.waitFor()
  page.off('request', record)
  console.log('Verified the dashboard, stove orbit and visible fire changes, guided comparisons, touch, keyboard, mobile and tablet views.')
}
