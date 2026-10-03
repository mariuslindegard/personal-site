export type Pt = { x: number; y: number }

export const TAU = Math.PI * 2

export function mulberry32(seed: number) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y)

export function flowAngle(x: number, y: number, t: number): number {
  const s = 0.0016
  return (
    (Math.sin(x * s + t * 0.31) +
      Math.cos(y * s * 1.35 - t * 0.19) +
      Math.sin((x + y) * s * 0.62 + t * 0.13)) *
    1.15
  )
}

export function radiusOf(tier: number): number {
  return 10 + tier * 1.7
}

export type Curve = { samples: Pt[]; cum: number[]; length: number }

export function buildCurve(p0: Pt, p1: Pt, p2: Pt, p3: Pt, steps = 28): Curve {
  const samples: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    const a = u * u * u
    const b = 3 * u * u * t
    const c = 3 * u * t * t
    const d = t * t * t
    samples.push({
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    })
  }

  const cum = [0]
  for (let i = 1; i < samples.length; i++) {
    cum.push(
      cum[i - 1] +
        Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y),
    )
  }

  return { samples, cum, length: cum[cum.length - 1] }
}

export function pointAtDistance(curve: Curve, d: number): Pt {
  const { samples, cum } = curve
  const total = cum[cum.length - 1]
  if (d <= 0 || samples.length < 2) return samples[0]
  if (d >= total) return samples[samples.length - 1]

  let lo = 1
  let hi = cum.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cum[mid] < d) lo = mid + 1
    else hi = mid
  }

  const seg = cum[lo] - cum[lo - 1]
  const t = seg <= 0 ? 0 : (d - cum[lo - 1]) / seg
  return {
    x: lerp(samples[lo - 1].x, samples[lo].x, t),
    y: lerp(samples[lo - 1].y, samples[lo].y, t),
  }
}
