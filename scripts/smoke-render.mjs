import { createHouseScene } from '../src/scene'
import { HOUSE, SmokeSimulation } from '../src/simulation'
import { Markers } from '../src/ui/markers'
import { LearningSession } from '../src/ui/session'

/** Render repeatable classroom experiments with the production scene and model clock. */
export async function mount() {
  const simulation = new SmokeSimulation()
  let observation = null
  let rolloverStop
  const markers = new Markers(document.querySelector('#markers'), () => {})
  const scene = await createHouseScene(document.querySelector('#viewport'), {
    onFrame: () => observation ?? simulation.snapshot(),
    onProject: (positions, floor) => markers.project(positions, floor),
    canActivate: () => false,
    onActivate() {},
    onError(error) {
      throw error
    },
  })
  return {
    fireObservation(phase) {
      const lesson = new LearningSession()
      lesson.beginLesson('fire')
      scene.focusFloor(1, -2.9)
      if (phase === 'local') lesson.tick(2)
      else {
        lesson.finishTrial()
        if (phase === 'flashover') {
          lesson.nextTrial()
          lesson.finishTrial()
          lesson.tick(60)
        }
      }
      observation = lesson.snapshot
      if (phase === 'rollover') rolloverStop = observation
      return observation.fire.phase
    },
    freeFire(sourceId) {
      const session = new LearningSession()
      session.selectSource(sourceId)
      const source = HOUSE.classroomSources.find((item) => item.id === sourceId)
      const room = HOUSE.rooms.find((item) => item.id === source.room)
      scene.focusFloor(room.floor, (room.minX + room.maxX) / 2)
      // Inspect the source before the descending smoke layer obscures it.
      observation = session.tick(2)
      return observation.fire.phase
    },
    gasFrame({ elapsed = rolloverStop.elapsed, burstSeed = rolloverStop.fire.burstSeed, deep = false } = {}) {
      // Hold the room and ventilation at the lesson stop so each paired image
      // isolates gas emission. Move the interface down for the floor regression.
      let rooms = rolloverStop.rooms
      if (deep) {
        const floorY = HOUSE.rooms.find((room) => room.id === 'living').floorY
        rooms = { ...rooms, living: { ...rooms.living, layerBaseY: floorY + 0.10 } }
      }
      observation = {
        ...rolloverStop,
        rooms,
        elapsed,
        fire: { ...rolloverStop.fire, burstSeed, sourceIntensity: 0, involvement: 0 },
      }
    },
    showSurfaceFlamesOnly() {
      // Isolate emission from exposed furnishings, retaining the complete smoke state.
      observation = {
        ...observation,
        fire: { ...observation.fire, sourceIntensity: 0, rollover: 0 },
      }
    },
    hideFlames() {
      // Preserve the lit room's smoke shader, plume and clock for a pixel-matched reference.
      observation = {
        ...observation,
        fire: { ...observation.fire, sourceIntensity: 0, rollover: 0, involvement: 0 },
      }
    },
    startKettle(apartmentOpen) {
      simulation.setDoor('d0l', apartmentOpen)
      simulation.start('s_kettle')
    },
    laundry(open) {
      simulation.setDoor('dbr', open)
      simulation.start('s_washer')
      simulation.advance(32)
      return simulation.snapshot().detectors.m_laundry
    },
    television(seconds, openAt) {
      scene.focusFloor(1, -3.5)
      simulation.setDoor('i1', false)
      // The clear reference is the room before the television is selected.
      if (seconds === 0) simulation.reset()
      else simulation.start('s_tv')
      simulation.advance(Math.min(seconds, openAt))
      if (seconds >= openAt) {
        simulation.setDoor('i1', true)
        simulation.advance(seconds - openAt)
      }
    },
    startDesk(atticOpen, playroomOpen = true) {
      simulation.setDoor('i2', true)
      simulation.setDoor('d2', playroomOpen)
      simulation.setDoor('d3', atticOpen)
      simulation.start('s_desk')
    },
    setAtticDoor(open) {
      simulation.setDoor('d3', open)
    },
    advance(seconds) {
      // Each call to the production clock represents at most one active minute.
      for (let left = seconds; left > 0; left -= 60) simulation.advance(Math.min(left, 60))
      return simulation.snapshot().elapsed
    },
    view(floor) {
      if (floor === null) scene.resetView()
      else scene.focusFloor(floor)
    },
  }
}
