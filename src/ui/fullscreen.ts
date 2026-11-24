import { icon } from './icons'

/** Safari before 17.5 reserves an inward pinch for dismissal in its native iPad fullscreen window. */
export function hasPinchToDismiss({
  userAgent,
  maxTouchPoints,
}: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>): boolean {
  const iPad = /\biPad\b/.test(userAgent) || (/\bMacintosh\b/.test(userAgent) && maxTouchPoints > 1)
  if (!iPad || !userAgent.includes('AppleWebKit/')) return false
  // Mobile sites expose the OS version. Desktop sites on iPad expose Safari's version.
  const version =
    /\bCPU (?:iPhone )?OS (\d+)_(\d+)/.exec(userAgent) ?? /\bVersion\/(\d+)\.(\d+)/.exec(userAgent)
  if (!version) return false
  const major = Number(version[1])
  // WebKit removed the native recognizer in https://commits.webkit.org/275288@main.
  return major < 17 || (major === 17 && Number(version[2]) < 5)
}

/** Bind native fullscreen where the lesson's gestures permit it and return the listener cleanup. */
export function bindFullscreen(
  button: HTMLButtonElement,
  message: HTMLElement,
  { usesPinchZoom = false } = {},
) {
  const doc = button.ownerDocument as Document & {
    webkitFullscreenEnabled?: boolean
    webkitFullscreenElement?: Element
    webkitExitFullscreen?: () => void
  }
  const root = doc.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  const standard = typeof root.requestFullscreen === 'function'
  const supported = standard
    ? doc.fullscreenEnabled
    : doc.webkitFullscreenEnabled && typeof root.webkitRequestFullscreen === 'function'
  button.hidden = !supported || (usesPinchZoom && hasPinchToDismiss(navigator))
  if (button.hidden) return () => {}

  const isFullscreen = () => Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement)
  let timeout: number | undefined
  function sync() {
    const active = isFullscreen()
    button.innerHTML = icon(active ? 'collapse' : 'expand')
    button.title = active ? 'Vollbild beenden' : 'Vollbild starten'
    button.setAttribute('aria-label', button.title)
    message.textContent = ''
  }
  function showError() {
    sync()
    message.textContent = 'Der Browser erlaubt den Vollbildwechsel gerade nicht.'
    window.clearTimeout(timeout)
    timeout = window.setTimeout(() => { message.textContent = '' }, 5000)
  }
  async function toggle() {
    try {
      if (standard) {
        if (isFullscreen()) await doc.exitFullscreen()
        else await root.requestFullscreen()
      } else if (isFullscreen()) doc.webkitExitFullscreen?.()
      else root.webkitRequestFullscreen?.()
    } catch {
      showError()
    }
  }

  const changeEvent = standard ? 'fullscreenchange' : 'webkitfullscreenchange'
  const errorEvent = standard ? 'fullscreenerror' : 'webkitfullscreenerror'
  sync()
  doc.addEventListener(changeEvent, sync)
  doc.addEventListener(errorEvent, showError)
  button.addEventListener('click', toggle)
  return () => {
    doc.removeEventListener(changeEvent, sync)
    doc.removeEventListener(errorEvent, showError)
    button.removeEventListener('click', toggle)
    window.clearTimeout(timeout)
  }
}
