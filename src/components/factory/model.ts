import {
  buildCurve,
  clamp,
  dist,
  flowAngle,
  pointAtDistance,
  radiusOf,
  type Curve,
  type Pt,
} from './geometry'
import { anchorFor, placeSupplier, placeTop, type Env } from './layout'

export type Factory = {
  id: number
  tier: number
  pos: Pt
  inputs: (Link | null)[]
  arrivals: number[]
  output: Link | null
  producedOnce: boolean
  produceAt: number
  pulse: number
  emitAt: number
}

export type Link = {
  id: number
  fromId: number
  toId: number
  slot: number
  curve: Curve
  build: number
  buildTarget: number
  committed: boolean
}

export type Product = {
  linkId: number
  at: number
  speed: number
  push: number
}

export type Pulse = {
  x: number
  y: number
  t: number
  max: number
  r: number
  hue: number
  width: number
}

export type Ambient = {
  x: number
  y: number
  trail: number[]
  speed: number
  life: number
  brightness: number
}

export type Task =
  | { kind: 'place'; consumer: number; slot: number }
  | { kind: 'connect'; from: number; to: number; slot: number }

export type Phase = 'grow' | 'dissolve'

export type World = {
  factories: Factory[]
  factoryById: (Factory | undefined)[]
  links: Link[]
  products: Product[]
  pulses: Pulse[]
  ambient: Ambient[]
  queue: Task[]
  nextId: number
  anchor: Pt
  topCount: number
  spawnedTier: number
  dissolveAt: number
  dissolveStart: number
  phase: Phase
}

export const PRODUCT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

export const TIER_RGB: [number, number, number][] = [
  [122, 162, 255],
  [111, 211, 199],
  [179, 157, 255],
  [255, 192, 110],
  [255, 143, 168],
  [155, 224, 127],
  [103, 217, 240],
]

export const PLACE_DELAY = 300
export const ROAD_SEGMENT = 0.2
export const ROAD_SEGMENT_MS = 550
export const PRODUCE_MS = 700
export const PULSE_MS = 1050
export const EMIT_MS = 1500
export const PRODUCT_SPEED = 0.08
export const MAX_PRODUCTS = 280
export const MAX_LINK_PRODUCTS = 4
export const DISSOLVE_MS = 8000
export const LINGER_MS = 12000

const TRAIL_LENGTH = 14

export function createWorld(anchor: Pt): World {
  return {
    factories: [],
    factoryById: [],
    links: [],
    products: [],
    pulses: [],
    ambient: [],
    queue: [],
    nextId: 0,
    anchor,
    topCount: 0,
    spawnedTier: 0,
    dissolveAt: 0,
    dissolveStart: 0,
    phase: 'grow',
  }
}

export function resetWorld(world: World, env: Env, density: number): void {
  world.factories = []
  world.factoryById = []
  world.links = []
  world.products = []
  world.pulses = []
  world.queue = []
  world.nextId = 0
  world.topCount = 0
  world.spawnedTier = 0
  world.dissolveAt = 0
  world.dissolveStart = 0
  world.phase = 'grow'
  world.anchor = anchorFor(env.width, env.height)
  const seed = addFactory(world, 1, world.anchor)
  world.spawnedTier = 1
  world.queue.push(
    { kind: 'place', consumer: seed.id, slot: 0 },
    { kind: 'place', consumer: seed.id, slot: 1 },
  )
  world.pulses.push({
    x: seed.pos.x,
    y: seed.pos.y,
    t: 0,
    max: 30,
    r: radiusOf(seed.tier),
    hue: seed.tier,
    width: 1.1,
  })
  buildAmbient(world, env, density)
}

export function addFactory(world: World, tier: number, pos: Pt): Factory {
  const factory: Factory = {
    id: world.nextId++,
    tier,
    pos,
    inputs: [null, null],
    arrivals: [0, 0],
    output: null,
    producedOnce: false,
    produceAt: 0,
    pulse: 0,
    emitAt: 0,
  }
  world.factories.push(factory)
  world.factoryById[factory.id] = factory
  return factory
}

