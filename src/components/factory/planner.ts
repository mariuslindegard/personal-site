import { cumulative, dist, distToSegment, type Pt } from './geometry'
import {
  BUILDINGS,
  BUILDING_SEP,
  CONVEYOR_COST,
  CONVEYOR_MAX,
  CONVEYOR_MIN_BUILDINGS,
  CONVEYOR_WORK,
  HIGHWAY_MIN_BUILDINGS,
  MARGIN,
  MAX_SIGNALS,
  MAX_SITES,
  PROGRESSION,
  ROAD_OPTIMIZE_AGE,
  ROAD_OPTIMIZE_DETOUR,
} from './config'
import {
  addNode,
  addRoad,
  buildingsConnected,
  components,
  findPath,
  nearestNode,
} from './network'
import type { Building, Conveyor, Env, World } from './types'

const TOTAL_BUILDING_CAP = 40

function referencePoint(world: World, key: string, anchor: Pt): Pt {
  const def = BUILDINGS[key]
  const mat = def?.recipe?.inputs[0]?.mat ?? -1
  let producer: Building | null = null
  let producerD = Infinity
  let any: Building | null = null
  let anyD = Infinity
  for (const building of world.buildings) {
    if (building.state !== 'active') continue
    const d = dist(building.pos, anchor)
    if (d < anyD) {
      anyD = d
      any = building
    }
    const out = BUILDINGS[building.key]?.recipe?.output
    if (out && out.mat === mat && d < producerD) {
      producerD = d
      producer = building
    }
  }
  if (producer) return producer.pos
  if (any) return any.pos
  return anchor
}

function isFree(world: World, pos: Pt): boolean {
  for (const building of world.buildings) {
    if (dist(building.pos, pos) < BUILDING_SEP) return false
  }
  for (const segment of world.segments) {
    if (distToSegment(pos, segment.pts[0], segment.pts[segment.pts.length - 1]) < 28) {
      return false
    }
  }
  return true
}

export function placeSite(
  world: World,
  env: Env,
  key: string,
  clock: number,
): Building | null {
  const def = BUILDINGS[key]
  if (!def) return null
  const reference =
    env.rng() < 0.4 ? world.anchor : referencePoint(world, key, world.anchor)

  let chosen: Pt | null = null
  for (let attempt = 0; attempt < 90; attempt++) {
    const angle = env.rng() * Math.PI * 2
    const radius = 92 + def.tier * 8 + attempt * 5 + env.rng() * 45
    const pos = {
      x: reference.x + Math.cos(angle) * radius,
      y: reference.y + Math.sin(angle) * radius,
    }
    if (
      pos.x < MARGIN ||
      pos.y < MARGIN ||
      pos.x > env.width - MARGIN ||
      pos.y > env.height - MARGIN
    ) {
      continue
    }
    if (!isFree(world, pos)) continue
    chosen = pos
    break
  }
  if (!chosen) return null

  const node = addNode(world, chosen, 'building')
  const building: Building = {
    id: world.nextBuildingId++,
    key,
    tier: def.tier,
    pos: chosen,
    nodeId: node.id,
    state: 'site',
    cost: def.cost.map((cost) => ({ mat: cost.mat, qty: cost.qty })),
    delivered: {},
    work: def.work,
    workRequired: def.work,
    inputs: {},
    output: {},
    vehicleOrders: 0,
    progress: 0,
    pulse: 1,
    produceAt: 0,
    idleSince: clock,
  }
  node.buildingId = building.id
  world.buildings.push(building)
  world.buildingById[building.id] = building

  const other = nearestNode(world, chosen, Infinity, (n) => n.id !== node.id)
  if (other) addRoad(world, other.pos, chosen, 1, false)
  else world.topoDirty = true
  return building
}

