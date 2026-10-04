import { useEffect, useRef } from 'react'
import { clamp, mulberry32 } from './factory/geometry'
import {
  buildStatic,
  createWorld,
  dissolveFinished,
  resetWorld,
  stepWorld,
} from './factory/sim'
import type { Env, World } from './factory/types'
import {
  drawAmbient,
  drawBuildings,
  drawConveyors,
  drawDissolve,
  drawJunctions,
  drawParticles,
  drawPulses,
  drawRoads,
  drawVehicles,
} from './factory/render'

type Props = {
  density?: number
  className?: string
}

export default function FactoryField({ density = 1, className }: Props) {
  const structRef = useRef<HTMLCanvasElement | null>(null)
  const liveRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const structCanvas = structRef.current
    const liveCanvas = liveRef.current
    if (!structCanvas || !liveCanvas) return
    const sctx = structCanvas.getContext('2d')
    const lctx = liveCanvas.getContext('2d')
    if (!sctx || !lctx) return

    const rng = mulberry32((0x5eed ^ Math.round(density * 9973)) >>> 0)
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    let width = 0
    let height = 0
    let dpr = 1
    const env: Env = { width: 0, height: 0, rng }
    let world: World = createWorld({ x: 0, y: 0 }, rng)
    let clock = 0
    const pointer = { x: Number.NaN, y: Number.NaN }
    let rafId = 0
    let running = true
    let last = performance.now()
    let viewScale = 1
    let viewOffX = 0
    let viewOffY = 0
    let viewCX = 0
    let viewCY = 0
    let lastViewAt = 0

    const applyTransforms = () => {
      const scale = dpr * viewScale
      sctx.setTransform(scale, 0, 0, scale, dpr * viewOffX, dpr * viewOffY)
      lctx.setTransform(scale, 0, 0, scale, dpr * viewOffX, dpr * viewOffY)
    }

    const computeView = () => {
      const margin = 160
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const building of world.buildings) {
        minX = Math.min(minX, building.pos.x)
        minY = Math.min(minY, building.pos.y)
        maxX = Math.max(maxX, building.pos.x)
        maxY = Math.max(maxY, building.pos.y)
      }
      if (!Number.isFinite(minX)) {
        minX = 0
        minY = 0
        maxX = width
        maxY = height
      }
      const boundsW = Math.max(maxX - minX + margin * 2, width)
      const boundsH = Math.max(maxY - minY + margin * 2, height)
      const target = clamp(Math.min(width / boundsW, height / boundsH), 0.3, 1)
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2

      const dt = clamp(clock - lastViewAt, 0, 100)
      lastViewAt = clock
      const ease = 1 - Math.exp(-dt / 700)
      viewScale += (target - viewScale) * ease
      viewCX += (centerX - viewCX) * ease
      viewCY += (centerY - viewCY) * ease

      viewOffX = width / 2 - viewCX * viewScale
      viewOffY = height / 2 - viewCY * viewScale
      applyTransforms()
    }

    const render = () => {
      sctx.setTransform(1, 0, 0, 1, 0, 0)
      lctx.setTransform(1, 0, 0, 1, 0, 0)
      sctx.clearRect(0, 0, structCanvas.width, structCanvas.height)
      lctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height)
      computeView()

      sctx.globalCompositeOperation = 'lighter'
      drawAmbient(sctx, world.ambient)
      sctx.globalCompositeOperation = 'source-over'

      drawRoads(sctx, world)
      drawJunctions(sctx, world, clock)
      drawConveyors(sctx, world, clock)
      drawBuildings(sctx, world, clock)

      drawVehicles(lctx, world)
      drawPulses(lctx, world.pulses)
      drawParticles(lctx, world.particles)

      if (world.phase === 'dissolve') {
        const alpha =
          ((clock - world.dissolveStart) / 8000) ** 1.15
        drawDissolve(lctx, Math.min(1, Math.max(0, alpha)))
      }
    }

    const reset = () => {
      env.width = width
      env.height = height
      viewScale = 1
      viewOffX = 0
      viewOffY = 0
      viewCX = width * 0.46
      viewCY = height * 0.54
      lastViewAt = clock
      world = createWorld({ x: width * 0.46, y: height * 0.54 }, rng)
      resetWorld(world, env, density, clock)
      sctx.setTransform(1, 0, 0, 1, 0, 0)
      lctx.setTransform(1, 0, 0, 1, 0, 0)
      sctx.clearRect(0, 0, structCanvas.width, structCanvas.height)
      lctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height)
    }

    const buildStaticFrame = () => {
      env.width = width
      env.height = height
      viewScale = 1
      viewOffX = 0
      viewOffY = 0
      viewCX = width * 0.46
      viewCY = height * 0.54
      lastViewAt = 0
      world = createWorld({ x: width * 0.46, y: height * 0.54 }, rng)
      buildStatic(world, env)
      sctx.setTransform(1, 0, 0, 1, 0, 0)
      lctx.setTransform(1, 0, 0, 1, 0, 0)
      sctx.clearRect(0, 0, structCanvas.width, structCanvas.height)
      lctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height)
      computeView()
      drawRoads(sctx, world)
      drawJunctions(sctx, world, 0)
      drawConveyors(sctx, world, 0)
      drawBuildings(sctx, world, 0)
      drawVehicles(sctx, world)
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = structCanvas.clientWidth
      height = structCanvas.clientHeight
      if (width === 0 || height === 0) return

      for (const canvas of [structCanvas, liveCanvas]) {
        canvas.width = Math.floor(width * dpr)
        canvas.height = Math.floor(height * dpr)
      }
      sctx.setTransform(1, 0, 0, 1, 0, 0)
      lctx.setTransform(1, 0, 0, 1, 0, 0)
      sctx.clearRect(0, 0, structCanvas.width, structCanvas.height)
      lctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height)

      if (reduceMotion) buildStaticFrame()
      else reset()
    }

    const loop = (now: number) => {
      if (!running) return
      const dtMs = Math.min(now - last, 50)
      last = now
      clock += dtMs

      stepWorld(world, env, dtMs, clock, pointer)
      if (dissolveFinished(world, clock)) reset()
      render()

      rafId = requestAnimationFrame(loop)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = structCanvas.getBoundingClientRect()
      pointer.x = (event.clientX - rect.left - viewOffX) / viewScale
      pointer.y = (event.clientY - rect.top - viewOffY) / viewScale
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

    const observer = new ResizeObserver(() => {
      if (
        structCanvas.clientWidth === width &&
        structCanvas.clientHeight === height
      ) {
        return
      }
      resize()
    })

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
      <canvas
        ref={structRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />
      <canvas
        ref={liveRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  )
}
