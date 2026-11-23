import {
  closestOnSide,
  constrainPoint,
  readTriangle,
  STOVE_START_ANGLE,
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

const labels: Record<TriangleFactor, string> = {
  heat: 'Wärme',
  oxygen: 'Sauerstoff',
  fuel: 'Brennstoff',
}
const symbols = {
  heat: '<path d="M10 17.9V5.4a3.9 3.9 0 0 1 7.8 0v12.5a6.8 6.8 0 1 1-7.8 0Z" fill="#fff3dd" stroke="#313b48" stroke-width="2.2"/><path d="M13.9 7.6v15.1" stroke="#d74e2c" stroke-width="3" stroke-linecap="round"/><circle cx="13.9" cy="23.4" r="4.1" fill="#df5631"/><path d="M20.6 6h4m-4 4H23m-2.4 4h4" fill="none" stroke="#9b4631" stroke-width="1.7" stroke-linecap="round"/>',
  oxygen:
    '<g fill="none" stroke="#057990" stroke-width="2.7" stroke-linecap="round"><path d="M3 11h13.8c5 0 5.1-7.5.5-7.5-2.2 0-3.3 1.1-3.7 2.5M6.3 16h18.2c5 0 5.1 6.5.7 6.5-1.8 0-2.8-.8-3.3-1.8M3 20.7h10c4.6 0 4.9 7 .7 7-1.7 0-2.7-.7-3.2-1.8"/></g>',
  fuel: '<path d="m4.2 14.2 16-8.6c3.6-1.9 7.5.4 9 5.1 1.4 4.1.6 7.3-2.3 8.9L11 27.8Z" fill="#965633" stroke="#633e2a" stroke-width="1.5" stroke-linejoin="round"/><path d="m4.2 14.2 16-8.6c2.8-1.4 5.1-.6 6.8 1.6l-16 9Z" fill="#e4a85c"/><path d="M4.2 14.2c2.9-1.6 6.9.9 8.3 5.3 1.4 4.3.2 7.8-2.5 8.6-2.8.9-5.9-1.1-7.2-5.2-1.3-4-.8-7.4 1.4-8.7Z" fill="#f5ca85" stroke="#70472c" stroke-width="1.5"/><g fill="none" stroke="#9d622f" stroke-width="1.3" stroke-linecap="round"><path d="M5.8 17.3c2.4-.6 4.7 3 4.2 6.7-.2 1.8-1.8 2.3-3.2 1.2M6.8 19.4c1.1.5 1.5 1.8 1.4 3"/><path d="m15.1 18.5 10.5-5.7m-9.7 9.1 10.3-5.6" stroke="#673e2b"/></g>',
}
const factors = ['heat', 'oxygen', 'fuel'] as const
const factorColors = { heat: '#f47753', oxygen: '#22af9e', fuel: '#e8aa29' }

function designPoint(point: TrianglePoint): TrianglePoint {
  return { x: LEFT + point.x * SIDE, y: TOP + point.y * SIDE }
}

function boardMarkup(): string {
  const tip = `${WIDTH / 2},${TOP}`
  const left = `${LEFT},${BASE}`
  const right = `${WIDTH - LEFT},${BASE}`
  const outline = `M${tip} L${left} L${right}Z`
  const centre = designPoint(TRIANGLE_CENTER)
  // Equal colour intensities lie on lines parallel to the relevant side.
  const gradients = factors.map((factor) => {
    const edge = designPoint(closestOnSide(TRIANGLE_CENTER, factor))
    return `<linearGradient id="field-${factor}" gradientUnits="userSpaceOnUse" x1="${edge.x}" y1="${edge.y}" x2="${centre.x}" y2="${centre.y}" color="${factorColors[factor]}">
      <stop stop-color="currentColor" stop-opacity=".52"/><stop offset=".38" stop-color="currentColor" stop-opacity=".24"/><stop offset=".72" stop-color="currentColor" stop-opacity=".075"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/>
    </linearGradient>`
  }).join('')
  const label = (factor: TriangleFactor) => `<span class="triangle-label label-${factor}"><svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${symbols[factor]}</svg><span>${labels[factor]}</span></span>`
  return `
    <div class="triangle-control" role="group" aria-label="Das Verbrennungsdreieck">
      <div class="triangle-board">
      <svg class="triangle-pad" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true" focusable="false">
        <defs>
          <marker id="triangle-study-arrow" markerUnits="userSpaceOnUse" markerWidth="25" markerHeight="25" refX="20" refY="12" viewBox="0 0 24 24" orient="auto">
            <path d="M3 3 20 12 3 21l4-9z" fill="#184666" stroke="#fff9ec" stroke-width="2" stroke-linejoin="round"/>
          </marker>
          ${gradients}
          <linearGradient id="triangle-coral" x2=".85" y2=".65"><stop stop-color="#ff9472"/><stop offset="1" stop-color="#ed684a"/></linearGradient>
          <linearGradient id="triangle-teal" x2="1" y2="1"><stop stop-color="#24c8b8"/><stop offset="1" stop-color="#079e95"/></linearGradient>
        </defs>
        <path d="${outline}" fill="#fff9e9"/>
        ${factors.map((factor) => `<path d="${outline}" fill="url(#field-${factor})"/>`).join('')}
        <g class="triangle-contours">
          ${[0.80, 0.58].map((size) => `<path d="${outline}" transform="translate(${centre.x} ${centre.y}) scale(${size}) translate(${-centre.x} ${-centre.y})"/>`).join('')}
        </g>
        <g class="triangle-guides">${factors.map((factor) => `<line data-guide="${factor}"/>`).join('')}</g>
        <g fill="none" stroke-width="15" stroke-linecap="round">
          <path d="M${tip} L${left}" stroke="url(#triangle-coral)"/>
          <path d="M${left} L${right}" stroke="#edac21"/>
          <path d="M${right} L${tip}" stroke="url(#triangle-teal)"/>
        </g>
        <path id="triangle-study-guide" marker-end="url(#triangle-study-arrow)" hidden/>
      </svg>
      ${label('heat')}${label('oxygen')}
      <button class="triangle-knob" type="button" aria-label="Knopf im Verbrennungsdreieck" aria-describedby="triangle-key-help triangle-observation">
        <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3v26M3 16h26M12 7l4-4 4 4m0 18-4 4-4-4M7 12l-4 4 4 4m18 0 4-4-4-4"/></svg>
      </button>
      <span id="triangle-key-help" class="sr-only">Tippe auf eine Stelle im Dreieck oder benutze die Pfeiltasten. Pos1 oder die Eingabetaste bringt den Knopf zur Mitte.</span>
      </div>
      ${label('fuel')}
    </div>`
}

const observations = {
  steady: ['Das Holz brennt.', 'Über dem glühenden Holz steigen Flammen auf.'],
  'weak-heat': ['Die Flammen sind kleiner.', 'Es ist weniger Wärme verfügbar.'],
  'weak-oxygen': ['Die Flammen sind kleiner.', 'Es ist weniger Sauerstoff verfügbar.'],
  'weak-fuel': ['Die Flammen sind kleiner.', 'Das Scheit wird dunkler. Ein Teil des Holzes ist schon verbrannt.'],
  'out-heat': ['Die Flammen sind aus.', 'Das braune Holz ist noch da. Es ist zu kühl zum Weiterbrennen.'],
  'out-oxygen': ['Die Flammen sind aus.', 'Der Sauerstoff reicht nicht mehr zum Weiterbrennen der Flammen.'],
  'out-fuel': ['Die Flammen sind aus.', 'Auf dem verkohlten Rest liegt graue Asche.'],
} as const

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
      <span id="stove-camera-help" class="sr-only">Mit einem Finger seitlich ziehen oder die Pfeiltasten links und rechts nutzen. Pos1 zeigt die Startansicht.</span>
      <figcaption id="triangle-observation" aria-live="polite" aria-atomic="true">
        ${Object.entries(observations).map(([key, [title, detail]]) =>
          `<span class="observation-copy" data-observation="${key}" aria-hidden="true"><strong>${title}</strong><span>${detail}</span></span>`
        ).join('')}
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
  let activeCaption: HTMLElement | undefined
  const viewer = find<HTMLElement>('.stove-window')
  const load = find<HTMLElement>('.stove-load')
  const loadText = find<HTMLElement>('.stove-load span')
  const retry = find<HTMLButtonElement>('.stove-load button')
  const events = new AbortController()
  const listeners = { signal: events.signal }
  let reading = readTriangle(TRIANGLE_CENTER)
  let stove: StoveView | undefined
  let angle = STOVE_START_ANGLE
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
    const key = reading.state === 'steady' ? 'steady' : `${reading.state}-${reading.limitingFactor}`
    if (activeCaption?.dataset.observation !== key) {
      activeCaption?.setAttribute('aria-hidden', 'true')
      activeCaption = find<HTMLElement>(`[data-observation="${key}"]`)
      activeCaption.removeAttribute('aria-hidden')
    }
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
  function setViewAngle(value: number): void {
    angle = value
    stove?.setAngle(value)
  }
  async function loadStove(): Promise<void> {
    load.hidden = false
    loadText.textContent = 'Der Ofen wird aufgebaut …'
    retry.hidden = true
    try {
      const module = await import('./stove')
      stove = await module.createStove(viewer, reading, events.signal, (value) => {
        if (stove) angle = value
      })
      stove.setReading(reading)
      stove.setPaused(paused)
      stove.setAngle(angle)
      load.hidden = true
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
