import { flowAngle, mulberry32, type Pt } from './geometry'
import {
  BUILDINGS,
  CONVEYOR_ITEM_MAX,
  CONVEYOR_ITEM_SPEED,
  CONVEYOR_TRANSFER_MS,
  DEPOT_SLOTS,
  DISSOLVE_MS,
  LANDMARK_PROGRESS,
  MATERIAL_RGB,
  OUTPUT_CAP,
  PLAN_MS,
  PULSE_MS,
  START_HAULERS,
  depotSlotOffset,
} from './config'
import { addNode, addRoad } from './network'
import { createVehicle, updateVehicles } from './fleet'
import {
  assignJobs,
  cleanupJobs,
  planConstructJobs,
  planConveyorJobs,
  planDemolishJobs,
  planHaulJobs,
  planReturnHome,
  planRoadJobs,
  planUpgradeJobs,
} from './jobs'
import { planCity } from './planner'
import type { Ambient, Building, Env, World } from './types'

const TRAIL_LENGTH = 12

export function createWorld(anchor: Pt, rng: () => number): World {
  return {
    nodes: [],
    nodeById: [],
    segments: [],
    segmentById: [],
    buildings: [],
    buildingById: [],
    vehicles: [],
    jobs: [],
    conveyors: [],
    ambient: [],
    pulses: [],
    particles: [],
    nextNodeId: 0,
    nextSegmentId: 0,
    nextBuildingId: 0,
    nextVehicleId: 0,
    nextJobId: 0,
    nextConveyorId: 0,
    produced: new Array(6).fill(0),
    consumed: new Array(6).fill(0),
    anchor,
    lastPlanAt: 0,
    phase: 'grow',
    dissolveAt: 0,
    dissolveStart: 0,
    landmarkDone: false,
    highways: 0,
    signals: 0,
    warehouseBuilt: false,
    boundsW0: 0,
    boundsH0: 0,
    lastExpandAt: 0,
    districts: {},
    lastRefineAt: 0,
    topoDirty: true,
    rng,
  }
}

