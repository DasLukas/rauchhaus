import type { SourceId } from './house'

// Integer mixing keeps the same burst sequence when a lesson skips ahead or pauses.
function fraction(seed: number): number {
  let bits = Math.imul(seed ^ (seed >>> 16), 0x21f0aaad)
  bits = Math.imul(bits ^ (bits >>> 15), 0x735a2d97)
  return ((bits ^ (bits >>> 15)) >>> 0) / 0x100000000
}

/**
 * Sample one transient patch of flaming gas at a given demonstration time.
 * The seed belongs to the source and time slot. Positions are room fractions.
 * Strength fades to zero between bursts and is independent of the model's
 * ventilation- and heat-dependent gas-flaming intensity.
 */
export function sampleGasFlame(elapsed: number, source: SourceId) {
  const slotDuration = 1.55
  const slot = Math.floor(elapsed / slotDuration)
  let seed = slot
  for (let i = 0; i < source.length; i++) seed = Math.imul(seed, 31) + source.charCodeAt(i)
  const start = 0.04 + 0.34 * fraction(seed)
  const duration = 0.70 + 0.45 * fraction(seed + 1)
  const progress = Math.min(1, Math.max(0, (elapsed - slot * slotDuration - start) / duration))
  const strength = progress > 0 && progress < 1 ? Math.sin(Math.PI * progress) ** 2 : 0
  return { progress, strength, x: fraction(seed + 2), z: fraction(seed + 3) }
}

// Two pockets overlap briefly in separate parts of the layer.
export function sampleGasPair(elapsed: number, source: SourceId) {
  return [sampleGasFlame(elapsed, source), sampleGasFlame(Math.max(0, elapsed - 0.12), source)] as const
}
