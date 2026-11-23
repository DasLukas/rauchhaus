import { createHouseScene, type HouseScene } from './scene'
import { CLASSROOM_SOURCES, DETECTORS, DOORS, FLOORS, HOUSE_VARIANT, ROOMS } from './simulation'
import { pageForSearch } from './navigation'
import { AlarmSound } from './ui/alarm'
import { element } from './ui/dom'
import { bindFullscreen } from './ui/fullscreen'
import { icon } from './ui/icons'
import { mountLayout, setButton } from './ui/layout'
import { Markers } from './ui/markers'
import { showPanel, type PanelKind } from './ui/panels'
import { LearningSession } from './ui/session'

const app = element('app')
mountLayout(app)
const session = new LearningSession()
const arrival = new URL(location.href)
if (arrival.searchParams.has('feuer')) {
  arrival.searchParams.delete('feuer')
  arrival.searchParams.set('modul', 'brandhaus')
  history.replaceState(history.state, '', arrival)
}
const markers = new Markers(element('markers'), activate)
const alarm = new AlarmSound()
const sound = element<HTMLButtonElement>('sound')
const markerLayer = element('markers')
const trial = element('trial')
const pause = element<HTMLButtonElement>('pause')
const restart = element<HTMLButtonElement>('restart')
const lesson = element<HTMLButtonElement>('lesson')
const previousPage = document.referrer ? new URL(document.referrer) : null
const fromApp = previousPage?.origin === arrival.origin &&
  new URL('.', previousPage).href === new URL('.', arrival).href
const previousModule = fromApp ? pageForSearch(previousPage.search) : null
const hintKey = 'brandhaus-lesson-hint'
function updateLessonHint() {
  let highlight = previousModule === 'dashboard'
  try {
    const state = sessionStorage.getItem(hintKey)
    highlight = state !== 'started' && (highlight || (previousModule === 'brandhaus' && state === 'pending'))
    if (highlight) sessionStorage.setItem(hintKey, 'pending')
  } catch { /* The hint also works for this visit when storage is unavailable. */ }
  lesson.classList.toggle('highlight-bulb', highlight)
}
updateLessonHint()
window.addEventListener('pageshow', updateLessonHint)
const loading = element('load-state')
let scene: HouseScene | undefined
let modal = false
let detectorState = ''
let ready = false

function announce(message: string) {
  element('announcer').textContent = message
}

const fireSteps = {
  rollover: {
    name: '1 von 2 · Unter der Decke',
    prompt: 'Wo siehst du Flammen, obwohl dort kein Möbelstück brennt?',
    observation: 'Zwei Flammenzungen unter der Rauchschicht.',
    next: 'Weiter beobachten',
  },
  flashover: {
    name: '2 von 2 · Im ganzen Zimmer',
    prompt: HOUSE_VARIANT === 'klein' ? 'Schau auf das rote Sofa. Was siehst du vor den Flammen?' : 'Schau auf den Sessel. Was siehst du vor den Flammen?',
    observation: 'Jetzt brennt es im ganzen Zimmer (Flashover).',
    next: 'Beobachtung besprechen',
  },
}

function refresh() {
  const state = session.snapshot
  markers.update(state, session.lesson)
  setButton(pause, session.paused ? 'play' : 'pause', session.paused ? 'Weiter' : 'Pause')
  pause.disabled = !ready || !state.source || session.trialFinished
  restart.disabled = !ready
  sound.setAttribute('aria-pressed', String(alarm.enabled))
  sound.innerHTML = icon(alarm.enabled ? 'sound' : 'muted')
  sound.title = alarm.enabled ? 'Alarmton ausschalten' : 'Alarmton einschalten'
  updateAlarm()
  lesson.disabled = !ready
  lesson.setAttribute('aria-expanded', String(Boolean(session.stage)))
  app.classList.toggle('learning', Boolean(session.stage))
  trial.hidden = !session.stage || session.stage === 'compare' || session.stage === 'fire-result'
  const showingTransition = session.showingUpholstery && !session.trialFinished
  element<HTMLButtonElement>('trial-next').disabled = showingTransition
  if (session.fireObservation) {
    const step = fireSteps[session.fireObservation]
    const done = session.trialFinished
    element('trial-name').textContent = step.name
    element('trial-hint').textContent = done ? step.observation : step.prompt
    element('trial-action').textContent = done ? step.next : showingTransition ? 'Beobachtung läuft' : 'Beobachtung zeigen'
  } else if (!trial.hidden) {
    const first = session.stage === 'open'
    const finished = session.trialFinished
    const action = finished
      ? first
        ? 'Türvergleich starten'
        : 'Vergleich abschließen'
      : 'Ergebnis ansehen'
    element('trial-name').textContent = first ? '1 von 2 · Tür offen' : '2 von 2 · Tür geschlossen'
    element('trial-hint').textContent = `Schau ins Treppenhaus ${HOUSE_VARIANT === 'klein' ? 'rechts' : 'in der Mitte'}.`
    element('trial-action').textContent = action
  }
}

