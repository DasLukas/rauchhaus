import {
  BufferGeometry,
  Color,
  Data3DTexture,
  Float32BufferAttribute,
  GLSL3,
  Group,
  LinearFilter,
  Mesh,
  RedFormat,
  RepeatWrapping,
  ShaderMaterial,
  Vector3,
  Vector4,
} from 'three'
import {
  DOORS,
  ROOMS,
  SOURCES,
  roofHeightAt,
  type Room,
  type SimulationSnapshot,
  type SourceId,
} from '../simulation'

const SLICE_COUNT = 19

// The fixed sample planes face the open cutaway, back to front. Each fragment
// is depth-tested against opaque furniture, so the bed or a door can occlude a
// plume without requiring a second off-screen render on a tablet.
function roomSlices(room: Room): BufferGeometry {
  const vertices: number[] = []
  const indices: number[] = []
  for (let slice = 0; slice < SLICE_COUNT; slice++) {
    const z = room.minZ + ((room.maxZ - room.minZ) * (slice + 0.5)) / SLICE_COUNT
    // Each doorway sits in a shallow diagonal partition in the Blender model.
    const apartment = 0.23 - 0.53 * Math.min(1, Math.max(0, (z + 0.42) / 0.97))
    const interior = 0.37 - 0.74 * Math.min(1, Math.max(0, (z + 0.27) / 0.37))
    const offset = (edge: number) => (Math.abs(edge) === 3 ? 0 : edge < 0 ? interior : apartment)
    const left = room.minX + offset(room.minX)
    const right = room.maxX + offset(room.maxX)
    const i = vertices.length / 3
    vertices.push(
      left,
      room.floorY,
      z,
      right,
      room.floorY,
      z,
      right,
      room.ceilingY,
      z,
      left,
      room.ceilingY,
      z,
    )
    indices.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  return geometry
}

function noiseTexture(): Data3DTexture {
  const size = 32
  const bytes = new Uint8Array(size ** 3)
  let seed = 53917
  for (let i = 0; i < bytes.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    bytes[i] = seed >>> 24
  }
  const texture = new Data3DTexture(bytes, size, size, size)
  texture.format = RedFormat
  texture.minFilter = texture.magFilter = LinearFilter
  texture.wrapS = texture.wrapT = texture.wrapR = RepeatWrapping
  texture.needsUpdate = true
  return texture
}

const vertexShader = `
  out vec3 point;
  void main() {
    point = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  precision highp sampler3D;
  in vec3 point;
  out vec4 smokeColor;
  uniform sampler3D noiseVolume;
  uniform float time;
  uniform float upperOpacity;
  uniform float layerBase;
  uniform float localCeiling;
  uniform float isGable;
  uniform vec3 source;
  uniform float strength;
  uniform vec4 jetA;
  uniform vec4 jetB;
  uniform vec3 shadowTint;
  uniform vec3 lightTint;
  uniform float ridge;
  uniform float roofSlope;
  uniform float sliceDepth;

  float jetDensity(vec4 jet) {
    // x = partition, y = lintel, z = inward travel direction, w = strength.
    float wallOffset = jet.x > 0.0 ? 0.23 - 0.53 * clamp((point.z + 0.42) / 0.97, 0.0, 1.0)
                               : 0.37 - 0.74 * clamp((point.z + 0.27) / 0.37, 0.0, 1.0);
    float wallX = jet.x + wallOffset;
    float run = (point.x - wallX) * jet.z;
    if (jet.w < 0.003 || run < 0.0 || run > 1.0) return 0.0;
    float center = jet.y - 0.11 + 0.24 * run;
    vec2 offset = vec2((point.y - center) / (0.12 + 0.18 * run),
                       (point.z - (jet.x > 0.0 ? 0.065 : -0.085)) / ((jet.x > 0.0 ? 0.36 : 0.18) + 0.16 * run));
    return jet.w * exp(-dot(offset, offset) - 2.2 * run);
  }

  void main() {
    float top = mix(localCeiling, ridge - roofSlope * abs(point.x), isGable);
    if (point.y > top || (point.y < layerBase - 0.18 && strength < 0.002
       && jetA.w < 0.003 && jetB.w < 0.003)) discard;

    vec3 uv = point * 0.063 + vec3(0.32, -time * 0.014, 0.5);
    float broad = texture(noiseVolume, uv).r - 0.5;
    float detail = texture(noiseVolume, uv * 2.18 + vec3(0.1, -time * 0.006, 0.3)).r;
    float billow = texture(noiseVolume, point * vec3(0.039, 0.051, 0.012)
        + vec3(time * 0.004, -time * 0.005, 0.5)).r - 0.5;
    float textureDensity = 0.82 + 0.46 * broad + 0.20 * detail + 0.35 * billow;
    float layer = upperOpacity * smoothstep(-0.075, 0.10,
        point.y - layerBase + billow * 0.24 + broad * 0.15 + (detail - 0.5) * 0.045);
    // Map optical opacity over the compartment depth into distributed samples.
    float extinction = -log(max(0.06, 1.0 - min(layer, 0.94))) / 1.80;

    float h = point.y - source.y;
    float plumeShade = 0.0;
    if (strength > 0.001 && h > -0.05) {
      float rise = max(h, 0.0);
      float width = 0.075 + 0.15 * sqrt(rise);
      vec2 curl = vec2(sin(rise * 6.0 - time * 1.9), cos(rise * 5.1 - time * 1.4))
                    * min(0.105, rise * 0.13);
      vec2 center = source.xz + curl;
      vec2 r = (point.xz - center) / width;
      float plume = exp(-dot(r,r) * 1.05) * smoothstep(-0.05, 0.08, h)
                    * (1.0 - smoothstep(time * 1.35, time * 1.35 + 0.20, rise));
      plumeShade = plume * strength;
      extinction += 4.1 * plumeShade * (0.78 + broad * 0.58);
    }
    extinction += (jetDensity(jetA) + jetDensity(jetB)) * 1.5;
    float alpha = 1.0 - exp(-extinction * sliceDepth * textureDensity);
    if (alpha < 0.0012) discard;
    vec3 color = mix(shadowTint, lightTint, clamp(0.36 + broad * 0.55 + detail * 0.18 + billow * 0.4 - plumeShade * 0.42
                    + 0.11 * smoothstep(layerBase, max(layerBase + 0.02, top + 0.02), point.y), 0.0, 1.0));
    smokeColor = vec4(linearToOutputTexel(vec4(color, 1.0)).rgb, alpha);
  }
`

/** Displays the simulation in compartment-bounded translucent volumes. */
export class SmokeVolumes extends Group {
  private readonly noise = noiseTexture()
  private readonly rooms = ROOMS.map((room) => {
    const material = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        noiseVolume: { value: this.noise },
        time: { value: 0 },
        upperOpacity: { value: 0 },
        layerBase: { value: room.ceilingY },
        localCeiling: { value: room.ceilingY },
        isGable: { value: room.floor === 3 ? 1 : 0 },
        ridge: { value: roofHeightAt(0) },
        roofSlope: { value: roofHeightAt(0) - roofHeightAt(1) },
        sliceDepth: { value: (room.maxZ - room.minZ) / SLICE_COUNT },
        source: { value: new Vector3() },
        strength: { value: 0 },
        jetA: { value: new Vector4() },
        jetB: { value: new Vector4() },
        shadowTint: { value: new Color(0x56616f) },
        lightTint: { value: new Color(0xa5adb7) },
      },
    })
    const mesh = new Mesh(roomSlices(room), material)
    mesh.visible = false
    mesh.name = `Rauch ${room.id}`
    this.add(mesh)
    return { room, mesh, material, doors: DOORS.filter((door) => door.rooms.includes(room.id)) }
  })

  constructor(private readonly sourcePositions: ReadonlyMap<SourceId, Vector3>) {
    super()
  }

  update(snapshot: SimulationSnapshot): void {
    const active = SOURCES.find((source) => source.id === snapshot.source)
    for (const { room, mesh, material, doors } of this.rooms) {
      const local = snapshot.rooms[room.id]
      const u = material.uniforms
      u.strength.value = active?.room === room.id ? snapshot.sourceStrength : 0
      if (active && u.strength.value > 0) u.source.value.copy(this.sourcePositions.get(active.id))
      u.time.value = snapshot.elapsed
      u.upperOpacity.value = local.opacity
      u.layerBase.value = local.layerBaseY
      for (const [index, door] of doors.entries()) {
        const jet = index === 0 ? u.jetA.value : u.jetB.value
        const incomingDirection = door.rooms[0] === room.id ? -1 : 1
        const flow = snapshot.doors[door.id] ? snapshot.doorFlow[door.id] * incomingDirection : 0
        jet.set(
          incomingDirection > 0 ? room.minX : room.maxX,
          door.topY,
          incomingDirection,
          Math.max(0, Math.min(1, flow)),
        )
      }
      mesh.visible =
        local.opacity > 0.002 ||
        u.strength.value > 0.002 ||
        u.jetA.value.w > 0.003 ||
        u.jetB.value.w > 0.003
    }
  }

  dispose(): void {
    for (const { mesh, material } of this.rooms) {
      mesh.geometry.dispose()
      material.dispose()
    }
    this.noise.dispose()
  }
}
