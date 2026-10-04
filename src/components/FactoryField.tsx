import { useEffect, useRef } from 'react'
import { mulberry32 } from './factory/geometry'
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

    const render = () => {
      sctx.clearRect(0, 0, width, height)
      lctx.clearRect(0, 0, width, height)

      sctx.globalCompositeOperation = 'lighter'
      drawAmbient(sctx, world.ambient)
      sctx.globalCompositeOperation = 'source-over'

      drawRoads(sctx, world)
      drawJunctions(sctx, world, clock)
      drawBuildings(sctx, world, clock)
      drawConveyors(sctx, world, clock)

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
      world = createWorld({ x: width * 0.46, y: height * 0.54 }, rng)
      resetWorld(world, env, density, clock)
      sctx.clearRect(0, 0, width, height)
      lctx.clearRect(0, 0, width, height)
    }

    const buildStaticFrame = () => {
      env.width = width
      env.height = height
      world = createWorld({ x: width * 0.46, y: height * 0.54 }, rng)
      buildStatic(world, env)
      drawRoads(sctx, world)
      drawJunctions(sctx, world, 0)
      drawBuildings(sctx, world, 0)
      drawConveyors(sctx, world, 0)
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
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sctx.clearRect(0, 0, width, height)
      lctx.clearRect(0, 0, width, height)

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