function connectComponents(world: World): boolean {
  const groups = components(world)
  if (groups.length <= 1) return false
  groups.sort((a, b) => b.length - a.length)
  const main = groups[0]
  const mainNodes = main
    .map((id) => world.nodeById[id])
    .filter((n): n is NonNullable<typeof n> => Boolean(n))
  let bestA: Pt | null = null
  let bestB: Pt | null = null
  let bestD = Infinity
  for (let gi = 1; gi < groups.length; gi++) {
    for (const id of groups[gi]) {
      const node = world.nodeById[id]
      if (!node) continue
      for (const mainNode of mainNodes) {
        const d = dist(node.pos, mainNode.pos)
        if (d < bestD) {
          bestD = d
          bestA = node.pos
          bestB = mainNode.pos
        }
      }
    }
  }
  if (bestA && bestB) {
    addRoad(world, bestB, bestA, 1, false)
    return true
  }
  return false
}

function maybeBuildHighway(world: World): void {
  if (world.highways > 0) return
  if ((world.produced[1] ?? 0) < 1) return
  if (world.buildings.length < HIGHWAY_MIN_BUILDINGS) return

  const nodes = world.buildings
    .filter((building) => building.state === 'active')
    .map((building) => world.nodeById[building.nodeId])
    .filter((node): node is NonNullable<typeof node> => Boolean(node))
  if (nodes.length < 2) return

  const pairs: { a: (typeof nodes)[number]; b: (typeof nodes)[number]; d: number }[] = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      pairs.push({
        a: nodes[i],
        b: nodes[j],
        d: dist(nodes[i].pos, nodes[j].pos),
      })
    }
  }
  pairs.sort((p, q) => q.d - p.d)

  let attempts = 0
  for (const pair of pairs) {
    if (attempts >= 6) break
    if (pair.d < 160) break
    attempts++
    const created = addRoad(world, pair.a.pos, pair.b.pos, 3, false)
    if (!created || created.length === 0) continue
    world.highways += 1
    world.pulses.push({
      x: pair.a.pos.x,
      y: pair.a.pos.y,
      t: 0,
      max: 26,
      r: 4,
      rgb: [228, 178, 108],
      width: 1.2,
    })
    return
  }
}

function installSignals(world: World): void {
  if (world.signals >= MAX_SIGNALS) return
  const systems = world.buildings.find(
    (building) =>
      building.key === 'systems' &&
      building.state === 'active' &&
      (building.output[3] ?? 0) > 0,
  )
  if (!systems) return

  let best: (typeof world.nodes)[number] | null = null
  for (const node of world.nodes) {
    if (node.signal || node.segments.length < 2) continue
    if (!best || node.segments.length > best.segments.length) best = node
  }
  if (!best) return

  systems.output[3] = (systems.output[3] ?? 0) - 1
  best.signal = true
  world.signals += 1
  world.pulses.push({
    x: best.pos.x,
    y: best.pos.y,
    t: 0,
    max: 18,
    r: 3,
    rgb: [150, 255, 180],
    width: 1,
  })
}

function maybeBuildConveyor(world: World): void {
  if ((world.produced[3] ?? 0) < 1) return
  if (world.buildings.length < CONVEYOR_MIN_BUILDINGS) return
  if (world.conveyors.length >= CONVEYOR_MAX) return
  if (world.conveyors.some((conveyor) => !conveyor.built)) return

  let best: { from: Building; to: Building; mat: number; d: number } | null = null
  for (const consumer of world.buildings) {
    if (consumer.state !== 'active') continue
    const recipe = BUILDINGS[consumer.key]?.recipe
    if (!recipe) continue
    for (const input of recipe.inputs) {
      for (const producer of world.buildings) {
        if (producer.state !== 'active' || producer.key === 'warehouse') continue
        if (BUILDINGS[producer.key]?.recipe?.output?.mat !== input.mat) continue
        const d = dist(producer.pos, consumer.pos)
        if (d < 180) continue
        if (!best || d > best.d) {
          best = { from: producer, to: consumer, mat: input.mat, d }
        }
      }
    }
  }
  if (!best) return
  if (
    world.conveyors.some(
      (conveyor) => conveyor.fromId === best!.from.id && conveyor.toId === best!.to.id,
    )
  ) {
    return
  }

  const fromNode = world.nodeById[best.from.nodeId]
  const toNode = world.nodeById[best.to.nodeId]
  if (!fromNode || !toNode) return
  const pts = [fromNode.pos, toNode.pos]
  const conveyor: Conveyor = {
    id: world.nextConveyorId++,
    fromId: best.from.id,
    toId: best.to.id,
    mat: best.mat,
    pts,
    cum: cumulative(pts),
    length: dist(pts[0], pts[1]),
    cost: CONVEYOR_COST.map((cost) => ({ mat: cost.mat, qty: cost.qty })),
    delivered: {},
    work: CONVEYOR_WORK,
    workRequired: CONVEYOR_WORK,
    progress: 0,
    built: false,
    transferAt: 0,
    pulse: 1,
  }
  world.conveyors.push(conveyor)
  world.pulses.push({
    x: pts[0].x,
    y: pts[0].y,
    t: 0,
    max: 22,
    r: 3,
    rgb: [160, 220, 255],
    width: 1,
  })
}

