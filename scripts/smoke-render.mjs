import { createHouseScene } from '../src/scene'
import { SmokeSimulation } from '../src/simulation'
import { Markers } from '../src/ui/markers'

/** Render repeatable classroom experiments with the production scene and model clock. */
export async function mount() {
  const simulation = new SmokeSimulation()
  const markers = new Markers(document.querySelector('#markers'), () => {})
  const scene = await createHouseScene(document.querySelector('#viewport'), {
    onFrame: () => simulation.snapshot(),
    onProject: (positions) => markers.project(positions),
    onActivate() {},
    onError(error) {
      throw error
    },
  })
  return {
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
      simulation.start('s_tv')
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
