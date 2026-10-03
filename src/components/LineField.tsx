import { useEffect, useRef } from 'react'

type Pt = { x: number; y: number }

type Particle = {
  x: number
  y: number
  /** Ring buffer of recent positions, oldest first. */
  trail: number[]
  speed: number
  life: number
  brightness: number
}

type Edge = { a: number; b: number; pts: Pt[]; len: number }

type Pulse = { x: number; y: number; t: number; s: number }

type Signal = { edge: number; at: number }

type Props = {
  /** Roughly how many flowing lines to keep on screen. */
  density?: number
  className?: string
}

const TRAIL_LENGTH = 18

/** Palette (matches --color-accent / --color-accent-soft in index.css). */
const ACCENT = '122, 162, 255'
const ACCENT_SOFT = '169, 192, 255'

/**
 * Pause between opening new build fronts. Grows with the graph so the pace
 * keeps easing as it fills, but stays short enough that structure forms in
 * seconds rather than minutes.
 */
const growthDelay = (n: number) => Math.min(240 + n * 65, 2200)

/** How many frontier pads are open for business at once. */
const MAX_TARGETS = 2

/** Radius of the funnel that bends ambient lines toward the nearest pad. */
const PULL_RADIUS = 430

/** Distance at which a line is considered to have reached a pad. */
const ARRIVE_RADIUS = 20

/** How many nodes the reduced-motion frame renders. */
const STATIC_NODES = 34

const PULSE_MS = 900
const SIGNAL_MS = 900

/* ------------------------------------------------------------- small utils */

/** Deterministic RNG, so the reduced-motion frame is always identical. */
function mulberry32(seed: number) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Summed sines: reads like Perlin noise, costs a fraction of it. */
function flowAngle(x: number, y: number, t: number): number {
  const s = 0.0016
  return (
    (Math.sin(x * s + t * 0.31) +
      Math.cos(y * s * 1.35 - t * 0.19) +
      Math.sin((x + y) * s * 0.62 + t * 0.13)) *
    1.15
  )
}

/** Shortest-path blend between two angles, so lines never spin the long way. */
function blendAngle(from: number, to: number, w: number): number {
  const TAU = Math.PI * 2
  const d = ((((to - from + Math.PI) % TAU) + TAU) % TAU) - Math.PI
  return from + d * w
}

/**
 * PCB routing between two pads: orthogonal run, 45° chamfer, orthogonal run.
 * This is what converts an organic arrival into orderly wiring.
 */
function routeTrace(a: Pt, b: Pt): Pt[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  const sx = dx < 0 ? -1 : 1
  const sy = dy < 0 ? -1 : 1

  if (adx < 1.5 && ady < 1.5) return [a, b]

  if (adx >= ady) {
    const run = (adx - ady) / 2
    const bend = a.x + sx * run
    return [a, { x: bend, y: a.y }, { x: bend + sx * ady, y: a.y + sy * ady }, b]
  }
  const run = (ady - adx) / 2
  const bend = a.y + sy * run
  return [a, { x: a.x, y: bend }, { x: a.x + sx * adx, y: bend + sy * adx }, b]
}

/** Stroke a polyline with rounded vertices — soldermask-smooth, not jagged. */
function strokeRounded(g: CanvasRenderingContext2D, pts: Pt[], radius: number) {
  g.beginPath()
  g.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]
    const n = pts[i + 1]
    g.arcTo(p.x, p.y, (p.x + n.x) / 2, (p.y + n.y) / 2, radius)
  }
  const last = pts[pts.length - 1]
  g.lineTo(last.x, last.y)
  g.stroke()
}

function polylineLength(pts: Pt[]): number {
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  }
  return total
}

/** Point at an absolute distance along a polyline. */
function pointAtLength(pts: Pt[], dist: number): Pt {
  let remaining = dist
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    if (seg <= 0) continue
    if (remaining <= seg) {
      const t = remaining / seg
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    remaining -= seg
  }
  return pts[pts.length - 1]
}

const NB8: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]

/** Orthogonal neighbours only — used to prefer straight runs over diagonals. */
const NB4: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
]

