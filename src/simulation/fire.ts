/** Observable fire behaviour in the source compartment, in normalized teaching units. */
export interface FireState {
  readonly phase: 'local' | 'rollover' | 'flashover'
  readonly burstSeed: number
  /** Visible flame strength at the selected object. */
  readonly sourceIntensity: number
  /** Flaming gas at the interface of the upper layer and the air below. */
  readonly rollover: number
  /** Visible release from the heated fuel surfaces before it ignites. */
  readonly outgassing: number
  /** Strength of secondary flames on exposed room contents after flashover. */
  readonly involvement: number
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

/**
 * Qualitative, time-compressed compartment fire. All state and coefficients
 * are dimensionless or paced in demonstration seconds. Air exchange limits
 * combustion, the upper layer heats up, and radiation heats exposed contents.
 */
export class CompartmentFire {
  constructor(private readonly burstSeed: number) {}

  private burningArea = 0.2
  private air = 1
  private layerHeating = 0
  private surfaceHeating = 0
  private involved = false
  private involvement = 0
  private rollover = 0
  private intensity = this.burningArea

  /** Advance using available ventilation and the depth and warmth of the smoke layer. */
  advance(dt: number, ventilation: number, layerDepth: number, warmth: number): void {
    // A closed compartment initially contains air. Continued burning consumes
    // it, while a connection to a clearer compartment can replenish it.
    const replenishment = (0.003 + ventilation * 0.28) * (1 - this.air)
    const consumption = 0.052 * (this.intensity + 0.35 * this.involvement)
    this.air = clamp(this.air + dt * (replenishment - consumption))
    this.burningArea += (dt * (1 - this.burningArea) * this.air) / 7
    const oxygenFactor = Math.min(1, this.air * 1.35)
    this.intensity = this.burningArea * oxygenFactor

    const layerCoverage = -Math.expm1(-layerDepth / 0.23)
    const heating = clamp(
      ((this.intensity + 0.35 * this.involvement) * layerCoverage * warmth) / 0.85,
    )
    this.layerHeating += (dt * (heating - this.layerHeating)) / 7
    this.rollover = clamp((this.layerHeating - 0.4) / 0.32) * oxygenFactor

    // Net thermal radiation rises nonlinearly with hot-layer temperature.
    // The scaled temperature ratio includes the ambient contribution. The
    // exposed surfaces respond with thermal inertia, independently of rollover.
    const radiantLoad = ((0.4 + 0.6 * this.layerHeating) ** 4 - 0.4 ** 4) / (1 - 0.4 ** 4)
    this.surfaceHeating += (dt * (radiantLoad - this.surfaceHeating)) / 7
    if (this.surfaceHeating >= 0.61 && oxygenFactor > 0.6) this.involved = true
    const roomFlames = this.involved ? oxygenFactor : 0
    this.involvement += (dt * (roomFlames - this.involvement)) / 1.25
  }

  /** Relative gas delivery from the source plume and secondary burning surfaces. */
  get plumeStrength(): number {
    return this.intensity + this.involvement * 0.8
  }

  /** Relative optical tracer yield; incomplete combustion in depleted air produces sootier smoke. */
  get sootYield(): number {
    return 0.16 + 0.38 * (1 - this.air)
  }

  /** Return a detached view that stays valid across later simulation steps. */
  snapshot(): FireState {
    return Object.freeze({
      burstSeed: this.burstSeed,
      phase: this.involved ? 'flashover' : this.rollover > 0.02 ? 'rollover' : 'local',
      sourceIntensity: this.intensity,
      rollover: this.rollover,
      outgassing: clamp((this.surfaceHeating - 0.32) / 0.18) * (1 - clamp(this.involvement * 4)),
      involvement: this.involvement,
    })
  }
}
