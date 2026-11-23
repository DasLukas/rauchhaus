import { element } from '../ui/dom'
import { bindFullscreen } from '../ui/fullscreen'
import { icon } from '../ui/icons'
import { STOVE_START_ANGLE } from './experiment'
import { mountInstrument } from './instrument'
import { predictionLabels, type Prediction, TriangleSession } from './lesson'
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

function predictionPicture(choice: Prediction) {
  const wood =
    '<path d="m6 23 23-3 6 3-1 6-24 2-4-3z" fill="#ac6b42"/><path d="m7 24 5 2-1 5-5-3z" fill="#eabd7d"/><path d="m15 26 13-2" stroke="#6a472f" stroke-width="1.4" stroke-linecap="round"/>'
  const charcoal =
    '<path d="m6 25 8-2 5 1 8-3 7 2 2 4-6 2-15 2-9-2z" fill="#383432"/><path d="m10 25 4 1-2 3m10-6 2 2-3 3m8-5 2 1" fill="none" stroke="#999088" stroke-width="1.5" stroke-linecap="round"/>'
  const flame =
    '<path d="M18 22c-5-2-5-6-3-10 1 2 2 3 3 3-1-4 4-7 3-13 7 6 11 15 4 20z" fill="#dc601f"/><path d="M19 22c-2-3 3-5 3-9 4 5 4 8 1 9z" fill="#ffd354"/>'
  const fire =
    choice === 'steady'
      ? flame
      : choice === 'weak'
        ? `<g transform="translate(11 12) scale(.5)">${flame}</g>`
        : ''
  return `<svg viewBox="0 0 42 35" aria-hidden="true" focusable="false"><rect x="1" y="2" width="40" height="31" rx="5" fill="#f4e5cb"/><path d="M2 31h38" stroke="#846e51" stroke-width="2"/>${fire}${choice === 'charred' ? charcoal : wood}</svg>`
}

