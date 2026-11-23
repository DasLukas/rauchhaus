import {
  HOUSE,
  SmokeSimulation,
  type DoorId,
  type SourceId,
  type SimulationSnapshot,
} from '../simulation'
import { sampleGasPair } from '../simulation/gas-flame'

export type FireObservation = 'rollover' | 'flashover'
export type LessonStage = 'open' | 'closed' | 'compare' | FireObservation | 'fire-result'
export type Lesson = 'doors' | 'fire'
// Allow the layer to become visible one landing above the television.
export const OBSERVATION_SECONDS = 40

/** Owns the free experiment and an isolated simulation for each guided lesson. */
export class LearningSession {
  private readonly free: SmokeSimulation
  private example: SmokeSimulation | null = null
  showingUpholstery = false
  stage: LessonStage | null = null
  paused = false
  snapshot: SimulationSnapshot

  constructor(private readonly house = HOUSE) {
    this.free = new SmokeSimulation(house)
    this.snapshot = this.free.snapshot()
  }

  get fireObservation(): FireObservation | null {
    switch (this.stage) {
      case 'rollover':
      case 'flashover':
        return this.stage
      default:
        return null
    }
  }

  get lesson(): Lesson | null {
    if (!this.stage) return null
    return this.fireObservation || this.stage === 'fire-result' ? 'fire' : 'doors'
  }

  private get active() {
    return this.example ?? this.free
  }

  /** Advances visible teaching time. Suspended tabs never need to catch up. */
  tick(seconds: number): SimulationSnapshot {
    if (this.paused || !this.snapshot.source || !Number.isFinite(seconds) || seconds <= 0) return this.snapshot
    if (this.fireObservation) {
      // Sample the same visible state on a skip and during ordinary playback.
      let remaining = Math.min(seconds, 60)
      while (remaining > 0 && !this.trialFinished) {
        const step = Math.min(remaining, 0.25)
        this.active.advance(step)
        this.snapshot = this.active.snapshot()
        remaining -= step
      }
      if (this.trialFinished) this.paused = true
      return this.snapshot
    }
    const doorTrial = this.stage === 'open' || this.stage === 'closed'
    const dt = doorTrial ? Math.min(seconds, OBSERVATION_SECONDS - this.snapshot.elapsed) : seconds
    if (dt > 0) this.active.advance(dt)
    this.snapshot = this.active.snapshot()
    if (this.trialFinished) this.paused = true
    return this.snapshot
  }

  /** Start a free experiment in an idle house and report whether the selection changed. */
  selectSource(id: SourceId): boolean {
    if (this.stage || this.snapshot.source !== null) return false
    this.free.start(id)
    this.paused = false
    this.snapshot = this.free.snapshot()
    return true
  }

  toggleDoor(id: DoorId) {
    if (this.stage) return
    this.free.setDoor(id, !this.snapshot.doors[id])
    this.snapshot = this.free.snapshot()
  }

  /** Restore the empty house and its initial doors, and leave any lesson. */
  restart() {
    this.showingUpholstery = false
    this.stage = null
    this.example = null
    this.free.reset()
    for (const door of this.house.doors) this.free.setDoor(door.id, door.initiallyOpen)
    this.paused = false
    this.snapshot = this.free.snapshot()
  }

  togglePause() {
    if (this.snapshot.source && this.stage !== 'compare' && !this.trialFinished)
      this.paused = !this.paused
  }

  get trialFinished() {
    const fire = this.snapshot.fire
    switch (this.stage) {
      case 'rollover':
        // Hold both visible tongues for discussion during the intermittent gas burning.
        return Boolean(
          fire && fire.rollover >= 0.45 && this.snapshot.source &&
          sampleGasPair(this.snapshot.elapsed, this.snapshot.source).every((burst) => burst.strength >= 0.72),
        )
      case 'flashover':
        return Boolean(fire && fire.involvement >= 0.65)
      case 'open':
      case 'closed':
        return this.snapshot.elapsed >= OBSERVATION_SECONDS
      case 'compare':
      case 'fire-result':
        return true
      default:
        return false
    }
  }

  /** Start a separate television experiment, starting from the lesson’s initial conditions. */
  beginLesson(lesson: Lesson = 'doors') {
    if (this.stage) return
    this.example = new SmokeSimulation(this.house, lesson === 'fire' ? 'compartment' : 'local')
    if (lesson === 'doors') {
      this.startTrial('open')
      return
    }
    this.example.setDoor('d1', true)
    this.example.start('s_tv')
    this.stage = 'rollover'
    this.paused = false
    this.snapshot = this.example.snapshot()
  }

  private startTrial(stage: 'open' | 'closed') {
    this.stage = stage
    for (const door of this.house.doors) this.active.setDoor(door.id, door.initiallyOpen)
    this.active.setDoor('d1', stage === 'open')
    this.active.start('s_tv')
    this.paused = false
    this.snapshot = this.active.snapshot()
  }

  /** Reaches the same observation point even when a class skips the animation. */
  finishTrial() {
    if (!this.stage || this.trialFinished) return
    this.paused = false
    if (this.stage === 'flashover' && !this.snapshot.fire?.involvement) {
      this.showingUpholstery = true
      // Seek into the upholstery preview, then let ordinary playback show ignition.
      for (let i = 0; i < 240 && (this.snapshot.fire?.outgassing ?? 0) < 0.85; i++) {
        this.tick(0.25)
        if (this.snapshot.fire?.involvement) break
      }
      return
    }
    this.tick(60)
  }

  nextTrial() {
    if (!this.trialFinished) return
    if (this.stage === 'rollover') {
      this.stage = 'flashover'
      this.paused = false
    } else if (this.stage === 'flashover') {
      this.stage = 'fire-result'
      this.paused = true
    } else if (this.stage === 'open') this.startTrial('closed')
    else if (this.stage === 'closed') {
      this.stage = 'compare'
      this.paused = true
    }
  }

  endLesson() {
    if (this.stage) this.restart()
  }
}
