import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync, zstdDecompressSync } from 'node:zlib'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'
import { fuelSurfaces } from '../src/scene/fuels.ts'
import { getHouse, roofHeightAt } from '../src/simulation/house.ts'

const readAsset = (path) => readFileSync(new URL(path, import.meta.url))
function inspectAsset(modelFilename) {
  const blendFilename = modelFilename.replace(/\.glb$/, '.blend')
  const source = readAsset(`../assets/blender/${blendFilename}`)
  const signature = source.readUInt32LE()
  let blend = source
  if (signature === 0xfd2fb528) blend = zstdDecompressSync(source)
  else if (source.readUInt16LE() === 0x8b1f) blend = gunzipSync(source)
  assert.equal(blend.toString('ascii', 0, 7), 'BLENDER', 'Editable source must be a Blender file')

  const bytes = readAsset(`../public/models/${modelFilename}`)
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
  return { gltf, visited, names, draws, triangles, bytes }
}

function checkModel(variant) {
  const {
    doors: DOORS,
    rooms: ROOMS,
    sources: SOURCES,
    classroomSources,
    detectors: DETECTORS,
    roof: ROOF,
    modelFilename,
  } = getHouse(variant)
  const { names, draws, triangles, bytes } = inspectAsset(modelFilename)
  for (const roomId of new Set(classroomSources.map((source) => source.room))) {
    const room = ROOMS.find((room) => room.id === roomId)
    const surfaces = fuelSurfaces(variant, roomId)
    assert.ok(surfaces.length, `Missing combustible furnishings in ${variant}/${roomId}`)
    for (const [x, height, z, width] of surfaces) {
      const ceiling = room.roof ? roofHeightAt(x, room.roof) : room.ceilingY
      assert.ok(
        x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ &&
        height >= 0 && room.floorY + height < ceiling && width > 0 && Number.isFinite(width),
        `Invalid burning surface in ${variant}/${roomId} at ${x}, ${height}, ${z}`,
      )
    }
  }
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
  const expectedRooms = ROOMS.filter((room) => !room.id.startsWith('stair') || room.floor === ROOF.floor)
  assert.deepEqual(DETECTORS.map((d) => d.room).sort(), expectedRooms.map((room) => room.id).sort(),
    'Each room and the top landing must have exactly one detector')
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
    const ceiling = room.floor === ROOF.floor ? roofHeightAt(p.x, ROOF) : room.ceilingY
    assert(
      p.x >= room.minX &&
        p.x <= room.maxX &&
        p.z >= room.minZ &&
        p.z <= room.maxZ &&
        p.y >= room.floorY &&
        p.y <= ceiling,
      `Source or sensor outside its room: ${target.id}`,
    )
    assert(
      p.distanceTo(new Vector3(...target.position)) < 0.02,
      `Exported anchor and shared floor plan differ: ${target.id}`,
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
    const angle = hinge.node.extras?.openAngle
    assert(
      Math.abs(Math.abs(angle) - Math.PI / 2) < 1e-5 && Math.abs(angle - door.openAngle) < 1e-5,
      `Door must swing 90 degrees into its room: ${door.id}`,
    )
    assert(
      hinge.point.distanceTo(new Vector3(door.x, room.floorY, door.hingeZ)) < 0.02,
      `Door pivot differs from its definition: ${door.id}`,
    )
    const span = hinge.bounds.getSize(new Vector3())
    assert(
      span.x < 0.3 &&
        Math.abs(hinge.bounds.min.z - door.latchZ) < 0.1 &&
        Math.abs(hinge.bounds.max.z - door.hingeZ) < 0.1 &&
        Math.abs(hinge.bounds.max.y - door.topY) < 0.1,
      `Closed leaf must extend along the wall, from hinge to latch: ${door.id}`,
    )
    const openLatchX = hinge.point.x + (door.latchZ - door.hingeZ) * Math.sin(angle)
    assert(
      door.rooms[1] === 'outside'
        ? openLatchX > door.x
        : openLatchX > room.minX && openLatchX < room.maxX,
      `Door opens into the wrong room: ${door.id}`,
    )
    assert(
      !hinge.bounds.isEmpty() && hinge.bounds.distanceToPoint(marker) < 0.3,
      `Door has no movable surface at its marker: ${door.id}`,
    )
  }

  console.log(
    `${modelFilename} verified: ${anchors.length} anchors, ${DOORS.length} hinges, ${draws} draws, ` +
      `${triangles.toLocaleString('en-US')} triangles, ${(bytes.length / 1024 ** 2).toFixed(2)} MiB.`,
  )
}

function checkStove() {
  const { gltf, names, visited, triangles, draws } = inspectAsset('holzofen.glb')
  const animated = new Set()
  function includeFlames(index) {
    animated.add(index)
    for (const child of gltf.nodes[index].children ?? []) includeFlames(child)
  }
  for (const name of ['Stove', 'Fuel', 'Embers', 'Flames']) {
    const group = names.get(name)
    assert(group && !group.bounds.isEmpty(), `Missing stove geometry: ${name}`)
  }
  includeFlames(gltf.nodes.findIndex((node) => node.name === 'Flames'))
  const channels = (gltf.animations ?? []).flatMap((clip) => clip.channels.map((channel) => ({
    target: channel.target,
    keys: gltf.accessors[clip.samplers[channel.sampler].input],
  })))
  assert(channels.some(({ target, keys }) =>
    visited.has(target.node) && animated.has(target.node) && keys.count >= 3 &&
    keys.max[0] > keys.min[0]), 'Expected animated flame geometry in the exported Blender clip')
  assert(triangles <= 250_000 && draws <= 48, 'The stove exceeds the classroom model budget')
  console.log(`holzofen.glb verified: ${triangles.toLocaleString('en-US')} triangles, ${draws} draws, animated channels: ${channels.length}.`)
}

for (const variant of ['gross', 'klein']) checkModel(variant)
checkStove()
