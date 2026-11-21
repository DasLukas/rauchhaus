// Run against the production bundle or a supplied Pages URL using a fresh Chrome profile.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import layout from '../src/simulation/layout.json' with { type: 'json' }

const evidence = process.env.RAUCHHAUS_SCREENSHOTS
const targetUrl = process.env.RAUCHHAUS_TEST_URL
const profile = await mkdtemp(join(tmpdir(), 'rauchhaus-chrome-'))
let server
let context

// Projected jamb markers provide a scale and location for sampling the shared
// stairwell. The two compared images use the same room, camera and elapsed time.
async function landingColor(page, level, clockPaused = false) {
  if (!clockPaused)
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    )
  const landing = layout.floors.find((floor) => floor.level === level).landing
  const entrances = layout.doors.filter((door) => door.rooms.includes(landing))
  const below = layout.floors.find((floor) => floor.level === level - 1).landing
  const lowerDoor = layout.doors.find((door) => door.rooms.includes(below))
  const ids = [...entrances.map((door) => door.id), lowerDoor.id]
  const clip = await page.evaluate((ids) => {
    const overlay = document.querySelector('#markers').getBoundingClientRect()
    const [left, right, lower] = ids.map((id) => {
      // Guided exploration hides unrelated controls, but keeps their projections current.
      const marker = document.querySelector(`[data-marker="${id}"]`)
      return { x: parseFloat(marker.style.left), y: parseFloat(marker.style.top) }
    })
    const span = Math.abs(right.x - left.x)
    const height = lower.y - left.y
    return {
      x: Math.round(overlay.left + Math.min(left.x, right.x) + span * 0.24),
      y: Math.round(overlay.top + left.y - height * 0.44),
      width: Math.max(8, Math.round(span * 0.52)),
      height: Math.max(6, Math.round(height * 0.31)),
    }
  }, ids)
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
    for (let i = 0; i < rgba.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) total[channel] += rgba[i + channel]
    }
    return total.map((channel) => channel / (rgba.length / 4))
  }, image.toString('base64'))
}

/** Compare two ordinary free-play laundry runs with the same browser-frame schedule. */
async function verifyLaundry(context, url, errors) {
  const page = await context.newPage()
  try {
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.setViewportSize({ width: 1000, height: 760 })
    await page.clock.install()
    await page.goto(url)
    const washer = page.locator('[data-marker=s_washer]')
    const door = page.locator('[data-marker=dbr]')
    await washer.waitFor()
    const freezeAt = await page.evaluate(() => Date.now() + 500)
    await page.clock.pauseAt(new Date(freezeAt))
    const colors = []
    for (const state of ['geschlossen', 'offen']) {
      if (state === 'offen') await door.click()
      await washer.click()
      // One animation callback per interval. The application advances its normal
      // fixed-step solver through 32 model seconds and renders both outcomes.
      for (let frame = 0; frame < 256; frame++) await page.clock.fastForward(125)
      assert.equal(await page.locator('[data-marker=m_laundry]').isVisible(), true)
      colors.push(await landingColor(page, 0, true))
      if (evidence) await page.screenshot({ path: join(evidence, `keller-${state}.png`) })
    }
    const difference = Math.hypot(...colors[1].map((value, i) => value - colors[0][i]))
    assert.ok(
      difference > 9,
      `Laundry door should visibly affect the central ground-floor landing (RGB distance ${difference.toFixed(1)})`,
    )
  } finally {
    await page.close()
  }
}

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
  await marker('s_tv').waitFor()
  await page.locator('#load-state').waitFor({ state: 'hidden' })
  assert.equal(
    await page.locator('.marker:visible').count(),
    layout.sources.length + layout.doors.length,
  )
  assert.equal(await btn('Pause').isDisabled(), true)
  const capture = async (name) => {
    if (evidence) await page.screenshot({ path: join(evidence, `${name}.png`) })
  }

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
  await btn('Lernimpuls').click()
  await btn('Versuch starten').click()
  await page.getByText('1 von 2 · Tür offen').waitFor()
  await btn('Ergebnis ansehen').click()
  await btn('Türvergleich starten').waitFor()
  const openLanding = await landingColor(page, 2)
  await capture('vergleich-offen')
  await btn('Türvergleich starten').click()
  await page.getByText('2 von 2 · Tür geschlossen').waitFor()
  await btn('Ergebnis ansehen').click()
  await btn('Vergleich abschließen').waitFor()
  const closedLanding = await landingColor(page, 2)
  await capture('vergleich-geschlossen')
  const colorDifference = Math.hypot(...openLanding.map((v, i) => v - closedLanding[i]))
  assert.ok(
    colorDifference > 9,
    `Upper landing should visibly change between trials (RGB distance ${colorDifference.toFixed(1)})`,
  )
  await btn('Vergleich abschließen').click()
  await page.getByText('Beobachtung vergleichen').click()
  await page.getByText('Eine geschlossene Tür bremst den Rauch.', { exact: true }).waitFor()
  await btn('Weiter entdecken').click()
  await page.locator('#app:not(.learning)').waitFor()
  assert.equal(await marker('d1').getAttribute('aria-pressed'), 'true')
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
    // Each landing has two separately selectable apartment or basement doors.
    for (const f of layout.floors) {
      const pair = layout.doors.filter((door) => door.rooms.includes(f.landing))
      assert.equal(pair.length, 2)
      for (const side of pair) {
        const control = marker(side.id)
        const before = await control.getAttribute('aria-pressed')
        await control.click()
        assert.notEqual(await control.getAttribute('aria-pressed'), before)
        await control.click()
      }
    }
    await marker('s_stove').click()
    assert.equal(await marker('s_stove').getAttribute('aria-pressed'), 'true')
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
    )
    for (const button of await page.locator('.marker:visible,.toolbar button').all()) {
      const box = await button.boundingBox()
      assert.ok(box && box.width >= 48 && box.height >= 48, 'Touch target below 48 CSS pixels')
    }
    await capture(`ansicht-${width}`)
  }
  const url = page.url()
  await page.close()
  await verifyLaundry(context, url, errors)
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
