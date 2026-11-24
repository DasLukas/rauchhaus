import assert from 'node:assert/strict'

// These room assignments are the classroom brief, independent of the layout coordinates.
const topics = {
  klein: [
    ['info_stove', 'kitchen', /Geschirrtuch.*heißen Herdplatte/],
    ['info_doors', 'living', /Zimmer- und Wohnungstüren.*Spalten/],
    ['info_alarm', 'sleep2', /Pflicht.*Flur.*im Schlaf wecken/],
    ['info_electric', 'attic', /Elektrogeräte sind eine häufige Brandursache.*Kabel.*Erwachsenen/],
  ],
  gross: [
    ['info_cellar', 'laundry', /Kellerbrand.*Rauch.*nach oben/],
    ['info_candle', 'dining', /Kerzenflamme.*Erwachsener/],
    ['info_stairs', 'stair2', /Blumentopf.*stolpern.*Kartons/],
    ['info_emergency', 'loft', /Wohnungstür zu.*rauchfreien Zimmer.*112.*Fenster/],
  ],
}

/** Verify that every visible control fits the screen and receives a tap at its centre. */
export async function checkTapTargets(page) {
  const targets = await page.locator(
    '#markers button:visible,.toolbar button:visible,.house-identity a,.house-picker a,.learning-tools button',
  ).evaluateAll((buttons) => ({
    fits: document.documentElement.scrollWidth <= innerWidth,
    blocked: buttons.flatMap((button) => {
      const box = button.getBoundingClientRect()
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return box.width >= 48 && box.height >= 48 && button.contains(hit)
        ? []
        : [button.getAttribute('aria-label')]
    }),
  }))
  assert.equal(targets.fits, true)
  assert.deepEqual(targets.blocked, [], 'Each 48-pixel target must receive its own tap')
}

/** Open each tip, check its content and focus return, then exercise the view and fire transitions. */
export async function verifySafetyTips(page, variant, layout, capture) {
  const marker = (id) => page.locator(`[data-marker="${id}"]`)
  const tips = page.getByRole('button', { name: /^Brandschutzhinweis/ })
  const house = page.locator('#viewport canvas')
  const dialog = page.getByRole('dialog')
  const overview = await tips.count()
  assert.equal(overview, 4)
  for (const [id, roomId, message] of topics[variant]) {
    const tip = marker(id)
    const room = layout.rooms.find((room) => room.id === roomId)
    assert.ok((await tip.getAttribute('aria-label')).endsWith(room.label))
    assert.equal(await tip.getAttribute('aria-haspopup'), 'dialog')
    await tip.press('Enter')
    await dialog.waitFor()
    assert.equal(await dialog.getByRole('heading').textContent(), await tip.locator('.tooltip').textContent())
    assert.match(await dialog.textContent(), message)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await tip.evaluate((node) => node === document.activeElement), true)
    assert.equal(await page.getByRole('button', { name: 'Pause', exact: true }).isDisabled(), true)
  }

  const small = variant === 'klein'
  assert.equal(await page.locator('.marker.door:visible').count(), small ? 7 : 5)
  assert.equal(await page.locator('.marker.source:visible').count(), small ? 2 : 5)
  const spot = marker(small ? 'info_electric' : 'info_emergency')
  const detailControl = marker(small ? 's_attic' : 'd3r')
  assert.equal(await detailControl.isVisible(), false)
  await house.press('4')
  await detailControl.waitFor()
  assert.equal(await tips.count(), 1)
  await spot.click()
  await dialog.getByRole('button', { name: 'Schließen' }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await spot.evaluate((node) => node === document.activeElement), true)
  await house.press('Home')
  await detailControl.waitFor({ state: 'hidden' })

  await marker('s_tv').click()
  assert.equal(await tips.count(), 0)
  assert.equal(await page.locator('.marker.door:visible').count(), layout.doors.length + Number(small))
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  assert.equal(await page.locator('.marker.info[hidden]').count(), 4)
  // The old tip location must now select the attic through the canvas.
  const point = await spot.evaluate((node) => {
    const stage = node.parentElement.getBoundingClientRect()
    const x = stage.left + parseFloat(node.style.left)
    const y = stage.top + parseFloat(node.style.top)
    return { x, y, target: document.elementFromPoint(x, y)?.tagName }
  })
  assert.equal(point.target, 'CANVAS')
  await page.mouse.click(point.x, point.y)
  await marker('d1').waitFor({ state: 'hidden' })
  assert.equal(await dialog.isVisible(), false)
  assert.equal(await tips.count(), 0)
  await page.getByRole('button', { name: 'Neu starten' }).click()
  await tips.nth(overview - 1).waitFor()
  assert.equal(await tips.count(), overview)

  if (small) {
    await house.press('1')
    await marker('s_stove').waitFor()
    await marker('s_stove').click()
    await house.press('Home')
    await marker('d1').waitFor()
    assert.equal(await marker('s_stove').isVisible(), true, 'The active source stays visible in the overview')
    await page.getByRole('button', { name: 'Neu starten' }).click()
    await marker('s_stove').waitFor({ state: 'hidden' })
  }

  const originalSize = page.viewportSize()
  for (const [width, height] of [[1180, 820], [820, 1180], [844, 390], [390, 844]]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
    await checkTapTargets(page)
    assert.equal(await tips.count(), overview)
  }
  // Deliver a real touch sequence in the narrow viewport.
  const touch = await page.context().newCDPSession(page)
  try {
    await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    const box = await spot.boundingBox()
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await dialog.waitFor()
    await capture(`hinweis-${variant}-mobil`)
    await dialog.getByRole('button', { name: 'Schließen' }).click()
    await dialog.waitFor({ state: 'hidden' })
  } finally {
    await touch.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await touch.detach()
  }
  await page.setViewportSize(originalSize)
}
