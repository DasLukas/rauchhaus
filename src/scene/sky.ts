import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three'

// Sculpted as one continuous curved surface so adjoining cloud lobes share
// lighting, like the rounded furniture in the dollhouse.
function cloudShape(seed: number): BufferGeometry {
  const vertices: number[] = []
  const indices: number[] = []
  const slices = 48
  const rings = 24
  // Smoothly union three elliptical puffs before sampling the surface. This
  // preserves an actual curved underside and rounds the valleys between puffs.
  const lobes = [
    [-0.6, -0.015, 0.0, 0.4, 0.25, 0.28],
    [-0.13 + seed, 0.14, 0.0, 0.49, 0.43, 0.37],
    [0.48, 0.025, 0.0, 0.52, 0.3, 0.32],
  ]
  function surface(x: number, y: number, z: number): number {
    let value = Infinity
    for (const [cx, cy, cz, rx, ry, rz] of lobes) {
      const distance = Math.hypot((x - cx) / rx, (y - cy) / ry, (z - cz) / rz) - 1
      const blend = Math.max(0.16 - Math.abs(distance - value), 0)
      value = Math.min(value, distance) - (blend * blend) / 0.64
    }
    return value
  }
  for (let i = 0; i <= slices; i++) {
    const x = -Math.cos((i / slices) * Math.PI)
    for (let j = 0; j <= rings; j++) {
      const a = (j / rings) * Math.PI * 2
      const dy = Math.sin(a),
        dz = Math.cos(a)
      let low = 0,
        high = 0.78
      for (let k = 0; k < 13; k++) {
        const mid = (low + high) * 0.5
        if (surface(x, dy * mid, dz * mid) > 0) high = mid
        else low = mid
      }
      const r = (low + high) * 0.5
      vertices.push(x, dy * r, dz * r)
      if (i < slices && j < rings) {
        const k = i * (rings + 1) + j
        indices.push(k, k + rings + 1, k + 1, k + 1, k + rings + 1, k + rings + 2)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const normals = geometry.getAttribute('normal')
  const colors: number[] = []
  const normal = new Vector3()
  const light = new Vector3(-0.35, 0.69, 0.55).normalize()
  const low = new Color(0xdecddd),
    high = new Color(0xfffcf2),
    color = new Color()
  for (let i = 0; i < normals.count; i++) {
    normal.fromBufferAttribute(normals, i)
    color.lerpColors(low, high, Math.min(1, Math.max(0, normal.dot(light) * 0.73 + 0.46)))
    colors.push(color.r, color.g, color.b)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}

/** Small background details kept beside the roof in the default view. */
export function addSkyClouds(): Group {
  const group = new Group()
  const material = new MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  const positions = [
    [-4.8, 6.8, -3.2, 1.12, 0.07],
    [4.65, 6.23, -3.45, 1.05, -0.06],
    [-6.28, 4.36, -3.8, 0.68, -0.1],
  ]
  for (const [x, y, z, scale, seed] of positions) {
    const cloud = new Mesh(cloudShape(seed), material)
    cloud.position.set(x, y, z)
    cloud.scale.set(scale, scale * 1.08, scale)
    group.add(cloud)
  }
  return group
}
