import type { SourceId } from './house'

// Integer mixing keeps the same burst sequence when a lesson skips ahead or pauses.
function fraction(seed: number): number {
  let bits = Math.imul(seed ^ (seed >>> 16), 0x21f0aaad)
  bits = Math.imul(bits ^ (bits >>> 15), 0x735a2d97)
  return ((bits ^ (bits >>> 15)) >>> 0) / 0x100000000
}

/** A burst has one or two pockets, with a common bright interval for the observation stop. */
export function sampleGasBursts(elapsed: number, source: SourceId, sequence: number) {
  const slotDuration = 1.55
  const slot = Math.floor(elapsed / slotDuration)
  let seed = sequence + slot
  for (let i = 0; i < source.length; i++) seed = Math.imul(seed, 31) + source.charCodeAt(i)
  const start = 0.04 + 0.25 * fraction(seed)
  const duration = 0.86 + 0.24 * fraction(seed + 1)
  const count = fraction(seed + 2) < 0.5 ? 1 : 2
  const firstBand = fraction(seed + 3) < 0.5 ? 0 : 1
  return Array.from({ length: count }, (_, i) => {
    const age = elapsed - slot * slotDuration - start - 0.06 * i
    const progress = Math.min(1, Math.max(0, age / duration))
    const strength = age > 0 && age < duration ? Math.min(1, 1.25 * Math.sin(Math.PI * progress) ** 2) : 0
    return {
      progress, strength, band: (firstBand + i) % 2,
      x: fraction(seed + 4 + 2 * i), z: fraction(seed + 5 + 2 * i),
    }
  })
}
