/** Plays one short alarm pulse on each rising edge of the shared detector signal. */
export class AlarmSound {
  private context?: AudioContext
  private tone?: OscillatorNode
  private high = false
  enabled = false

  /** Unlock audio from a user gesture. Muting interrupts an ongoing beep immediately. */
  toggle() {
    this.enabled = !this.enabled
    if (this.enabled) {
      this.context ??= new AudioContext()
      void this.context.resume().catch(() => {})
    } else {
      this.update(false)
    }
  }

  update(pulse: boolean) {
    const context = this.context
    const high = Boolean(pulse && this.enabled && context?.state === 'running')
    if (high === this.high) return
    this.high = high
    if (!high) {
      this.tone?.stop()
      this.tone = undefined
      return
    }
    if (!context) return
    const tone = context.createOscillator()
    const gain = context.createGain()
    const now = context.currentTime
    tone.type = 'sine'
    tone.frequency.value = 2900
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.075, now + 0.008)
    gain.gain.setValueAtTime(0.075, now + 0.19)
    gain.gain.linearRampToValueAtTime(0, now + 0.21)
    tone.connect(gain).connect(context.destination)
    tone.onended = () => {
      tone.disconnect()
      gain.disconnect()
      if (this.tone === tone) this.tone = undefined
    }
    this.tone = tone
    tone.start(now)
    tone.stop(now + 0.22)
  }

  dispose() {
    this.update(false)
    if (this.context) void this.context.close()
  }
}
