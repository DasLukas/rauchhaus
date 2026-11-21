// Run against the production bundle or a supplied Pages URL using a fresh Chrome profile.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { preview } from 'vite'

const evidence = process.env.RAUCHHAUS_SCREENSHOTS
const targetUrl = process.env.RAUCHHAUS_TEST_URL
const profile = await mkdtemp(join(tmpdir(), 'rauchhaus-chrome-'))
let server
let context

// Sample the landing one floor above the television. That region contains no
// moving door in either trial. The image is decoded offscreen by the browser.
async function landingColor(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
  const tv = await page.locator('[data-marker=s_tv]').boundingBox()
  const door = await page.locator('[data-marker=d1]').boundingBox()
  assert.ok(tv && door)
  const scale = door.x - tv.x
  const clip = {
    x: Math.round(door.x + door.width / 2 + 0.32 * scale),
    y: Math.round(door.y + door.height / 2 - 0.85 * scale),
    width: 16,
    height: 14,
  }
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
  assert.equal(await page.locator('.marker:visible').count(), 12)
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
  const openLanding = await landingColor(page)
  await capture('vergleich-offen')
  await btn('Türvergleich starten').click()
  await page.getByText('2 von 2 · Tür geschlossen').waitFor()
  await btn('Ergebnis ansehen').click()
  await btn('Vergleich abschließen').waitFor()
  const closedLanding = await landingColor(page)
  const colorDifference = Math.hypot(...openLanding.map((v, i) => v - closedLanding[i]))
  assert.ok(
    colorDifference > 9,
    `Upper landing should visibly change between trials (RGB distance ${colorDifference.toFixed(1)})`,
  )
  await capture('vergleich-geschlossen')
  await btn('Vergleich abschließen').click()
  await page.getByText('Beobachtung vergleichen').click()
  await page.getByText('Eine geschlossene Tür bremst den Rauch.', { exact: true }).waitFor()
  await btn('Weiter entdecken').click()
  await page.locator('#app:not(.learning)').waitFor()
  assert.equal(await marker('d1').getAttribute('aria-pressed'), 'true')
  await btn('Vergrößern').click()
  await btn('Ganzes Haus zeigen').click()
  for (const [width, height] of [
    [820, 1180],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
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
  assert.deepEqual(errors, [])
  console.log(
    'Passed: model load, smoke alarm, pause, door, restart, help, matched trials, zoom, portrait and narrow touch targets.',
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
