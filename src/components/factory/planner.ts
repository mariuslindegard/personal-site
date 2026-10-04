import { cumulative, dist, distToSegment, type Pt } from './geometry'
import {
  BUILDINGS,
  BUILDING_SEP,
  CONVEYOR_COST,
  CONVEYOR_MAX,
  CONVEYOR_MIN_BUILDINGS,
  CONVEYOR_WORK,
  DEPOT_SLOTS,
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
  pathPoints,
} from './network'
import { requestBuildingDemolition } from './jobs'
import type { Building, Conveyor, Env, World } from './types'

const TOTAL_BUILDING_CAP = 90
const DISTRICT_KEYS = [
  'extractor',
  'assembly',
  'concrete',
  'systems',
  'design',
  'megaplant',
  'vehicle',
]
const DISTRICT_MIN = 3
const DISTRICT_RADIUS = 150
const REFINE_MS = 12000

function countKey(world: World, key: string): number {
  let count = 0
  for (const building of world.buildings) {
    if (building.key === key && building.state !== 'complete') count += 1
  }
  return count
}

function ensureDistricts(world: World, env: Env): void {
  for (let i = 0; i < DISTRICT_KEYS.length; i++) {
    const key = DISTRICT_KEYS[i]
    if (world.districts[key]) continue
    if (countKey(world, key) < DISTRICT_MIN) continue
    const angle = i * 2.39996 + 0.7
    const radius = Math.max(env.width, env.height) * 0.32
    world.districts[key] = {
      x: world.anchor.x + Math.cos(angle) * radius,
      y: world.anchor.y + Math.sin(angle) * radius,
    }
    return
  }
}

function refineZones(world: World, clock: number): void {
  if (clock - world.lastRefineAt < REFINE_MS) return
  world.lastRefineAt = clock
  if (world.buildings.length < 12) return

  for (const key of DISTRICT_KEYS) {
    const center = world.districts[key]
    if (!center) continue

    for (const building of world.buildings) {
      if (building.state !== 'active') continue
      if (building.key === key) continue
      if (
        building.key === 'depot' ||
        building.key === 'warehouse' ||
        building.key === 'landmark'
      ) {
        continue
      }
      if (dist(building.pos, center) > DISTRICT_RADIUS) continue
      if (countKey(world, building.key) < 2) continue
      if (requestBuildingDemolition(world, building.id, clock)) return
    }

    const members = world.buildings.filter(
      (building) => building.key === key && building.state === 'active',
    )
    if (members.length < 2) continue
    let far: Building | null = null
    let farD = 0
    for (const member of members) {
      const d = dist(member.pos, center)
      if (d > farD) {
        farD = d
        far = member
      }
    }
    if (far && farD > DISTRICT_RADIUS * 2.2) {
      if (requestBuildingDemolition(world, far.id, clock)) return
    }
  }
}

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

function isFree(world: World, pos: Pt, size: number): boolean {
  for (const building of world.buildings) {
    if (dist(building.pos, pos) < BUILDING_SEP) return false
  }
  for (const segment of world.segments) {
    const clearance = size / 2 + 14
    if (
      distToSegment(pos, segment.pts[0], segment.pts[segment.pts.length - 1]) <
      clearance
    ) {
      return false
    }
  }
  return true
}

function maybeExpand(world: World, env: Env, clock: number): void {
  if (clock - world.lastExpandAt < 2500) return
  if (env.width >= world.boundsW0 * 4) return
  env.width *= 1.12
  env.height *= 1.12
  world.lastExpandAt = clock
}

