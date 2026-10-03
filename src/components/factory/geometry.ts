export type Pt = { x: number; y: number }

export const TAU = Math.PI * 2
export const EPS = 1e-6

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

export const angleOf = (a: Pt, b: Pt) => Math.atan2(b.y - a.y, b.x - a.x)

export function approach(cur: number, target: number, maxDelta: number): number {
  if (cur < target) return Math.min(target, cur + maxDelta)
  return Math.max(target, cur - maxDelta)
}

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
  const cum = cumulative(samples)
  return { samples, cum, length: cum[cum.length - 1] }
}


export function cumulative(pts: Pt[]): number[] {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]))
  }
  return cum
}

export function polylineLength(pts: Pt[]): number {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i])
  return total
}

export function pointOnPolyline(pts: Pt[], cum: number[], d: number): Pt {
  const total = cum[cum.length - 1] ?? 0
  if (d <= 0 || pts.length < 2) return pts[0]
  if (d >= total) return pts[pts.length - 1]
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
    x: lerp(pts[lo - 1].x, pts[lo].x, t),
    y: lerp(pts[lo - 1].y, pts[lo].y, t),
  }
}

export function pointAtDistance(curve: Curve, d: number): Pt {
  return pointOnPolyline(curve.samples, curve.cum, d)
}

export function projectParam(a: Pt, b: Pt, p: Pt): { t: number; point: Pt } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  const t = lenSq <= EPS ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1)
  return { t, point: { x: a.x + dx * t, y: a.y + dy * t } }
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  return dist(p, projectParam(a, b, p).point)
}

export function segmentIntersection(
  a1: Pt,
  a2: Pt,
  b1: Pt,
  b2: Pt,
): { t: number; u: number; point: Pt } | null {
  const rx = a2.x - a1.x
  const ry = a2.y - a1.y
  const sx = b2.x - b1.x
  const sy = b2.y - b1.y
  const denom = rx * sy - ry * sx
  if (Math.abs(denom) < 1e-9) return null
  const qpx = b1.x - a1.x
  const qpy = b1.y - a1.y
  const t = (qpx * sy - qpy * sx) / denom
  const u = (qpx * ry - qpy * rx) / denom
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null
  return { t, u, point: { x: a1.x + rx * t, y: a1.y + ry * t } }
}
