import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { factorPoint, readTriangle, TRIANGLE_CENTER } from '../src/triangle/experiment'
import { bindWoodFinish } from '../src/triangle/stove'

/** Model two wood tones, sharing one material with a section of the surrounding grate. */
function fixture() {
  const model = new Group()
  const wood = new Group()
  const bark = new MeshStandardMaterial({ color: 0x63452e })
  const grain = new MeshStandardMaterial({ color: 0xcd934e })
  const geometry = new BoxGeometry()
  const log = new Mesh(geometry, [bark, grain])
  const grate = new Mesh(geometry, bark)
  wood.position.set(0, 0.57, 0.06)
  wood.add(log)
  model.add(wood, grate)
  const finish = bindWoodFinish(model, wood)
  return { wood, log, grate, geometry, finish }
}

describe('fuel finish', () => {
  it('keeps the full log on the grate while making spent fuel visibly ashy', () => {
    const { wood, log, geometry, finish } = fixture()
    const fresh = log.material.map((material) => material.color.clone())
    const position = wood.position.clone()
    const scale = wood.scale.clone()
    finish(0.35)
    const charred = log.material.map((material) => material.color.clone())
    finish(0)
    for (const [index, material] of log.material.entries()) {
      const ash = material.color
      expect(charred[index].r).toBeLessThan(fresh[index].r)
      expect(ash.g).toBeGreaterThan(charred[index].g)
      expect(ash.r / ash.b).toBeLessThan(1.2)
      expect(material.opacity).toBe(1)
    }
    expect(log.material[1].color.r).toBeGreaterThan(log.material[0].color.r)
    expect(wood.position).toEqual(position)
    expect(wood.scale).toEqual(scale)
    expect(wood.visible && log.visible).toBe(true)
    expect(log.geometry).toBe(geometry)
  })

  it('isolates shared finishes and restores the original wood for heat and oxygen comparisons', () => {
    const { log, grate, finish } = fixture()
    const grateColor = grate.material.color.clone()
    const original = log.material.map((material) => material.color.clone())
    const samples = [factorPoint('heat', 1), factorPoint('oxygen', 1), TRIANGLE_CENTER]
    for (const point of samples) {
      finish(readTriangle(factorPoint('fuel', 1)).availability.fuel)
      expect(log.material[0].color).not.toEqual(original[0])
      expect(grate.material.color).toEqual(grateColor)
      finish(readTriangle(point).availability.fuel)
      expect(log.material.map((material) => material.color)).toEqual(original)
    }
  })
})
