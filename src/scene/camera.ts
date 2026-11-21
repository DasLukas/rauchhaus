import { MathUtils, OrthographicCamera, Vector3 } from 'three'
import { FLOORS, HOUSE_VARIANT, ROOMS } from '../simulation'

// The small house has its entrance and solar panels on the right.
const FRONT_YAW = HOUSE_VARIANT === 'klein' ? 0.26 : -0.15
const ELEVATION = 0.16
const clamp = MathUtils.clamp
const levels = FLOORS.map((floor) => floor.level).sort((a, b) => a - b)
const floorBases = new Map(ROOMS.map((room) => [room.floor, room.floorY]))
const minY = Math.min(...ROOMS.map((room) => room.floorY))
const maxY = Math.max(...ROOMS.map((room) => room.ceilingY))
const minX = Math.min(...ROOMS.map((room) => room.minX))
const maxX = Math.max(...ROOMS.map((room) => room.maxX))
const modelWidth = maxX - minX
const modelHeight = maxY - minY

/** Resolve physical taps against the same storey elevations that bound the smoke. */
export function pickedFloor(world: Vector3): number | undefined {
  if (
    world.x < minX - 0.15 ||
    world.x > maxX + 0.15 ||
    world.y < minY - 0.1 ||
    world.y > maxY + 0.2
  )
    return
  for (let i = levels.length - 1; i >= 0; i--) {
    if (world.y >= (floorBases.get(levels[i]) ?? 0) - 0.03) return levels[i]
  }
}

/** Frames the whole cutaway and allows room-scale exploration using a single finger. */
export class HouseCamera {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  floor: number | null = null
  private zoom = 1
  private width = 1
  private height = 1
  private yaw = FRONT_YAW
  private currentYaw = FRONT_YAW
  private span = modelHeight + 1.3
  private centerY = (maxY + minY) / 2
  private centerX = 0
  private targetX = 0
  private targetY = this.centerY
  private projectionDirty = true
  private readonly target = new Vector3()

  resize(width: number, height: number): void {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.projectionDirty = true
    this.update(1, true)
  }

  zoomBy(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return
    this.zoom = clamp(this.zoom * factor, this.floor === null ? 0.9 : 0.72, 3.2)
    if (!this.isDetail) {
      this.targetX = 0
      this.targetY = (maxY + minY) / 2
    }
  }

  private get isDetail() {
    return this.floor !== null || this.zoom > 1.01
  }

  drag(dx: number, dy: number): void {
    if (this.isDetail) {
      const perPixel = this.span / this.height
      this.targetX = clamp(this.targetX - dx * perPixel, minX, maxX)
      const base = this.floor === null ? undefined : floorBases.get(this.floor)
      // A selected floor keeps its controls in reach as a child explores it.
      this.targetY = clamp(
        this.targetY + dy * perPixel,
        base === undefined ? minY : base + 0.35,
        base === undefined ? maxY : (floorBases.get((this.floor ?? 0) + 1) ?? maxY) - 0.35,
      )
    } else {
      this.yaw = clamp(this.yaw - (dx / this.width) * 0.96, -0.32, 0.32)
    }
  }

  /** Center a room or landing; returns false for a level absent from this house. */
  focus(floor: number, x = 0): boolean {
    const floorY = floorBases.get(floor)
    if (floorY === undefined) return false
    this.floor = floor
    this.targetY = floorY + 1.22
    this.targetX = clamp(x, minX, maxX)
    this.zoom = 1
    return true
  }

  reset(): void {
    this.floor = null
    this.targetY = (minY + maxY) / 2
    this.targetX = 0
    this.yaw = FRONT_YAW
    this.zoom = 1
  }

  update(dt: number, snap: boolean): boolean {
    const aspect = this.width / this.height
    // Keep the full house and its doors on a portrait screen. In landscape
    // the additional room at the edges also shows the garden and terrain.
    const overviewWidth = modelWidth + (aspect >= 1.22 ? 4.8 : this.width >= 650 ? 4.1 : 1.65)
    const focusWidth = clamp(this.width / 89, 5.3, modelWidth + 1.7)
    const fit =
      this.floor === null
        ? Math.max(modelHeight + 1.7, overviewWidth / aspect)
        : Math.max(4.1, focusWidth / aspect)
    const span = fit / this.zoom
    const halfWidth = (span * aspect) / 2
    const panLimitX = Math.max(0, modelWidth / 2 + 0.6 - halfWidth)
    const x = clamp(this.targetX, -panLimitX, panLimitX)
    this.targetX = x
    const y = this.isDetail ? clamp(this.targetY, minY + 0.8, maxY - 0.6) : (minY + maxY) / 2
    const changed =
      this.projectionDirty ||
      Math.abs(this.currentYaw - this.yaw) > 0.00008 ||
      Math.abs(this.span - span) > 0.0008 ||
      Math.abs(this.centerY - y) > 0.0008 ||
      Math.abs(this.centerX - x) > 0.0008
    if (!changed) return false
    this.projectionDirty = false
    const t = snap ? 1 : 1 - Math.exp(-dt * 14)
    this.currentYaw = MathUtils.lerp(this.currentYaw, this.yaw, t)
    this.span = MathUtils.lerp(this.span, span, t)
    this.centerY = MathUtils.lerp(this.centerY, y, t)
    this.centerX = MathUtils.lerp(this.centerX, x, t)
    const camera = this.camera
    camera.left = (-this.span * aspect) / 2
    camera.right = -camera.left
    camera.top = this.span / 2
    camera.bottom = -camera.top
    this.target.set(this.centerX, this.centerY, 0)
    camera.position
      .set(34 * Math.sin(this.currentYaw), 34 * Math.tan(ELEVATION), 34 * Math.cos(this.currentYaw))
      .add(this.target)
    camera.lookAt(this.target)
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    return true
  }
}