export function placeSite(
  world: World,
  env: Env,
  key: string,
  clock: number,
): Building | null {
  const def = BUILDINGS[key]
  if (!def) return null
  const district =
    world.districts[key] ??
    (key === 'warehouse' ? world.districts.extractor : undefined)
  const reference =
    district ??
    (env.rng() < 0.4 ? world.anchor : referencePoint(world, key, world.anchor))

  let chosen: Pt | null = null
  for (let attempt = 0; attempt < 90; attempt++) {
    const angle = env.rng() * Math.PI * 2
    const radius = district
      ? 24 + attempt * 3 + env.rng() * DISTRICT_RADIUS
      : 92 + def.tier * 8 + attempt * 5 + env.rng() * 45
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
    if (!isFree(world, pos, def.size)) continue
    chosen = pos
    break
  }
  if (!chosen) {
    maybeExpand(world, env, clock)
    return null
  }

  if (
    chosen.x < MARGIN * 3 ||
    chosen.y < MARGIN * 3 ||
    chosen.x > env.width - MARGIN * 3 ||
    chosen.y > env.height - MARGIN * 3
  ) {
    maybeExpand(world, env, clock)
  }

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
    lastUsed: clock,
    slots: key === 'depot' ? new Array(DEPOT_SLOTS).fill(null) : [],
  }
  node.buildingId = building.id
  world.buildings.push(building)
  world.buildingById[building.id] = building

  const nearby = world.nodes
    .filter((candidate) => candidate.id !== node.id)
    .sort((a, b) => dist(a.pos, chosen) - dist(b.pos, chosen))
  let other = nearby[0] ?? null
  for (const candidate of nearby.slice(0, 6)) {
    if (!crossesBuilding(world, chosen, candidate.pos, node.id, candidate.id)) {
      other = candidate
      break
    }
  }
  if (other) addRoad(world, other.pos, chosen, 1, false)
  else world.topoDirty = true
  return building
}

function crossesBuilding(
  world: World,
  a: Pt,
  b: Pt,
  ignoreA: number,
  ignoreB: number,
): boolean {
  for (const building of world.buildings) {
    if (building.state === 'complete') continue
    if (building.nodeId === ignoreA || building.nodeId === ignoreB) continue
    const size = BUILDINGS[building.key]?.size ?? 20
    if (distToSegment(building.pos, a, b) < size / 2 + 10) return true
  }
  return false
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
  if (world.highways >= 2) return
  if ((world.produced[1] ?? 0) < 1) return
  if (world.buildings.length < HIGHWAY_MIN_BUILDINGS) return

  const busy = world.segments
    .filter((segment) => segment.built && !segment.demolish && !segment.belt && segment.traffic > 0)
    .sort((a, b) => b.traffic - a.traffic)
  if (busy.length === 0 || busy[0].traffic < 10) return

  const points: { id: number; pos: Pt }[] = []
  for (const segment of busy.slice(0, 12)) {
    const a = world.nodeById[segment.a]
    const b = world.nodeById[segment.b]
    if (a && !points.some((p) => p.id === a.id)) points.push({ id: a.id, pos: a.pos })
    if (b && !points.some((p) => p.id === b.id)) points.push({ id: b.id, pos: b.pos })
  }
  if (points.length < 2) return

  let best: { a: Pt; b: Pt; d: number } | null = null
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = dist(points[i].pos, points[j].pos)
      if (d < 160 || d > 620) continue
      if (!best || d > best.d) best = { a: points[i].pos, b: points[j].pos, d }
    }
  }
  if (!best) return

  const created = addRoad(world, best.a, best.b, 3, false)
  if (!created || created.length === 0) return
  world.highways += 1
  world.pulses.push({
    x: best.a.x,
    y: best.a.y,
    t: 0,
    max: 26,
    r: 4,
    rgb: [228, 178, 108],
    width: 1.2,
  })
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
  if ((world.produced[2] ?? 0) < 1) return
  if (world.buildings.length < CONVEYOR_MIN_BUILDINGS) return
  if (world.conveyors.length >= CONVEYOR_MAX) return
  if (world.conveyors.some((conveyor) => !conveyor.built)) return

  const candidates: { from: Building; to: Building; mat: number; d: number }[] = []
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
        candidates.push({ from: producer, to: consumer, mat: input.mat, d })
      }
    }
  }

  const warehouses = world.buildings.filter(
    (building) => building.key === 'warehouse' && building.state === 'active',
  )
  for (const warehouse of warehouses) {
    for (const producer of world.buildings) {
      if (producer.state !== 'active' || producer.key === 'warehouse') continue
      const out = BUILDINGS[producer.key]?.recipe?.output
      if (!out) continue
      const d = dist(producer.pos, warehouse.pos)
      if (d > 320) continue
      candidates.push({ from: producer, to: warehouse, mat: out.mat, d })
    }
    for (const consumer of world.buildings) {
      if (consumer.state !== 'active') continue
      const recipe = BUILDINGS[consumer.key]?.recipe
      if (!recipe) continue
      for (const input of recipe.inputs) {
        if ((warehouse.output[input.mat] ?? 0) <= 0) continue
        const d = dist(warehouse.pos, consumer.pos)
        if (d < 120) continue
        candidates.push({ from: warehouse, to: consumer, mat: input.mat, d })
      }
    }
  }
  candidates.sort((a, b) => b.d - a.d)

  for (const candidate of candidates.slice(0, 8)) {
    if (
      world.conveyors.some(
        (conveyor) =>
          conveyor.fromId === candidate.from.id && conveyor.toId === candidate.to.id,
      )
    ) {
      continue
    }
    const path = findPath(world, candidate.from.nodeId, candidate.to.nodeId, -1, true)
    if (!path || path.segments.length === 0) continue
    const overlap = world.conveyors.some((conveyor) => {
      const reversed =
        conveyor.fromId === candidate.to.id && conveyor.toId === candidate.from.id
      if (reversed) return false
      const shared = path.segments.filter((id) => conveyor.segments.includes(id)).length
      const shortest = Math.min(path.segments.length, conveyor.segments.length)
      return shortest > 0 && shared / shortest > 0.5
    })
    if (overlap) continue

    const pts = pathPoints(world, path.nodes, path.segments)
    if (pts.length < 2) continue
    for (const id of path.segments) {
      const segment = world.segmentById[id]
      if (segment) segment.belt = true
    }
    if (!buildingsConnected(world)) {
      for (const id of path.segments) {
        const segment = world.segmentById[id]
        if (segment) segment.belt = false
      }
      if ((world.produced[2] ?? 0) >= 1 && world.highways < 2) {
        addRoad(world, candidate.from.pos, candidate.to.pos, 3, false)
      } else {
        const from = candidate.from.pos
        const to = candidate.to.pos
        const length = Math.max(1, dist(from, to))
        const perpX = -(to.y - from.y) / length
        const perpY = (to.x - from.x) / length
        const via = {
          x: (from.x + to.x) / 2 + perpX * 90,
          y: (from.y + to.y) / 2 + perpY * 90,
        }
        addRoad(world, from, via, 1, false)
        addRoad(world, via, to, 1, false)
      }
      return
    }
    const conveyor: Conveyor = {
      id: world.nextConveyorId++,
      fromId: candidate.from.id,
      toId: candidate.to.id,
      mat: candidate.mat,
      pts,
      cum: cumulative(pts),
      length: pts.reduce((total, point, index) => {
        if (index === 0) return 0
        return total + dist(pts[index - 1], point)
      }, 0),
      segments: path.segments.slice(),
      cost: CONVEYOR_COST.map((cost) => ({ mat: cost.mat, qty: cost.qty })),
      delivered: {},
      work: CONVEYOR_WORK,
      workRequired: CONVEYOR_WORK,
      progress: 0,
      built: false,
      transferAt: 0,
      pulse: 1,
      items: [],
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
    return
  }
}

