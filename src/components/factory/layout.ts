import { TAU, clamp, dist, type Pt } from './geometry'
import type { Factory, World } from './model'

export type Env = { width: number; height: number; rng: () => number }

const MARGIN = 34

function minSep(width: number, height: number): number {
  return clamp(Math.min(width, height) * 0.115, 54, 96)
}

export function anchorFor(width: number, height: number): Pt {
  return { x: width * 0.44, y: height * 0.55 }
}

export function placeSupplier(
  world: World,
  env: Env,
  tier: number,
  parent: Factory,
  slot: number,
): Pt {
  const anchor = world.anchor
  const sep = minSep(env.width, env.height)
  const outward = Math.hypot(parent.pos.x - anchor.x, parent.pos.y - anchor.y)
  const base =
    outward < 12
      ? slot === 0
        ? Math.PI * 0.72
        : Math.PI * 1.28
      : Math.atan2(parent.pos.y - anchor.y, parent.pos.x - anchor.x)
  const spread = 0.72 + env.rng() * 0.5
  const preferred = base + (slot === 0 ? -spread : spread)
  const baseDist = 88 + tier * 8 + env.rng() * 60

  let fallback: Pt | null = null
  let fallbackScore = Infinity

  for (let attempt = 0; attempt < 90; attempt++) {
    const t = attempt / 90
    const angle = preferred + (env.rng() - 0.5) * (0.7 + t * 6)
    const radius = baseDist * (1 + t * 1.6)
    const p = {
      x: parent.pos.x + Math.cos(angle) * radius,
      y: parent.pos.y + Math.sin(angle) * radius,
    }
    if (
      p.x < MARGIN ||
      p.y < MARGIN ||
      p.x > env.width - MARGIN ||
      p.y > env.height - MARGIN
    ) {
      continue
    }

    let nearest = Infinity
    for (const factory of world.factories) {
      const d = dist(p, factory.pos)
      if (d < nearest) nearest = d
    }
    const score = nearest < sep ? sep - nearest + radius * 0.05 : 0
    if (score === 0) return p
    if (score < fallbackScore) {
      fallbackScore = score
      fallback = p
    }
  }

  let lastResort: Pt | null = null
  let lastNearest = -1
  for (let i = 0; i < 32; i++) {
    const angle = env.rng() * TAU
    const radius = baseDist * (0.8 + env.rng() * 1.8)
    const p = {
      x: parent.pos.x + Math.cos(angle) * radius,
      y: parent.pos.y + Math.sin(angle) * radius,
    }
    if (
      p.x < MARGIN ||
      p.y < MARGIN ||
      p.x > env.width - MARGIN ||
      p.y > env.height - MARGIN
    ) {
      continue
    }
    let nearest = Infinity
    for (const factory of world.factories) {
      const d = dist(p, factory.pos)
      if (d < nearest) nearest = d
    }
    if (nearest > lastNearest) {
      lastNearest = nearest
      lastResort = p
    }
  }
  if (lastResort) return lastResort
  if (fallback) return fallback

  const angle = preferred + env.rng() * TAU
  return {
    x: clamp(parent.pos.x + Math.cos(angle) * baseDist * 1.6, MARGIN, env.width - MARGIN),
    y: clamp(parent.pos.y + Math.sin(angle) * baseDist * 1.6, MARGIN, env.height - MARGIN),
  }
}

export function placeTop(world: World, env: Env): Pt {
  const sep = minSep(env.width, env.height) * 0.92
  let angle = world.topCount * 2.39996 + 0.6
  let radius = 62 + Math.min(world.topCount, 7) * 16
  let best: Pt | null = null
  let bestNearest = -1

  for (let attempt = 0; attempt < 48; attempt++) {
    const p = {
      x: clamp(world.anchor.x + Math.cos(angle) * radius, MARGIN, env.width - MARGIN),
      y: clamp(world.anchor.y + Math.sin(angle) * radius, MARGIN, env.height - MARGIN),
    }
    let nearest = Infinity
    for (const factory of world.factories) {
      const d = dist(p, factory.pos)
      if (d < nearest) nearest = d
    }
    if (nearest >= sep) return p
    if (nearest > bestNearest) {
      bestNearest = nearest
      best = p
    }
    angle += 2.39996
    radius += 14
  }

  return best ?? { x: world.anchor.x, y: world.anchor.y }
}