function addLink(world: World, from: Factory, to: Factory, slot: number): Link {
  const a = from.pos
  const b = to.pos
  const ra = radiusOf(from.tier)
  const rb = radiusOf(to.tier)
  const d = Math.max(dist(a, b), 1)
  const ux = (b.x - a.x) / d
  const uy = (b.y - a.y) / d
  const p0 = { x: a.x + ux * ra, y: a.y + uy * ra }
  const p3 = { x: b.x - ux * rb, y: b.y - uy * rb }
  const nx = -uy
  const ny = ux
  const curl = (slot === 0 ? 1 : -1) * (0.75 + ((from.id + to.id) % 3) * 0.18)
  const k = clamp(d * 0.24, 14, 74) * curl
  const p1 = {
    x: p0.x + (p3.x - p0.x) * 0.3 + nx * k,
    y: p0.y + (p3.y - p0.y) * 0.3 + ny * k,
  }
  const p2 = {
    x: p0.x + (p3.x - p0.x) * 0.7 + nx * k,
    y: p0.y + (p3.y - p0.y) * 0.7 + ny * k,
  }

  const link: Link = {
    id: world.nextId++,
    fromId: from.id,
    toId: to.id,
    slot,
    curve: buildCurve(p0, p1, p2, p3),
    build: 0.05,
    buildTarget: 0.05,
    committed: false,
  }
  world.links.push(link)
  from.output = link
  to.inputs[slot] = link
  return link
}

function findIdleSupplier(world: World, tier: number): Factory | null {
  for (const factory of world.factories) {
    if (factory.tier === tier && factory.output === null) return factory
  }
  return null
}

export function processTask(world: World, env: Env): boolean {
  const task = world.queue[0]
  if (!task) return false

  if (task.kind === 'place') {
    const consumer = world.factoryById[task.consumer]
    if (!consumer) {
      world.queue.shift()
      return true
    }
    const tier = consumer.tier - 1
    const supplier = findIdleSupplier(world, tier)
    if (supplier) {
      world.queue[0] = {
        kind: 'connect',
        from: supplier.id,
        to: consumer.id,
        slot: task.slot,
      }
      return true
    }

    const pos = placeSupplier(world, env, tier, consumer, task.slot)
    const factory = addFactory(world, tier, pos)
    const connect: Task = {
      kind: 'connect',
      from: factory.id,
      to: consumer.id,
      slot: task.slot,
    }
    if (tier > 0) {
      world.queue.splice(
        0,
        1,
        { kind: 'place', consumer: factory.id, slot: 0 },
        { kind: 'place', consumer: factory.id, slot: 1 },
        connect,
      )
    } else {
      world.queue.splice(0, 1, connect)
    }
    return true
  }

  const from = world.factoryById[task.from]
  const to = world.factoryById[task.to]
  world.queue.shift()
  if (!from || !to) return true

  addLink(world, from, to, task.slot)
  return true
}

export function maybeSpawnTop(
  world: World,
  env: Env,
  clock: number,
  maxTier: number,
): void {
  if (world.phase !== 'grow') return
  const top = world.factories.find((factory) => factory.output === null)
  if (!top || !top.producedOnce || top.tier !== world.spawnedTier) return

  if (top.tier >= maxTier) {
    if (
      world.dissolveAt === 0 &&
      world.dissolveStart === 0 &&
      world.queue.length === 0 &&
      world.links.every((link) => link.committed)
    ) {
      world.dissolveAt = clock + LINGER_MS
    }
    return
  }

  const pos = placeTop(world, env)
  const factory = addFactory(world, top.tier + 1, pos)
  world.topCount++
  world.spawnedTier = factory.tier
  world.queue.push(
    { kind: 'place', consumer: factory.id, slot: 0 },
    { kind: 'place', consumer: factory.id, slot: 1 },
  )
  world.pulses.push({
    x: pos.x,
    y: pos.y,
    t: 0,
    max: 34,
    r: radiusOf(factory.tier),
    hue: factory.tier,
    width: 1.2,
  })
}

