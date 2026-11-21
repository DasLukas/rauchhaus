import { createHouseScene } from '../src/scene'
import { SmokeSimulation } from '../src/simulation'
import { Markers } from '../src/ui/markers'

/** Mount the production scene and return a selector for two matched laundry experiments. */
export async function mount() {
  const simulation = new SmokeSimulation()
  const markers = new Markers(document.querySelector('#markers'), () => {})
  await createHouseScene(document.querySelector('#viewport'), {
    onFrame: () => simulation.snapshot(),
    onProject: (positions) => markers.project(positions),
    onActivate() {},
    onError(error) {
      throw error
    },
  })
  return (open) => {
    simulation.setDoor('dbr', open)
    simulation.start('s_washer')
    simulation.advance(32)
    const snapshot = simulation.snapshot()
    markers.update(snapshot, false)
    return snapshot.detectors.m_laundry
  }
}