/** Mount the movable triangle and its optional guided wood-combustion comparisons. */
export function mountTriangle(root: HTMLElement) {
  root.innerHTML = `
    <header class="topbar triangle-topbar">
      <div class="triangle-identity">
        <a class="pill compact" href="./" aria-label="Zur Übersicht" title="Zur Übersicht">${icon('overview')}</a>
        <h1 class="brand" id="triangle-title"><svg viewBox="0 0 32 32" fill="none" stroke-width="4.5" stroke-linecap="round" aria-hidden="true"><path d="M16 4 3 27" stroke="#e36d4e"/><path d="M3 27h26" stroke="#e9a620"/><path d="M29 27 16 4" stroke="#008c84"/></svg>Verbrennungsdreieck</h1>
      </div>
      <nav aria-label="Lernen und Hilfe">
        <button class="pill" id="triangle-lesson" type="button" aria-label="Lernimpuls" title="Lernimpuls">${icon('bulb')}<span>Lernimpuls</span></button>
        <button class="pill compact" id="triangle-help" type="button" aria-label="Hilfe" title="Hilfe">${icon('help')}</button>
      </nav>
    </header>
    <div class="triangle-workspace">
      <div id="triangle-instrument"></div>
      <section id="triangle-study" aria-labelledby="triangle-study-heading" hidden>
        <div class="triangle-study-copy">
          <span id="triangle-progress"></span>
          <h2 id="triangle-study-heading" tabindex="-1"></h2>
          <p id="triangle-study-prompt"></p>
          <fieldset id="triangle-predictions" hidden><legend>Sag deine Vermutung oder wähle ein Bild.</legend><div id="triangle-choices"></div></fieldset>
          <details id="triangle-transfer" hidden><summary>Was ist der Brennstoff einer Kerze?</summary><p>Bei einer Kerze ist das Wachs der Brennstoff. Auch ihre Flamme braucht genügend Wärme und Sauerstoff.</p></details>
        </div>
        <div class="triangle-study-actions">
          <button class="action" id="triangle-next" type="button"><span id="triangle-next-label"></span>${icon('next')}</button>
          <button class="close compact" id="triangle-end" type="button" aria-label="Lernimpuls beenden" title="Lernimpuls beenden">${icon('close')}</button>
        </div>
      </section>
    </div>
    <footer class="toolbar" aria-label="Versuch und Ansicht">
      <div class="play-controls">
        <button class="pill" id="triangle-pause" type="button" aria-label="Pause" title="Pause"></button>
        <button class="pill" id="triangle-restart" type="button" aria-label="Neu starten" title="Neu starten">${icon('reset')}<span>Neu starten</span></button>
      </div>
      <div class="view-controls"><button id="fullscreen" class="pill compact" type="button" aria-label="Vollbild starten" title="Vollbild starten">${icon('expand')}</button></div>
      <div id="fullscreen-message" role="status"></div>
    </footer>
    <span class="sr-only" id="triangle-announcer" role="status"></span>
    <dialog id="sheet" aria-labelledby="triangle-help-title">${helpContent}</dialog>`

  const session = new TriangleSession()
  const lesson = element<HTMLButtonElement>('triangle-lesson')
  const pause = element<HTMLButtonElement>('triangle-pause')
  const next = element<HTMLButtonElement>('triangle-next')
  const nextLabel = element('triangle-next-label')
  const end = element<HTMLButtonElement>('triangle-end')
  const study = element('triangle-study')
  const heading = element('triangle-study-heading')
  const prompt = element('triangle-study-prompt')
  const progress = element('triangle-progress')
  const predictions = element('triangle-predictions')
  const choices = element('triangle-choices')
  const transfer = element<HTMLDetailsElement>('triangle-transfer')
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
    if (before !== session.phase) {
      refresh()
      announceStage()
      next.focus({ preventScroll: true })
    } else instrument.setPosition(session.position)
  })

  function updatePlayback() {
    const watchingCooling =
      session.phase === 'discuss' && session.comparison.factor === 'oxygen' && !session.firstStop
    const discussing =
      (session.phase === 'discuss' && !watchingCooling) ||
      session.phase === 'transfer' ||
      session.phase === 'result'
    instrument.setPaused(document.hidden || dialog.open || session.paused || discussing)
  }

  function refresh() {
    const { phase, comparison } = session
    const free = phase === 'free'
    study.hidden = free
    study.dataset.phase = phase
    study.dataset.factor = comparison.factor
    lesson.disabled = !free
    pause.hidden = !free
    const pauseLabel = session.paused ? 'Weiter' : 'Pause'
    pause.innerHTML = `${icon(session.paused ? 'play' : 'pause')}<span>${pauseLabel}</span>`
    pause.setAttribute('aria-label', pauseLabel)
    pause.title = pauseLabel
    instrument.setInteractive(free || phase === 'explore')
    instrument.setGuide(session.guide)
    instrument.setPosition(session.position)
    updatePlayback()
    predictions.hidden = phase !== 'predict'
    transfer.hidden = phase !== 'result'
    if (transfer.hidden) transfer.open = false
    if (free) return

    const review = phase === 'transfer' || phase === 'result'
    progress.textContent = review ? 'Zum Schluss' : `Versuch ${session.number} von ${session.total}`
    heading.textContent =
      phase === 'transfer'
        ? 'Was braucht das Holz zum Brennen?'
        : phase === 'result'
          ? 'Drei Dinge gehören zusammen'
          : comparison.title
    const copy = {
      predict: [comparison.prediction, 'Ausprobieren'],
      explore: [session.stop.direction, 'Beobachtung zeigen'],
      discuss: [
        session.stop.observation,
        session.hasAnotherStop
          ? 'Noch weniger Sauerstoff'
          : session.number === session.total
            ? 'Weiterdenken'
            : 'Nächster Versuch',
      ],
      transfer: [
        'Denk an die drei Versuche. Was fehlte dem Feuer jeweils? Erkläre es mit deinen eigenen Worten.',
        'Auflösung ansehen',
      ],
      result: [
        'Holz ist der Brennstoff. Seine Flammen brauchen auch Wärme und Sauerstoff. Das kalte Holz blieb braun. Am Ende der Brennzeit blieb ein dunkler Rest mit aschgrauen Streifen. Verkohltes Holz kann noch glühen.',
        'Weiter entdecken',
      ],
    }[phase]
    const previousChoice =
      phase === 'discuss' && session.firstStop && session.prediction
        ? `Du hast „${predictionLabels[session.prediction]}“ vermutet. `
        : ''
    prompt.textContent = previousChoice + copy[0]
    nextLabel.textContent = copy[1]
    if (phase === 'predict') {
      const buttons = comparison.choices.map((choice) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.dataset.choice = choice
        button.innerHTML = `${predictionPicture(choice)}<span>${predictionLabels[choice]}</span>`
        button.setAttribute('aria-pressed', String(session.prediction === choice))
        button.onclick = () => {
          session.choose(choice)
          for (const candidate of buttons)
            candidate.setAttribute(
              'aria-pressed',
              String(candidate.dataset.choice === session.prediction),
            )
        }
        return button
      })
      choices.replaceChildren(...buttons)
    }
  }

  function announceStage() {
    announcer.textContent = `${progress.textContent}. ${heading.textContent}. ${prompt.textContent}`
  }

  function leave() {
    session.end()
    instrument.setViewAngle(session.viewAngle)
    refresh()
    restorePlayback?.()
    restorePlayback = undefined
    lesson.focus()
    announcer.textContent = 'Zurück in deinem freien Versuch.'
  }

  lesson.onclick = () => {
    restorePlayback = instrument.capturePlayback()
    session.begin(instrument.getViewAngle())
    instrument.setViewAngle(STOVE_START_ANGLE)
    refresh()
    heading.focus()
    announceStage()
  }
  next.onclick = () => {
    if (session.phase === 'result') {
      leave()
      return
    }
    session.next()
    instrument.setViewAngle(STOVE_START_ANGLE)
    refresh()
    announceStage()
    if (session.phase === 'explore') {
      root.querySelector<HTMLButtonElement>('.triangle-knob')?.focus()
    }
  }
  end.onclick = leave
  pause.onclick = () => {
    session.togglePause()
    refresh()
  }
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
