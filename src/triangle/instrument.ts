import {
  closestOnSide,
  constrainPoint,
  readTriangle,
  TRIANGLE_CENTER,
  TRIANGLE_HEIGHT,
  type TriangleFactor,
  type TrianglePoint,
  type TriangleReading,
} from './experiment'
import type { StoveView } from './stove'
import './instrument.css'

const WIDTH = 640
const HEIGHT = 478
const SIDE = 494
const LEFT = (WIDTH - SIDE) / 2
const TOP = 20
const BASE = TOP + SIDE * TRIANGLE_HEIGHT
const ORBIT_STEP = Math.PI / 18

const labels: Record<TriangleFactor, string> = {
  heat: 'Wärme',
  oxygen: 'Sauerstoff',
  fuel: 'Brennstoff',
}
const symbols = {
  heat: '<path fill="#fff9ec" stroke="#193b4d" stroke-width="2.4" d="M10 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z"/><path d="M13 7v10" stroke="#d35736" stroke-width="2.5" stroke-linecap="round"/><circle cx="13" cy="18" r="2.7" fill="#d35736"/>',
  oxygen:
    '<g fill="none" stroke="#007a91" stroke-width="2.2" stroke-linecap="round"><path d="M2 8.5h12.5c3.7 0 3.8-5.8.4-5.8-1.6 0-2.4.8-2.7 1.8M4.5 12.5h15.1c3.6 0 3.7 4.8.6 5.4M2 16.5h8.5c3.5 0 3.9 5 .7 5.2"/></g>',
  fuel: '<path d="m3 10 12.8-5.8 4.4 2.3.4 8.2L8.2 21l-5.7-2.9z" fill="#9e6135" stroke="#68452d" stroke-width="1.3" stroke-linejoin="round"/><path d="m3.4 10.3 5 2.6 11.5-5.8-4.3-2.2z" fill="#edb96c"/><path d="m2.9 10.4 5.5 2.7L8 20.4l-5.2-2.7Z" fill="#f6ce89"/><path d="m10.3 15 7.2-3.6m-6.8 6.5 5.5-2.8M4.4 13.6l1.9.9-.1 2.9" fill="none" stroke="#86552f" stroke-width="1.1" stroke-linecap="round"/>',
}
const factors = ['heat', 'oxygen', 'fuel'] as const

function designPoint(point: TrianglePoint): TrianglePoint {
  return { x: LEFT + point.x * SIDE, y: TOP + point.y * SIDE }
}

function boardMarkup(): string {
  const tip = `${WIDTH / 2},${TOP}`
  const left = `${LEFT},${BASE}`
  const right = `${WIDTH - LEFT},${BASE}`
  return `
    <div class="triangle-board" role="group" aria-label="Das Verbrennungsdreieck">
      <svg class="triangle-pad" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true" focusable="false">
        <defs>
          <marker id="triangle-study-arrow" markerUnits="userSpaceOnUse" markerWidth="25" markerHeight="25" refX="20" refY="12" viewBox="0 0 24 24" orient="auto">
            <path d="M3 3 20 12 3 21l4-9z" fill="#184666" stroke="#fff9ec" stroke-width="2" stroke-linejoin="round"/>
          </marker>
          <linearGradient id="triangle-paper" x2=".85" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#fffaf0"/><stop offset=".65" stop-color="#fff2d8"/><stop offset="1" stop-color="#fae5c1"/></linearGradient>
          <linearGradient id="triangle-coral" x2=".85" y2=".65"><stop stop-color="#ff9472"/><stop offset="1" stop-color="#ed684a"/></linearGradient>
          <linearGradient id="triangle-teal" x2="1" y2="1"><stop stop-color="#24c8b8"/><stop offset="1" stop-color="#079e95"/></linearGradient>
        </defs>
        <path d="M${tip} L${left} L${right}Z" fill="url(#triangle-paper)"/>
        <g class="triangle-guides">${factors.map((factor) => `<line data-guide="${factor}"/>`).join('')}</g>
        <g fill="none" stroke-width="15" stroke-linecap="round">
          <path d="M${tip} L${left}" stroke="url(#triangle-coral)"/>
          <path d="M${left} L${right}" stroke="#edac21"/>
          <path d="M${right} L${tip}" stroke="url(#triangle-teal)"/>
        </g>
        <path id="triangle-study-guide" marker-end="url(#triangle-study-arrow)" hidden/>
      </svg>
      ${factors.map((factor) => `<span class="triangle-label label-${factor}"><svg viewBox="0 0 25 25" aria-hidden="true" focusable="false">${symbols[factor]}</svg>${labels[factor]}</span>`).join('')}
      <button class="triangle-knob" type="button" aria-label="Knopf im Verbrennungsdreieck" aria-describedby="triangle-key-help triangle-observation">
        <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3v26M3 16h26M12 7l4-4 4 4m0 18-4 4-4-4M7 12l-4 4 4 4m18 0 4-4-4-4"/></svg>
      </button>
      <span id="triangle-key-help" class="sr-only">Tippe auf eine Stelle im Dreieck oder benutze die Pfeiltasten. Pos1 oder die Eingabetaste bringt den Knopf zur Mitte.</span>
    </div>`
}

