import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Plane,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three'

/** Outer outline of a horizontal cut through the log, including its raised bark. */
function outline(points: Vector2[]) {
  points.sort((a, b) => a.x - b.x || a.y - b.y)
  const hull: Vector2[] = []
  function append(p: Vector2, first: number) {
    while (hull.length >= first + 2) {
      const a = hull[hull.length - 2]
      const b = hull[hull.length - 1]
      if ((b.x - a.x) * (p.y - a.y) > (b.y - a.y) * (p.x - a.x)) break
      hull.pop()
    }
    hull.push(p)
  }
  for (const p of points) append(p, 0)
  const last = hull.length - 1
  for (let i = points.length - 2; i >= 0; i--) append(points[i], last)
  hull.pop()
  return hull
}

/** Dark, fractured charcoal runs along the grain of the newly exposed wood. */
function charcoalTexture() {
  const width = 160
  const height = 64
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width
      const v = y / height
      const along = v * 5 + 0.25 * Math.sin(19 * u) + 0.12 * Math.sin(47 * u + v)
      const across = u * 11 + 0.43 * Math.floor(along) + 0.18 * Math.sin(8 * along + 3 * u)
      const seam = Math.min(
        Math.abs(along - Math.round(along)),
        Math.abs(across - Math.round(across)),
      )
      const tile = Math.sin(31 * Math.floor(along) + 23 * Math.floor(across))
      const speckle = ((x * 13 + y * 31 + x * y) % 11) - 5
      const grey = seam < 0.065 ? 23 + speckle : 60 + 14 * tile + speckle
      pixels.set([grey + 5, grey, grey - 4, 255], (y * width + x) * 4)
    }
  }
  const texture = new DataTexture(pixels, width, height)
  texture.colorSpace = SRGBColorSpace
  texture.generateMipmaps = true
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

/**
 * The stove's split log is approximately convex. Intersect its authored edges
 * with the descending plane and close that outline with a shallow charcoal face.
 * The same plane clips the wood and its shadows without moving any bark vertices.
 */
function createBurnSurface(wood: Object3D, cut: Plane) {
  const edges: [Vector3, Vector3][] = []
  let bottom = Infinity
  let top = -Infinity
  wood.updateWorldMatrix(true, true)
  wood.traverse((part) => {
    if (!(part instanceof Mesh)) return
    const lines = new EdgesGeometry(part.geometry)
    lines.applyMatrix4(part.matrixWorld)
    const positions = lines.getAttribute('position')
    for (let i = 0; i < positions.count; i += 2) {
      const a = new Vector3().fromBufferAttribute(positions, i)
      const b = new Vector3().fromBufferAttribute(positions, i + 1)
      bottom = Math.min(bottom, a.y, b.y)
      top = Math.max(top, a.y, b.y)
      if (a.y !== b.y) edges.push(a.y < b.y ? [a, b] : [b, a])
    }
    lines.dispose()
  })
  const geometry = new BufferGeometry()
  const vertices = new BufferAttribute(new Float32Array(edges.length * 9), 3)
  const uvs = new BufferAttribute(new Float32Array(edges.length * 6), 2)
  geometry.setAttribute('uv', uvs)
  geometry.setAttribute('position', vertices)
  const normals = new Float32Array(vertices.count * 3)
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  const mesh = new Mesh(
    geometry,
    new MeshStandardMaterial({
      map: charcoalTexture(),
      flatShading: true,
      roughness: 1,
    }),
  )
  mesh.name = 'Charred burn surface'
  mesh.castShadow = mesh.receiveShadow = true
  // The active triangles change as the plane crosses different parts of the log.
  mesh.frustumCulled = false

  function vertex(i: number, p: Vector2, y: number) {
    vertices.setXYZ(i, p.x, y, p.y)
    // Map the grain along the oblique log axis used by the Blender model.
    uvs.setXY(i, 0.5 + 0.43 * p.x, 0.45 + 1.25 * (p.y + 0.268 * p.x))
  }

  function update(available: number): number {
    const height = bottom + (top - bottom) * available
    cut.constant = available === 1 ? top + 0.001 : height
    mesh.visible = available > 0 && available < 1
    if (!mesh.visible) {
      geometry.setDrawRange(0, 0)
      return height
    }
    const points: Vector2[] = []
    for (const [a, b] of edges) {
      if (height < a.y || height > b.y) continue
      const t = (height - a.y) / (b.y - a.y)
      points.push(new Vector2(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t))
    }
    const rim = outline(points)
    const centre = new Vector2()
    for (const p of rim) centre.add(p)
    centre.divideScalar(rim.length || 1)
    // The scorched middle lies slightly below the jagged rim. Limit the hollow
    // at both endpoints so it joins the fresh split face and the last char cleanly.
    const hollow = Math.min(0.021, (top - height) * 0.3, (height - bottom) * 0.3)
    for (let i = 0; i < rim.length; i++) {
      const a = rim[i]
      const b = rim[(i + 1) % rim.length]
      vertex(i * 3, centre, height - hollow)
      vertex(i * 3 + 1, b, height)
      vertex(i * 3 + 2, a, height)
    }
    uvs.needsUpdate = true
    vertices.needsUpdate = true
    geometry.setDrawRange(0, rim.length * 3)
    return height
  }
  return { mesh, update }
}

