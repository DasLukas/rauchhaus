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
  type Door,
  FLOORS,
  HOUSE_VARIANT,
  PLUME_RISE_SPEED,
  ROOF,
  ROOMS,
  type Room,
  type SimulationSnapshot,
  SOURCES,
  type SourceId,
} from '../simulation'
import { sampleGasBursts } from '../simulation/gas-flame'
import { fireShader } from './fire'
import { fuelSurfaces } from './fuels'

const SLICE_COUNT = 19

// The fixed sample planes face the open cutaway, back to front. Each fragment
// is depth-tested against opaque furniture, so the bed or a door can occlude a
// plume without requiring a second off-screen render on a tablet.
function roomSlices(room: Room, doors: readonly Door[]): BufferGeometry {
  const vertices: number[] = []
  const indices: number[] = []
  function quad(left: number, right: number, top: number, z: number): void {
    const i = vertices.length / 3
    vertices.push(left, room.floorY, z, right, room.floorY, z, right, top, z, left, top, z)
    indices.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
  for (let slice = 0; slice < SLICE_COUNT; slice++) {
    const z = room.minZ + ((room.maxZ - room.minZ) * (slice + 0.5)) / SLICE_COUNT
    quad(room.minX, room.maxX, room.ceilingY, z)
    // The receiving jet also spans the wall thickness, inside the clear opening.
    for (const door of doors) {
      if (z > Math.min(door.hingeZ, door.latchZ) && z < Math.max(door.hingeZ, door.latchZ)) {
        const halfWall = DIMENSIONS.wallThickness / 2
        quad(door.x - halfWall, door.x + halfWall, door.topY, z)
      }
    }
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
  uniform float sliceDepth;
  flat out float pathLength;
  flat out float sideStep;
  void main() {
    point = position;
    pathLength = sliceDepth / abs(modelViewMatrix[2].z);
    sideStep = abs(modelViewMatrix[0].z) * pathLength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  precision highp sampler3D;
  in vec3 point;
  flat in float pathLength;
  flat in float sideStep;
  out vec4 smokeColor;
  uniform sampler3D noiseVolume;
  uniform float time;
  uniform float layerExtinction;
  uniform float layerDensity;
  uniform float layerBase;
  uniform vec4 ceilingFront; // entry x/z, ceiling radius, remaining vertical rise
  uniform vec2 roomSides;
  uniform float localCeiling;
  uniform float isGable;
  uniform vec3 source;
  uniform float strength;
  uniform vec4 openings[OPENING_COUNT];
  uniform vec4 flows[OPENING_COUNT]; // inward direction, rate, submerged depth, donor density
  uniform float flowTravel[OPENING_COUNT]; // distance travelled by this open-door current
  uniform vec3 stairEntry;
  uniform vec2 stairStrength;
  uniform vec2 stairDensity;
  uniform float stairDownAge;
  uniform float floorY;
  uniform vec3 shadowTint;
  uniform vec3 lightTint;
  uniform float ridge;
  uniform float roofSlope;
  #ifdef SHOW_FIRE
  ${fireShader}
  #endif

  float ceilingAt(float x) {
    return mix(localCeiling, ridge - roofSlope * abs(x), isGable);
  }

  float risingTip(vec2 entry) {
    if (ceilingFront.w <= 0.0 || distance(entry, ceilingFront.xy) > 0.02) return 1.0;
    float tipY = ceilingAt(entry.x) - ceilingFront.w;
    return 1.0 - smoothstep(tipY, tipY + 0.05, point.y);
  }

  // Extinction and extinction-weighted soot fraction for a current mixing
  // with room air. Entrainment softens both its opacity and its grey tone.
  vec2 plumeOptics(float gas, float donorDensity, float rise) {
    float concentration = donorDensity / (1.0 + 0.72 * rise);
    return gas * concentration * vec2(1.0, concentration);
  }

  float cloudProfile(vec2 offset, vec2 width, vec2 eddies, float distanceTravelled) {
    vec2 relative = offset / width + eddies * min(0.85, distanceTravelled);
    return exp(-dot(relative, relative));
  }

  float reached(float distanceFromOpening, float travel) {
    return 1.0 - smoothstep(travel - 0.08, travel + 0.02, distanceFromOpening);
  }

  vec2 doorwaySmoke(vec4 opening, vec4 flow, float travel, vec2 eddies) {
    float run = max(0.0, (point.x - opening.x) * flow.x - HALF_WALL);
    float depth = min(0.70 * flow.z, opening.y - floorY);
    float lateral = point.z - opening.z;
    float width = opening.w * 0.5;
    // Keep the exiting gas inside the submerged part of the actual aperture.
    float lip = (1.0 - smoothstep(width * 0.7, width, abs(lateral)))
              * smoothstep(0.0, 0.04, point.y - opening.y + depth)
              * (1.0 - smoothstep(-0.02, 0.0, point.y - opening.y));
    float rate = mix(flow.y, sqrt(flow.y), 0.30);
    vec2 mouth = plumeOptics(5.2 * rate * lip * exp(-5.0 * run), flow.w, 0.0);

    // The spill plume leaves the wall with some horizontal momentum. Its
    // widening cross section depends on rise through air and can reach a high
    // attic ceiling without stretching the thin mouth over that whole height.
    float aboveLip = point.y - (opening.y - 0.45 * depth);
    float rise = max(0.0, aboveLip);
    float axis = 0.15 + 0.20 * rate + 0.36 * rise;
    vec2 spread = vec2(0.16 + 0.13 * rate, width * 0.8) + vec2(0.50, 0.42) * rise;
    float cloud = cloudProfile(vec2(run - axis, lateral), spread, eddies, rise + run);
    float release = smoothstep(0.0, 0.20, run)
                  * smoothstep(-0.5 * depth - 0.03, 0.05, aboveLip);
    vec2 plume = plumeOptics(4.8 * rate * release * cloud, flow.w, rise);

    // A previous trickle can leave an old ceiling layer in place. The fresh
    // current still has to travel out of the opening and rise to that layer.
    float distanceFromOpening = length(vec3(run, max(0.0, point.y - opening.y),
                                             max(0.0, abs(lateral) - width)));
    return (mouth + plume) * reached(distanceFromOpening, travel) * risingTip(opening.xz);
  }

  vec2 risingStairSmoke(float height, float amount, float donorDensity, vec2 eddies) {
    if (amount < 0.002 || height < 0.0) return vec2(0.0);
    // The staircase opening constricts the current at each slab. Between
    // slabs it keeps entraining air all the way up to the receiving layer.
    vec2 spread = vec2(0.24, 0.43) + vec2(0.38, 0.40) * height;
    vec2 offset = point.xz - stairEntry.xz - vec2(0.0, 0.14 * height);
    float cloud = cloudProfile(offset, spread, eddies, height);
    return plumeOptics(5.8 * amount * cloud, donorDensity, height);
  }

  vec2 descendingStairSmoke(float drop, vec2 eddies) {
    if (stairStrength.y < 0.002) return vec2(0.0);
    // A spill enters at the eye, then mixes along the underside of the
    // accumulating layer. Only its rolling fringe dips into the clearer air.
    float rate = sqrt(stairStrength.y);
    float layerDepth = max(0.0, localCeiling - layerBase);
    float reach = min(stairDownAge * 0.48, layerDepth + 0.22 + 0.45 * rate);
    if (drop > reach + 0.12) return vec2(0.0);
    vec2 offset = point.xz - stairEntry.xz;
    vec2 width = vec2(0.17, 0.42) + min(drop, 1.2) * vec2(0.37, 0.28);
    float cloud = cloudProfile(offset, width, eddies, drop);
    float tip = reached(drop + 0.14 * length(offset) + 0.10 * eddies.y, reach);
    return plumeOptics(4.6 * stairStrength.y * cloud * tip, stairDensity.y, drop);
  }

  void main() {
    float top = ceilingAt(point.x);
    if (point.y > top) discard;
    bool inside = point.x >= roomSides.x && point.x <= roomSides.y;
    // Fractional side coverage antialiases the visible ends of the depth
    // slices. An active doorway joins them to the samples in the wall reveal.
    float edgeDistance = min(point.x - roomSides.x, roomSides.y - point.x);
    float coverage = inside ? clamp(edgeDistance / max(0.00001, sideStep), 0.0, 1.0) : 1.0;
    float distanceToEntry = distance(point.xz, ceilingFront.xy);
    // Broad rolls travel away from the impingement point along the ceiling.
    float billow = texture(noiseVolume, vec3(distanceToEntry * 0.055 - time * 0.017,
        point.y * 0.051, point.z * 0.032 + 0.5)).r - 0.5;
    vec3 uv = point * 0.063 + vec3(0.32, -time * 0.014, 0.5);
    float broad = texture(noiseVolume, uv).r - 0.5;
    vec2 eddies = vec2(broad + 0.5 * billow, billow - 0.5 * broad);
    vec2 currents = vec2(0.0);
    bool nearRoof = isGable > 0.5 && top - point.y < 0.43;
    float roofFeed = strength + stairStrength.x;
    for (int i = 0; i < OPENING_COUNT; i++) {
      if (flows[i].y > 0.002 && (inside || abs(point.x - openings[i].x) <= HALF_WALL)) {
        vec4 opening = openings[i];
        currents += doorwaySmoke(opening, flows[i], flowTravel[i], eddies);
        if (abs(point.x - opening.x) < HALF_WALL + sideStep
            && point.y < opening.y && abs(point.z - opening.z) < opening.w * 0.5) coverage = 1.0;
        if (nearRoof) {
          float doorCeiling = ceilingAt(opening.x);
          float roofPath = max(0.0, doorCeiling - opening.y)
                         + length(vec3(point.xz - opening.xz, top - doorCeiling));
          roofFeed += flows[i].y * reached(roofPath, flowTravel[i]);
        }
      }
    }
    if (inside) {
      currents += risingStairSmoke(point.y - floorY, stairStrength.x, stairDensity.x, eddies)
                * risingTip(stairEntry.xz);
      currents += descendingStairSmoke(top - point.y, eddies);
    }
    bool behindFront = ceilingFront.z > 0.0 && distanceToEntry < ceilingFront.z + 0.16;
    bool atRoof = nearRoof && roofFeed > 0.002;
    bool inLayer = inside && behindFront && (point.y > layerBase - 0.48 || atRoof);
    #ifndef SHOW_FIRE
    if (!inLayer && strength < 0.002 && currents.x < 0.002) discard;
    #endif
    float detail = texture(noiseVolume, uv * 2.18 + vec3(0.1, -time * 0.006, 0.3)).r - 0.5;
    float textureDensity = 1.0 + 0.46 * broad + 0.20 * detail + 0.35 * billow;
    float layer = 0.0;
    float smokeEdge = top;
    float front = 0.0;
    if (inLayer) {
      front = smoothstep(-0.12, 0.35, ceilingFront.z - distanceToEntry + 0.08 * billow);
      // The advancing nose is shallower than the developed layer behind it.
      float base = mix(top, layerBase, front);
      float edge = 0.085 + 0.10 * clamp(top - base, 0.0, 1.0);
      smokeEdge = base - billow * 0.32 - broad * 0.18 - detail * 0.04;
      float vertical = smoothstep(-edge, edge, point.y - smokeEdge);
      layer = layerExtinction * front * vertical;
      if (atRoof) {
        // Before a horizontal layer pools at the ridge, the incoming current
        // follows the upward pitch on its own side of the roof.
        float side = sign(ceilingFront.x);
        float uphill = smoothstep(-0.18, 0.10, (ceilingFront.x - point.x) * side)
                     * smoothstep(-0.12, 0.04, point.x * side);
        float roofCloud = 1.0 - smoothstep(0.0, 0.35, top - point.y + eddies.x * 0.10);
        layer = max(layer, min(1.0, roofFeed) * front * uphill * roofCloud * exp(-0.3 * distanceToEntry));
      }
    }
    #ifdef SHOW_FIRE
    vec2 fire = inside ? fireAt(top, smokeEdge, front) : vec2(0.0);
    if (!inLayer && strength < 0.002 && currents.x < 0.002 && fire.x <= 0.0) discard;
    #endif
    // Once mixed into the established layer, incoming gas no longer draws a
    // second, darker plume over the ceiling or a post through the landing.
    currents *= (1.0 + 0.75 * broad + 0.5 * billow) * (1.0 - smoothstep(0.02, 0.90, layer));
    float extinction = layer + currents.x;
    float soot = layer * layerDensity + currents.y;

    float h = point.y - source.y;
    if (inside && strength > 0.001 && h > -0.05) {
      float rise = max(h, 0.0);
      float width = 0.12 + 0.20 * sqrt(rise);
      vec2 curl = vec2(sin(rise * 6.0 - time * 1.9), cos(rise * 5.1 - time * 1.4))
                    * min(0.105, rise * 0.13);
      vec2 center = source.xz + curl;
      vec2 r = (point.xz - center) / width;
      // Show a short wisp at selection. The rising front overtakes it before
      // the plume feeds the ceiling layer at the model's normal rise speed.
      float tip = max(0.5 + 0.4 * time, time * RISE_SPEED);
      float plume = exp(-dot(r,r) * 1.05) * smoothstep(-0.05, 0.08, h)
                    * (1.0 - smoothstep(tip - 0.10, tip + 0.10, rise));
      float column = 4.1 * plume * strength * (0.86 + broad * 0.58);
      extinction += column;
      soot += column * max(0.45, layerDensity);
    }
    // Beer-Lambert transmittance composes over the visible path to each object.
    float smokeDepth = extinction * textureDensity;
    float totalDepth = smokeDepth;
    #ifdef SHOW_FIRE
    float wispDepth = inside ? surfaceWisps() : 0.0;
    totalDepth += fire.x + wispDepth;
    #endif
    float alpha = 1.0 - exp(-totalDepth * pathLength * coverage);
    if (alpha < 0.0012) discard;
    float darkness = smoothstep(0.10, 0.76, soot / max(0.00001, extinction) + billow * 0.045);
    // Coherent self-shading keeps the dense cloud moving even after furniture
    // contrast has vanished. Its illumination must not open holes in the layer.
    float roll = texture(noiseVolume, point * vec3(0.049, 0.060, 0.012)
        + vec3(time * 0.006 + broad * 0.025, -time * 0.008 + billow * 0.03, 0.3)).r - 0.5;
    vec3 shadow = shadowTint * exp2(5.2 * roll + 1.3 * billow);
    vec3 light = lightTint * (0.94 + 0.22 * broad + 0.22 * billow);
    #ifdef SHOW_FIRE
    // A growing soot-bearing layer absorbs the model's bright studio fill.
    // Preserve its interface against the pale interior paint on the projector.
    light *= mix(1.0, 0.20, smoothstep(0.05, 0.21, layerDensity));
    #endif
    vec3 color = mix(shadow, light, (1.0 - darkness) * (1.0 - darkness));
    #ifdef SHOW_FIRE
    // Extinction-weighted emission shares the slice with the smoke. Smoke in
    // front and opaque depth-tested geometry still occlude the burning surface.
    float hot = clamp(fire.y / max(0.00001, fire.x), 0.0, 1.0);
    vec3 flameColor = mix(vec3(1.0, 0.06, 0.002), vec3(1.0, 0.88, 0.24), smoothstep(0.10, 0.95, hot));
    color = (color * smokeDepth + flameColor * fire.x + vec3(0.60, 0.62, 0.61) * wispDepth) / totalDepth;
    #endif
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
    const flows = doors.map(
      (door) => new Vector4(door.x < (room.maxX + room.minX) / 2 ? 1 : -1, 0, 0, 0),
    )
    const landing = FLOORS.find((floor) => floor.landing === room.id)
    const below = landing ? FLOORS.find((floor) => floor.level === landing.level - 1) : undefined
    const above = landing ? FLOORS.find((floor) => floor.level === landing.level + 1) : undefined
    const patches = fuelSurfaces(HOUSE_VARIANT, room.id).map(
      ([x, height, z, width]) => new Vector4(x, room.floorY + height, z, width),
    )
    if (!patches.length) patches.push(new Vector4(0, 0, 0, 0))
    const material = new ShaderMaterial({
      defines: {
        OPENING_COUNT: Math.max(1, doors.length),
        HALF_WALL: DIMENSIONS.wallThickness / 2,
        RISE_SPEED: PLUME_RISE_SPEED,
      },
      glslVersion: GLSL3,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        noiseVolume: { value: this.noise },
        time: { value: 0 },
        layerExtinction: { value: 0 },
        layerDensity: { value: 0 },
        layerBase: { value: room.ceilingY },
        ceilingFront: { value: new Vector4(0, 0, -1, 0) },
        roomSides: { value: new Vector2(room.minX, room.maxX) },
        localCeiling: { value: room.ceilingY },
        isGable: { value: room.floor === ROOF.floor ? 1 : 0 },
        ridge: { value: ROOF.ridgeY },
        roofSlope: { value: ROOF.slope },
        sliceDepth: { value: (room.maxZ - room.minZ) / SLICE_COUNT },
        source: { value: new Vector3() },
        strength: { value: 0 },
        fireAmounts: { value: new Vector3() },
        firstBurst: { value: new Vector4() },
        secondBurst: { value: new Vector4() },
        surfaceGas: { value: 0 },
        fuelSurfaces: { value: patches },
        flameTime: { value: 0 },
        openings: { value: portals.length ? portals : [new Vector4()] },
        flows: { value: flows.length ? flows : [new Vector4(0, 0, 0, 0)] },
        flowTravel: { value: new Float32Array(Math.max(1, doors.length)) },
        floorY: { value: room.floorY },
        stairEntry: { value: new Vector3(DIMENSIONS.stairEyeX, room.floorY, DIMENSIONS.stairEyeZ) },
        stairStrength: { value: new Vector2() },
        stairDensity: { value: new Vector2() },
        stairDownAge: { value: 0 },
        shadowTint: { value: new Color(0x212326) },
        lightTint: { value: new Color(0xd4d5d3) },
      },
    })
    const mesh = new Mesh(roomSlices(room, doors), material)
    mesh.visible = false
    mesh.name = `Rauch ${room.id}`
    this.add(mesh)
    return { room, mesh, material, doors, below, above, landing }
  })

  constructor(private readonly sourcePositions: ReadonlyMap<SourceId, Vector3>) {
    super()
  }

  update(snapshot: SimulationSnapshot, reducedMotion = false): void {
    const active = SOURCES.find((source) => source.id === snapshot.source)
    for (const { room, mesh, material, doors, below, above, landing } of this.rooms) {
      const local = snapshot.rooms[room.id]
      const u = material.uniforms
      u.strength.value = active?.room === room.id ? snapshot.sourceStrength : 0
      const fire = active?.room === room.id ? snapshot.fire : null
      // Compile fire sampling only for the source room when a fire is active.
      if (Boolean(fire) !== ('SHOW_FIRE' in material.defines)) {
        if (fire) {
          material.defines.SHOW_FIRE = 1
          material.defines.FUEL_COUNT = u.fuelSurfaces.value.length
        } else {
          delete material.defines.SHOW_FIRE
          delete material.defines.FUEL_COUNT
        }
        material.needsUpdate = true
      }
      if (fire && active) {
        u.fireAmounts.value.set(fire.sourceIntensity, fire.rollover, fire.involvement)
        u.flameTime.value = reducedMotion ? 0 : snapshot.elapsed
        u.surfaceGas.value = fire.outgassing
        if (fire.rollover > 0) {
          const bursts = sampleGasBursts(snapshot.elapsed, active.id, fire.burstSeed)
          // Reserve separate bands above the seating, clear of the detector and TV.
          const centres = HOUSE_VARIANT === 'klein' ? [0.63, 0.79] : [0.19, 0.69]
          u.secondBurst.value.z = 0
          for (const [i, burst] of bursts.entries()) {
            const x = centres[burst.band] + (burst.x - 0.5) * 0.075
            const z = room.minZ + (room.maxZ - room.minZ) * (0.57 + 0.12 * burst.z)
            const uniform = i === 0 ? u.firstBurst : u.secondBurst
            uniform.value.set(x, z, burst.strength, reducedMotion ? 0.5 : burst.progress)
          }
        }
      }
      if (active && (u.strength.value > 0 || fire)) {
        const anchor = this.sourcePositions.get(active.id)
        if (anchor) u.source.value.copy(anchor)
        else u.source.value.fromArray(active.position)
      }
      u.time.value = snapshot.elapsed
      u.layerExtinction.value =
        -Math.log(Math.max(1e-6, 1 - local.opacity)) / (room.maxZ - room.minZ)
      u.layerDensity.value = local.density
      u.layerBase.value = local.layerBaseY
      const front = local.ceilingFront
      if (front) u.ceilingFront.value.set(front.x, front.z, front.radius, front.riseRemaining)
      else u.ceilingFront.value.set(0, 0, -1, 0)
      let incomingRate = 0
      for (const [index, door] of doors.entries()) {
        const first = door.rooms[0] === room.id
        const signedFlow = snapshot.doorFlow[door.id] * (first ? -1 : 1)
        const incoming = snapshot.doors[door.id] ? Math.max(0, signedFlow) : 0
        const flow = u.flows.value[index]
        flow.y = incoming
        u.flowTravel.value[index] = snapshot.doorFlowAge[door.id] * PLUME_RISE_SPEED
        const upstream = first ? door.rooms[1] : door.rooms[0]
        if (incoming > 0.002 && upstream !== 'outside') {
          flow.z = Math.max(0, door.topY - snapshot.rooms[upstream].layerBaseY)
          flow.w = snapshot.rooms[upstream].density
          incomingRate += incoming
        }
      }
      const rising = below ? Math.max(0, snapshot.stairFlow[below.landing]) : 0
      const sinking = landing ? Math.max(0, -snapshot.stairFlow[landing.landing]) : 0
      u.stairStrength.value.set(rising, sinking)
      u.stairDownAge.value = landing ? snapshot.stairDownAge[landing.landing] : 0
      u.stairDensity.value.set(
        below ? snapshot.rooms[below.landing].density : 0,
        above ? snapshot.rooms[above.landing].density : 0,
      )
      mesh.visible =
        Boolean(fire) ||
        local.opacity > 0.002 ||
        u.strength.value > 0.002 ||
        incomingRate > 0.002 ||
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
