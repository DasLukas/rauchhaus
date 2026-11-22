import { icon } from './icons'

/** Connects the control to native page fullscreen and returns its teardown function. */
export function bindFullscreen(button: HTMLButtonElement, message: HTMLElement) {
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
  button.hidden = !supported
  if (!supported) return () => {}

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