export function updateLinks(world: World, dtMs: number): Link[] {
  const committed: Link[] = []
  const step = (ROAD_SEGMENT / ROAD_SEGMENT_MS) * dtMs

  for (const link of world.links) {
    if (link.committed) continue
    if (link.build < link.buildTarget) {
      link.build = Math.min(link.buildTarget, link.build + step)
    }
    if (link.build >= 1 - 1e-6 && link.buildTarget >= 1) {
      link.build = 1
      link.committed = true
      committed.push(link)
      const to = world.factoryById[link.toId]
      const from = world.factoryById[link.fromId]
      if (to && from) {
        world.pulses.push({
          x: to.pos.x,
          y: to.pos.y,
          t: 0,
          max: 26,
          r: radiusOf(to.tier),
          hue: from.tier,
          width: 1,
        })
      }
    }
  }

  return committed
}

function trySpawnProduct(world: World, factory: Factory): boolean {
  const link = factory.output
  if (!link) return false
  if (link.committed && world.products.length >= MAX_PRODUCTS) {
    return false
  }
  let onLink = 0
  for (const product of world.products) {
    if (product.linkId === link.id) onLink++
  }
  if (onLink >= MAX_LINK_PRODUCTS) return false

  world.products.push({
    linkId: link.id,
    at: 0,
    speed: PRODUCT_SPEED * (0.8 + Math.random() * 0.4),
    push: 0,
  })
  return true
}

function deliver(world: World, link: Link): void {
  const to = world.factoryById[link.toId]
  const from = world.factoryById[link.fromId]
  if (!to || to.tier === 0) return

  const was = to.arrivals[link.slot]
  to.arrivals[link.slot] = Math.min(2, was + 1)
  if (was === 0 && from) {
    world.pulses.push({
      x: to.pos.x,
      y: to.pos.y,
      t: 0,
      max: 9,
      r: radiusOf(to.tier) + 2,
      hue: from.tier,
      width: 0.7,
    })
  }
}

export function updateProducts(world: World, dtMs: number): void {
  if (world.products.length === 0) return
  const keep: Product[] = []

  for (const product of world.products) {
    const link = world.links.find((candidate) => candidate.id === product.linkId)
    if (!link) continue
    const from = world.factoryById[link.fromId]

    if (!link.committed) {
      const tip = link.build * link.curve.length

      if (product.push > 0) {
        product.at = Math.min(tip, link.curve.length)
        if (link.build >= product.push - 1e-4) {
          const point = pointAtDistance(link.curve, product.at)
          if (from) {
            world.pulses.push({
              x: point.x,
              y: point.y,
              t: 0,
              max: 11,
              r: 3,
              hue: from.tier,
              width: 0.8,
            })
          }
          if (link.build >= 1 - 1e-6) deliver(world, link)
          continue
        }
        keep.push(product)
        continue
      }

      product.at += product.speed * dtMs
      if (product.at >= tip) {
        product.at = tip
        product.push = Math.min(1, link.buildTarget + ROAD_SEGMENT)
        link.buildTarget = product.push
      }
      keep.push(product)
      continue
    }

    product.at += product.speed * dtMs
    if (product.at < link.curve.length) {
      keep.push(product)
      continue
    }
    deliver(world, link)
  }

  world.products = keep
}

export function stepFactories(
  world: World,
  dtMs: number,
  clock: number,
): void {
  for (const factory of world.factories) {
    if (factory.pulse > 0) {
      factory.pulse = Math.max(0, factory.pulse - dtMs / PULSE_MS)
    }

    if (factory.tier === 0) {
      if (factory.emitAt === 0) {
        factory.emitAt = clock + 240 + Math.random() * 1300
        continue
      }
      if (clock >= factory.emitAt) {
        const spawned = trySpawnProduct(world, factory)
        factory.emitAt =
          clock + (spawned ? EMIT_MS * (0.55 + Math.random() * 0.9) : 500)
      }
      continue
    }

    if (factory.produceAt === 0 && factory.arrivals[0] > 0 && factory.arrivals[1] > 0) {
      factory.arrivals[0] -= 1
      factory.arrivals[1] -= 1
      factory.produceAt = clock + PRODUCE_MS
    }

    if (factory.produceAt !== 0 && clock >= factory.produceAt) {
      factory.produceAt = 0
      factory.producedOnce = true
      factory.pulse = 1
      trySpawnProduct(world, factory)
    }
  }
}

