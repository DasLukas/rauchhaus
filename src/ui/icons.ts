const glyphs = {
  house: '<path d="M3 11.4 12 3l9 8.4M5.2 10v10.4h13.6V10"/><path d="M10 20v-6.4h4V20"/>',
  apartments: '<path d="M2 21h20M4 21V7h7V3h9v18M7.5 11h.1m-.1 4h.1M14 7h3m-3 4h3m-3 4h3m-3 6v-3h3v3"/>',
  settings: '<path d="m9.3 3 .6-1h4.2l.6 2 1.6.9 2-.4 2.1 3.6-1.4 1.5v2l1.4 1.6-2.1 3.6-2-.4-1.6.9-.6 2H10l-.6-2-1.7-.9-2 .4-2.1-3.6L5 11.7v-2L3.6 8.1l2.1-3.6 2 .4 1.6-.9z" transform="translate(0 1)"/><circle cx="12" cy="12" r="3"/>',
  muted: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>',
  sound: '<path d="M3 9h4l5-4v14l-5-4H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  bulb: '<g fill="#ffca43" stroke="#d98a20"><path d="M8.8 15.3C8.8 13.7 6.4 12.4 6.4 9a5.6 5.6 0 0 1 11.2 0c0 3.4-2.4 4.7-2.4 6.3Z" stroke-width="1.3"/><path d="M12 .6v1M2.5 7l1.3.5M20.2 7.5l1.3-.5M4.5 2.8l1 .9M18.6 3.7l1-.9" stroke-width="1.4"/></g><path d="M9 17h6m-5 2h4m-3 1.8h2" stroke-width="1.6"/>',
  help: '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M9.1 8.9c.2-3.3 6.1-3.5 6.1.1 0 2.2-3.2 2.3-3.2 5" stroke="#fff9ee" stroke-width="2.1"/><circle cx="12" cy="17.3" r="1.2" fill="#fff9ee" stroke="none"/>',
  flame: '<path d="M13 2c1 5-4 6-3 11-2-1-3-3-3-5-2 3-3 5-3 8a8 8 0 0 0 16 0c0-5-3-9-7-14Z" fill="#ff997c"/><path d="M12 20c-2-1-2-3 0-6 0 2 3 3 2 5" fill="#ffca43" stroke="none"/>',
  smoke:
    '<path d="M6.3 20c-4.5-5.8 4.5-6.4 0-12.2m5.7 11c-4.6-6.1 5.1-7.4.2-15m5.4 16.2c-4.3-5.5 4.8-7.6.3-13.3" stroke-width="2"/>',
  check: '<path d="m4.5 12.5 5 5 10-11" stroke-width="3"/>',
  door: '<path d="m6 4.2 10.6-1.4V21L6 19.8z"/><path d="M16.7 4.3h2v15.4h-2M13.5 12v.2" stroke-width="1.6"/>',
  open: '<path d="M8 4h11v16H8m-3-14 7-3v18l-7-2.5z"/><path d="M9.7 12.1v.5" stroke-width="1.6"/>',
  reset: '<path d="M4.3 8.5a8.4 8.4 0 1 1-.4 6.2M3.7 3.9v5.5h5.6"/>',
  pause:
    '<rect x="5" y="3.5" width="5" height="17" rx="1.8" fill="currentColor" stroke="none"/><rect x="14" y="3.5" width="5" height="17" rx="1.8" fill="currentColor" stroke="none"/>',
  play: '<path d="m7 4 13 8-13 8z" fill="currentColor" stroke-linejoin="round"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  expand: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  collapse: '<path d="M9 4v5H4m16 0h-5V4m0 16v-5h5M4 15h5v5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  next: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  alarm:
    '<path d="M5.5 9h13l-1.7 4.5H7.2zM3.4 16.2l-1.1 2.1m18.3-2.1 1.1 2.1M12 16v3"/><path d="M7 6.5h10"/>',
  eye: '<path d="M2 12s3.6-6.4 10-6.4S22 12 22 12s-3.6 6.4-10 6.4S2 12 2 12Z"/><circle cx="12" cy="12" r="2.7"/>',
} as const

export type IconName = keyof typeof glyphs

/** Returns decorative, scalable artwork for an already named control. */
export function icon(name: IconName): string {
  return `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${glyphs[name]}</svg>`
}
