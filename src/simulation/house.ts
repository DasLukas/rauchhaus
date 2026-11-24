import largeLayout from './layout.json' with { type: 'json' }
import smallLayout from './layout-small.json' with { type: 'json' }

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
  | 'entry'
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
export type DetectorId = `m_${Exclude<RoomId, 'bedroom' | 'stairB' | 'stair0' | 'stair1' | 'stair2'> | 'bed'}`
export type InfoId = keyof typeof smallLayout.infoSpots | keyof typeof largeLayout.infoSpots

/** A safety tip anchored beside an object in one room of the cutaway. */
export interface InfoSpot {
  readonly id: InfoId
  readonly room: RoomId
  readonly position: readonly [number, number, number]
}

export interface Room {
  readonly id: RoomId
  readonly label: string
  readonly floor: number
  readonly floorY: number
  readonly roof?: typeof largeLayout.roof
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
  readonly rooms: readonly [RoomId, RoomId | 'outside']
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

export type HouseVariant = 'klein' | 'gross'

/** Selects the small classroom house unless the URL explicitly requests the large house. */
export function houseVariantForSearch(search: string): HouseVariant {
  return new URLSearchParams(search).get('haus') === 'gross' ? 'gross' : 'klein'
}

/** Underside of the pitched roof at the specified horizontal coordinate. */
export function roofHeightAt(x: number, roof: typeof largeLayout.roof = ROOF): number {
  return roof.ridgeY - roof.slope * Math.abs(x)
}

/**
 * Convert the shared Blender wall centerlines to clear compartment dimensions,
 * preserving the cutaway front as a viewing plane.
 */
export function getHouse(variant: HouseVariant) {
  const layout = variant === 'gross' ? largeLayout : smallLayout
  const { dimensions, roof } = layout
  const floors = layout.floors.map((floor) => ({ ...floor, landing: floor.landing as RoomId }))
  const rooms: Room[] = layout.rooms.map((room) => {
    const floorY = dimensions.levelHeight * room.floor
    const halfWall = dimensions.wallThickness / 2
    const minX = room.minX + halfWall
    const maxX = room.maxX - halfWall
    const ridge = Math.max(minX, Math.min(0, maxX))
    return {
      ...room,
      id: room.id as RoomId,
      minX,
      maxX,
      floorY,
      minZ: dimensions.minZ + halfWall,
      maxZ: dimensions.maxZ,
      roof: room.floor === roof.floor ? roof : undefined,
      ceilingY:
        room.floor === roof.floor ? roofHeightAt(ridge, roof) : floorY + dimensions.clearHeight,
    }
  })
  const openings = [...layout.doors]
  if ('exteriorDoor' in layout) {
    const entry = layout.exteriorDoor
    openings.push({ ...entry, rooms: [entry.room, 'outside'] })
  }
  const doors: Door[] = openings.map((door) => ({
    ...door,
    id: door.id as DoorId,
    rooms: door.rooms as [RoomId, RoomId | 'outside'],
    topY: door.floor * dimensions.levelHeight + door.height,
  }))
  const sources: Source[] = layout.sources.map((source) => ({
    ...source,
    id: source.id as SourceId,
    room: source.room as RoomId,
    position: source.position as [number, number, number],
  }))
  const classroomSources = Object.entries(layout.sourceMarkers).map(([id, marker]) => {
    const source = sources.find((item) => item.id === id)
    if (!source) throw new Error(`Missing smoke source: ${id}`)
    return { ...source, marker }
  })
  const detectors: Detector[] = layout.detectors.map((detector) => ({
    ...detector,
    id: detector.id as DetectorId,
    room: detector.room as RoomId,
    position: detector.position as [number, number, number],
    sensorY: detector.position[1],
  }))
  const infoSpots: InfoSpot[] = Object.entries(layout.infoSpots).map(([id, spot]) => ({
    id: id as InfoId,
    room: spot.room as RoomId,
    position: spot.position as [number, number, number],
  }))
  return {
    dimensions,
    roof,
    floors,
    rooms,
    doors,
    sources,
    classroomSources,
    detectors,
    infoSpots,
    detailOnlyMarkers: layout.detailOnlyMarkers,
    modelFilename: variant === 'klein' ? 'rauchhaus-klein.glb' : 'rauchhaus.glb',
  }
}

export const HOUSE_VARIANT =
  typeof window === 'undefined' ? 'gross' : houseVariantForSearch(window.location.search)
export const HOUSE = getHouse(HOUSE_VARIANT)
export const {
  dimensions: DIMENSIONS,
  roof: ROOF,
  floors: FLOORS,
  rooms: ROOMS,
  doors: DOORS,
  sources: SOURCES,
  classroomSources: CLASSROOM_SOURCES,
  detectors: DETECTORS,
  infoSpots: INFO_SPOTS,
  modelFilename: MODEL_FILENAME,
} = HOUSE

/** Exact volume under the clipped gable, above a horizontal layer boundary. */
function atticVolumeAbove(bounds: Room, height: number, roof: typeof ROOF): number {
  const reach = Math.max(0, (roof.ridgeY - height) / roof.slope)
  function section(near: number, far: number): number {
    const end = Math.min(reach, far)
    if (end <= near) return 0
    return (end - near) * (roofHeightAt((near + end) / 2, roof) - height)
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
  return bounds.roof
    ? atticVolumeAbove(bounds, plane, bounds.roof)
    : (bounds.ceilingY - plane) * floorArea(bounds)
}

/** Returns the absolute height delimiting the specified upper-layer volume. */
export function layerBase(bounds: Room, volume: number): number {
  if (volume <= 0) return bounds.ceilingY
  if (!bounds.roof) {
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
