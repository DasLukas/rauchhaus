import {
  constrainPoint,
  factorPoint,
  TRIANGLE_CENTER,
  type TriangleFactor,
  type TrianglePoint,
} from './experiment'

export type TrianglePhase = 'free' | 'predict' | 'explore' | 'discuss' | 'transfer' | 'result'

export const predictionLabels = {
  steady: 'Große Flammen',
  weak: 'Kleinere Flammen',
  dark: 'Holz ohne Flammen',
  empty: 'Kein Holz, keine Flammen',
} as const

export type Prediction = keyof typeof predictionLabels

interface Observation {
  deficiency: number
  direction: string
  observation: string
}

interface Comparison {
  factor: TriangleFactor
  title: string
  prediction: string
  choices: readonly Prediction[]
  observations: readonly Observation[]
}

const comparisons: readonly Comparison[] = [
  {
    factor: 'oxygen',
    title: 'Weniger Sauerstoff',
    prediction: 'Was siehst du wohl, wenn das Holz etwas weniger Sauerstoff bekommt?',
    choices: ['steady', 'weak', 'dark'],
    observations: [
      {
        deficiency: 0.65,
        direction:
          'Folge dem Pfeil nach links unten, weg vom Luftzeichen. Schau dabei auf die Flammen.',
        observation: 'Die Flammen sind kleiner als am Anfang. Wovon hat das Holz noch genug?',
      },
      {
        deficiency: 1,
        direction:
          'Folge dem Pfeil weiter bis zur Ecke. Was passiert jetzt mit Flammen und Glut?',
        observation:
          'Die Flammen sind aus. Das heiße Holz kann noch kurz nachglühen. Was war beim ersten Stopp anders?',
      },
    ],
  },
  {
    factor: 'heat',
    title: 'Weniger Wärme',
    prediction:
      'Das Holz brennt wieder wie am Anfang. Was siehst du im Ofen, wenn das Holz ganz abkühlt?',
    choices: ['dark', 'steady', 'empty'],
    observations: [
      {
        deficiency: 1,
        direction: 'Bewege den Knopf vom Thermometer weg. Schau auf das Holz und auf die Flammen.',
        observation:
          'Das Holz liegt noch im Ofen. Es ist zu kühl, um weiterzubrennen. Woran siehst du das?',
      },
    ],
  },
  {
    factor: 'fuel',
    title: 'Weniger Brennstoff',
    prediction:
      'Wieder brennt dasselbe Holzscheit. Wie sieht der Ofen aus, wenn der Brennstoff ganz aufgebraucht ist?',
    choices: ['dark', 'empty', 'weak'],
    observations: [
      {
        deficiency: 1,
        direction: 'Finde den Weg für weniger Brennstoff. Beobachte Holz und Flammen.',
        observation:
          'Das Holz ist aufgebraucht und die Flammen sind aus. Was ist anders als beim Versuch mit weniger Wärme?',
      },
    ],
  },
]

/** The free experiment and its camera and pause setting survive a complete or interrupted lesson. */
export class TriangleSession {
  phase: TrianglePhase = 'free'
  private index = 0
  private stopIndex = 0
  prediction: Prediction | null = null
  private guidedPoint = TRIANGLE_CENTER
  private freePoint = TRIANGLE_CENTER
  private freePaused = false
  private freeAngle = 0

  get comparison() {
    return comparisons[this.index]
  }
  get stop() {
    return this.comparison.observations[this.stopIndex]
  }
  get firstStop() {
    return this.stopIndex === 0
  }
  get hasAnotherStop() {
    return this.stopIndex + 1 < this.comparison.observations.length
  }
  /** Mark the two oxygen paths while the class first learns to move away from a side. */
  get guide() {
    if (this.phase !== 'explore' || this.comparison.factor !== 'oxygen') return null
    return {
      from: factorPoint('oxygen', this.comparison.observations[this.stopIndex - 1]?.deficiency ?? 0),
      to: factorPoint('oxygen', this.stop.deficiency),
    }
  }
  get number() {
    return this.index + 1
  }
  get total() {
    return comparisons.length
  }
  get position() {
    return this.phase === 'free' ? this.freePoint : this.guidedPoint
  }
  get paused() {
    return this.phase === 'free' && this.freePaused
  }
  get viewAngle() {
    return this.freeAngle
  }

  /** Start at a repeatable baseline, retaining the free view for restoration on exit. */
  begin(freeAngle: number) {
    if (this.phase !== 'free') return
    this.freeAngle = freeAngle
    this.index = 0
    this.stopIndex = 0
    this.prediction = null
    this.guidedPoint = TRIANGLE_CENTER
    this.phase = 'predict'
  }

  /**
   * In a guided trial, project the input onto the path opposite its named side.
   * The other two conditions then remain sufficient throughout the comparison.
   */
  move(point: TrianglePoint) {
    if (this.phase === 'free') {
      this.freePoint = constrainPoint(point)
      return
    }
    if (this.phase !== 'explore') return
    const { factor } = this.comparison
    const end = factorPoint(factor, 1)
    const dx = end.x - TRIANGLE_CENTER.x
    const dy = end.y - TRIANGLE_CENTER.y
    const t =
      ((point.x - TRIANGLE_CENTER.x) * dx + (point.y - TRIANGLE_CENTER.y) * dy) /
      (dx * dx + dy * dy)
    if (t >= this.stop.deficiency - 0.035) this.showObservation()
    else
      this.guidedPoint = factorPoint(
        factor,
        Math.max(t, this.comparison.observations[this.stopIndex - 1]?.deficiency ?? 0),
      )
  }

  /** Accept an optional prediction from this trial until the class starts observing. */
  choose(choice: Prediction) {
    if (this.phase === 'predict' && this.comparison.choices.includes(choice))
      this.prediction = this.prediction === choice ? null : choice
  }

  /** Land on the same observation point as a completed drag. */
  showObservation() {
    if (this.phase !== 'explore') return
    this.guidedPoint = factorPoint(this.comparison.factor, this.stop.deficiency)
    this.phase = 'discuss'
  }

  /** Advance only after the class has had time to predict, observe or explain. */
  next() {
    switch (this.phase) {
      case 'predict':
        this.phase = 'explore'
        break
      case 'explore':
        this.showObservation()
        break
      case 'discuss':
        if (this.hasAnotherStop) {
          this.stopIndex++
          this.phase = 'explore'
        } else if (this.number === this.total) {
          this.phase = 'transfer'
        } else {
          this.index++
          this.stopIndex = 0
          this.prediction = null
          this.guidedPoint = TRIANGLE_CENTER
          this.phase = 'predict'
        }
        break
      case 'transfer':
        this.phase = 'result'
        break
      case 'result':
        this.end()
        break
    }
  }

  togglePause() {
    if (this.phase === 'free') this.freePaused = !this.freePaused
  }

  end() {
    this.phase = 'free'
  }

  /** Restore the initial free experiment, including a centred camera. */
  restart() {
    this.phase = 'free'
    this.freePoint = TRIANGLE_CENTER
    this.freePaused = false
    this.freeAngle = 0
  }
}
