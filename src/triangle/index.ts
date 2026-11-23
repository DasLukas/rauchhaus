import { element } from '../ui/dom'
import { bindFullscreen } from '../ui/fullscreen'
import { icon } from '../ui/icons'
import { STOVE_START_ANGLE } from './experiment'
import { mountInstrument } from './instrument'
import { TriangleSession } from './lesson'
import './lesson.css'

const helpContent = `
  <header class="sheet-heading">
    <h2 id="triangle-help-title">So geht’s</h2>
    <button type="button" class="close compact" aria-label="Schließen" data-close>${icon('close')}</button>
  </header>
  <p>Zieh den Knopf im Dreieck oder tippe auf einen Punkt. Bewegst du ihn zum Beispiel vom Luftzeichen weg, bekommt das Feuer weniger Sauerstoff.</p>
  <p>Zieh seitlich über die Ofenscheibe, um den Ofen von einer anderen Seite zu sehen. Mit „Lernimpuls“ kannst du die drei Seiten des Dreiecks nacheinander untersuchen.</p>
  <details><summary>Für Erwachsene</summary>
    <p>Die Mitte steht für genügend Wärme, Sauerstoff und Brennstoff. Die Abstände sind Modellwerte. Das Dreieck gibt keine Mengenverhältnisse für einen echten Brand an.</p>
    <p>Jede Einstellung zeigt dasselbe Holz unter den gewählten Bedingungen. Die Ausgangsszene enthält bereits brennendes Holz. Die Rückkehr zur Mitte zeigt diesen Ausgangszustand erneut.</p>
    <p>Beim Erhitzen setzt Holz brennbare Gase frei. Am Ende des Brennstoffversuchs liefert der verkohlte Rest zu wenig Gas für eine Flamme. Holzkohle kann bei genügend Wärme und Sauerstoff weiterglühen.</p>
    <p>Mit der Tabulatortaste erreichst du den Knopf. Die Pfeiltasten verschieben ihn, Pos1 bringt ihn zurück in die Mitte.</p>
  </details>
  <button class="action" type="button" data-close>Verstanden</button>`

