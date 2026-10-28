const PERIOD = 32
const gusts = [
  { start: 1.8, duration: 5.8, strength: .74 },
  { start: 13.8, duration: 7.6, strength: 1 },
  { start: 25.8, duration: 4.8, strength: .84 },
] as const

function ease(value: number) {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

// Shared by hair, clothes and both grass planes. Calm gaps and smooth edges
// avoid a continuous wobble; the quiet beginning/end make the 32s loop seamless.
export function dreamscapeWind(seconds: number) {
  const time = ((seconds % PERIOD) + PERIOD) % PERIOD
  let wind = .025 + .01 * Math.sin(time * Math.PI * 2 / PERIOD)
  for (const gust of gusts) {
    const phase = (time - gust.start) / gust.duration
    if (phase <= 0 || phase >= 1) continue
    wind += ease(phase / .22) * (1 - ease((phase - .45) / .55)) * gust.strength
  }
  return wind
}
