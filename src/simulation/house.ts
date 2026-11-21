/** Model coordinates match the exported glTF scene, with positive Y pointing up. */
export type RoomId =
  | 'kitchen'
  | 'dining'
  | 'living'
  | 'bedroom'
  | 'playroom'
  | 'attic'
  | 'stair0'
  | 'stair1'
  | 'stair2'
  | 'stair3'
export type DoorId = 'd0' | 'd1' | 'd2' | 'd3' | 'i0' | 'i2'
export type SourceId = 's_stove' | 's_candle' | 's_tv' | 's_lamp' | 's_desk' | 's_attic'
export type DetectorId = 'm_bed' | 'm_attic' | 'm_living'

export interface Room {
  readonly id: RoomId
  readonly label: string
  readonly floor: number
  readonly floorY: number
  /** Highest part of the room, including the gable on the top floor. */
  readonly ceilingY: number
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

export interface Door {
  readonly id: DoorId
  readonly label: string
  readonly rooms: readonly [RoomId, RoomId]
  readonly initiallyOpen: boolean
  /** Absolute height of the lintel. */
  readonly topY: number
}

export interface Source {
  readonly id: SourceId
  readonly label: string
  readonly room: RoomId
}

export interface Detector {
  readonly id: DetectorId
  readonly label: string
  readonly room: RoomId
  /** Absolute height of the sensing element under the local ceiling. */
  readonly sensorY: number
}

/** Inside surface of the two gable roof panels in model coordinates. */
export function roofHeightAt(x: number): number {
  return 8.56 - 0.72 * Math.abs(x)
}

function room(id: RoomId, label: string, floor: number, minX: number, maxX: number): Room {
  const nearestToRidge = Math.max(minX, Math.min(0, maxX))
  const floorY = 2.1 * floor
  return {
    id,
    label,
    floor,
    floorY,
    minX,
    maxX,
    minZ: -0.96,
    maxZ: 1.05,
    ceilingY: floor === 3 ? roofHeightAt(nearestToRidge) : floorY + 1.99,
  }
}

/** Clear interior bounds; each stair landing is its own connected compartment. */
export const ROOMS: readonly Room[] = [
  room('kitchen', 'Küche', 0, -3, -0.993),
  room('dining', 'Esszimmer', 0, -0.907, 1.4),
  room('stair0', 'Treppenhaus im Erdgeschoss', 0, 1.5, 3),
  room('living', 'Wohnzimmer', 1, -3, 1.4),
  room('stair1', 'Treppenhaus im ersten Stock', 1, 1.5, 3),
  room('bedroom', 'Schlafzimmer', 2, -3, -0.993),
  room('playroom', 'Kinderzimmer', 2, -0.907, 1.4),
  room('stair2', 'Treppenhaus im zweiten Stock', 2, 1.5, 3),
  room('attic', 'Lesezimmer im Dachgeschoss', 3, -3, 1.4),
  room('stair3', 'Treppenhaus im Dachgeschoss', 3, 1.5, 3),
]

/** Positive doorway flow travels from the first listed room to the second. */
export const DOORS: readonly Door[] = [
  {
    id: 'd0',
    label: 'Wohnungstür im Erdgeschoss',
    rooms: ['dining', 'stair0'],
    initiallyOpen: false,
    topY: 1.64,
  },
  {
    id: 'd1',
    label: 'Wohnungstür im ersten Stock',
    rooms: ['living', 'stair1'],
    initiallyOpen: false,
    topY: 3.74,
  },
  {
    id: 'd2',
    label: 'Wohnungstür im zweiten Stock',
    rooms: ['playroom', 'stair2'],
    initiallyOpen: false,
    topY: 5.84,
  },
  {
    id: 'd3',
    label: 'Wohnungstür im Dachgeschoss',
    rooms: ['attic', 'stair3'],
    initiallyOpen: false,
    topY: 7.4,
  },
  {
    id: 'i0',
    label: 'Tür zwischen Küche und Esszimmer',
    rooms: ['kitchen', 'dining'],
    initiallyOpen: true,
    topY: 1.64,
  },
  {
    id: 'i2',
    label: 'Tür zwischen Schlafzimmer und Kinderzimmer',
    rooms: ['bedroom', 'playroom'],
    initiallyOpen: true,
    topY: 5.84,
  },
]

export const SOURCES: readonly Source[] = [
  { id: 's_stove', label: 'Herd', room: 'kitchen' },
  { id: 's_candle', label: 'Kerze', room: 'dining' },
  { id: 's_tv', label: 'Fernseher', room: 'living' },
  { id: 's_lamp', label: 'Nachttischlampe', room: 'bedroom' },
  { id: 's_desk', label: 'Schreibtischlampe', room: 'playroom' },
  { id: 's_attic', label: 'Leselampe', room: 'attic' },
]

export const DETECTORS: readonly Detector[] = [
  { id: 'm_bed', label: 'Rauchwarnmelder im Schlafzimmer', room: 'bedroom', sensorY: 6.09 },
  { id: 'm_attic', label: 'Rauchwarnmelder im Dachgeschoss', room: 'attic', sensorY: 8.245 },
  { id: 'm_living', label: 'Rauchwarnmelder im Wohnzimmer', room: 'living', sensorY: 3.99 },
]

/** Exact volume under the clipped gable, above a horizontal layer boundary. */
function atticVolumeAbove(bounds: Room, height: number): number {
  const reach = Math.max(0, (roofHeightAt(0) - height) / 0.72)
  function section(near: number, far: number): number {
    const end = Math.min(reach, far)
    if (end <= near) return 0
    return (end - near) * (roofHeightAt((near + end) / 2) - height)
  }
  const left = section(Math.max(0, -bounds.maxX), Math.max(0, -bounds.minX))
  const right = section(Math.max(0, bounds.minX), Math.max(0, bounds.maxX))
  return (left + right) * (bounds.maxZ - bounds.minZ)
}

export function floorArea(bounds: Room): number {
  return (bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ)
}

/** Returns the volume between a horizontal plane and the room's ceiling. */
export function volumeAbove(bounds: Room, y: number): number {
  const plane = Math.max(bounds.floorY, Math.min(bounds.ceilingY, y))
  return bounds.floor === 3
    ? atticVolumeAbove(bounds, plane)
    : (bounds.ceilingY - plane) * floorArea(bounds)
}

/** Returns the absolute height delimiting the specified upper-layer volume. */
export function layerBase(bounds: Room, volume: number): number {
  if (volume <= 0) return bounds.ceilingY
  if (bounds.floor !== 3) {
    return Math.max(bounds.floorY, bounds.ceilingY - volume / floorArea(bounds))
  }
  if (volume >= volumeAbove(bounds, bounds.floorY)) return bounds.floorY
  let low = bounds.floorY
  let high = bounds.ceilingY
  for (let iteration = 0; iteration < 15; iteration++) {
    const mid = (low + high) / 2
    if (volumeAbove(bounds, mid) > volume) low = mid
    else high = mid
  }
  return (low + high) / 2
}