function observation(reading: TriangleReading): [string, string] {
  if (reading.state === 'steady')
    return ['Das Holz brennt.', 'Über dem glühenden Holz steigen Flammen auf.']
  if (reading.state === 'weak')
    return [
      'Die Flammen sind kleiner.',
      `Es ist weniger ${labels[reading.limitingFactor ?? 'oxygen']} verfügbar.`,
    ]
  if (reading.limitingFactor === 'fuel') {
    return [
      'Die Flammen sind aus.',
      reading.availability.fuel < 0.001
        ? 'Das brennbare Holz ist aufgebraucht.'
        : 'Es ist kaum noch brennbares Holz übrig.',
    ]
  }
  if (reading.limitingFactor === 'heat')
    return ['Die Flammen sind aus.', 'Das Holz ist zu kühl, um weiterzubrennen.']
  return [
    'Die Flammen sind aus.',
    'Der Sauerstoff reicht nicht mehr zum Weiterbrennen der Flammen.',
  ]
}

export interface TriangleInstrument {
  getReading(): TriangleReading
  /** Programmatic changes do not dispatch user input back into the lesson. */
  setPosition(point: TrianglePoint): void
  /** Display a direction arrow between two points, or remove it outside the first trial. */
  setGuide(guide: { from: TrianglePoint; to: TrianglePoint } | null): void
  setInteractive(enabled: boolean): void
  setPaused(paused: boolean): void
  getViewAngle(): number
  /** Set the stove orbit in radians. Zero restores its frontal view. */
  setViewAngle(angle: number): void
  /** Capture the current animation and cooling times for restoring a free experiment. */
  capturePlayback(): (() => void) | undefined
  dispose(): void
}