/** Mount the movable triangle and its optional guided wood-combustion comparisons. */
export function mountTriangle(root: HTMLElement) {
  root.innerHTML = `
    <header class="topbar triangle-topbar">
      <div class="triangle-identity">
        <a class="pill compact" href="./" aria-label="Zur Übersicht" title="Zur Übersicht">${icon('overview')}</a>
        <h1 class="brand" id="triangle-title"><svg viewBox="0 0 32 32" fill="none" stroke-width="4.5" stroke-linecap="round" aria-hidden="true"><path d="M16 4 3 27" stroke="#e36d4e"/><path d="M3 27h26" stroke="#e9a620"/><path d="M29 27 16 4" stroke="#008c84"/></svg>Verbrennungsdreieck</h1>
      </div>
      <nav aria-label="Lernen und Hilfe">
        <button class="pill" id="triangle-lesson" type="button" aria-controls="triangle-study" aria-expanded="false" aria-label="Lernimpuls" title="Lernimpuls">${icon('bulb')}<span>Lernimpuls</span></button>
        <button class="pill compact" id="triangle-help" type="button" aria-label="Hilfe" title="Hilfe">${icon('help')}</button>
      </nav>
    </header>
    <div class="triangle-workspace">
      <div id="triangle-instrument"></div>
      <section id="triangle-study" class="trial-bar" aria-label="Lernimpuls" hidden>
        <div class="trial-copy">
          <strong id="triangle-study-heading"></strong>
          <span id="triangle-study-prompt"></span>
        </div>
        <button class="action" id="triangle-next" type="button"><span id="triangle-next-label"></span>${icon('next')}</button>
        <button class="close compact" id="triangle-end" type="button" aria-label="Lernimpuls beenden" title="Lernimpuls beenden">${icon('close')}</button>
      </section>
    </div>
    <footer class="toolbar" aria-label="Versuch und Ansicht">
      <div class="play-controls">
        <button class="pill" id="triangle-restart" type="button" aria-label="Neu starten" title="Neu starten">${icon('reset')}<span>Neu starten</span></button>
      </div>
      <div class="view-controls"><button id="fullscreen" class="pill compact" type="button" aria-label="Vollbild starten" title="Vollbild starten">${icon('expand')}</button></div>
      <div id="fullscreen-message" role="status"></div>
    </footer>
    <span class="sr-only" id="triangle-announcer" role="status"></span>
    <dialog id="sheet" aria-labelledby="triangle-help-title">${helpContent}</dialog>`

  const session = new TriangleSession()
  const lesson = element<HTMLButtonElement>('triangle-lesson')
  const next = element<HTMLButtonElement>('triangle-next')
  const nextLabel = element('triangle-next-label')
  const end = element<HTMLButtonElement>('triangle-end')
  const study = element('triangle-study')
  const heading = element('triangle-study-heading')
  const prompt = element('triangle-study-prompt')
  const dialog = element<HTMLDialogElement>('sheet')
  const announcer = element('triangle-announcer')
  const unbindFullscreen = bindFullscreen(
    element<HTMLButtonElement>('fullscreen'),
    element('fullscreen-message'),
  )
  let restorePlayback: (() => void) | undefined

  const instrument = mountInstrument(element('triangle-instrument'), (reading) => {
    const before = session.phase
    session.move(reading.point)
    if (before !== session.phase) presentStage()
    else instrument.setPosition(session.position)
  })
  const knob = element<HTMLButtonElement>('triangle-knob')
  const caption = element('triangle-observation')

  function updatePlayback() {
    instrument.setPaused(document.hidden || dialog.open)
  }

  function refresh() {
    const { phase, trial } = session
    const free = phase === 'free'
    const exploring = phase === 'explore'
    root.classList.toggle('learning', !free)
    study.hidden = free
    study.dataset.phase = phase
    study.dataset.factor = trial.factor
    lesson.setAttribute('aria-expanded', String(!free))
    caption.hidden = !free
    knob.setAttribute(
      'aria-describedby',
      free ? 'triangle-key-help triangle-observation' : 'triangle-key-help triangle-study-prompt',
    )
    instrument.setInteractive(free || exploring)
    instrument.setGuide(session.guide)
    instrument.setPosition(session.position)
    if (free) return

    heading.textContent = `${session.number} von ${session.total} · ${trial.title}`
    prompt.textContent = exploring ? trial.prompt : trial.observation
    const continueLabel = session.number === session.total ? 'Fertig' : 'Weiter'
    nextLabel.textContent = exploring ? 'Zeigen' : continueLabel
  }

  function presentStage() {
    refresh()
    if (session.phase === 'free') {
      instrument.setViewAngle(session.viewAngle)
      restorePlayback?.()
      restorePlayback = undefined
      lesson.focus({ preventScroll: true })
      announcer.textContent = 'Zurück in deinem freien Versuch.'
      return
    }
    if (session.phase === 'explore') {
      instrument.setViewAngle(STOVE_START_ANGLE)
      knob.focus({ preventScroll: true })
    } else next.focus({ preventScroll: true })
    announcer.textContent = `${heading.textContent}. ${prompt.textContent}`
  }

  function leave() {
    session.end()
    presentStage()
  }

  lesson.onclick = () => {
    if (session.phase !== 'free') {
      leave()
      return
    }
    restorePlayback = instrument.capturePlayback()
    session.begin(instrument.getViewAngle())
    presentStage()
  }
  next.onclick = () => {
    session.next()
    presentStage()
  }
  end.onclick = leave
  element('triangle-restart').onclick = () => {
    session.restart()
    restorePlayback = undefined
    instrument.setViewAngle(STOVE_START_ANGLE)
    refresh()
    announcer.textContent = 'Das Holz brennt wieder. Der Knopf liegt in der Mitte.'
  }
  element('triangle-help').onclick = () => {
    dialog.showModal()
    updatePlayback()
  }
  dialog.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((button) => {
    button.onclick = () => dialog.close()
  })
  dialog.addEventListener('close', updatePlayback)
  document.addEventListener('visibilitychange', updatePlayback)
  refresh()

  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      document.removeEventListener('visibilitychange', updatePlayback)
      dialog.removeEventListener('close', updatePlayback)
      unbindFullscreen()
      instrument.dispose()
    })
}
