import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, type Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { factorPoint, readTriangle, TRIANGLE_CENTER } from '../src/triangle/experiment'
import { bindFuel } from '../src/triangle/fuel'

function bounds(object: Object3D) {
  object.updateWorldMatrix(true, false)
  return new Box3().setFromObject(object)
}

/** The fixture rests on the ash pan, with a flame root on top and seams on the wood. */
function fixture() {
  const model = new Group()
  const wood = new Group()
  const embers = new Group()
  const flames = new Group()
  const bark = new MeshStandardMaterial({ color: 0x63452e })
  const grain = new MeshStandardMaterial({ color: 0xcd934e })
  const geometry = new BoxGeometry(2, 0.5, 0.5)
  const log = new Mesh(geometry, [bark, grain])
  const grate = new Mesh(geometry, bark)
  wood.position.set(0, 0.536, 0.06)
  embers.position.copy(wood.position)
  flames.position.set(0, 0.786, 0.06)
  const seam = new Mesh(geometry, new MeshStandardMaterial())
  embers.add(seam)
  wood.add(log)
  model.add(wood, embers, flames, grate)
  const setFuel = bindFuel(model, wood, embers, flames)
  const ash = model.getObjectByName('Spent wood ash')
  const cap = model.getObjectByName('Charred burn surface')
  if (!ash || !(cap instanceof Mesh)) throw new Error('Missing ash or char in stove fixture')
  return { model, wood, seam, flames, log, grate, ash, cap, setFuel }
}

describe('fuel consumption', () => {
  it('consumes the top layers in place and keeps the flames on the exposed charcoal', () => {
    const { wood, seam, flames, log, ash, cap, setFuel } = fixture()
    const fresh = log.material.map((material) => material.color.clone())
    setFuel(1)
    const original = bounds(wood)
    expect(ash.visible).toBe(false)
    expect(setFuel(0.35)).toBe(true)
    expect(setFuel(0.35)).toBe(false)
    expect(bounds(wood)).toEqual(original)
    const plane = log.material[0].clippingPlanes?.[0]
    if (!plane) throw new Error('Expected a burn surface clipping the log')
    const height = original.min.y + 0.35 * (original.max.y - original.min.y)
    expect(plane.distanceToPoint(new Vector3(0, height, 0))).toBeCloseTo(0)
    expect(plane.distanceToPoint(original.max)).toBeLessThan(0)
    expect(plane.distanceToPoint(original.min)).toBeGreaterThan(0)
    expect(seam.material.clippingPlanes?.[0]).toBe(plane)
    expect(log.material[0].clipShadows).toBe(true)
    expect(flames.position.y).toBeCloseTo(height)
    expect(cap.visible).toBe(true)
    const capPoints = cap.geometry.getAttribute('position')
    const face = new Box3()
    for (let i = 0; i < cap.geometry.drawRange.count; i++) {
      face.expandByPoint(new Vector3().fromBufferAttribute(capPoints, i))
    }
    expect(face.max.y).toBeCloseTo(height)
    expect(face.min.x).toBeCloseTo(original.min.x)
    expect(face.max.x).toBeCloseTo(original.max.x)
    expect(face.min.z).toBeCloseTo(original.min.z)
    expect(face.max.z).toBeCloseTo(original.max.z)
    for (const [index, material] of log.material.entries()) {
      expect(material.color.r).toBeLessThan(fresh[index].r)
    }
    const almostSpent = readTriangle(factorPoint('fuel', 0.9))
    expect(almostSpent.flame).toBe(0)
    setFuel(almostSpent.availability.fuel)
    expect(ash.visible).toBe(true)
    expect(ash.scale.x).toBeGreaterThan(0)
  })

  it('leaves an ash deposit at full burnout and restores the wood for heat and oxygen trials', () => {
    const { model, wood, flames, log, grate, ash, cap, setFuel } = fixture()
    const grateColor = grate.material.color.clone()
    const original = log.material.map((material) => material.color.clone())
    setFuel(1)
    const fullSize = bounds(wood)
    const samples = [factorPoint('heat', 1), factorPoint('oxygen', 1), TRIANGLE_CENTER]
    for (const point of samples) {
      setFuel(readTriangle(factorPoint('fuel', 1)).availability.fuel)
      const visible = new Set()
      model.traverseVisible((part) => visible.add(part))
      expect(visible.has(log)).toBe(false)
      expect(visible.has(cap)).toBe(false)
      expect(visible.has(ash.children[0])).toBe(true)
      const residue = bounds(ash)
      expect(residue.max.y).toBeGreaterThan(fullSize.min.y)
      expect(residue.max.y).toBeLessThan(fullSize.max.y)
      expect(residue.max.x - residue.min.x).toBeLessThan(fullSize.max.x - fullSize.min.x)
      expect(grate.material.color).toEqual(grateColor)
      setFuel(readTriangle(point).availability.fuel)
      expect(bounds(wood)).toEqual(fullSize)
      expect(flames.position.y).toBeCloseTo(fullSize.max.y)
      expect(cap.visible).toBe(false)
      expect(log.material[0].clippingPlanes?.[0].distanceToPoint(fullSize.max)).toBeGreaterThan(0)
      expect(grate.material.clippingPlanes).toBeNull()
      expect(ash.visible).toBe(false)
      expect(log.material.map((material) => material.color)).toEqual(original)
    }
  })
})
