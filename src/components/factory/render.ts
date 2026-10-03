import {
  PRODUCE_MS,
  PULSE_MS,
  PRODUCT_LETTERS,
  TIER_RGB,
  type Ambient,
  type Factory,
  type Link,
  type Pulse,
} from './model'
import { clamp, pointAtDistance, radiusOf, type Pt } from './geometry'

const ACCENT_RGB: [number, number, number] = [122, 162, 255]

function rgba(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

function lighten(rgb: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.min(255, rgb[0] + amount),
    Math.min(255, rgb[1] + amount),
    Math.min(255, rgb[2] + amount),
  ]
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + radius, y)
  g.arcTo(x + w, y, x + w, y + h, radius)
  g.arcTo(x + w, y + h, x, y + h, radius)
  g.arcTo(x, y + h, x, y, radius)
  g.arcTo(x, y, x + w, y, radius)
  g.closePath()
}

function strokePolyline(g: CanvasRenderingContext2D, pts: Pt[]) {
  g.beginPath()
  g.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) {
    g.lineTo(pts[i].x, pts[i].y)
  }
  g.stroke()
}

export function drawLink(
  g: CanvasRenderingContext2D,
  link: Link,
  fromTier: number,
  progress: number,
  alphaMul: number,
) {
  const distance = link.curve.length * progress
  const pts: Pt[] = []
  for (let i = 0; i < link.curve.samples.length; i++) {
    if (link.curve.cum[i] > distance) break
    pts.push(link.curve.samples[i])
  }
  pts.push(pointAtDistance(link.curve, distance))
  if (pts.length < 2) return

  const rgb = TIER_RGB[fromTier] ?? TIER_RGB[0]
  g.lineCap = 'round'
  g.lineJoin = 'round'

  g.strokeStyle = rgba(rgb, 0.055 * alphaMul)
  g.lineWidth = 4.6
  strokePolyline(g, pts)

  g.strokeStyle = rgba(rgb, 0.2 * alphaMul)
  g.lineWidth = 1.2
  strokePolyline(g, pts)

  g.strokeStyle = `rgba(255, 255, 255, ${0.05 * alphaMul})`
  g.lineWidth = 0.6
  strokePolyline(g, pts)
}

