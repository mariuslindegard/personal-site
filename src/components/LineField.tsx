import { useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  /** Ring buffer of recent positions, oldest first. */
  trail: number[]
  speed: number
  life: number
  maxLife: number
  brightness: number
}

type Props = {
  /** Roughly how many flowing lines to keep on screen. */
  density?: number
  className?: string
}

const TRAIL_LENGTH = 20

/**
 * Smooth, cheap flow field. Summing a few sines gives long, gently winding
 * streamlines that look like Perlin noise but cost a fraction of it.
 */
function flowAngle(x: number, y: number, t: number): number {
  const s = 0.0016
  return (
    (Math.sin(x * s + t * 0.31) +
      Math.cos(y * s * 1.35 - t * 0.19) +
      Math.sin((x + y) * s * 0.62 + t * 0.13)) *
    1.15
  )
}

/**
 * Full-bleed animated background: hundreds of thin streamlines drifting
 * through a flow field, with luminous heads and fading tails.
 *
 * Renders to a single <canvas> and fully respects `prefers-reduced-motion`
 * (falls back to one static frame) and tab visibility (pauses when hidden).
 */
export default function LineField({ density = 1, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    let width = 0
    let height = 0
    let dpr = 1
    let particles: Particle[] = []
    let rafId = 0
    let elapsed = 0
    let running = true

    /** Pointer position, used for a gentle swirl. NaN when not over canvas. */
    const pointer = { x: Number.NaN, y: Number.NaN }

    const spawn = (p: Particle, randomY: boolean) => {
      // Enter from the left edge (or scatter on first spawn) and drift right.
      p.x = randomY ? Math.random() * width : -40 - Math.random() * 220
      p.y = randomY ? Math.random() * height : Math.random() * height
      p.speed = 0.28 + Math.random() * 0.62
      p.maxLife = 900 + Math.random() * 1400
      p.life = Math.random() * p.maxLife
      p.brightness = 0.25 + Math.random() * 0.75

      const ring: number[] = []
      for (let i = 0; i < TRAIL_LENGTH; i++) ring.push(p.x, p.y)
      p.trail = ring
    }

    const buildParticles = () => {
      const target = Math.round(
        Math.min(150, Math.max(45, (width / 15) * density)),
      )
      const next: Particle[] = []
      for (let i = 0; i < target; i++) {
        const p: Particle = {
          x: 0,
          y: 0,
          trail: [],
          speed: 1,
          life: 0,
          maxLife: 1,
          brightness: 1,
        }
        spawn(p, true)
        next.push(p)
      }
      particles = next
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      buildParticles()
      if (reduceMotion) drawFrame()
    }

    const step = (p: Particle, dt: number, t: number) => {
      let angle = flowAngle(p.x, p.y, t)

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
        p.x > width + 60 || p.y < -80 || p.y > height + 80 || p.x < -320
      if (offScreen || p.life > p.maxLife) spawn(p, false)
    }

    const drawFrame = () => {
      // Translucent wipe instead of a full clear — this is what creates the
      // soft comet tails without storing extra history.
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(4, 5, 10, 0.085)'
      ctx.fillRect(0, 0, width, height)

      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'

      for (const p of particles) {
        const trail = p.trail
        const len = trail.length / 2
        if (len < 2) continue

        const headX = trail[trail.length - 2]
        const headY = trail[trail.length - 1]
        const tailX = trail[0]
        const tailY = trail[1]

        // Fade in at spawn and out near end of life so lines never pop.
        const fadeIn = Math.min(1, p.life / 120)
        const fadeOut = Math.min(1, (p.maxLife - p.life) / 160)
        const alpha = 0.55 * p.brightness * fadeIn * fadeOut
        if (alpha <= 0.01) continue

        const gradient = ctx.createLinearGradient(tailX, tailY, headX, headY)
        gradient.addColorStop(0, 'rgba(122, 162, 255, 0)')
        gradient.addColorStop(0.65, `rgba(122, 162, 255, ${alpha * 0.35})`)
        gradient.addColorStop(1, `rgba(190, 212, 255, ${alpha})`)

        ctx.strokeStyle = gradient
        ctx.lineWidth = 1.05
        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        // Quadratic smoothing between midpoints keeps the curve silky.
        for (let i = 1; i < len - 1; i++) {
          const x = trail[i * 2]
          const y = trail[i * 2 + 1]
          const nx = trail[(i + 1) * 2]
          const ny = trail[(i + 1) * 2 + 1]
          ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2)
        }
        ctx.lineTo(headX, headY)
        ctx.stroke()

        // Luminous head.
        ctx.fillStyle = `rgba(210, 226, 255, ${alpha * 0.9})`
        ctx.beginPath()
        ctx.arc(headX, headY, 1.25, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'source-over'
    }

    let last = performance.now()
    const loop = (now: number) => {
      if (!running) return
      const dt = Math.min((now - last) / 16.67, 3)
      last = now
      elapsed += dt

      for (const p of particles) step(p, dt, elapsed * 0.004)
      drawFrame()

      rafId = requestAnimationFrame(loop)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
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
    observer.observe(canvas)
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
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className ?? 'absolute inset-0 h-full w-full'}
    />
  )
}