function updateAlarm() {
  const state = session.snapshot
  const active = ready && Object.values(state.detectors).some(Boolean)
  const pulse = active && state.elapsed % 1.2 < 0.3
  markerLayer.classList.toggle('pulse', session.paused ? active : pulse)
  alarm.update(pulse && !session.paused && !modal && !document.hidden)
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
  updateAlarm()
  showPanel(kind, (selected) => {
    modal = false
    if (selected) {
      session.beginLesson(selected)
      lesson.classList.remove('highlight-bulb')
      try {
        sessionStorage.setItem(hintKey, 'started')
      } catch { /* The highlight has already stopped for this visit. */ }
      if (selected === 'fire') {
        const room = ROOMS.find((room) => room.id === 'living')
        if (room) scene?.focusFloor(room.floor, (room.minX + room.maxX) / 2)
        announce('Beobachte das Feuer am Fernseher und die Decke darüber.')
      } else {
        scene?.resetView()
        announce('Erster Versuch mit offener Wohnungstür.')
      }
    } else if (kind === 'result' || kind === 'fireResult') endLesson()
    refresh()
    if (selected) element('trial-next').focus({ preventScroll: true })
  })
}

function activate(id: string) {
  if (!ready || modal || session.stage) return
  const door = DOORS.find((item) => item.id === id)
  const source = CLASSROOM_SOURCES.find((item) => item.id === id)
  if (door) {
    session.toggleDoor(door.id)
    announce(door.label + (session.snapshot.doors[door.id] ? ' offen.' : ' geschlossen.'))
  } else if (source) {
    if (!session.selectSource(source.id)) return
    announce(`${source.label}. Der Brandversuch startet.`)
  }
  refresh()
}

element('trial-next').onclick = () => {
  if (!session.trialFinished) {
    session.finishTrial()
    if (session.trialFinished) announce(session.fireObservation ? fireObservationAnnouncement() : 'Beobachtung beendet.')
    else announce(fireSteps.flashover.prompt)
  } else {
    session.nextTrial()
    if (session.stage === 'compare') openPanel('result')
    else if (session.stage === 'fire-result') openPanel('fireResult')
    else if (session.fireObservation) announce(fireSteps.flashover.prompt)
    else announce('Zweiter Versuch mit geschlossener Wohnungstür.')
  }
  refresh()
}
element('trial-end').onclick = endLesson
element('help').onclick = () => openPanel('help')
lesson.onclick = () => (session.stage ? endLesson() : openPanel('lessons'))
pause.onclick = () => {
  session.togglePause()
  refresh()
}
restart.onclick = () => {
  session.restart()
  scene?.resetView()
  announce('Haus zurückgesetzt. Alle Räume sind rauchfrei.')
  refresh()
}
sound.onclick = () => {
  alarm.toggle()
  refresh()
}
document.addEventListener('visibilitychange', updateAlarm)
element('out').onclick = () => scene?.zoomBy(1 / 1.25)
element('in').onclick = () => scene?.zoomBy(1.25)
element('home').onclick = () => scene?.resetView()
const unbindFullscreen = bindFullscreen(element<HTMLButtonElement>('fullscreen'), element('fullscreen-message'))

function showError() {
  ready = false
  refresh()
  loading.hidden = false
  loading.setAttribute('role', 'alert')
  loading.innerHTML =
    '<strong>Das 3D-Haus konnte nicht geladen werden.</strong><span>Prüfe die Verbindung und verwende einen Browser mit WebGL 2.</span><button type="button" class="action">Erneut laden</button>'
  loading.querySelector('button')?.addEventListener('click', () => location.reload())
}

function fireObservationAnnouncement() {
  return session.fireObservation === 'rollover'
    ? 'Im heißen Rauch unter der Decke sind zwei Flammenzungen aufgeflammt. Der Versuch pausiert.'
    : 'Raumdurchzündung. Im Zimmer brennen jetzt auch die Möbel und die Pflanze. Der Versuch pausiert.'
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
        markers.update(state, session.lesson)
        if (alarms.length) announce(`Rauch erkannt. ${alarms.map((d) => d.label).join(', ')}.`)
      }
      updateAlarm()
      if (!wasDone && session.trialFinished) {
        refresh()
        if (session.fireObservation) announce(fireObservationAnnouncement())
      }
      return state
    },
    onProject: (positions) => markers.project(positions),
    onFloorChange(level) {
      const floor = FLOORS.find((floor) => floor.level === level)
      announce(floor ? `Du erkundest jetzt das ${floor.label}.` : 'Das ganze Haus ist sichtbar.')
    },
    onActivate: activate,
    onError: showError,
  })
  ready = true
  loading.hidden = true
  refresh()
}
void start().catch(showError)
if (import.meta.hot) import.meta.hot.dispose(() => {
  window.removeEventListener('pageshow', updateLessonHint)
  document.removeEventListener('visibilitychange', updateAlarm)
  unbindFullscreen()
  alarm.dispose()
  scene?.dispose()
})
