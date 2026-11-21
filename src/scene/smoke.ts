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
  Vector2,
  Vector3,
  Vector4,
} from 'three'
import {
  DIMENSIONS,
  DOORS,
  FLOORS,
  ROOF,
  ROOMS,
  type Room,
  type SimulationSnapshot,
  SOURCES,
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
    const { minX: left, maxX: right } = room
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
  uniform vec4 openings[OPENING_COUNT];
  uniform vec2 flows[OPENING_COUNT];
  uniform vec3 stairEntry;
  uniform vec2 stairStrength;
  uniform float floorY;
  uniform vec3 shadowTint;
  uniform vec3 lightTint;
  uniform float ridge;
  uniform float roofSlope;
  uniform float sliceDepth;

  float doorwayJet(vec4 opening, vec2 flow) {
    float run = (point.x - opening.x) * flow.x;
    if (run < 0.0 || run > 1.5) return 0.0;
    float center = opening.y - 0.13 + 0.27 * run;
    vec2 offset = vec2((point.y - center) / (0.14 + 0.15 * run),
                       (point.z - opening.z) / (opening.w * 0.42 + 0.13 * run));
    return flow.y * exp(-dot(offset, offset) - 1.8 * run);
  }

  // The open eye between the switchback flights is visible through each slab.
  // Incoming flow from the lower landing rises here before joining its layer.
  float stairPlume(float height, float amount) {
    if (amount < 0.002 || height < 0.0) return 0.0;
    float side = min(height, 1.0);
    vec2 curl = vec2(sin(3.8 * height - time * 1.5), cos(4.6 * height - time))
              * 0.10 * side;
    // The jet entrains air and fans out between the flights on its ascent.
    vec2 width = vec2(0.22, 0.44) + vec2(0.25, 0.34) * side;
    vec2 offset = (point.xz - stairEntry.xz - curl - vec2(0.0, 0.26 * side)) / width;
    return amount * exp(-dot(offset,offset) - 0.22 * height);
  }

  void main() {
    float top = mix(localCeiling, ridge - roofSlope * abs(point.x), isGable);
    float height = point.y - floorY;
    if (point.y > top) discard;
    float risingGas = stairPlume(height, stairStrength.x) + stairPlume(top - point.y, stairStrength.y);
    float openingGas = 0.0;
    for (int i = 0; i < OPENING_COUNT; i++) {
      if (flows[i].y > 0.002) openingGas += doorwayJet(openings[i], flows[i]);
    }
    if (point.y < layerBase - 0.23 && strength < 0.002 && openingGas + risingGas < 0.002) discard;
    vec3 uv = point * 0.063 + vec3(0.32, -time * 0.014, 0.5);
    float broad = texture(noiseVolume, uv).r - 0.5;
    float detail = texture(noiseVolume, uv * 2.18 + vec3(0.1, -time * 0.006, 0.3)).r;
    float billow = texture(noiseVolume, point * vec3(0.039, 0.051, 0.012)
        + vec3(time * 0.004, -time * 0.005, 0.5)).r - 0.5;
    float textureDensity = 0.82 + 0.46 * broad + 0.20 * detail + 0.35 * billow;
    float layer = upperOpacity * smoothstep(-0.075, 0.10,
        point.y - layerBase + billow * 0.24 + broad * 0.15 + (detail - 0.5) * 0.045);
    // Map optical opacity over the compartment depth into distributed samples.
    float extinction = -1.75 * log(max(0.06, 1.0 - min(layer, 0.94))) / (sliceDepth * float(SAMPLES));

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
    extinction += openingGas * 3.6 + risingGas * 5.6;
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
    const doors = DOORS.filter((door) => door.rooms.includes(room.id))
    const portals = doors.map(
      (door) =>
        new Vector4(
          door.x,
          door.topY,
          (door.hingeZ + door.latchZ) * 0.5,
          Math.abs(door.hingeZ - door.latchZ),
        ),
    )
    const flows = doors.map((door) => new Vector2(door.x < (room.maxX + room.minX) / 2 ? 1 : -1, 0))
    const landing = FLOORS.find((floor) => floor.landing === room.id)
    const below = landing ? FLOORS.find((floor) => floor.level === landing.level - 1) : undefined
    const material = new ShaderMaterial({
      defines: { OPENING_COUNT: Math.max(1, doors.length), SAMPLES: SLICE_COUNT },
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
        isGable: { value: room.floor === ROOF.floor ? 1 : 0 },
        ridge: { value: ROOF.ridgeY },
        roofSlope: { value: ROOF.slope },
        sliceDepth: { value: (room.maxZ - room.minZ) / SLICE_COUNT },
        source: { value: new Vector3() },
        strength: { value: 0 },
        openings: { value: portals.length ? portals : [new Vector4()] },
        flows: { value: flows.length ? flows : [new Vector2()] },
        floorY: { value: room.floorY },
        stairEntry: { value: new Vector3(DIMENSIONS.stairEyeX, room.floorY, DIMENSIONS.stairEyeZ) },
        stairStrength: { value: new Vector2() },
        shadowTint: { value: new Color(0x35404b) },
        lightTint: { value: new Color(0x8b949e) },
      },
    })
    const mesh = new Mesh(roomSlices(room), material)
    mesh.visible = false
    mesh.name = `Rauch ${room.id}`
    this.add(mesh)
    return { room, mesh, material, doors, below, landing }
  })

  constructor(private readonly sourcePositions: ReadonlyMap<SourceId, Vector3>) {
    super()
  }

  update(snapshot: SimulationSnapshot): void {
    const active = SOURCES.find((source) => source.id === snapshot.source)
    for (const { room, mesh, material, doors, below, landing } of this.rooms) {
      const local = snapshot.rooms[room.id]
      const u = material.uniforms
      u.strength.value = active?.room === room.id ? snapshot.sourceStrength : 0
      if (active && u.strength.value > 0) {
        const anchor = this.sourcePositions.get(active.id)
        if (anchor) u.source.value.copy(anchor)
        else u.source.value.fromArray(active.position)
      }
      u.time.value = snapshot.elapsed
      u.upperOpacity.value = local.opacity
      u.layerBase.value = local.layerBaseY
      let hasFlow = false
      for (const [index, door] of doors.entries()) {
        const signedFlow = snapshot.doorFlow[door.id] * (door.rooms[0] === room.id ? -1 : 1)
        const incoming = snapshot.doors[door.id] ? Math.max(0, signedFlow) : 0
        u.flows.value[index].y = incoming
        if (incoming > 0.002) hasFlow = true
      }
      const rising = below ? Math.max(0, snapshot.stairFlow[below.landing]) : 0
      const sinking = landing ? Math.max(0, -snapshot.stairFlow[landing.landing]) : 0
      u.stairStrength.value.set(rising, sinking)
      mesh.visible =
        local.opacity > 0.002 ||
        u.strength.value > 0.002 ||
        hasFlow ||
        rising > 0.002 ||
        sinking > 0.002
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