/**
 * Remove the upper layers of the log and its ember seams at the same surface.
 * The surviving bark and end grain stay fixed as the flames follow that surface.
 */
export function bindFuel(
  model: Object3D,
  wood: Object3D,
  embers: Object3D,
  flames: Object3D,
): (available: number) => boolean {
  const cut = new Plane(new Vector3(0, -1, 0))
  const surface = createBurnSurface(wood, cut)
  model.add(surface.mesh)
  const flameOrigin = flames.position.y
  // These shallow overlapping deposits collect among the ash flakes already on the pan.
  const ashBed = new Group()
  ashBed.name = 'Spent wood ash'
  ashBed.position.set(wood.position.x, 0.286, wood.position.z)
  const ashGeometry = new IcosahedronGeometry(1)
  const ashMaterial = new MeshStandardMaterial({ color: 0xcac5bc, roughness: 1, flatShading: true })
  for (const [x, z, width, height, depth, angle] of [
    [-0.09, 0.0, 0.42, 0.13, 0.21, 0.3],
    [0.25, -0.02, 0.29, 0.09, 0.16, -0.5],
    [-0.34, 0.09, 0.22, 0.07, 0.13, 0.7],
    [0.4, 0.13, 0.09, 0.035, 0.06, 0.1],
  ]) {
    const deposit = new Mesh(ashGeometry, ashMaterial)
    deposit.position.set(x, 0, z)
    deposit.scale.set(width, height, depth)
    deposit.rotation.y = angle
    deposit.castShadow = deposit.receiveShadow = true
    ashBed.add(deposit)
  }
  model.add(ashBed)

  const timber = new Set<Mesh>()
  wood.traverse((object) => {
    if (object instanceof Mesh) timber.add(object)
  })
  const outside = new Set<Material>()
  model.traverse((object) => {
    if (object instanceof Mesh && !timber.has(object)) {
      for (const material of [object.material].flat()) outside.add(material)
    }
  })
  const copies = new Map<MeshStandardMaterial, MeshStandardMaterial>()
  const finishes = new Map<MeshStandardMaterial, { fresh: Color; char: Color; ash: Color }>()
  function prepare(source: Material): Material {
    if (!(source instanceof MeshStandardMaterial)) return source
    let material = source
    if (outside.has(source)) {
      material = copies.get(source) ?? source.clone()
      copies.set(source, material)
    }
    if (!finishes.has(material)) {
      material.clippingPlanes = [cut]
      material.clipShadows = true
      const fresh = material.color.clone()
      const lightness = 0.2126 * fresh.r + 0.7152 * fresh.g + 0.0722 * fresh.b
      const charcoal = 0.013 + 0.15 * lightness
      const ash = 0.026 + 0.64 * lightness
      finishes.set(material, {
        fresh,
        char: new Color(charcoal * 1.1, charcoal, charcoal * 0.96),
        ash: new Color(ash * 1.05, ash, ash * 0.94),
      })
    }
    return material
  }
  for (const part of timber) {
    part.material = Array.isArray(part.material)
      ? part.material.map(prepare)
      : prepare(part.material)
  }
  embers.traverse((part) => {
    if (part instanceof Mesh) {
      for (const material of [part.material].flat()) material.clippingPlanes = [cut]
    }
  })
  let previousFuel = -1
  return (available) => {
    if (available === previousFuel) return false
    previousFuel = available
    const height = surface.update(available)
    wood.visible = available > 0
    flames.position.y = Math.min(flameOrigin, height)
    ashBed.scale.setScalar(1 - available)
    ashBed.visible = available < 1
    const char = Math.min(1, (1 - available) / 0.7)
    const ash = Math.max(0, 1 - available / 0.4)
    for (const [material, finish] of finishes)
      material.color
        .copy(finish.fresh)
        .lerp(finish.char, char)
        .lerp(finish.ash, ash * ash)
    return true
  }
}
