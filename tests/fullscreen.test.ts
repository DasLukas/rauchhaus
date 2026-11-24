import { describe, expect, it } from 'vitest'
import { hasPinchToDismiss } from '../src/ui/fullscreen'

const desktopSafari = (version: string) =>
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/${version} Safari/605.1.15`
const mobileWebKit = (os: string, browser: string) =>
  `Mozilla/5.0 (iPad; CPU OS ${os} like Mac OS X) AppleWebKit/605.1.15 ${browser} Mobile/15E148 Safari/604.1`

describe('native fullscreen pinch dismissal', () => {
  it.each([
    [desktopSafari('16.6'), 5, true],
    [mobileWebKit('16_7_2', 'Version/16.6'), 5, true],
    [mobileWebKit('16_7_2', 'CriOS/120.0'), 5, true],
    [desktopSafari('17.4.1'), 5, true],
    [desktopSafari('17.5'), 5, false],
    [mobileWebKit('17_5', 'FxiOS/126.0'), 5, false],
    [desktopSafari('26.5'), 5, false],
    [desktopSafari('16.6'), 0, false],
    ['Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/158.0 Safari/537.36', 5, false],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/158.0', 10, false],
  ] as const)('classifies %s with %i touch points as %s', (userAgent, maxTouchPoints, expected) => {
    expect(hasPinchToDismiss({ userAgent, maxTouchPoints })).toBe(expected)
  })
})
