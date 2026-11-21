import { MathUtils, OrthographicCamera, Vector3 } from 'three'

const FRONT_YAW = -0.09
const ELEVATION = 0.102
const clamp = MathUtils.clamp

/** Keeps the cutaway readable while allowing small changes of viewpoint. */
export class HouseCamera {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 65)
  floor: number | null = null
  zoom = 1
  private width = 1
  private height = 1
  private yaw = FRONT_YAW
  private currentYaw = FRONT_YAW
  private span = 9.6
  private centerY = 4.15
  private centerX = 0
  private pan = 0
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
    this.zoom = clamp(this.zoom * factor, 0.85, 2.7)
    if (this.zoom <= 1) this.pan = 0
  }

  drag(dx: number, dy: number): void {
    this.yaw = clamp(this.yaw - (dx / this.width) * 0.82, -0.255, 0.255)
    if (this.zoom > 1 || this.floor !== null) {
      this.pan = clamp(this.pan + (dy * this.span) / this.height, -3.75, 3.75)
    }
  }

  focus(floor: number): void {
    this.floor = clamp(Math.round(floor), 0, 3)
    this.pan = 0
    this.zoom = 1
  }

  reset(): void {
    this.floor = null
    this.pan = 0
    this.yaw = FRONT_YAW
    this.zoom = 1
  }

  update(dt: number, snap: boolean): boolean {
    const aspect = this.width / this.height
    const floor = this.floor
    // On portrait displays the side of the garden may extend outside the view.
    // Keep every room visible and reserve as many pixels as possible for doors.
    const overviewWidth = aspect >= 1.15 ? 10.75 : 7.1
    const fit =
      floor === null ? Math.max(9.4, overviewWidth / aspect) : Math.max(3.45, 6.85 / aspect)
    const span = fit / this.zoom
    const baseY = floor === null ? 4.16 : floor * 2.1 + (floor === 3 ? 1.04 : 0.96)
    const y = clamp(baseY + this.pan, 0.9, 7.65)
    const x = floor === null ? 0 : -0.05
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
      .set(24 * Math.sin(this.currentYaw), 24 * Math.tan(ELEVATION), 24 * Math.cos(this.currentYaw))
      .add(this.target)
    camera.lookAt(this.target)
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    return true
  }
}
