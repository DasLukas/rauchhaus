// Run against the production bundle or a supplied Pages URL using a fresh Chrome profile.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import largeHouse from '../src/simulation/layout.json' with { type: 'json' }
import smallHouse from '../src/simulation/layout-small.json' with { type: 'json' }

import { verifyFullscreenPinch, verifyLegacyIpadTab } from './test-fullscreen-pinch.mjs'
import { verifyLearningModules } from './test-learning-modules.mjs'
import { checkTapTargets, verifySafetyTips } from './test-safety-tips.mjs'
import { landingColor, verifySmoke, verifySmokeStart } from './test-smoke-rendering.mjs'

const evidence = process.env.RAUCHHAUS_SCREENSHOTS
const targetUrl = process.env.RAUCHHAUS_TEST_URL
const profile = await mkdtemp(join(tmpdir(), 'rauchhaus-chrome-'))
let server
let context

try {
  if (evidence) await mkdir(evidence, { recursive: true })
  if (!targetUrl) server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } })
  const port = server?.httpServer.address()?.port
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    chromiumSandbox: true,
    headless: true,
    // Exercise native fullscreen before emulating the classroom display sizes.
    viewport: null,
    ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
  })
  const page = context.pages()[0] ?? (await context.newPage())
  page.setDefaultTimeout(16000)
  const errors = []
  const modelRequests = new Set()
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (path.endsWith('.glb')) modelRequests.add(path.split('/').at(-1))
  })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error(msg.text())
    if (msg.type() === 'error' || /shader error|VALIDATE_STATUS|GL_INVALID/i.test(msg.text()))
      errors.push(msg.text())
  })
  await page.addInitScript(() => {
    window.alarmPulses = []
    const start = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (...args) {
      window.alarmPulses.push({
        time: this.context.currentTime,
        frequency: this.frequency.value,
        lights: document.querySelectorAll('#markers.pulse .detector.active').length,
      })
      return start.apply(this, args)
    }
  })
  const dashboardUrl = targetUrl || `http://127.0.0.1:${port}/`
  await page.goto(dashboardUrl)
  const houseCard = page.getByRole('link', { name: /^Brandhaus\b/ })
  await houseCard.waitFor()
  assert.match(await page.title(), /Brandschutzfrüherziehung/)
  assert.equal(modelRequests.size, 0, 'The dashboard must not load a house model')
  await houseCard.click()
  await page.getByRole('heading', { name: 'Brandhaus', exact: true }).waitFor()
  assert.match(await page.title(), /Brandhaus/)
  const marker = (id) => page.locator(`[data-marker="${id}"]`)
  const btn = (name) => page.getByRole('button', { name, exact: true })
  const capture = async (name) => {
    if (evidence) await page.screenshot({ path: join(evidence, `${name}.png`) })
  }
  async function checkLesson(layout, prefix) {
    await btn('Lernimpuls').click()
    await btn('Wie breitet sich Feuer aus?').waitFor()
    await btn('Wohin zieht der Rauch?').click()
    await btn('Versuch starten').click()
    await page.getByText('1 von 2 · Tür offen').waitFor()
    assert.equal(await page.locator('.marker.info[hidden]').count(), 4)
    await btn('Ergebnis ansehen').click()
    await btn('Mit geschlossener Tür testen').waitFor()
    const openLanding = await landingColor(page, 2, layout)
    await capture(`${prefix}-offen`)
    await btn('Mit geschlossener Tür testen').click()
    await page.getByText('2 von 2 · Tür geschlossen').waitFor()
    await btn('Ergebnis ansehen').click()
    await btn('Versuch besprechen').waitFor()
    const closedLanding = await landingColor(page, 2, layout)
    await capture(`${prefix}-geschlossen`)
    const colorDifference = Math.hypot(...openLanding.map((v, i) => v - closedLanding[i]))
    assert.ok(
      colorDifference > 9,
      `Upper landing should visibly change between trials (RGB distance ${colorDifference.toFixed(1)})`,
    )
    console.log('Passed the rendered television door comparison.')
    await btn('Versuch besprechen').click()
    await page.getByRole('heading', { name: 'Wann war mehr Rauch im Treppenhaus?' }).waitFor()
    assert.equal(await page.locator('.marker.info:visible').count(), 0)
    assert.equal(await btn('Weiter entdecken').count(), 0)
    const safetyHeading = page.getByRole('heading', { name: 'Wenn es im Mehrfamilienhaus brennt' })
    assert.equal(await safetyHeading.count(), 0)
    await btn('Ergebnis ansehen').click()
    await page.getByText('Eine geschlossene Tür bremst den Rauch.', { exact: true }).waitFor()
    await safetyHeading.waitFor()
    const findings = page.getByRole('dialog')
    const freeRoute = findings.locator('p').filter({ hasText: 'Es brennt in deiner Wohnung und der Weg nach draußen ist frei.' })
    const blockedRoute = findings.locator('p').filter({ hasText: 'Rauch oder Feuer versperrt dir den Weg.' })
    assert.match(await freeRoute.textContent(), /rauchfreien Weg.*Bleib draußen.*112/s)
    assert.match(await blockedRoute.textContent(), /Geh nicht durch Rauch.*Wohnungstür zu.*zieh sie wieder zu/s)
    const shelter = findings.locator('p').filter({ hasText: 'Bleib in einem rauchfreien Zimmer' })
    assert.match(await shelter.textContent(), /Tür zwischen dir und dem Rauch.*112.*Fenster/s)
    await capture(`${prefix}-verhalten`)
    await btn('Weiter entdecken').click()
    await page.locator('#app:not(.learning)').waitFor()
    await page.locator('.marker.info:visible').nth(3).waitFor()
  }

  async function checkFireLesson(house) {
    assert.equal(await btn('Pause').isDisabled(), true)
    assert.match(await marker('s_tv').getAttribute('aria-label'), /Versuch starten$/)
    await marker('s_tv').click()
    await btn('Pause').click()
    await btn('Lernimpuls').click()
    await btn('Wie breitet sich Feuer aus?').click()
    const autoplay = house === 'klein'
    const originalViewport = page.viewportSize()
    if (autoplay) {
      // Keep real-time flame playback affordable on software-rendered CI workers.
      await page.setViewportSize({ width: 480, height: 360 })
      await page.emulateMedia({ reducedMotion: 'no-preference' })
    }
    await btn('Feuerversuch starten').click()
    await page.getByText('1 von 2 · Unter der Decke', { exact: true }).waitFor()
    assert.equal(await page.locator('#markers button:visible').count(), 0)
    if (!autoplay) await btn('Beobachtung zeigen').click()
    await btn('Weiter beobachten').waitFor({ timeout: 90000 })
    await capture(`feuer-${house}-rauchdurchzuendung`)
    await btn('Weiter beobachten').click()
    if (!autoplay) await btn('Beobachtung zeigen').click()
    await btn('Versuch besprechen').waitFor({ timeout: 90000 })
    if (autoplay) await page.setViewportSize(originalViewport)
    await capture(`feuer-${house}-raumdurchzuendung`)
    await btn('Versuch besprechen').click()
    await page.getByRole('heading', { name: 'Was hast du an den Möbeln entdeckt?' }).waitFor()
    assert.equal(await page.locator('.marker.info:visible').count(), 0)
    assert.equal(await btn('Weiter entdecken').count(), 0)
    assert.equal(await page.getByText('Rollover', { exact: true }).count(), 0)
    await btn('Ergebnis ansehen').click()
    await page.getByRole('heading', { name: 'Wie nennt das die Feuerwehr?' }).waitFor()
    await page.getByText('Rollover', { exact: true }).waitFor()
    await page.getByText('Flashover', { exact: true }).waitFor()
    await btn('Weiter entdecken').click()
    await page.locator('#app:not(.learning)').waitFor()
    assert.equal(await btn('Pause').isDisabled(), true)
    assert.equal(await marker('s_tv').getAttribute('aria-pressed'), 'false')
    await page.locator('.marker.info:visible').nth(3).waitFor()
    if (autoplay) await page.emulateMedia({ reducedMotion: 'reduce' })
  }

  await marker('entry').waitFor()
  await verifyLegacyIpadTab(context, page.url())
  assert.equal(await btn('Einstellungen').count(), 0)
  const enterFullscreen = btn('Vollbild starten')
  const leaveFullscreen = btn('Vollbild beenden')
  await page.bringToFront()
  await enterFullscreen.click()
  await leaveFullscreen.waitFor()
  assert.ok(await page.evaluate(() => document.fullscreenElement === document.documentElement))
  await verifyFullscreenPinch(page)
  await leaveFullscreen.click()
  await enterFullscreen.waitFor()
  assert.ok(await page.evaluate(() => document.fullscreenElement === null))
  await enterFullscreen.press('Enter')
  await leaveFullscreen.waitFor()
  await page.evaluate(() => document.exitFullscreen())
  await enterFullscreen.waitFor()
  await page.setViewportSize({ width: 1448, height: 1086 })
  assert.deepEqual([...modelRequests], ['rauchhaus-klein.glb'])
  assert.equal(await page.locator('.house-picker [aria-current]').getAttribute('aria-label'), 'Kleines Haus')
  assert.equal(await page.locator('.detector:visible').count(), smallHouse.detectors.length)
  assert.equal(await btn('Alarmton').getAttribute('aria-pressed'), 'false')
  await capture('haus-klein')
  await verifySafetyTips(page, 'klein', smallHouse, capture)
  await verifySmokeStart(page, 'klein')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await marker('entry').click()
  const glass = await page.evaluate(async () => {
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    const anchor = (id) => document.querySelector(`[data-marker="${id}"]`).style
    const storey = parseFloat(anchor('d0').top) - parseFloat(anchor('d1').top)
    const stage = document.querySelector('#markers').getBoundingClientRect()
    // A point on the open leaf, beyond the HTML control at its hinge.
    const x = stage.x + parseFloat(anchor('entry').left) + storey * 0.3
    const y = stage.y + parseFloat(anchor('entry').top)
    return { x, y, target: document.elementFromPoint(x, y)?.tagName }
  })
  assert.equal(glass.target, 'CANVAS')
  await page.mouse.click(glass.x, glass.y)
  assert.equal(await marker('entry').getAttribute('aria-pressed'), 'false')
  await marker('entry').click()
  assert.equal(await marker('entry').getAttribute('aria-pressed'), 'true')
  await checkLesson(smallHouse, 'vergleich-klein')
  assert.equal(await marker('entry').getAttribute('aria-pressed'), 'false')
  await checkFireLesson('klein')
  await page.setViewportSize({ width: 820, height: 1180 })
  await capture('haus-klein-hochformat')
  await page.getByRole('link', { name: 'Großes Haus' }).click()
  await marker('s_washer').waitFor()
  assert.equal(modelRequests.has('rauchhaus.glb'), true)
  assert.equal(new URL(page.url()).searchParams.has('feuer'), false)
  await page.setViewportSize({ width: 1448, height: 1086 })
  assert.equal(await page.locator('.house-picker [aria-current]').getAttribute('aria-label'), 'Großes Haus')
  assert.equal(await btn('Pause').isDisabled(), true)
  await capture('haus')
  await verifySafetyTips(page, 'gross', largeHouse, capture)
  await verifySmokeStart(page, 'gross')
  // Detector and audio timing use real playback, just like the fire lesson.
  await page.setViewportSize({ width: 480, height: 440 })
  await marker('s_tv').click()
  await page.locator('[data-marker="m_living"].active').waitFor({ timeout: 60000 })
  await page.locator('[data-marker="m_bed"].active').waitFor({ timeout: 60000 })
  assert.equal(await page.evaluate(() => window.alarmPulses.length), 0)
  await btn('Alarmton').click()
  assert.equal(await btn('Alarmton').getAttribute('aria-pressed'), 'true')
  await page.waitForFunction(() => window.alarmPulses.length >= 3)
  const pulses = await page.evaluate(() => window.alarmPulses)
  assert.ok(pulses.every((pulse) => pulse.lights >= 2 && pulse.frequency === 2900))
  assert.ok(pulses.slice(1).every((pulse, i) => pulse.time - pulses[i].time > 0.5))
  await btn('Alarmton').click()
  const mutedCount = await page.evaluate(() => window.alarmPulses.length)
  await page.locator('#markers:not(.pulse)').waitFor()
  await page.locator('#markers.pulse').waitFor()
  assert.equal(await page.evaluate(() => window.alarmPulses.length), mutedCount)
  await btn('Pause').click()
  assert.equal(await marker('s_tv').getAttribute('aria-pressed'), 'true')
  assert.equal(await marker('d1').getAttribute('aria-pressed'), 'false')
  await page.setViewportSize({ width: 1448, height: 1086 })
  await capture('rauch')
  const doorBox = await marker('d1').boundingBox()
  assert.ok(doorBox)
  const x = doorBox.x + doorBox.width / 2
  const y = doorBox.y + doorBox.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 12, y, { steps: 3 })
  await page.mouse.up()
  assert.equal(await marker('d1').getAttribute('aria-pressed'), 'false')
  await marker('d1').click()
  assert.equal(await marker('d1').getAttribute('aria-pressed'), 'true')
  await btn('Neu starten').click()
  assert.equal(await btn('Pause').isDisabled(), true)
  assert.equal(await page.locator('.marker.active.source,.marker.active.detector').count(), 0)
  assert.equal(await marker('d1').getAttribute('aria-pressed'), 'false')
  await btn('Hilfe').click()
  await page.getByRole('heading', { name: 'So geht’s' }).waitFor()
  await page.keyboard.press('Escape')
  await checkLesson(largeHouse, 'vergleich')
  assert.equal(await marker('d1').getAttribute('aria-pressed'), 'false')
  await checkFireLesson('gross')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const bookmark = new URL(dashboardUrl)
  bookmark.search = '?haus=gross&feuer=0'
  await page.goto(bookmark.href)
  await marker('s_washer').waitFor()
  const canonical = new URL(page.url())
  assert.equal(canonical.searchParams.get('modul'), 'brandhaus')
  assert.equal(canonical.searchParams.get('haus'), 'gross')
  assert.equal(canonical.searchParams.has('feuer'), false)
  assert.match(await marker('s_washer').getAttribute('aria-label'), /Versuch starten$/)
  await btn('Lernimpuls').click()
  await btn('Wie breitet sich Feuer aus?').waitFor()
  await page.keyboard.press('Escape')
  await btn('Vergrößern').click()
  await btn('Ganzes Haus zeigen').click()
  const house = page.locator('#viewport canvas')
  await house.press('0')
  await marker('s_tv').waitFor({ state: 'hidden' })
  assert.equal(await marker('s_washer').isVisible(), true)
  await capture('keller-detail')
  await house.press('4')
  await marker('s_attic').waitFor()
  assert.equal(await marker('s_washer').isVisible(), false)
  await house.press('Home')
  await marker('s_washer').waitFor()
  for (const [width, height] of [
    [1180, 820],
    [820, 1180],
    [644, 766],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    )
    await checkTapTargets(page)
    await capture(`ansicht-${width}`)
    await house.press('0')
    await marker('dbl').waitFor()
    await checkTapTargets(page)
    // Exercise an opposing pair with real pointer clicks in each orientation.
    for (const id of ['dbl', 'dbr']) {
      const door = marker(id)
      const before = await door.getAttribute('aria-pressed')
      await door.click()
      assert.notEqual(await door.getAttribute('aria-pressed'), before)
    }
    await house.press('Home')
    await marker('dbl').waitFor({ state: 'hidden' })
    console.log(`Verified independent door controls at ${width} × ${height}.`)
  }
  await marker('s_washer').click()
  assert.equal(await marker('s_washer').getAttribute('aria-pressed'), 'true')
  await page.locator('[data-marker="m_laundry"].active').waitFor({ timeout: 60000 })
  await btn('Pause').click()
  await btn('Lernimpuls').click()
  await btn('Wie breitet sich Feuer aus?').click()
  await btn('Feuerversuch starten').click()
  await btn('Beobachtung zeigen').click()
  await btn('Weiter beobachten').waitFor()
  await capture('feuer-mobil-lernimpuls')
  await btn('Lernimpuls beenden').click()
  assert.equal(await page.locator('#trial').isVisible(), false)
  await marker('info_cellar').waitFor()
  assert.equal(await marker('s_washer').getAttribute('aria-pressed'), 'false')
  assert.equal(await btn('Pause').isDisabled(), true)
  await verifySmoke(page)
  await verifyLearningModules(page, dashboardUrl, capture)
  assert.deepEqual(errors, [])
  console.log(
    'Passed: model load, smoke alarm, matched TV and laundry trials, opposed entrance doors, zoom and portrait touch controls.',
  )
} finally {
  try {
    await context?.close()
  } finally {
    try {
      await server?.close()
    } finally {
      await rm(profile, { recursive: true, force: true })
    }
  }
}
