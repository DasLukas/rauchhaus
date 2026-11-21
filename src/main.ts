import './style.css'
import { createHouseScene, type HouseScene } from './scene'
import { DETECTORS, DOORS, SOURCES } from './simulation'
import { element, mountLayout, setButton } from './ui/layout'
import { Markers } from './ui/markers'
import { showPanel, type PanelKind } from './ui/panels'
import { LearningSession } from './ui/session'

const app = element('app')
mountLayout(app)
const session = new LearningSession()
const markers = new Markers(element('markers'), activate)
const trial = element('trial')
const pause = element<HTMLButtonElement>('pause')
const restart = element<HTMLButtonElement>('restart')
const lesson = element<HTMLButtonElement>('lesson')
const loading = element('load-state')
let scene: HouseScene | undefined
let modal = false
let detectorState = ''
let ready = false

function announce(message: string) {
  element('announcer').textContent = message
}

function refresh() {
  const state = session.snapshot
  markers.update(state, Boolean(session.stage))
  setButton(pause, session.paused ? 'play' : 'pause', session.paused ? 'Weiter' : 'Pause')
  pause.disabled = !ready || !state.source || session.trialFinished
  restart.disabled = !ready || !state.source || session.stage === 'compare'
  lesson.disabled = !ready
  lesson.setAttribute('aria-expanded', String(Boolean(session.stage)))
  app.classList.toggle('learning', Boolean(session.stage))
  trial.hidden = !session.stage || session.stage === 'compare'
  if (!trial.hidden) {
    const first = session.stage === 'open'
    const finished = session.trialFinished
    const action = finished
      ? first
        ? 'Türvergleich starten'
        : 'Vergleich abschließen'
      : 'Ergebnis ansehen'
    element('trial-name').textContent = first ? '1 von 2 · Tür offen' : '2 von 2 · Tür geschlossen'
    element('trial-action').textContent = action
  }
}

function endLesson() {
  session.endLesson()
  scene?.resetView()
  refresh()
  lesson.focus({ preventScroll: true })
  announce('Du kannst wieder frei entdecken.')
}

function openPanel(kind: PanelKind) {
  if (modal) return
  modal = true
  showPanel(kind, (start) => {
    modal = false
    if (start) {
      scene?.resetView()
      session.beginLesson()
      announce('Erster Versuch mit offener Wohnungstür.')
    } else if (kind === 'result') endLesson()
    refresh()
  })
}

function activate(id: string) {
  if (!ready || modal || session.stage) return
  const door = DOORS.find((item) => item.id === id)
  const source = SOURCES.find((item) => item.id === id)
  if (door) {
    session.toggleDoor(door.id)
    announce(door.label + (session.snapshot.doors[door.id] ? ' offen.' : ' geschlossen.'))
  } else if (source) {
    session.selectSource(source.id)
    announce(`Rauchversuch gestartet. ${source.label}.`)
  }
  refresh()
}

element('trial-next').onclick = () => {
  if (!session.trialFinished) {
    session.finishTrial()
    announce('Beobachtung beendet.')
  } else {
    session.nextTrial()
    if (session.stage === 'compare') openPanel('result')
    else announce('Zweiter Versuch mit geschlossener Wohnungstür.')
  }
  refresh()
}
element('trial-end').onclick = endLesson
element('help').onclick = () => openPanel('help')
lesson.onclick = () => (session.stage ? endLesson() : openPanel('intro'))
pause.onclick = () => {
  session.togglePause()
  refresh()
}
restart.onclick = () => {
  session.restart()
  announce('Der Versuch beginnt von vorn.')
  refresh()
}
element('out').onclick = () => scene?.zoomBy(1 / 1.25)
element('in').onclick = () => scene?.zoomBy(1.25)
element('home').onclick = () => scene?.resetView()

function showError() {
  ready = false
  refresh()
  loading.hidden = false
  loading.setAttribute('role', 'alert')
  loading.innerHTML =
    '<strong>Das 3D-Haus konnte nicht geladen werden.</strong><span>Prüfe die Verbindung und verwende einen Browser mit WebGL 2.</span><button type="button" class="action">Erneut laden</button>'
  loading.querySelector('button')?.addEventListener('click', () => location.reload())
}

async function start() {
  refresh()
  scene = await createHouseScene(element('viewport'), {
    onFrame(dt) {
      const wasDone = session.trialFinished
      const state = document.hidden || modal ? session.snapshot : session.tick(Math.min(dt, 0.2))
      const alarms = DETECTORS.filter((d) => state.detectors[d.id])
      const signature = alarms.map((d) => d.id).join(',')
      if (signature !== detectorState) {
        detectorState = signature
        markers.update(state, Boolean(session.stage))
        if (alarms.length) announce(`Rauch erkannt. ${alarms.map((d) => d.label).join(', ')}.`)
      }
      if (!wasDone && session.trialFinished) refresh()
      return state
    },
    onProject: (positions) => markers.project(positions),
    onActivate: activate,
    onError: showError,
  })
  ready = true
  loading.hidden = true
  refresh()
}
void start().catch(showError)
if (import.meta.hot) import.meta.hot.dispose(() => scene?.dispose())
