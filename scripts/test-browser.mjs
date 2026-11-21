// Run against the production bundle or a supplied Pages URL using a fresh Chrome profile.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import largeHouse from '../src/simulation/layout.json' with { type: 'json' }
import smallHouse from '../src/simulation/layout-small.json' with { type: 'json' }

import { landingColor, verifySmoke } from './test-smoke-rendering.mjs'

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
    viewport: { width: 1448, height: 1086 },
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
  await page.goto(targetUrl || `http://127.0.0.1:${port}/`)
  assert.match(await page.title(), /Das Rauchhaus/)
  const marker = (id) => page.locator(`[data-marker="${id}"]`)
  const btn = (name) => page.getByRole('button', { name, exact: true })
  const capture = async (name) => {
    if (evidence) await page.screenshot({ path: join(evidence, `${name}.png`) })
  }
  async function checkLesson(layout, prefix) {
    await btn('Lernimpuls').click()
    await btn('Versuch starten').click()
    await page.getByText('1 von 2 · Tür offen').waitFor()
    await btn('Ergebnis ansehen').click()
    await btn('Türvergleich starten').waitFor()
    const openLanding = await landingColor(page, 2, layout)
    await capture(`${prefix}-offen`)
    await btn('Türvergleich starten').click()
    await page.getByText('2 von 2 · Tür geschlossen').waitFor()
    await btn('Ergebnis ansehen').click()
    await btn('Vergleich abschließen').waitFor()
    const closedLanding = await landingColor(page, 2, layout)
    await capture(`${prefix}-geschlossen`)
    const colorDifference = Math.hypot(...openLanding.map((v, i) => v - closedLanding[i]))
    assert.ok(
      colorDifference > 9,
      `Upper landing should visibly change between trials (RGB distance ${colorDifference.toFixed(1)})`,
    )
    console.log('Passed the rendered television door comparison.')
    await btn('Vergleich abschließen').click()
    await page.getByText('Beobachtung vergleichen').click()
    await page.getByText('Eine geschlossene Tür bremst den Rauch.', { exact: true }).waitFor()
    await btn('Weiter entdecken').click()
    await page.locator('#app:not(.learning)').waitFor()
  }

  await marker('entry').waitFor()
  assert.deepEqual([...modelRequests], ['rauchhaus-klein.glb'])
  assert.equal(await page.locator('.house-picker [aria-current]').textContent(), 'Kleines Haus')
  assert.equal(
    await page.locator('.marker:visible').count(),
    smallHouse.floors.length + smallHouse.doors.length + Number(Boolean(smallHouse.exteriorDoor)),
  )
  await capture('haus-klein')
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
  assert.equal(await marker('entry').getAttribute('aria-pressed'), 'true')
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.getByRole('link', { name: 'Großes Haus' }).click()
  await marker('s_washer').waitFor()
  assert.equal(modelRequests.has('rauchhaus.glb'), true)
  await page.getByRole('link', { name: 'Kleines Haus' }).click()
  await marker('entry').waitFor()
  assert.equal(await marker('entry').getAttribute('aria-pressed'), 'false')
  await capture('haus-klein-hochformat')
  await page.getByRole('link', { name: 'Großes Haus' }).click()
  await marker('s_washer').waitFor()
  await page.setViewportSize({ width: 1448, height: 1086 })
  assert.equal(await page.locator('.house-picker [aria-current]').textContent(), 'Großes Haus')
  assert.equal(
    await page.locator('.marker:visible').count(),
    largeHouse.floors.length + largeHouse.doors.length,
  )
  assert.equal(await btn('Pause').isDisabled(), true)
  await capture('haus')
  await marker('s_tv').click()
  await marker('m_living').waitFor()
  await btn('Pause').click()
  assert.equal(await marker('s_tv').getAttribute('aria-pressed'), 'true')
  assert.equal(await marker('d1').getAttribute('aria-pressed'), 'false')
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
  await btn('Hilfe').click()
  await page.getByRole('heading', { name: 'So geht’s' }).waitFor()
  await page.keyboard.press('Escape')
  await checkLesson(largeHouse, 'vergleich')
  assert.equal(await marker('d1').getAttribute('aria-pressed'), 'true')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await marker('s_washer').waitFor()
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
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    )
    const targets = await page.evaluate(() => {
      const markers = Array.from(
        document.querySelectorAll('#markers button:not([hidden]),.toolbar button,.house-picker a'),
      )
      return {
        fits: document.documentElement.scrollWidth <= innerWidth,
        blocked: markers.flatMap((button) => {
          const box = button.getBoundingClientRect()
          const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          return box.width >= 48 && box.height >= 48 && button.contains(hit)
            ? []
            : [button.getAttribute('aria-label')]
        }),
        doors: markers.filter((node) => node.classList.contains('door')).length,
      }
    })
    assert.equal(targets.fits, true)
    assert.equal(targets.doors, largeHouse.doors.length)
    assert.deepEqual(
      targets.blocked,
      [],
      'Each 48-pixel target must receive a tap at its own centre',
    )
    // Exercise an opposing pair with real pointer clicks in each orientation.
    for (const id of ['dbl', 'dbr']) {
      const door = marker(id)
      const before = await door.getAttribute('aria-pressed')
      await door.click()
      assert.notEqual(await door.getAttribute('aria-pressed'), before)
    }
    await capture(`ansicht-${width}`)
    console.log(`Verified independent door controls at ${width} × ${height}.`)
  }
  await marker('s_washer').click()
  assert.equal(await marker('s_washer').getAttribute('aria-pressed'), 'true')
  await marker('m_laundry').waitFor()
  await btn('Pause').click()
  await verifySmoke(page)
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
