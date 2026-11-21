import {
  DOORS,
  SmokeSimulation,
  type DoorId,
  type SourceId,
  type SimulationSnapshot,
} from '../simulation'

export type LessonStage = 'open' | 'closed' | 'compare'
// Allow the layer to become visible one landing above the television.
export const OBSERVATION_SECONDS = 40

/** Owns one free experiment and an optional pair of matched door trials. */
export class LearningSession {
  private readonly free = new SmokeSimulation()
  private example: SmokeSimulation | null = null
  private freeWasPaused = false
  stage: LessonStage | null = null
  paused = false
  snapshot = this.free.snapshot()

  private get active() {
    return this.example ?? this.free
  }

  /** Advances visible teaching time. Suspended tabs never need to catch up. */
  tick(seconds: number): SimulationSnapshot {
    if (this.paused || !this.snapshot.source || seconds <= 0) return this.snapshot
    const dt = this.stage ? Math.min(seconds, OBSERVATION_SECONDS - this.snapshot.elapsed) : seconds
    if (dt > 0) this.active.advance(dt)
    this.snapshot = this.active.snapshot()
    if (this.trialFinished) this.paused = true
    return this.snapshot
  }

  selectSource(id: SourceId) {
    if (this.stage) return
    this.free.start(id)
    this.paused = false
    this.snapshot = this.free.snapshot()
  }

  toggleDoor(id: DoorId) {
    if (this.stage) return
    this.free.setDoor(id, !this.snapshot.doors[id])
    this.snapshot = this.free.snapshot()
  }

  restart() {
    const { source } = this.snapshot
    if (!source) return
    this.active.start(source)
    this.paused = false
    this.snapshot = this.active.snapshot()
  }

  togglePause() {
    if (this.snapshot.source && this.stage !== 'compare' && !this.trialFinished)
      this.paused = !this.paused
  }

  get trialFinished() {
    return this.stage !== null && this.snapshot.elapsed >= OBSERVATION_SECONDS
  }

  /** Starts two independent TV trials that differ only in door d1. */
  beginLesson() {
    if (this.stage) return
    this.freeWasPaused = this.paused
    this.example = new SmokeSimulation()
    this.startTrial('open')
  }

  private startTrial(stage: 'open' | 'closed') {
    this.stage = stage
    for (const door of DOORS) this.active.setDoor(door.id, door.initiallyOpen)
    this.active.setDoor('d1', stage === 'open')
    this.active.start('s_tv')
    this.paused = false
    this.snapshot = this.active.snapshot()
  }

  /** Reaches the same observation point even when a class skips the animation. */
  finishTrial() {
    if (!this.stage || this.stage === 'compare') return
    while (!this.trialFinished) {
      this.active.advance(Math.min(0.25, OBSERVATION_SECONDS - this.snapshot.elapsed + 0.0001))
      this.snapshot = this.active.snapshot()
    }
    this.paused = true
  }

  nextTrial() {
    if (this.stage === 'open') this.startTrial('closed')
    else if (this.stage === 'closed') {
      this.stage = 'compare'
      this.paused = true
    }
  }

  endLesson() {
    if (!this.stage) return
    this.stage = null
    this.example = null
    this.paused = this.freeWasPaused
    this.snapshot = this.free.snapshot()
  }
}
