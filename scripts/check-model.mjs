import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync, zstdDecompressSync } from 'node:zlib'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'
import { DETECTORS, DOORS, ROOMS, SOURCES, roofHeightAt } from '../src/simulation/house.ts'

const readAsset = (path) => readFileSync(new URL(path, import.meta.url))
const source = readAsset('../assets/blender/rauchhaus.blend')
const signature = source.readUInt32LE()
let blend = source
if (signature === 0xfd2fb528) blend = zstdDecompressSync(source)
else if (source.readUInt16LE() === 0x8b1f) blend = gunzipSync(source)
assert.equal(blend.toString('ascii', 0, 7), 'BLENDER', 'Editable source must be a Blender file')

const bytes = readAsset('../public/models/rauchhaus.glb')
assert(bytes.length <= 8 * 1024 * 1024, 'Keep the downloaded model within its 8 MiB budget')
assert.equal(bytes.toString('ascii', 0, 4), 'glTF', 'Missing GLB header')
assert.equal(bytes.readUInt32LE(4), 2, 'Expected GLB 2')
assert.equal(bytes.readUInt32LE(8), bytes.length, 'Truncated GLB')
assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, 'First GLB chunk must be JSON')
const bin = 20 + bytes.readUInt32LE(12)
const gltf = JSON.parse(bytes.toString('utf8', 20, bin))
assert.equal(gltf.asset.version, '2.0')
assert.equal(bytes.readUInt32LE(bin + 4), 0x004e4942, 'Missing embedded binary')
assert.equal(bin + 8 + bytes.readUInt32LE(bin), bytes.length, 'Invalid binary length')
assert(gltf.buffers[0].byteLength <= bytes.readUInt32LE(bin), 'Truncated geometry buffer')
for (const resource of [...gltf.buffers, ...(gltf.images ?? [])]) {
  assert(!resource.uri || resource.uri.startsWith('data:'), 'The model must be self-contained')
}
for (const view of gltf.bufferViews) {
  assert(
    (view.byteOffset ?? 0) + view.byteLength <= gltf.buffers[view.buffer].byteLength,
    'A buffer view extends beyond its buffer',
  )
}

const scene = gltf.scenes[gltf.scene ?? 0]
const names = new Map()
const visited = new Set()
let triangles = 0
let draws = 0

// glTF accessors retain counts and POSITION bounds for indexed, unindexed and
// compressed geometry. The verifier needs no graphics context or asset decoder.
function inspect(index, parent) {
  assert(!visited.has(index), 'Scene graph contains a cycle or shared node')
  visited.add(index)
  const node = gltf.nodes[index]
  assert(node, 'Scene refers to a missing node')
  const transform = node.matrix
    ? new Matrix4().fromArray(node.matrix)
    : new Matrix4().compose(
        new Vector3(...(node.translation ?? [0, 0, 0])),
        new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
        new Vector3(...(node.scale ?? [1, 1, 1])),
      )
  const world = parent.clone().multiply(transform)
  assert(world.elements.every(Number.isFinite), `Invalid transform for ${node.name}`)
  const bounds = new Box3()
  if (node.mesh !== undefined) {
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const position = gltf.accessors[primitive.attributes.POSITION]
      assert(position?.type === 'VEC3' && position.count > 0, 'Missing position accessor')
      assert(
        [position.min, position.max].every((v) => v?.length === 3 && v.every(Number.isFinite)),
        'Missing or nonfinite mesh bounds',
      )
      const box = new Box3(new Vector3(...position.min), new Vector3(...position.max))
      assert(!box.isEmpty(), 'Invalid mesh bounds')
      bounds.union(box.applyMatrix4(world))
      const count =
        primitive.indices === undefined ? position.count : gltf.accessors[primitive.indices].count
      const mode = primitive.mode ?? 4
      assert([4, 5, 6].includes(mode), 'The model should consist of triangle surfaces')
      const faces = mode === 4 ? count / 3 : count - 2
      assert(Number.isSafeInteger(faces) && faces > 0, 'Invalid primitive count')
      triangles += faces
      draws++
    }
  }
  for (const child of node.children ?? []) bounds.union(inspect(child, world))
  if (node.name) {
    assert(!names.has(node.name), `Duplicate node name: ${node.name}`)
    names.set(node.name, { node, point: new Vector3().setFromMatrixPosition(world), bounds })
  }
  return bounds
}

for (const root of scene.nodes) inspect(root, new Matrix4())
assert(
  triangles > 0 && triangles <= 250_000,
  'The mobile scene exceeds its 250,000-triangle budget',
)
assert(draws > 0 && draws <= 48, 'The mobile scene exceeds its 48 surface draw-call budget')

function named(name) {
  const entry = names.get(name)
  assert(entry, `Missing reachable model node: ${name}`)
  return entry
}
const anchors = [...DOORS, ...SOURCES, ...DETECTORS]
assert.equal(
  [...names.keys()].filter((name) => name.startsWith('anchor_')).length,
  anchors.length,
  'Exported interaction anchors and the simulation definitions disagree',
)
for (const { id } of anchors) {
  const { node } = named(`anchor_${id}`)
  assert.equal(node.mesh, undefined, `Anchor ${id} must be a marker point`)
}
for (const target of [...SOURCES, ...DETECTORS]) {
  const room = ROOMS.find((room) => room.id === target.room)
  assert(room, `Unknown compartment for ${target.id}`)
  const { point: p } = named(`anchor_${target.id}`)
  const ceiling = room.floor === 3 ? roofHeightAt(p.x) : room.ceilingY
  assert(
    p.x >= room.minX &&
      p.x <= room.maxX &&
      p.z >= room.minZ &&
      p.z <= room.maxZ &&
      p.y >= room.floorY &&
      p.y <= ceiling,
    `Source or sensor outside its room: ${target.id}`,
  )
  if ('sensorY' in target) {
    assert(
      Math.abs(p.y - target.sensorY) < 0.02,
      `Sensor height differs from its model: ${target.id}`,
    )
  }
}
for (const door of DOORS) {
  const hinge = named(`hinge_${door.id}`)
  const marker = named(`anchor_${door.id}`).point
  const room = ROOMS.find((room) => room.id === door.rooms[0])
  assert(room && Math.abs(hinge.point.y - room.floorY) < 0.1, `Misplaced hinge: ${door.id}`)
  assert(marker.y > room.floorY && marker.y < door.topY, `Marker outside door height: ${door.id}`)
  const angle = Math.abs(hinge.node.extras?.openAngle)
  assert(angle > 0.4 && angle <= Math.PI, `Missing usable open angle: ${door.id}`)
  assert(
    !hinge.bounds.isEmpty() && hinge.bounds.distanceToPoint(marker) < 0.3,
    `Door has no movable surface at its marker: ${door.id}`,
  )
}

console.log(
  `Model verified: ${anchors.length} anchors, ${DOORS.length} hinges, ${draws} draws, ` +
    `${triangles.toLocaleString('en-US')} triangles, ${(bytes.length / 1024 ** 2).toFixed(2)} MiB.`,
)
