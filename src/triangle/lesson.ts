import {
  constrainPoint,
  factorPoint,
  STOVE_START_ANGLE,
  TRIANGLE_CENTER,
  type TriangleFactor,
  type TrianglePoint,
} from './experiment'

interface Trial {
  factor: TriangleFactor
  title: string
  prompt: string
  observation: string
  deficiency: number
}

const trials: readonly Trial[] = [
  {
    factor: 'oxygen',
    title: 'Weniger Sauerstoff',
    prompt: 'Zieh den Knopf am Pfeil entlang. Was machen die Flammen?',
    observation: 'Das Holzfeuer bekommt weniger Sauerstoff aus der Luft. Hier werden die Flammen kleiner.',
    deficiency: 0.65,
  },
  {
    factor: 'heat',
    title: 'Weniger Wärme',
    prompt: 'Zieh den Knopf vom Thermometer weg. Was passiert mit den Flammen?',
    observation: 'Das Holz ist zu kühl für Flammen. Es kann trotzdem noch heiß sein.',
    deficiency: 1,
  },
  {
    factor: 'fuel',
    title: 'Weniger Brennstoff',
    prompt: 'Zieh den Knopf vom Holzzeichen weg. Was bleibt übrig?',
    observation: 'Asche bleibt übrig. Ein Holzfeuer braucht Brennstoff, genug Wärme und Sauerstoff.',
    deficiency: 1,
  },
]

/** Three single-factor trials share the free experiment and its movable knob. */
export class TriangleSession {
  phase: 'free' | 'explore' | 'observe' = 'free'
  private index = 0
  private guidedPoint = TRIANGLE_CENTER
  private freePoint = TRIANGLE_CENTER
  private freeAngle = STOVE_START_ANGLE

  get trial() {
    return trials[this.index]
  }
  get number() {
    return this.index + 1
  }
  get total() {
    return trials.length
  }
  get position() {
    return this.phase === 'free' ? this.freePoint : this.guidedPoint
  }
  get viewAngle() {
    return this.freeAngle
  }
  private get target() {
    return factorPoint(this.trial.factor, this.trial.deficiency)
  }
  get guide() {
    return this.phase === 'explore' ? { from: TRIANGLE_CENTER, to: this.target } : null
  }

  /** Start with the same burning log for everyone, preserving the child's free view. */
  begin(freeAngle: number) {
    if (this.phase !== 'free') return
    this.freeAngle = freeAngle
    this.index = 0
    this.guidedPoint = TRIANGLE_CENTER
    this.phase = 'explore'
  }

  /** Project guided input onto the arrow so only the selected factor can decrease. */
  move(point: TrianglePoint) {
    if (this.phase === 'free') {
      this.freePoint = constrainPoint(point)
      return
    }
    if (this.phase !== 'explore') return
    const end = factorPoint(this.trial.factor, 1)
    const dx = end.x - TRIANGLE_CENTER.x
    const dy = end.y - TRIANGLE_CENTER.y
    const t =
      ((point.x - TRIANGLE_CENTER.x) * dx + (point.y - TRIANGLE_CENTER.y) * dy) /
      (dx * dx + dy * dy)
    if (t >= this.trial.deficiency - 0.035) this.next()
    else this.guidedPoint = factorPoint(this.trial.factor, t)
  }

  /** Show the observation, start the next trial with fresh wood, or return to free play. */
  next() {
    if (this.phase === 'explore') {
      this.guidedPoint = this.target
      this.phase = 'observe'
    } else if (this.phase === 'observe') {
      if (this.number === this.total) this.end()
      else {
        this.index++
        this.guidedPoint = TRIANGLE_CENTER
        this.phase = 'explore'
      }
    }
  }

  end() {
    this.phase = 'free'
  }

  /** Restore the initial free experiment and the default viewing angle. */
  restart() {
    this.end()
    this.freePoint = TRIANGLE_CENTER
    this.freeAngle = STOVE_START_ANGLE
  }
}