export function updatePulses(world: World, dtMs: number): void {
  if (world.pulses.length === 0) return
  const keep: Pulse[] = []
  for (const pulse of world.pulses) {
    pulse.t += dtMs
    if (pulse.t <= PULSE_MS) keep.push(pulse)
  }
  world.pulses = keep
}

function spawnAmbient(env: Env, ambient: Ambient, scatter: boolean) {
  if (scatter) {
    ambient.x = env.rng() * env.width
    ambient.y = env.rng() * env.height
  } else {
    const margin = 30 + env.rng() * 180
    const edge = (env.rng() * 4) | 0
    if (edge === 0) {
      ambient.x = -margin
      ambient.y = env.rng() * env.height
    } else if (edge === 1) {
      ambient.x = env.width + margin
      ambient.y = env.rng() * env.height
    } else if (edge === 2) {
      ambient.x = env.rng() * env.width
      ambient.y = -margin
    } else {
      ambient.x = env.rng() * env.width
      ambient.y = env.height + margin
    }
  }
  ambient.speed = 0.3 + env.rng() * 0.6
  ambient.life = 0
  ambient.brightness = 0.25 + env.rng() * 0.75

  const trail: number[] = []
  for (let i = 0; i < TRAIL_LENGTH; i++) trail.push(ambient.x, ambient.y)
  ambient.trail = trail
}

export function buildAmbient(world: World, env: Env, density: number): void {
  const count = Math.round(
    Math.min(24, Math.max(8, (env.width / 95) * density)),
  )
  const next: Ambient[] = []
  for (let i = 0; i < count; i++) {
    const ambient: Ambient = {
      x: 0,
      y: 0,
      trail: [],
      speed: 1,
      life: 0,
      brightness: 1,
    }
    spawnAmbient(env, ambient, true)
    ambient.life = env.rng() * 140
    next.push(ambient)
  }
  world.ambient = next
}

export function updateAmbient(
  world: World,
  env: Env,
  dtMs: number,
  t: number,
  pointer: Pt,
): void {
  const dt = dtMs / 16.67
  for (const ambient of world.ambient) {
    let angle = flowAngle(ambient.x, ambient.y, t)

    if (!Number.isNaN(pointer.x)) {
      const dx = ambient.x - pointer.x
      const dy = ambient.y - pointer.y
      const distSq = dx * dx + dy * dy
      if (distSq < 42000 && distSq > 1) {
        angle += (1 - distSq / 42000) * 1.1 * Math.sign(dy || 1)
      }
    }

    ambient.x += Math.cos(angle) * ambient.speed * dt
    ambient.y += Math.sin(angle) * ambient.speed * dt
    ambient.life += dtMs

    ambient.trail.push(ambient.x, ambient.y)
    while (ambient.trail.length > TRAIL_LENGTH * 2) ambient.trail.splice(0, 2)

    const offScreen =
      ambient.x > env.width + 260 ||
      ambient.x < -260 ||
      ambient.y > env.height + 260 ||
      ambient.y < -260
    if (offScreen) spawnAmbient(env, ambient, false)
  }
}

export function buildStatic(world: World, env: Env, maxTier: number): void {
  const root = addFactory(world, maxTier, world.anchor)
  world.spawnedTier = maxTier
  growStatic(world, env, root)
}

function growStatic(world: World, env: Env, factory: Factory): void {
  if (factory.tier === 0) return
  for (const slot of [0, 1]) {
    const pos = placeSupplier(world, env, factory.tier - 1, factory, slot)
    const child = addFactory(world, factory.tier - 1, pos)
    growStatic(world, env, child)
    const link = addLink(world, child, factory, slot)
    link.build = 1
    link.buildTarget = 1
    link.committed = true
  }
}