function optimizeRoads(world: World): void {
  let marked = 0
  for (const segment of world.segments) {
    if (marked >= 2) break
    if (!segment.built || segment.demolish || segment.tier === 3) continue
    if (segment.age < ROAD_OPTIMIZE_AGE) continue
    if (segment.traffic > 3) continue
    if (!buildingsConnected(world, segment.id)) continue
    const detour = findPath(world, segment.a, segment.b, segment.id)
    if (!detour) continue
    let detourLength = 0
    for (const id of detour.segments) {
      detourLength += world.segmentById[id]?.length ?? 0
    }
    if (detourLength > segment.length * ROAD_OPTIMIZE_DETOUR) continue
    segment.demolish = true
    marked += 1
  }
}

export function planCity(world: World, env: Env, clock: number): void {
  if (world.landmarkDone) return

  connectComponents(world)
  installSignals(world)
  maybeBuildHighway(world)
  maybeBuildConveyor(world)
  optimizeRoads(world)

  const sites = world.buildings.filter((b) => b.state === 'site').length
  const total = world.buildings.length

  const warehouses = world.buildings.filter(
    (b) => b.key === 'warehouse' && b.state !== 'complete',
  ).length
  const extractors = world.buildings.filter(
    (b) => b.key === 'extractor' && b.state !== 'complete',
  ).length
  if (warehouses === 0 && extractors >= 3 && sites < MAX_SITES && total < TOTAL_BUILDING_CAP) {
    placeSite(world, env, 'warehouse', clock)
    return
  }

  const producerKeys = [
    'extractor',
    'assembly',
    'concrete',
    'systems',
    'design',
    'megaplant',
  ]
  const producerMax = [5, 3, 3, 2, 2, 2]

  for (let mat = 0; mat < 6; mat++) {
    let consumers = 0
    for (const building of world.buildings) {
      if (building.state !== 'active') continue
      const recipe = BUILDINGS[building.key]?.recipe
      if (recipe?.inputs.some((input) => input.mat === mat)) consumers += 1
    }
    if (consumers === 0) continue

    let producers = 0
    for (const building of world.buildings) {
      if (building.state === 'complete') continue
      if (BUILDINGS[building.key]?.recipe?.output?.mat === mat) producers += 1
    }
    const key = producerKeys[mat]
    const def = BUILDINGS[key]
    if (!def) continue
    if (def.unlock >= 0 && (world.produced[def.unlock] ?? 0) < 1) continue
    const target = Math.min(producerMax[mat], consumers + 1)
    if (producers < target && sites < MAX_SITES && total < TOTAL_BUILDING_CAP) {
      placeSite(world, env, key, clock)
      return
    }
  }

  for (const key of PROGRESSION) {
    const def = BUILDINGS[key]
    if (!def) continue
    if (def.unlock >= 0 && (world.produced[def.unlock] ?? 0) < 1) break
    const existing = world.buildings.some(
      (b) => b.key === key && b.state !== 'complete',
    )
    if (existing) continue
    if (sites < MAX_SITES && total < TOTAL_BUILDING_CAP) {
      placeSite(world, env, key, clock)
    }
    break
  }
}