/**
 * Living background that slowly builds a circuit.
 *
 * Lines stream in continuously from every edge and roam the flow field until
 * they find one of the active frontier pads. The moment a line reaches a pad
 * it settles the connection to the *persistent* offscreen layer as an orderly
 * 45°-chamfered PCB trace, the pad becomes part of the structure, and the next
 * frontier opens up. Every dot that enters therefore ends up attached to the
 * graph rather than drifting back off screen.
 *
 * Two stacked canvases: the structure layer is append-only (so cost is flat no
 * matter how much has been built), the live layer is cleared each frame and
 * carries the flowing lines, pulses and signals.
 *
 * Respects `prefers-reduced-motion` (renders one deterministic static frame)
 * and pauses while the tab is hidden.
 */
export default function LineField({ density = 1, className }: Props) {
  const structRef = useRef<HTMLCanvasElement | null>(null)
  const liveRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const structCanvas = structRef.current
    const liveCanvas = liveRef.current
    if (!structCanvas || !liveCanvas) return
    const sctx = structCanvas.getContext('2d')
    const lctx = liveCanvas.getContext('2d')
    if (!sctx || !lctx) return

    const rng = mulberry32(20261003)
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    let width = 0
    let height = 0
    let dpr = 1
    let cell = 66
    let cols = 0
    let rows = 0

    // Graph state. `cells` are arena grid slots, not DOM elements.
    let nodes: Pt[] = []
    let state = new Uint8Array(0) // 0 empty, 1 built
    let builtNear = new Uint8Array(0) // how many built neighbours a cell has
    let rank = new Int32Array(0) // build order, for picking the newest parent

    let edges: Edge[] = []
    let particles: Particle[] = []
    let pulses: Pulse[] = []
    let signals: Signal[] = []

    // Frontier pads that lines are currently converging on.
    let targets: number[] = []
    let built = 0
    let clock = 0
    let nextGrowthAt = 0
    let nextSignalAt = 4000
    let dissolveFrames = 0

    let rafId = 0
    let running = true
    let last = performance.now()

    /** Pointer position, used for a gentle swirl. NaN when not over canvas. */
    const pointer = { x: Number.NaN, y: Number.NaN }

    const idxOf = (c: number, r: number) => r * cols + c
    const colOf = (i: number) => i % cols
    const rowOf = (i: number) => (i / cols) | 0

    const inBounds = (c: number, r: number) =>
      c >= 0 && r >= 0 && c < cols && r < rows

    /* ------------------------------------------------ structure rendering */

    const drawPad = (g: CanvasRenderingContext2D, pt: Pt, isRoot: boolean) => {
      g.globalCompositeOperation = 'lighter'
      g.beginPath()
      g.arc(pt.x, pt.y, isRoot ? 3.1 : 2.1, 0, Math.PI * 2)
      g.fillStyle = `rgba(${ACCENT_SOFT}, ${isRoot ? 0.5 : 0.34})`
      g.fill()
      if (isRoot) {
        g.beginPath()
        g.arc(pt.x, pt.y, 7.5, 0, Math.PI * 2)
        g.strokeStyle = `rgba(${ACCENT}, 0.22)`
        g.lineWidth = 1
        g.stroke()
      }
      g.globalCompositeOperation = 'source-over'
    }

    const drawTrace = (g: CanvasRenderingContext2D, pts: Pt[]) => {
      g.globalCompositeOperation = 'lighter'
      g.lineCap = 'round'
      g.lineJoin = 'round'
      // Wide, faint halo — the conductive "aura".
      g.strokeStyle = `rgba(${ACCENT}, 0.055)`
      g.lineWidth = 4.2
      strokeRounded(g, pts, 10)
      // The trace itself.
      g.strokeStyle = `rgba(${ACCENT}, 0.17)`
      g.lineWidth = 1.15
      strokeRounded(g, pts, 10)
      // Bright inner highlight.
      g.strokeStyle = `rgba(${ACCENT_SOFT}, 0.09)`
      g.lineWidth = 0.6
      strokeRounded(g, pts, 10)
      g.globalCompositeOperation = 'source-over'
    }

    const markNeighbours = (i: number) => {
      const c = colOf(i)
      const r = rowOf(i)
      for (const [dc, dr] of NB8) {
        const nc = c + dc
        const nr = r + dr
        if (inBounds(nc, nr)) builtNear[idxOf(nc, nr)]++
      }
    }

    /* --------------------------------------------------------- graph build */

    /** Pick the next cell to grow into: frontier, preferring open space. */
    const pickTarget = (): number => {
      const pool: number[] = []
      let chosen = -1
      let bestScore = Infinity

      for (let i = 0; i < nodes.length; i++) {
        if (state[i] !== 0 || builtNear[i] === 0) continue
        if (targets.includes(i)) continue
        pool.push(i)

        // Prefer cells that can be reached straight, not only diagonally, so
        // the lattice reads as wiring rather than a diamond mesh.
        const c = colOf(i)
        const r = rowOf(i)
        let straight = false
        for (const [dc, dr] of NB4) {
          const nc = c + dc
          const nr = r + dr
          if (inBounds(nc, nr) && state[idxOf(nc, nr)] === 1) {
            straight = true
            break
          }
        }

        const score = builtNear[i] + (straight ? 0 : 0.9) + rng() * 0.75
        if (score < bestScore) {
          bestScore = score
          chosen = i
        }
      }

      if (chosen === -1) return -1

      // Occasionally branch from an arbitrary frontier cell instead, which
      // keeps the growth from looking like a single marching front.
      if (rng() < 0.28 && pool.length) {
        chosen = pool[(rng() * pool.length) | 0]
      }
      return chosen
    }

    /** Wire a new pad in. Called the instant a line reaches it. */
    const commit = (toIdx: number) => {
      const c = colOf(toIdx)
      const r = rowOf(toIdx)

      let parent = -1
      let parentRank = -1
      const candidates: number[] = []
      for (const [dc, dr] of NB8) {
        const nc = c + dc
        const nr = r + dr
        if (!inBounds(nc, nr)) continue
        const ni = idxOf(nc, nr)
        if (state[ni] === 1) {
          candidates.push(ni)
          if (rank[ni] > parentRank) {
            parentRank = rank[ni]
            parent = ni
          }
        }
      }
      if (parent === -1) {
        targets = targets.filter((t) => t !== toIdx)
        return
      }

      // Mostly attach to the newest pad (a continuous growing edge), sometimes
      // tap an older one, which is what gives the circuit its bus topology.
      if (candidates.length > 1 && rng() < 0.25) {
        parent = candidates[(rng() * candidates.length) | 0]
      }

      const pts = routeTrace(nodes[parent], nodes[toIdx])
      edges.push({ a: parent, b: toIdx, pts, len: polylineLength(pts) })
      state[toIdx] = 1
      rank[toIdx] = ++built
      markNeighbours(toIdx)

      drawTrace(sctx, pts)
      drawPad(sctx, nodes[toIdx], false)
      pulses.push({ x: nodes[toIdx].x, y: nodes[toIdx].y, t: 0, s: 1 })

      targets = targets.filter((t) => t !== toIdx)
      nextGrowthAt = clock + growthDelay(built)
    }

    const buildGrid = () => {
      cell = width < 720 ? 56 : 66
      cols = Math.max(4, Math.round(width / cell))
      rows = Math.max(4, Math.round(height / cell))
      const ox = (width - cols * cell) / 2
      const oy = (height - rows * cell) / 2

      nodes = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          nodes.push({
            x: ox + (c + 0.5) * cell + (rng() - 0.5) * cell * 0.22,
            y: oy + (r + 0.5) * cell + (rng() - 0.5) * cell * 0.22,
          })
        }
      }

      state = new Uint8Array(cols * rows)
      builtNear = new Uint8Array(cols * rows)
      rank = new Int32Array(cols * rows)
      edges = []
      pulses = []
      signals = []
      targets = []
      built = 0
      clock = 0
      dissolveFrames = 0
      nextSignalAt = 4000

      // Seed slightly below-left of centre so the graph radiates across the
      // whole page instead of blooming out of the middle of the headline.
      const seedPt = { x: width * 0.42, y: height * 0.58 }
      let root = 0
      let bestD = Infinity
      for (let i = 0; i < nodes.length; i++) {
        const d = (nodes[i].x - seedPt.x) ** 2 + (nodes[i].y - seedPt.y) ** 2
        if (d < bestD) {
          bestD = d
          root = i
        }
      }

      state[root] = 1
      rank[root] = ++built
      markNeighbours(root)
      drawPad(sctx, nodes[root], true)
      pulses.push({ x: nodes[root].x, y: nodes[root].y, t: 0, s: 1 })
      nextGrowthAt = 250
    }

    /* -------------------------------------------------------------- canvas */

    const spawn = (p: Particle, scatter: boolean) => {
      if (scatter) {
        p.x = rng() * width
        p.y = rng() * height
      } else {
        // Enter from a random edge so the field never thins into a wave.
        const margin = 30 + rng() * 180
        const edge = (rng() * 4) | 0
        if (edge === 0) {
          p.x = -margin
          p.y = rng() * height
        } else if (edge === 1) {
          p.x = width + margin
          p.y = rng() * height
        } else if (edge === 2) {
          p.x = rng() * width
          p.y = -margin
        } else {
          p.x = rng() * width
          p.y = height + margin
        }
      }
      p.speed = 0.3 + rng() * 0.6
      p.life = 0
      p.brightness = 0.25 + rng() * 0.75

      const ring: number[] = []
      for (let i = 0; i < TRAIL_LENGTH; i++) ring.push(p.x, p.y)
      p.trail = ring
    }

    const buildParticles = () => {
      const count = Math.round(
        Math.min(130, Math.max(44, (width / 16) * density)),
      )
      const next: Particle[] = []
      for (let i = 0; i < count; i++) {
        const p: Particle = {
          x: 0,
          y: 0,
          trail: [],
          speed: 1,
          life: 0,
          brightness: 1,
        }
        spawn(p, true)
        // Stagger the initial fade so the field is already alive on load.
        p.life = rng() * 140
        next.push(p)
      }
      particles = next
    }

    const stepParticle = (p: Particle, dt: number, t: number) => {
      let angle = flowAngle(p.x, p.y, t)

      // The funnel: lines inside the pull radius lean toward the nearest open
      // pad and speed up as they close in, so arrivals read as intent.
      if (targets.length) {
        let best = -1
        let bestD = Infinity
        for (const ti of targets) {
          const tp = nodes[ti]
          const d = Math.hypot(tp.x - p.x, tp.y - p.y)
          if (d < bestD) {
            bestD = d
            best = ti
          }
        }
        if (best !== -1 && bestD < PULL_RADIUS) {
          const tp = nodes[best]
          if (bestD < ARRIVE_RADIUS) {
            // Settle the connection and immediately send a fresh line in, so
            // the stream never stops while structure keeps accumulating.
            pulses.push({ x: tp.x, y: tp.y, t: 0, s: 0.35 })
            commit(best)
            spawn(p, false)
            return
          }
          const pull = (1 - bestD / PULL_RADIUS) ** 1.3
          angle = blendAngle(angle, Math.atan2(tp.y - p.y, tp.x - p.x), pull)
          p.x += Math.cos(angle) * p.speed * (1 + pull * 2.4) * dt
          p.y += Math.sin(angle) * p.speed * (1 + pull * 2.4) * dt
          p.life += dt
          p.trail.push(p.x, p.y)
          while (p.trail.length > TRAIL_LENGTH * 2) p.trail.splice(0, 2)
          return
        }
      }

      // Subtle swirl around the cursor.
      if (!Number.isNaN(pointer.x)) {
        const dx = p.x - pointer.x
        const dy = p.y - pointer.y
        const distSq = dx * dx + dy * dy
        if (distSq < 42000 && distSq > 1) {
          angle += (1 - distSq / 42000) * 1.1 * Math.sign(dy || 1)
        }
      }

      p.x += Math.cos(angle) * p.speed * dt
      p.y += Math.sin(angle) * p.speed * dt
      p.life += dt

      p.trail.push(p.x, p.y)
      while (p.trail.length > TRAIL_LENGTH * 2) p.trail.splice(0, 2)

      const offScreen =
        p.x > width + 260 || p.x < -260 || p.y > height + 260 || p.y < -260
      if (offScreen) spawn(p, false)
    }

    /* ------------------------------------------------------------ the loop */

    const drawLive = (dtMs: number) => {
      // Built structure lives on the lower canvas, so this layer can be fully
      // cleared each frame without wiping anything permanent.
      lctx.clearRect(0, 0, width, height)
      lctx.globalCompositeOperation = 'lighter'
      lctx.lineCap = 'round'

      for (const p of particles) {
        const trail = p.trail
        const len = trail.length / 2
        if (len < 3) continue

        const headX = trail[trail.length - 2]
        const headY = trail[trail.length - 1]
        const tailX = trail[0]
        const tailY = trail[1]

        const fadeIn = Math.min(1, p.life / 140)
        const alpha = 0.62 * p.brightness * fadeIn
        if (alpha <= 0.01) continue

        const gradient = lctx.createLinearGradient(tailX, tailY, headX, headY)
        gradient.addColorStop(0, `rgba(${ACCENT}, 0)`)
        gradient.addColorStop(0.6, `rgba(${ACCENT}, ${alpha * 0.3})`)
        gradient.addColorStop(1, `rgba(198, 218, 255, ${alpha})`)

        // Build the path once, stroke it twice: soft halo then crisp core.
        lctx.beginPath()
        lctx.moveTo(tailX, tailY)
        for (let i = 1; i < len - 1; i++) {
          const x = trail[i * 2]
          const y = trail[i * 2 + 1]
          const nx = trail[(i + 1) * 2]
          const ny = trail[(i + 1) * 2 + 1]
          lctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2)
        }
        lctx.lineTo(headX, headY)
        lctx.strokeStyle = gradient
        lctx.lineWidth = 2.6
        lctx.globalAlpha = 0.35
        lctx.stroke()
        lctx.globalAlpha = 1
        lctx.lineWidth = 1.05
        lctx.stroke()

        lctx.fillStyle = `rgba(215, 230, 255, ${alpha * 0.9})`
        lctx.beginPath()
        lctx.arc(headX, headY, 1.2, 0, Math.PI * 2)
        lctx.fill()
      }

      // Solder-pad rings where the next connections will land.
      for (const ti of targets) {
        const tp = nodes[ti]
        const phase = (clock % 1300) / 1300
        const alpha = 0.14 + (1 - Math.abs(phase - 0.5) * 2) * 0.16
        lctx.beginPath()
        lctx.arc(tp.x, tp.y, 6.5, 0, Math.PI * 2)
        lctx.strokeStyle = `rgba(${ACCENT_SOFT}, ${alpha})`
        lctx.lineWidth = 0.9
        lctx.stroke()
      }

      // Settlement rings.
      for (const pulse of pulses) {
        const k = pulse.t / PULSE_MS
        if (k < 0 || k > 1) continue
        const big = pulse.s > 0.5
        lctx.beginPath()
        lctx.arc(pulse.x, pulse.y, 4 + k * (big ? 30 : 11), 0, Math.PI * 2)
        lctx.strokeStyle = `rgba(${ACCENT_SOFT}, ${(1 - k) ** 1.7 * (big ? 0.4 : 0.22)})`
        lctx.lineWidth = big ? 1.1 : 0.8
        lctx.stroke()
      }

      // Traffic along established edges — this is what keeps it alive once
      // most of the easy growth is done.
      for (const sig of signals) {
        const edge = edges[sig.edge]
        if (!edge) continue
        const head = pointAtLength(edge.pts, sig.at)
        const tail = pointAtLength(edge.pts, Math.max(0, sig.at - 22))
        const gradient = lctx.createLinearGradient(tail.x, tail.y, head.x, head.y)
        gradient.addColorStop(0, `rgba(${ACCENT}, 0)`)
        gradient.addColorStop(1, 'rgba(226, 236, 255, 0.75)')
        lctx.strokeStyle = gradient
        lctx.lineWidth = 1.5
        lctx.beginPath()
        lctx.moveTo(tail.x, tail.y)
        lctx.lineTo(head.x, head.y)
        lctx.stroke()
        lctx.beginPath()
        lctx.arc(head.x, head.y, 1.7, 0, Math.PI * 2)
        lctx.fillStyle = 'rgba(235, 242, 255, 0.85)'
        lctx.fill()
      }

      lctx.globalCompositeOperation = 'source-over'

      // Advance the time-based bits.
      if (pulses.length) {
        for (const pulse of pulses) pulse.t += dtMs
        pulses = pulses.filter((p) => p.t <= PULSE_MS)
      }

      if (edges.length > 8 && clock >= nextSignalAt) {
        signals.push({ edge: (rng() * edges.length) | 0, at: 0 })
        nextSignalAt = clock + 1800 + rng() * 4200
      }
      if (signals.length) {
        for (const sig of signals) {
          const edge = edges[sig.edge]
          if (edge) sig.at += (dtMs / SIGNAL_MS) * edge.len
        }
        signals = signals.filter(
          (s) => s.edge < edges.length && s.at < edges[s.edge].len,
        )
      }
    }

    const loop = (now: number) => {
      if (!running) return
      const dtMs = Math.min(now - last, 50)
      const dt = dtMs / 16.67
      last = now
      clock += dtMs

      const t = clock * 0.00024

      // Once the lattice is exhausted, dissolve slowly and start again rather
      // than snapping to empty.
      if (dissolveFrames > 0) {
        dissolveFrames++
        sctx.globalCompositeOperation = 'destination-out'
        sctx.fillStyle = 'rgba(0, 0, 0, 0.014)'
        sctx.fillRect(0, 0, width, height)
        sctx.globalCompositeOperation = 'source-over'
        if (dissolveFrames > 1000) {
          sctx.clearRect(0, 0, width, height)
          buildGrid()
        }
      } else if (targets.length < MAX_TARGETS && clock >= nextGrowthAt) {
        const next = pickTarget()
        if (next === -1) {
          if (targets.length === 0) dissolveFrames = 1
        } else {
          targets.push(next)
          nextGrowthAt = clock + growthDelay(built)
        }
      }

      for (const p of particles) stepParticle(p, dt, t)

      drawLive(dtMs)

      rafId = requestAnimationFrame(loop)
    }

    /* ----------------------------------------------------------- lifecycle */

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = structCanvas.clientWidth
      height = structCanvas.clientHeight
      if (width === 0 || height === 0) return

      for (const cv of [structCanvas, liveCanvas]) {
        cv.width = Math.floor(width * dpr)
        cv.height = Math.floor(height * dpr)
      }
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sctx.clearRect(0, 0, width, height)
      lctx.clearRect(0, 0, width, height)

      buildGrid()
      particles = []
      if (reduceMotion) {
        // One deterministic frame: a partially built circuit, no motion.
        let guard = 0
        while (built < STATIC_NODES && guard < 400) {
          guard++
          const next = pickTarget()
          if (next === -1) break
          commit(next)
        }
        targets = []
        pulses = []
        signals = []
        sctx.globalCompositeOperation = 'source-over'
        lctx.clearRect(0, 0, width, height)
      } else {
        buildParticles()
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = structCanvas.getBoundingClientRect()
      pointer.x = event.clientX - rect.left
      pointer.y = event.clientY - rect.top
    }
    const onPointerLeave = () => {
      pointer.x = Number.NaN
      pointer.y = Number.NaN
    }
    const onVisibility = () => {
      if (reduceMotion) return
      if (document.hidden) {
        running = false
        cancelAnimationFrame(rafId)
      } else if (!running) {
        running = true
        last = performance.now()
        rafId = requestAnimationFrame(loop)
      }
    }

    const observer = new ResizeObserver(resize)
    observer.observe(structCanvas)
    resize()

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerleave', onPointerLeave)
    document.addEventListener('visibilitychange', onVisibility)

    if (!reduceMotion) rafId = requestAnimationFrame(loop)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [density])

  return (
    <div className={className ?? 'absolute inset-0 h-full w-full'}>
      {/* Persistent layer: committed structure, append-only. */}
      <canvas
        ref={structRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />
      {/* Live layer: flowing lines, convergence, pulses, signals. */}
      <canvas
        ref={liveRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  )
}