export function drawFactory(
  g: CanvasRenderingContext2D,
  factory: Factory,
  now: number,
) {
  const r = radiusOf(factory.tier)
  const rgb = TIER_RGB[factory.tier] ?? TIER_RGB[0]
  const soft = lighten(rgb, 46)
  const half = r * 0.975

  if (factory.pulse > 0) {
    const expand = (1 - factory.pulse) * r * 2.1
    g.beginPath()
    g.arc(factory.pos.x, factory.pos.y, r + expand, 0, Math.PI * 2)
    g.strokeStyle = rgba(rgb, factory.pulse ** 1.5 * 0.5)
    g.lineWidth = 1.1
    g.stroke()
  }

  roundRect(
    g,
    factory.pos.x - half,
    factory.pos.y - half,
    half * 2,
    half * 2,
    half * 0.46,
  )
  g.fillStyle = 'rgba(6, 8, 16, 0.8)'
  g.fill()
  g.strokeStyle = rgba(rgb, 0.1)
  g.lineWidth = 3.6
  g.stroke()
  g.strokeStyle = rgba(rgb, 0.5)
  g.lineWidth = 1.05
  g.stroke()

  if (factory.output === null) {
    g.beginPath()
    g.setLineDash([3, 5])
    g.arc(factory.pos.x, factory.pos.y, half + 5.5, 0, Math.PI * 2)
    g.strokeStyle = rgba(rgb, 0.22)
    g.lineWidth = 1
    g.stroke()
    g.setLineDash([])
  }

  for (const slot of [0, 1]) {
    const connected = factory.inputs[slot] !== null
    const buffered = factory.arrivals[slot] > 0
    const inputRgb = TIER_RGB[Math.max(0, factory.tier - 1)]
    const start = slot === 0 ? Math.PI * 0.78 : -Math.PI * 0.22
    g.beginPath()
    g.arc(factory.pos.x, factory.pos.y, half + 1.6, start, start + Math.PI * 0.44)
    g.strokeStyle = connected
      ? rgba(inputRgb, buffered ? 0.95 : 0.5)
      : 'rgba(255, 255, 255, 0.13)'
    g.lineWidth = connected && buffered ? 2.4 : 2
    g.stroke()
  }

  if (factory.produceAt !== 0) {
    const progress = 1 - clamp((factory.produceAt - now) / PRODUCE_MS, 0, 1)
    g.beginPath()
    g.arc(
      factory.pos.x,
      factory.pos.y,
      half + 4,
      -Math.PI / 2,
      -Math.PI / 2 + progress * Math.PI * 2,
    )
    g.strokeStyle = rgba(soft, 0.8)
    g.lineWidth = 1.6
    g.stroke()
  }

  g.font = `600 ${Math.round(r * 1.02)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = rgba(soft, 0.92)
  g.fillText(PRODUCT_LETTERS[factory.tier] ?? '?', factory.pos.x, factory.pos.y + 0.5)

  if (factory.output) {
    const start = factory.output.curve.samples[0]
    g.beginPath()
    g.arc(start.x, start.y, 4.4, 0, Math.PI * 2)
    g.fillStyle = rgba(rgb, 0.18)
    g.fill()
    g.beginPath()
    g.arc(start.x, start.y, 1.9, 0, Math.PI * 2)
    g.fillStyle = rgba(soft, 0.9)
    g.fill()
  }
}

export function drawProduct(
  g: CanvasRenderingContext2D,
  link: Link,
  at: number,
  fromTier: number,
) {
  const rgb = TIER_RGB[fromTier] ?? TIER_RGB[0]
  const soft = lighten(rgb, 60)
  const head = pointAtDistance(link.curve, at)
  const p1 = pointAtDistance(link.curve, at - 21)
  const p2 = pointAtDistance(link.curve, at - 14)
  const p3 = pointAtDistance(link.curve, at - 7)

  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(p1.x, p1.y)
  g.lineTo(p2.x, p2.y)
  g.lineTo(p3.x, p3.y)
  g.lineTo(head.x, head.y)
  g.strokeStyle = rgba(rgb, 0.45)
  g.lineWidth = 1.5
  g.stroke()

  g.beginPath()
  g.arc(head.x, head.y, 3.6, 0, Math.PI * 2)
  g.fillStyle = rgba(rgb, 0.22)
  g.fill()

  g.beginPath()
  g.arc(head.x, head.y, 1.9, 0, Math.PI * 2)
  g.fillStyle = rgba(soft, 0.95)
  g.fill()
}

export function drawAmbient(g: CanvasRenderingContext2D, particles: Ambient[]) {
  g.lineCap = 'round'
  for (const particle of particles) {
    const trail = particle.trail
    const len = trail.length / 2
    if (len < 3) continue

    const headX = trail[trail.length - 2]
    const headY = trail[trail.length - 1]
    const tailX = trail[0]
    const tailY = trail[1]
    const fadeIn = Math.min(1, particle.life / 140)
    const alpha = 0.33 * particle.brightness * fadeIn
    if (alpha <= 0.01) continue

    const gradient = g.createLinearGradient(tailX, tailY, headX, headY)
    gradient.addColorStop(0, rgba(ACCENT_RGB, 0))
    gradient.addColorStop(0.6, rgba(ACCENT_RGB, alpha * 0.3))
    gradient.addColorStop(1, `rgba(198, 218, 255, ${alpha})`)

    g.beginPath()
    g.moveTo(tailX, tailY)
    for (let i = 1; i < len - 1; i++) {
      const x = trail[i * 2]
      const y = trail[i * 2 + 1]
      const nx = trail[(i + 1) * 2]
      const ny = trail[(i + 1) * 2 + 1]
      g.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2)
    }
    g.lineTo(headX, headY)
    g.strokeStyle = gradient
    g.lineWidth = 1.15
    g.stroke()

    g.beginPath()
    g.arc(headX, headY, 1.1, 0, Math.PI * 2)
    g.fillStyle = `rgba(215, 230, 255, ${alpha * 0.9})`
    g.fill()
  }
}

export function drawPulse(g: CanvasRenderingContext2D, pulse: Pulse) {
  const k = pulse.t / PULSE_MS
  if (k < 0 || k > 1) return
  const rgb = TIER_RGB[pulse.hue] ?? TIER_RGB[0]
  g.beginPath()
  g.arc(pulse.x, pulse.y, pulse.r + k * pulse.max, 0, Math.PI * 2)
  g.strokeStyle = rgba(rgb, (1 - k) ** 1.7 * 0.5 * pulse.width)
  g.lineWidth = pulse.width
  g.stroke()
}

export function drawDissolve(g: CanvasRenderingContext2D, alpha: number) {
  g.fillStyle = `rgba(4, 5, 10, ${alpha})`
  g.fillRect(0, 0, g.canvas.width, g.canvas.height)
}
