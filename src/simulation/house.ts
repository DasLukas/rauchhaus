import layout from './layout.json' with { type: 'json' }

/** Identifiers shared by the model, the learning scenarios and their tests. */
export type RoomId =
  | 'storage'
  | 'laundry'
  | 'studio0'
  | 'dining'
  | 'kitchen'
  | 'living'
  | 'bedroom'
  | 'studio1'
  | 'studio2'
  | 'playroom'
  | 'sleep2'
  | 'attic'
  | 'loft'
  | 'stairB'
  | 'stair0'
  | 'stair1'
  | 'stair2'
  | 'stair3'
export type DoorId =
  | 'dbl'
  | 'dbr'
  | 'd0l'
  | 'd0'
  | 'd1'
  | 'd1r'
  | 'd2l'
  | 'd2'
  | 'd3'
  | 'd3r'
  | 'i0'
  | 'i1'
  | 'i2'
export type SourceId =
  | 's_washer'
  | 's_kettle'
  | 's_stove'
  | 's_candle'
  | 's_lamp'
  | 's_tv'
  | 's_radio'
  | 's_floorlamp'
  | 's_desk'
  | 's_bed2'
  | 's_attic'
  | 's_loft'
export type DetectorId = 'm_living' | 'm_bed' | 'm_attic' | 'm_laundry'

export interface Room {
  readonly id: RoomId
  readonly label: string
  readonly floor: number
  readonly floorY: number
  /** Highest interior point of the room, including the attic gable. */
  readonly ceilingY: number
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

export interface Door {
  readonly id: DoorId
  readonly label: string
  readonly floor: number
  /** Positive doorway flow goes from the first room to the second room. */
  readonly rooms: readonly [RoomId, RoomId]
  readonly initiallyOpen: boolean
  readonly x: number
  readonly hingeZ: number
  readonly latchZ: number
  readonly height: number
  /** Signed angle about the Y axis measured from the closed position. */
  readonly openAngle: number
  /** Absolute height of the lintel. */
  readonly topY: number
}

export interface Source {
  readonly id: SourceId
  readonly label: string
  readonly room: RoomId
  readonly position: readonly [number, number, number]
}

export interface Detector {
  readonly id: DetectorId
  readonly label: string
  readonly room: RoomId
  readonly position: readonly [number, number, number]
  readonly sensorY: number
}

export const DIMENSIONS = layout.dimensions
export const ROOF = layout.roof
export const FLOORS = layout.floors.map((f) => ({ ...f, landing: f.landing as RoomId }))

/** Underside of the pitched roof at the specified horizontal coordinate. */
export function roofHeightAt(x: number): number {
  return ROOF.ridgeY - ROOF.slope * Math.abs(x)
}

/**
 * The JSON stores wall centerlines for construction. The simulation occupies
 * the clear volume between wall faces. The open cutaway is a viewing plane.
 */
export const ROOMS: readonly Room[] = layout.rooms.map((room) => {
  const floorY = DIMENSIONS.levelHeight * room.floor
  const halfWall = DIMENSIONS.wallThickness / 2
  const minX = room.minX + halfWall
  const maxX = room.maxX - halfWall
  const ridge = Math.max(minX, Math.min(0, maxX))
  return {
    ...room,
    id: room.id as RoomId,
    minX,
    maxX,
    floorY,
    minZ: DIMENSIONS.minZ + halfWall,
    maxZ: DIMENSIONS.maxZ,
    ceilingY: room.floor === ROOF.floor ? roofHeightAt(ridge) : floorY + DIMENSIONS.clearHeight,
  }
})

export const DOORS: readonly Door[] = layout.doors.map((door) => ({
  ...door,
  id: door.id as DoorId,
  rooms: door.rooms as [RoomId, RoomId],
  topY: door.floor * DIMENSIONS.levelHeight + door.height,
}))

export const SOURCES: readonly Source[] = layout.sources.map((source) => ({
  ...source,
  id: source.id as SourceId,
  room: source.room as RoomId,
  position: source.position as [number, number, number],
}))

export const DETECTORS: readonly Detector[] = layout.detectors.map((detector) => ({
  ...detector,
  id: detector.id as DetectorId,
  room: detector.room as RoomId,
  position: detector.position as [number, number, number],
  sensorY: detector.position[1],
}))

/** Exact volume under the clipped gable, above a horizontal layer boundary. */
function atticVolumeAbove(bounds: Room, height: number): number {
  const reach = Math.max(0, (roofHeightAt(0) - height) / ROOF.slope)
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
  return bounds.floor === ROOF.floor
    ? atticVolumeAbove(bounds, plane)
    : (bounds.ceilingY - plane) * floorArea(bounds)
}

/** Returns the absolute height delimiting the specified upper-layer volume. */
export function layerBase(bounds: Room, volume: number): number {
  if (volume <= 0) return bounds.ceilingY
  if (bounds.floor !== ROOF.floor) {
    return Math.max(bounds.floorY, bounds.ceilingY - volume / floorArea(bounds))
  }
  if (volume >= volumeAbove(bounds, bounds.floorY)) return bounds.floorY
  let low = bounds.floorY
  let high = bounds.ceilingY
  for (let iteration = 0; iteration < 19; iteration++) {
    const mid = (low + high) / 2
    if (volumeAbove(bounds, mid) > volume) low = mid
    else high = mid
  }
  return (low + high) / 2
}