function optimizeRoads(world: World): void {
  if (world.buildings.length < 30) return
  let marked = 0
  for (const segment of world.segments) {
    if (marked >= 1) break
    if (!segment.built || segment.demolish || segment.tier === 3 || segment.belt) continue
    if (segment.age < ROAD_OPTIMIZE_AGE) continue
    if (segment.traffic > 0) continue
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
  connectComponents(world)
  ensureDistricts(world, env)
  refineZones(world, clock)
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
  if (
    !world.warehouseBuilt &&
    warehouses === 0 &&
    extractors >= 3 &&
    sites < MAX_SITES &&
    total < TOTAL_BUILDING_CAP
  ) {
    const built = placeSite(world, env, 'warehouse', clock)
    if (built) world.warehouseBuilt = true
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
    if (producers >= target) continue

    let pending = 0
    for (const job of world.jobs) {
      if (job.state === 'done') continue
      if (
        job.mat === mat &&
        (job.kind === 'haul' || job.kind === 'roadhaul' || job.kind === 'pave')
      ) {
        pending += job.qty
      }
    }
    let buffered = 0
    for (const building of world.buildings) {
      if (building.state !== 'active') continue
      if (BUILDINGS[building.key]?.recipe?.output?.mat === mat) {
        buffered += building.output[mat] ?? 0
      }
    }
    const scarce = pending > buffered
    if (!scarce) continue

    if (sites < MAX_SITES && total < TOTAL_BUILDING_CAP) {
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
