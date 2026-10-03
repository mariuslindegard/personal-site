import { useEffect, useRef } from 'react'
import {
  DISSOLVE_MS,
  PLACE_DELAY,
  buildAmbient,
  buildStatic,
  createWorld,
  maybeSpawnTop,
  processTask,
  resetWorld,
  stepFactories,
  updateAmbient,
  updateLinks,
  updateProducts,
  updatePulses,
  type World,
} from './factory/model'
import { anchorFor, type Env } from './factory/layout'
import { clamp, mulberry32 } from './factory/geometry'
import {
  drawAmbient,
  drawDissolve,
  drawFactory,
  drawLink,
  drawProduct,
  drawPulse,
} from './factory/render'

type Props = {
  density?: number
  className?: string
}

const MAX_TIER_WIDE = 6
const MAX_TIER_NARROW = 5
const STATIC_TIER = 3

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
    let maxTier = MAX_TIER_WIDE
    const env: Env = { width: 0, height: 0, rng }
    let world: World = createWorld({ x: 0, y: 0 })
    let clock = 0
    let nextTaskAt = 0
    const pointer = { x: Number.NaN, y: Number.NaN }
    let rafId = 0
    let running = true
    let last = performance.now()

    const findLink = (id: number) =>
      world.links.find((candidate) => candidate.id === id)

    const renderLive = () => {
      lctx.clearRect(0, 0, width, height)
      lctx.globalCompositeOperation = 'lighter'
      drawAmbient(lctx, world.ambient)

      for (const link of world.links) {
        if (link.committed || link.build <= 0) continue
        const from = world.factoryById[link.fromId]
        if (from) drawLink(lctx, link, from.tier, link.build, 1.7)
      }

      for (const product of world.products) {
        const link = findLink(product.linkId)
        if (!link) continue
        const from = world.factoryById[link.fromId]
        if (from) drawProduct(lctx, link, product.at, from.tier)
      }

      lctx.globalCompositeOperation = 'source-over'

      for (const factory of world.factories) drawFactory(lctx, factory, clock)
      for (const pulse of world.pulses) drawPulse(lctx, pulse)

      if (world.phase === 'dissolve') {
        const alpha = clamp((clock - world.dissolveStart) / DISSOLVE_MS, 0, 1) ** 1.15
        drawDissolve(lctx, alpha)
      }
    }

    const reset = () => {
      env.width = width
      env.height = height
      world = createWorld(anchorFor(width, height))
      resetWorld(world, env, density)
      nextTaskAt = clock + 600
      sctx.clearRect(0, 0, width, height)
      lctx.clearRect(0, 0, width, height)
    }

    const buildStaticFrame = () => {
      env.width = width
      env.height = height
      world = createWorld(anchorFor(width, height))
      buildAmbient(world, env, density)
      buildStatic(world, env, STATIC_TIER)

      for (const link of world.links) {
        const from = world.factoryById[link.fromId]
        if (from) drawLink(sctx, link, from.tier, 1, 1)
      }
      for (let i = 0; i < world.links.length; i++) {
        if (i % 3 !== 0) continue
        const link = world.links[i]
        const from = world.factoryById[link.fromId]
        if (from) {
          drawProduct(sctx, link, link.curve.length * (0.25 + (i % 5) * 0.13), from.tier)
        }
      }
      for (const factory of world.factories) drawFactory(sctx, factory, 0)
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = structCanvas.clientWidth
      height = structCanvas.clientHeight
      if (width === 0 || height === 0) return
      maxTier = width < 720 ? MAX_TIER_NARROW : MAX_TIER_WIDE

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
      const t = clock * 0.00024

      if (world.phase === 'grow') {
        if (world.dissolveAt === 0 && clock >= nextTaskAt) {
          processTask(world, env)
          nextTaskAt = clock + PLACE_DELAY
        }
        maybeSpawnTop(world, env, clock, maxTier)
        if (world.dissolveAt > 0 && clock >= world.dissolveAt) {
          world.phase = 'dissolve'
          world.dissolveStart = clock
        }
      } else if (clock - world.dissolveStart >= DISSOLVE_MS) {
        reset()
      }

      if (world.phase === 'grow') stepFactories(world, dtMs, clock)

      const committed = updateLinks(world, dtMs)
      for (const link of committed) {
        const from = world.factoryById[link.fromId]
        if (from) drawLink(sctx, link, from.tier, 1, 1)
      }

      updateProducts(world, dtMs)
      updatePulses(world, dtMs)
      updateAmbient(world, env, dtMs, t, pointer)
      renderLive()

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
