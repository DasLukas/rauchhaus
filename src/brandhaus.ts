import { createHouseScene, type HouseScene } from './scene'
import { CLASSROOM_SOURCES, DETECTORS, DOORS, FLOORS, HOUSE_VARIANT, ROOMS } from './simulation'
import { bindLessonHint } from './ui/lesson-hint'
import { AlarmSound } from './ui/alarm'
import { element } from './ui/dom'
import { bindFullscreen } from './ui/fullscreen'
import { icon } from './ui/icons'
import { mountLayout, setButton } from './ui/layout'
import { Markers } from './ui/markers'
import { showPanel, type LessonViews, type PanelKind } from './ui/panels'
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
const nextButton = element<HTMLButtonElement>('trial-next')
const progressBar = element('trial-progress')
let lastPercent = -1
const pause = element<HTMLButtonElement>('pause')
const restart = element<HTMLButtonElement>('restart')
const lesson = element<HTMLButtonElement>('lesson')
const hint = bindLessonHint(lesson, 'brandhaus')
const loading = element('load-state')
let scene: HouseScene | undefined
let views: LessonViews = {}
let modal = false
let detectorState = ''
let ready = false

function announce(message: string) {
  element('announcer').textContent = message
}

const fireSteps = {
  rollover: {
    name: '1 von 2 · Unter der Decke',
    prompt: 'Wo flackert es über dem Fernseher?',
    observation: 'Im Rauch unter der Decke flackern Flammen.',
    next: 'Weiter beobachten',
  },
  flashover: {
    name: '2 von 2 · Im ganzen Zimmer',
    prompt: HOUSE_VARIANT === 'klein' ? 'Was steigt über dem Sofa auf?' : 'Was steigt über dem Sessel auf?',
    observation: 'Jetzt brennt es im ganzen Zimmer.',
    next: 'Versuch besprechen',
  },
}

function updateTrialTimer() {
  const progress = session.trialProgress
  const percent = progress === null || progress >= 1 ? -1 : Math.floor(progress * 100)
  if (percent === lastPercent) return
  lastPercent = percent
  nextButton.classList.toggle('timed', percent >= 0)
  progressBar.hidden = percent < 0
  if (percent >= 0) {
    nextButton.style.setProperty('--timer-offset', String(1 - percent / 100))
    progressBar.setAttribute('aria-valuenow', String(percent))
  }
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
  const showingTransition = session.showingOutgassing && !session.trialFinished
  updateTrialTimer()
  nextButton.disabled = showingTransition
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
        ? 'Mit geschlossener Tür testen'
        : 'Versuch besprechen'
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
  announce('Jetzt kannst du das Haus selbst erkunden.')
}

function openPanel(kind: PanelKind) {
  if (modal) return
  modal = true
  updateAlarm()
  showPanel(kind, (selected) => {
    modal = false
    if (selected) {
      views = {}
      session.beginLesson(selected)
      hint.started()
      if (selected === 'fire') {
        const room = ROOMS.find((room) => room.id === 'living')
        if (room) scene?.focusFloor(room.floor, (room.minX + room.maxX) / 2)
        announce('Schau über den brennenden Fernseher.')
      } else {
        scene?.resetView()
        announce('Die Wohnungstür ist offen. Wohin zieht der Rauch?')
      }
    } else if (kind === 'result' || kind === 'fireResult') endLesson()
    refresh()
    if (selected) nextButton.focus({ preventScroll: true })
  }, views)
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
    announce(`${source.label}. Der Versuch beginnt.`)
  }
  refresh()
}

nextButton.onclick = () => {
  if (!session.trialFinished) {
    session.finishTrial()
    if (session.trialFinished) announce(session.fireObservation ? fireObservationAnnouncement() : 'Der Versuch hält an.')
    else announce(fireSteps.flashover.prompt)
  } else {
    if (scene && (session.stage === 'open' || session.stage === 'closed')) {
      views[session.stage] = scene.captureRoom(session.snapshot, 'stair1')
    } else if (scene && session.stage === 'flashover') {
      if (session.outgassingSnapshot) views.outgassing = scene.captureRoom(session.outgassingSnapshot, 'living')
      views.flashover = scene.captureRoom(session.snapshot, 'living')
    }
    session.nextTrial()
    if (session.stage === 'compare') openPanel('result')
    else if (session.stage === 'fire-result') openPanel('fireResult')
    else if (session.fireObservation) announce(fireSteps.flashover.prompt)
    else announce('Jetzt ist die Wohnungstür zu. Wohin zieht der Rauch?')
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
  announce('Neuer Start. Das Haus ist rauchfrei.')
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
    '<strong>Das Haus konnte nicht geladen werden.</strong><span>Versuche es noch einmal.</span><button type="button" class="action">Erneut laden</button>'
  loading.querySelector('button')?.addEventListener('click', () => location.reload())
}

function fireObservationAnnouncement() {
  return session.fireObservation === 'rollover'
    ? 'Pause. Im Rauch unter der Decke flackern Flammen.'
    : 'Pause. Jetzt brennen auch die Möbel.'
}

async function start() {
  refresh()
  scene = await createHouseScene(element('viewport'), {
    onFrame(dt) {
      const wasDone = session.trialFinished
      const state = document.hidden || modal ? session.snapshot : session.tick(Math.min(dt, 0.2))
      updateTrialTimer()
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
      announce(floor ? `${floor.label}.` : 'Das ganze Haus ist sichtbar.')
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
  hint.dispose()
  document.removeEventListener('visibilitychange', updateAlarm)
  unbindFullscreen()
  alarm.dispose()
  scene?.dispose()
})