/** Mount a free instrument, or let a lesson accept or constrain user input through setPosition. */
export function mountInstrument(
  host: HTMLElement,
  onChange?: (reading: TriangleReading) => void,
): TriangleInstrument {
  host.innerHTML = `<div class="triangle-instrument">
    ${boardMarkup()}
    <figure class="stove-observation" aria-label="Beobachtung im Holzofen">
      <div class="stove-window">
        <div class="stove-load" role="status"><span>Der Ofen wird aufgebaut …</span><button class="pill" type="button" hidden>Erneut laden</button></div>
      </div>
      <div class="stove-camera" role="group" aria-label="Ofenansicht">
        <button type="button" class="pill compact stove-turn" data-turn="-1" aria-label="Ofen nach links schwenken"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></button>
        <span>Ofen schwenken</span>
        <button type="button" class="pill compact stove-turn" data-turn="1" aria-label="Ofen nach rechts schwenken"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="m10 6 6 6-6 6"/></svg></button>
        <button class="pill stove-front" type="button" aria-label="Ofen von vorne zeigen" hidden>Von vorne</button>
      </div>
      <span id="stove-camera-help" class="sr-only">Mit einem Finger seitlich ziehen oder die Pfeiltasten links und rechts nutzen. Pos1 zeigt den Ofen von vorne.</span>
      <figcaption id="triangle-observation" aria-live="polite" aria-atomic="true">
        <strong></strong><span></span>
      </figcaption>
    </figure>
  </div>`
  const find = <T extends Element>(selector: string) => {
    const node = host.querySelector<T>(selector)
    if (!node) throw new Error(`Missing triangle control: ${selector}`)
    return node
  }
  const instrument = find<HTMLElement>('.triangle-instrument')
  const board = find<HTMLElement>('.triangle-board')
  const knob = find<HTMLButtonElement>('.triangle-knob')
  const guidePath = find<SVGPathElement>('#triangle-study-guide')
  const guides = factors.map(
    (factor) => [factor, find<SVGLineElement>(`[data-guide="${factor}"]`)] as const,
  )
  const caption = find<HTMLElement>('figcaption strong')
  const detail = find<HTMLElement>('figcaption span')
  const viewer = find<HTMLElement>('.stove-window')
  const load = find<HTMLElement>('.stove-load')
  const loadText = find<HTMLElement>('.stove-load span')
  const retry = find<HTMLButtonElement>('.stove-load button')
  const cameraControls = find<HTMLElement>('.stove-camera')
  const front = find<HTMLButtonElement>('.stove-front')
  const events = new AbortController()
  const listeners = { signal: events.signal }
  let reading = readTriangle(TRIANGLE_CENTER)
  let stove: StoveView | undefined
  let angle = 0
  let paused = false
  let activePointer: number | null = null
  let offset = { x: 0, y: 0 }

  function setPosition(point: TrianglePoint): void {
    reading = readTriangle(point)
    const centre = designPoint(reading.point)
    knob.style.left = `${(100 * centre.x) / WIDTH}%`
    knob.style.top = `${(100 * centre.y) / HEIGHT}%`
    for (const [factor, guide] of guides) {
      const end = designPoint(closestOnSide(reading.point, factor))
      guide.setAttribute('x1', String(centre.x))
      guide.setAttribute('y1', String(centre.y))
      guide.setAttribute('x2', String(end.x))
      guide.setAttribute('y2', String(end.y))
    }
    const [title, hint] = observation(reading)
    if (caption.textContent !== title) caption.textContent = title
    if (detail.textContent !== hint) detail.textContent = hint
    instrument.dataset.fireState = reading.state
    stove?.setReading(reading)
  }

  function move(point: TrianglePoint): void {
    if (onChange) onChange(readTriangle(point))
    else setPosition(point)
  }
  function localPoint(event: PointerEvent): TrianglePoint {
    const rect = board.getBoundingClientRect()
    return {
      x: (((event.clientX - rect.left) / rect.width) * WIDTH - LEFT) / SIDE,
      y: (((event.clientY - rect.top) / rect.height) * HEIGHT - TOP) / SIDE,
    }
  }
  board.addEventListener(
    'pointerdown',
    (event) => {
      if (knob.disabled || event.button !== 0 || !event.isPrimary || activePointer !== null) return
      const point = localPoint(event)
      const onKnob = event.target instanceof Element && knob.contains(event.target)
      if (!onKnob && constrainPoint(point) !== point) return
      offset = onKnob
        ? { x: reading.point.x - point.x, y: reading.point.y - point.y }
        : { x: 0, y: 0 }
      activePointer = event.pointerId
      board.setPointerCapture(event.pointerId)
      knob.focus({ preventScroll: true })
      if (!onKnob) move(point)
    },
    listeners,
  )
  board.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId !== activePointer) return
      const point = localPoint(event)
      move({ x: point.x + offset.x, y: point.y + offset.y })
    },
    listeners,
  )
  board.addEventListener(
    'lostpointercapture',
    () => {
      activePointer = null
    },
    listeners,
  )
  knob.addEventListener(
    'keydown',
    (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const { x, y } = reading.point
      const step = event.shiftKey ? 0.08 : 0.032
      if (event.key === 'ArrowLeft') move({ x: x - step, y })
      else if (event.key === 'ArrowRight') move({ x: x + step, y })
      else if (event.key === 'ArrowUp') move({ x, y: y - step })
      else if (event.key === 'ArrowDown') move({ x, y: y + step })
      else if (event.key === 'Home') move(TRIANGLE_CENTER)
      else return
      event.preventDefault()
    },
    listeners,
  )
  // Keyboard and assistive-technology activation of the button also centres the control.
  knob.addEventListener(
    'click',
    (event) => {
      if (!event.detail) move(TRIANGLE_CENTER)
    },
    listeners,
  )
  function recordAngle(value: number): void {
    angle = value
    front.hidden = Math.abs(value) < 0.001
  }
  function setViewAngle(value: number): void {
    if (stove) stove.setAngle(value)
    else recordAngle(value)
  }
  for (const button of cameraControls.querySelectorAll<HTMLButtonElement>('[data-turn]')) {
    button.addEventListener(
      'click',
      () => setViewAngle(angle + Number(button.dataset.turn) * ORBIT_STEP),
      listeners,
    )
  }
  front.addEventListener(
    'click',
    () => {
      setViewAngle(0)
      viewer.querySelector('canvas')?.focus({ preventScroll: true })
    },
    listeners,
  )
  async function loadStove(): Promise<void> {
    load.hidden = false
    loadText.textContent = 'Der Ofen wird aufgebaut …'
    retry.hidden = true
    cameraControls.hidden = true
    try {
      const module = await import('./stove')
      stove = await module.createStove(viewer, reading, events.signal, (value) => {
        if (stove) recordAngle(value)
      })
      stove.setReading(reading)
      stove.setPaused(paused)
      stove.setAngle(angle)
      load.hidden = true
      cameraControls.hidden = false
    } catch {
      if (events.signal.aborted) return
      loadText.textContent =
        'Der 3D-Ofen konnte nicht geladen werden. Prüfe die Verbindung und verwende einen Browser mit WebGL 2.'
      retry.hidden = false
    }
  }
  retry.addEventListener(
    'click',
    () => {
      void loadStove()
    },
    listeners,
  )
  setPosition(TRIANGLE_CENTER)
  void loadStove()
  return {
    getReading: () => reading,
    setPosition,
    setGuide(guide) {
      guidePath.toggleAttribute('hidden', !guide)
      if (!guide) return
      const from = designPoint(guide.from)
      const to = designPoint(guide.to)
      guidePath.setAttribute('d', `M${from.x} ${from.y}L${to.x} ${to.y}`)
    },
    setInteractive(enabled) {
      knob.disabled = !enabled
      if (!enabled && activePointer !== null && board.hasPointerCapture(activePointer))
        board.releasePointerCapture(activePointer)
      if (!enabled) activePointer = null
    },
    setPaused(value) {
      paused = value
      stove?.setPaused(value)
    },
    getViewAngle: () => angle,
    setViewAngle,
    capturePlayback: () => stove?.capturePlayback(),
    dispose() {
      events.abort()
      stove?.dispose()
    },
  }
}
