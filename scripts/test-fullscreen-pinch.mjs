import assert from 'node:assert/strict'

/** Read the projected storey height, or check it against the expected zoom level. */
function storeyHeight(expected) {
  const top = (id) => parseFloat(document.querySelector(`[data-marker="${id}"]`).style.top)
  const height = top('d0') - top('d1')
  return expected === undefined ? height : Math.abs(height / expected - 1) < 0.04
}

async function verifyCameraPinch(page, session, fullscreen) {
  async function pinch(start, end) {
    // Choose bare canvas at both starting contacts, even after the markers have moved.
    const origin = await page.evaluate((gap) => {
      const canvas = document.querySelector('#viewport canvas')
      for (let y = 90; y < innerHeight - 90; y += 30) {
        for (let x = 90; x < innerWidth - 90; x += 30) {
          if ([-gap, gap].every((dx) => document.elementFromPoint(x + dx, y) === canvas)) return { x, y }
        }
      }
      throw new Error('Two unobstructed touch points are required for the camera test')
    }, start)
    const contacts = (gap) => [-1, 1].map((side, i) => ({
      id: i + 1, x: origin.x + side * gap, y: origin.y,
    }))
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: contacts(start) })
    for (let step = 1; step <= 6; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: contacts(start + (end - start) * step / 6),
      })
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }

  const originalHeight = await page.evaluate(storeyHeight)
  for (const [start, end] of [[36, 60], [60, 36]]) {
    await pinch(start, end)
    await page.waitForFunction(storeyHeight, end > start ? originalHeight * end / start : originalHeight)
    assert.equal(await page.evaluate(() => document.fullscreenElement === document.documentElement), fullscreen)
    assert.equal(await page.evaluate(() => visualViewport.scale), 1)
  }
}

/** Exercise two contacts in native fullscreen before returning Chrome to desktop input. */
export async function verifyFullscreenPinch(page) {
  const session = await page.context().newCDPSession(page)
  try {
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 })
    await verifyCameraPinch(page, session, true)
  } finally {
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await session.detach()
  }
}

/** Exercise the house in a browser tab using the desktop-site identity of an older iPad. */
export async function verifyLegacyIpadTab(context, url) {
  const page = await context.newPage()
  try {
    const session = await context.newCDPSession(page)
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    await session.send('Emulation.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/16.6 Safari/605.1.15',
    })
    await page.goto(url)
    await page.locator('[data-marker="d1"]:visible').waitFor()
    assert.ok(await page.locator('#fullscreen').evaluate((button) => button.hidden))
    await verifyCameraPinch(page, session, false)
  } finally {
    await page.close()
  }
}