function addStartingBuilding(
  world: World,
  key: string,
  pos: Pt,
  clock: number,
): Building {
  const def = BUILDINGS[key]
  const node = addNode(world, pos, 'building')
  const building: Building = {
    id: world.nextBuildingId++,
    key,
    tier: def.tier,
    pos,
    nodeId: node.id,
    state: 'active',
    cost: [],
    delivered: {},
    work: 0,
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
  return building
}

export function resetWorld(world: World, env: Env, density: number, clock: number): void {
  world.nodes = []
  world.nodeById = []
  world.segments = []
  world.segmentById = []
  world.buildings = []
  world.buildingById = []
  world.vehicles = []
  world.jobs = []
  world.conveyors = []
  world.pulses = []
  world.particles = []
  world.nextNodeId = 0
  world.nextSegmentId = 0
  world.nextBuildingId = 0
  world.nextVehicleId = 0
  world.nextJobId = 0
  world.nextConveyorId = 0
  world.produced = new Array(6).fill(0)
  world.consumed = new Array(6).fill(0)
  world.phase = 'grow'
  world.dissolveAt = 0
  world.dissolveStart = 0
  world.landmarkDone = false
  world.highways = 0
  world.signals = 0
  world.warehouseBuilt = false
  world.boundsW0 = env.width
  world.boundsH0 = env.height
  world.lastExpandAt = 0
  world.districts = {}
  world.lastRefineAt = 0
  world.topoDirty = true
  world.lastPlanAt = 0
  world.anchor = { x: env.width * 0.46, y: env.height * 0.54 }

  const a1 = addStartingBuilding(world, 'extractor', { x: world.anchor.x - 90, y: world.anchor.y + 60 }, clock)
  addStartingBuilding(world, 'assembly', { x: world.anchor.x + 110, y: world.anchor.y - 70 }, clock)
  const depot = addStartingBuilding(world, 'depot', { x: world.anchor.x + 20, y: world.anchor.y + 40 }, clock)

  addRoad(world, a1.pos, { x: world.anchor.x + 110, y: world.anchor.y - 70 }, 1, false)
  addRoad(world, depot.pos, { x: world.anchor.x + 110, y: world.anchor.y - 70 }, 1, false)

  const starters = []
  for (let i = 0; i < START_HAULERS; i++) {
    starters.push(createVehicle(world, 1, 'hauler', depot.pos))
  }
  starters.push(createVehicle(world, 1, 'builder', depot.pos))

  const depotSize = BUILDINGS.depot.size
  for (let i = 0; i < starters.length && i < DEPOT_SLOTS; i++) {
    const vehicle = starters[i]
    const offset = depotSlotOffset(i, depotSize)
    vehicle.slot = i
    vehicle.depotId = depot.id
    vehicle.pos = { x: depot.pos.x + offset.x, y: depot.pos.y + offset.y }
    vehicle.angle = offset.angle
    vehicle.state = 'parked'
    depot.slots[i] = vehicle.id
  }

  buildAmbient(world, env, density)
}

function stepBuildings(world: World, dtMs: number, clock: number): void {
  for (const building of world.buildings) {
    if (building.pulse > 0) building.pulse = Math.max(0, building.pulse - dtMs / 400)

    if (building.state !== 'active') continue
    const def = BUILDINGS[building.key]
    const recipe = def?.recipe
    if (!recipe || recipe.manual) continue

    if (building.produceAt !== 0) {
      if (clock >= building.produceAt) {
        building.produceAt = 0
        building.pulse = 1
        if (recipe.output) {
          const mat = recipe.output.mat
          building.output[mat] = Math.min(
            OUTPUT_CAP,
            (building.output[mat] ?? 0) + recipe.output.qty,
          )
          world.produced[mat] += recipe.output.qty
        }
        if (recipe.producesVehicle) building.vehicleOrders += 1
        if (recipe.addsProgress) {
          building.progress += recipe.addsProgress
        }
      }
      continue
    }

    const inputsOk = recipe.inputs.every(
      (input) => (building.inputs[input.mat] ?? 0) >= input.qty,
    )
    if (!inputsOk) continue
    const outputOk =
      !recipe.output || (building.output[recipe.output.mat] ?? 0) < def.buffer
    if (!outputOk) continue

    for (const input of recipe.inputs) {
      building.inputs[input.mat] = (building.inputs[input.mat] ?? 0) - input.qty
      world.consumed[input.mat] += input.qty
    }
    building.produceAt = clock + recipe.time
  }

  for (const building of world.buildings) {
    if (building.key === 'landmark' && building.progress >= LANDMARK_PROGRESS) {
      world.landmarkDone = true
    }
  }
}

function updateEffects(world: World, dtMs: number): void {
  if (world.pulses.length) {
    world.pulses = world.pulses.filter((pulse) => {
      pulse.t += dtMs
      return pulse.t <= PULSE_MS
    })
  }
  if (world.particles.length) {
    world.particles = world.particles.filter((particle) => {
      particle.life += dtMs
      particle.vy += 0.00008 * dtMs
      particle.x += particle.vx * dtMs
      particle.y += particle.vy * dtMs
      return particle.life <= particle.max
    })
  }
}

function removeCompleted(world: World): void {
  if (!world.buildings.some((b) => b.state === 'complete')) return
  const removed: number[] = []
  world.buildings = world.buildings.filter((building) => {
    if (building.state !== 'complete') return true
    removed.push(building.id)
    world.buildingById[building.id] = undefined
    const node = world.nodeById[building.nodeId]
    if (node) node.buildingId = -1
    return false
  })
  if (removed.length > 0) {
    const gone = new Set(removed)
    world.jobs = world.jobs.filter(
      (job) =>
        job.state === 'done' ||
        (!gone.has(job.sourceId) && !gone.has(job.destId)),
    )
    world.conveyors = world.conveyors.filter(
      (conveyor) => !gone.has(conveyor.fromId) && !gone.has(conveyor.toId),
    )
    const used = new Set<number>()
    for (const conveyor of world.conveyors) {
      for (const id of conveyor.segments) used.add(id)
    }
    for (const segment of world.segments) {
      if (segment.belt && !used.has(segment.id)) segment.belt = false
    }
  }
}

function updateAmbient(
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
    const off =
      ambient.x > env.width + 220 ||
      ambient.x < -220 ||
      ambient.y > env.height + 220 ||
      ambient.y < -220
    if (off) {
      ambient.x = env.rng() * env.width
      ambient.y = env.rng() * env.height
      ambient.life = 0
    }
  }
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
  const count = Math.round(Math.min(20, Math.max(7, (env.width / 110) * density)))
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

function stepConveyors(world: World, dtMs: number, clock: number): void {
  for (const conveyor of world.conveyors) {
    if (!conveyor.built) continue
    if (conveyor.pulse > 0) conveyor.pulse = Math.max(0, conveyor.pulse - dtMs / 400)
    const from = world.buildingById[conveyor.fromId]
    const to = world.buildingById[conveyor.toId]
    if (!from || !to) continue

    const next: number[] = []
    for (const at of conveyor.items) {
      const moved = at + dtMs * CONVEYOR_ITEM_SPEED
      if (moved >= conveyor.length) {
const isWarehouse = to.key === 'warehouse'
      const cap = isWarehouse ? BUILDINGS.warehouse.buffer : OUTPUT_CAP
      const current = isWarehouse
        ? (to.output[conveyor.mat] ?? 0)
        : (to.inputs[conveyor.mat] ?? 0)
      if (current < cap) {
        if (isWarehouse) to.output[conveyor.mat] = current + 1
        else to.inputs[conveyor.mat] = current + 1
        conveyor.pulse = 1
        world.pulses.push({
          x: to.pos.x,
          y: to.pos.y,
          t: 0,
          max: 9,
          r: 3,
          rgb: MATERIAL_RGB[conveyor.mat] ?? [180, 220, 255],
          width: 0.7,
        })
      } else {
        next.push(conveyor.length)
      }
      } else {
        next.push(moved)
      }
    }
    conveyor.items = next

    if (
      clock >= conveyor.transferAt &&
      conveyor.items.length < CONVEYOR_ITEM_MAX
    ) {
      const available = from.output[conveyor.mat] ?? 0
      if (available > 0) {
        from.output[conveyor.mat] = available - 1
        conveyor.items.push(0)
        conveyor.transferAt = clock + CONVEYOR_TRANSFER_MS
      }
    }
  }
}

export function stepWorld(
  world: World,
  env: Env,
  dtMs: number,
  clock: number,
  pointer: Pt,
): void {
  stepBuildings(world, dtMs, clock)
  stepConveyors(world, dtMs, clock)
  for (const segment of world.segments) segment.age += dtMs

  if (clock - world.lastPlanAt >= PLAN_MS) {
    world.lastPlanAt = clock
    planCity(world, env, clock)
    planHaulJobs(world, clock)
    planRoadJobs(world, clock)
    planConstructJobs(world, clock)
    planConveyorJobs(world, clock)
    planDemolishJobs(world, clock)
    planUpgradeJobs(world, clock)
    planReturnHome(world)
    assignJobs(world)
    cleanupJobs(world)
  }

  updateVehicles(world, dtMs, clock)
  updateEffects(world, dtMs)
  removeCompleted(world)
  updateAmbient(world, env, dtMs, clock * 0.00024, pointer)
}

export function dissolveFinished(world: World, clock: number): boolean {
  return world.phase === 'dissolve' && clock - world.dissolveStart >= DISSOLVE_MS
}

export function buildStatic(world: World, env: Env): void {
  world.anchor = { x: env.width * 0.46, y: env.height * 0.54 }
  const a1 = addStartingBuilding(world, 'extractor', { x: world.anchor.x - 110, y: world.anchor.y + 40 }, 0)
  const a2 = addStartingBuilding(world, 'extractor', { x: world.anchor.x - 40, y: world.anchor.y + 120 }, 0)
  const b = addStartingBuilding(world, 'assembly', { x: world.anchor.x + 60, y: world.anchor.y + 40 }, 0)
  const c = addStartingBuilding(world, 'vehicle', { x: world.anchor.x + 120, y: world.anchor.y - 50 }, 0)
  addRoad(world, a1.pos, b.pos, 1, true)
  addRoad(world, a2.pos, b.pos, 1, true)
  addRoad(world, b.pos, c.pos, 1, true)
  addRoad(world, a2.pos, c.pos, 3, true)
  const junction = world.nodes.find((node) => node.segments.length >= 2)
  if (junction) junction.signal = true
  world.highways = 1
  world.signals = junction ? 1 : 0
  b.inputs[0] = 3
  b.output[1] = 2
  c.inputs[1] = 2
  for (let i = 0; i < 2; i++) {
    const v = createVehicle(world, i + 1, 'hauler', {
      x: a1.pos.x + i * 12 - 6,
      y: a1.pos.y + 16,
    })
    v.angle = -0.4
    v.cargo = [{ mat: 0, qty: 1 }]
  }
}

export { mulberry32 }
