import { clamp, dist, type Pt } from './geometry'
import {
  BUILDINGS,
  DEMOLISH_WORK,
  FLEET_MAX,
  MAX_ROAD_BUILDS,
  ROADS,
  SIGNAL_SPEED_BONUS,
  WAREHOUSE_IDLE_MS,
} from './config'
import { createVehicle } from './fleet'
import { buildingsConnected, findPath, nearestNode } from './network'
import type { Building, Job, World } from './types'

function maxCapacity(world: World): number {
  let cap = 1
  for (const vehicle of world.vehicles) {
    if (vehicle.role === 'hauler' && vehicle.capacity > cap) cap = vehicle.capacity
  }
  return cap
}

function reservedTo(world: World, buildingId: number, mat: number): number {
  let total = 0
  for (const job of world.jobs) {
    if (job.state === 'done') continue
    if (job.destId === buildingId && job.mat === mat && job.kind === 'haul') {
      total += job.qty
    }
  }
  return total
}

function availableOutput(building: Building, world: World, mat: number): number {
  const total = building.output[mat] ?? 0
  let used = 0
  for (const job of world.jobs) {
    if (job.state === 'done') continue
    if (job.sourceId === building.id && job.mat === mat) used += job.qty
  }
  return Math.max(0, total - used)
}

function isTarget(job: Job): boolean {
  return job.state === 'pending'
}

function makeJob(world: World, partial: Partial<Job>): Job {
  const job: Job = {
    id: world.nextJobId++,
    kind: 'haul',
    state: 'pending',
    mat: 0,
    qty: 1,
    amount: 0,
    sourceId: -1,
    destId: -1,
    segmentId: -1,
    buildingId: -1,
    conveyorId: -1,
    vehicleTier: 0,
    assigned: -1,
    createdAt: world.jobs.length,
    priority: 2,
    ...partial,
  }
  world.jobs.push(job)
  return job
}

function findSource(
  world: World,
  mat: number,
  dest: Building,
): Building | null {
  let best: Building | null = null
  let bestScore = Infinity
  for (const building of world.buildings) {
    if (building.id === dest.id || building.state !== 'active') continue
    if (availableOutput(building, world, mat) <= 0) continue
    const score =
      dist(building.pos, dest.pos) + (building.key === 'warehouse' ? -80 : 120)
    if (score >= bestScore) continue
    if (!findPath(world, dest.nodeId, building.nodeId)) continue
    bestScore = score
    best = building
  }
  return best
}

function findProducer(
  world: World,
  mat: number,
  dest: Building,
): Building | null {
  let best: Building | null = null
  let bestD = Infinity
  for (const building of world.buildings) {
    if (building.key === 'warehouse') continue
    if (building.state !== 'active') continue
    if (availableOutput(building, world, mat) <= 0) continue
    const d = dist(building.pos, dest.pos)
    if (d >= bestD) continue
    if (!findPath(world, dest.nodeId, building.nodeId)) continue
    bestD = d
    best = building
  }
  return best
}

function reservedToConveyor(world: World, conveyorId: number, mat: number): number {
  let total = 0
  for (const job of world.jobs) {
    if (job.state === 'done') continue
    if (job.conveyorId === conveyorId && job.mat === mat) total += job.qty
  }
  return total
}

export function planHaulJobs(world: World, clock: number): void {
  const cap = maxCapacity(world)
  let pendingCount = 0
  for (const job of world.jobs) if (job.state !== 'done' && job.kind === 'haul') pendingCount++
  if (pendingCount > 48) return

  const ordered = world.buildings.slice().sort((a, b) => {
    const rank = (x: Building): number => {
      if (x.state === 'site') return 0
      const r = BUILDINGS[x.key]?.recipe
      return r?.manual ? 2 : 1
    }
    return rank(a) - rank(b)
  })

  for (const building of ordered) {
    if (building.state === 'complete') continue

    if (building.state === 'active') {
      const def = BUILDINGS[building.key]
      if (!def?.recipe || def.recipe.manual) continue
      for (const input of def.recipe.inputs) {
        const have = (building.inputs[input.mat] ?? 0) + reservedTo(world, building.id, input.mat)
        const need = input.qty - have
        if (need <= 0) continue
        const source = findSource(world, input.mat, building)
        if (!source) continue
        const qty = Math.min(need, cap, availableOutput(source, world, input.mat))
        if (qty < 1) continue
        makeJob(world, {
          kind: 'haul',
          mat: input.mat,
          qty,
          sourceId: source.id,
          destId: building.id,
          priority: 2,
          createdAt: clock + Math.random(),
        })
      }
    } else if (building.state === 'site') {
      for (const cost of building.cost) {
        const have =
          (building.delivered[cost.mat] ?? 0) + reservedTo(world, building.id, cost.mat)
        const need = cost.qty - have
        if (need <= 0) continue
        const source = findSource(world, cost.mat, building)
        if (!source) continue
        const qty = Math.min(need, cap, availableOutput(source, world, cost.mat))
        if (qty < 1) continue
        makeJob(world, {
          kind: 'haul',
          mat: cost.mat,
          qty,
          sourceId: source.id,
          destId: building.id,
          priority: 1,
          createdAt: clock + Math.random(),
        })
      }
    }
  }

  const stockTarget = 10
  for (const building of world.buildings) {
    if (building.key !== 'warehouse' || building.state !== 'active') continue
    const def = BUILDINGS.warehouse
    for (let mat = 0; mat < 2; mat++) {
      const stored = (building.output[mat] ?? 0) + reservedTo(world, building.id, mat)
      if (stored >= stockTarget) continue
      const source = findProducer(world, mat, building)
      if (!source) continue
      const room = Math.min(stockTarget, def.buffer) - stored
      const qty = Math.min(room, cap, availableOutput(source, world, mat))
      if (qty < 1) continue
      makeJob(world, {
        kind: 'haul',
        mat,
        qty,
        sourceId: source.id,
        destId: building.id,
        priority: 4,
        createdAt: clock + Math.random(),
      })
    }
  }
}

export function planConveyorJobs(world: World, clock: number): void {
  for (const conveyor of world.conveyors) {
    if (conveyor.built) continue
    const needsMaterials = conveyor.cost.some(
      (cost) =>
        (conveyor.delivered[cost.mat] ?? 0) + reservedToConveyor(world, conveyor.id, cost.mat) <
        cost.qty,
    )
    if (needsMaterials) {
      const anchor = world.buildingById[conveyor.fromId]
      if (!anchor) continue
      for (const cost of conveyor.cost) {
        const have =
          (conveyor.delivered[cost.mat] ?? 0) +
          reservedToConveyor(world, conveyor.id, cost.mat)
        const need = cost.qty - have
        if (need <= 0) continue
        const source = findProducer(world, cost.mat, anchor)
        if (!source) continue
        const qty = Math.min(need, maxCapacity(world), availableOutput(source, world, cost.mat))
        if (qty < 1) continue
        makeJob(world, {
          kind: 'haul',
          mat: cost.mat,
          qty,
          sourceId: source.id,
          destId: -1,
          conveyorId: conveyor.id,
          priority: 1,
          createdAt: clock + Math.random(),
        })
      }
    } else if (conveyor.work > 0) {
      const already = world.jobs.some(
        (job) =>
          job.state !== 'done' &&
          job.kind === 'buildbelt' &&
          job.conveyorId === conveyor.id,
      )
      if (!already) {
        makeJob(world, {
          kind: 'buildbelt',
          conveyorId: conveyor.id,
          priority: 2,
          createdAt: clock,
        })
      }
    }
  }
}

export function planRoadJobs(world: World, clock: number): void {
  let deliveries = 0
  let constructions = 0
  for (const job of world.jobs) {
    if (job.state === 'done') continue
    if (job.kind === 'roadhaul') deliveries++
    if (job.kind === 'pave') constructions++
  }

  const cap = maxCapacity(world)
  for (const segment of world.segments) {
    if (segment.built || segment.demolish) continue
    const mat = segment.tier === 1 ? 0 : segment.tier === 2 ? 1 : 2
    const materialDone = segment.materialDelivered >= segment.materialRequired

    if (!materialDone) {
      if (deliveries >= MAX_ROAD_BUILDS) continue
      const already = world.jobs.some(
        (job) =>
          job.state !== 'done' && job.kind === 'roadhaul' && job.segmentId === segment.id,
      )
      if (already) continue

      let source: Building | null = null
      let reverse = false
      let bestD = Infinity
      for (const building of world.buildings) {
        if (building.state !== 'active') continue
        if (availableOutput(building, world, mat) <= 0) continue
        const canForward = Boolean(findPath(world, building.nodeId, segment.a))
        const canBackward = !canForward && Boolean(findPath(world, building.nodeId, segment.b))
        if (!canForward && !canBackward) continue
        const startPt = canForward ? segment.pts[0] : segment.pts[1]
        const d = dist(building.pos, startPt)
        if (d >= bestD) continue
        bestD = d
        source = building
        reverse = canBackward
      }
      if (!source) continue
      segment.reverse = reverse
      const remaining = segment.materialRequired - segment.materialDelivered
      const qty = Math.min(remaining, cap, availableOutput(source, world, mat))
      if (qty < 1) continue
      makeJob(world, {
        kind: 'roadhaul',
        mat,
        qty,
        sourceId: source.id,
        segmentId: segment.id,
        priority: 0,
        createdAt: clock + Math.random(),
      })
      deliveries++
    } else {
      if (constructions >= 2) continue
      const already = world.jobs.some(
        (job) =>
          job.state !== 'done' && job.kind === 'pave' && job.segmentId === segment.id,
      )
      if (already) continue
      makeJob(world, {
        kind: 'pave',
        segmentId: segment.id,
        priority: 2,
        createdAt: clock + Math.random(),
      })
      constructions++
    }
  }
}

export function planDemolishJobs(world: World, clock: number): void {
  if (
    world.jobs.some((job) => job.state !== 'done' && job.kind === 'demolish')
  ) {
    return
  }
  for (const building of world.buildings) {
    if (building.key !== 'warehouse' || building.state !== 'active') continue
    if (clock - building.lastUsed < WAREHOUSE_IDLE_MS) continue
    let nearDistrict = false
    for (const key of Object.keys(world.districts)) {
      if (dist(building.pos, world.districts[key]) < 260) {
        nearDistrict = true
        break
      }
    }
    if (nearDistrict) continue
    let stored = 0
    for (let mat = 0; mat < 6; mat++) stored += building.output[mat] ?? 0
    if (stored > 2) continue
    const already = world.jobs.some(
      (job) =>
        job.state !== 'done' && job.kind === 'demolish' && job.destId === building.id,
    )
    if (already) continue
    makeJob(world, {
      kind: 'demolish',
      destId: building.id,
      amount: DEMOLISH_WORK,
      priority: 2,
      createdAt: clock,
    })
  }

  for (const segment of world.segments) {
    if (!segment.demolish || !segment.built) continue
    if (!buildingsConnected(world, segment.id)) {
      segment.demolish = false
      continue
    }
    const already = world.jobs.some(
      (job) =>
        job.state !== 'done' &&
        job.kind === 'demolish' &&
        job.segmentId === segment.id,
    )
    if (already) continue
    makeJob(world, {
      kind: 'demolish',
      segmentId: segment.id,
      amount: DEMOLISH_WORK,
      priority: 2,
      createdAt: clock,
    })
  }
}

export function planConstructJobs(world: World, clock: number): void {
  for (const building of world.buildings) {
    if (building.state !== 'site') continue
    const complete = building.cost.every(
      (cost) => (building.delivered[cost.mat] ?? 0) >= cost.qty,
    )
    if (!complete) continue
    const already = world.jobs.some(
      (job) => job.state !== 'done' && job.kind === 'construct' && job.destId === building.id,
    )
    if (already) continue
    makeJob(world, {
      kind: 'construct',
      destId: building.id,
      priority: 3,
      createdAt: clock,
    })
  }
}

export function planUpgradeJobs(world: World, clock: number): void {
  let upgrades = 0
  for (const job of world.jobs) {
    if (job.kind === 'upgrade' && job.state !== 'done') upgrades++
  }
  if (upgrades >= 2) return
  const desired = clamp(3 + Math.floor(world.buildings.length / 3), 3, FLEET_MAX)
  const cap = maxCapacity(world)
  const haulers = world.vehicles.filter((vehicle) => vehicle.role === 'hauler')
  const wantsAction =
    haulers.length < desired || haulers.some((vehicle) => vehicle.tier < 6)
  if (!wantsAction) return

  for (const building of world.buildings) {
    if (building.state !== 'active' || building.key !== 'vehicle') continue
    const available = building.inputs[1] ?? 0

    if (available < 2) {
      const already = world.jobs.some(
        (job) =>
          job.state !== 'done' &&
          job.kind === 'haul' &&
          job.destId === building.id &&
          job.mat === 1,
      )
      if (!already) {
        const source = findSource(world, 1, building)
        if (source) {
          const qty = Math.min(2 - available, cap, availableOutput(source, world, 1))
          if (qty >= 1) {
            makeJob(world, {
              kind: 'haul',
              mat: 1,
              qty,
              sourceId: source.id,
              destId: building.id,
              priority: 0,
              createdAt: clock,
            })
          }
        }
      }
      continue
    }

    if (haulers.length < desired) {
      building.inputs[1] = available - 2
      const node = world.nodeById[building.nodeId]
      if (node) {
        createVehicle(world, 1, 'hauler', node.pos)
        haulers.push(world.vehicles[world.vehicles.length - 1])
      }
      building.pulse = 1
      return
    }

    const lowest = haulers
      .filter((vehicle) => vehicle.tier < 6)
      .sort((a, b) => a.tier - b.tier)[0]
    if (!lowest) return
    building.inputs[1] = available - 2
    makeJob(world, {
      kind: 'upgrade',
      buildingId: lowest.id,
      destId: building.id,
      priority: 1,
      createdAt: clock,
    })
    return
  }
}

function join(a: Pt[], b: Pt[]): Pt[] {
  if (a.length === 0) return b.slice()
  const out = a.slice()
  for (let i = 1; i < b.length; i++) out.push(b[i])
  return out
}

function pathPointsWithSpeed(
  world: World,
  nodes: number[],
  segments: number[],
): { pts: Pt[]; speeds: number[] } {
  const pts: Pt[] = []
  const speeds: number[] = []
  for (let i = 0; i < segments.length; i++) {
    const segment = world.segmentById[segments[i]]
    if (!segment) continue
    const forward = segment.a === nodes[i]
    const sp = forward ? segment.pts : segment.pts.slice().reverse()
    const mul = ROADS[segment.tier]?.speedMul ?? 1
    const start = pts.length === 0 ? 0 : 1
    for (let k = start; k < sp.length; k++) {
      pts.push(sp[k])
      speeds.push(mul)
    }
  }
  if (pts.length === 0) {
    const node = world.nodeById[nodes[0]]
    if (node) {
      pts.push(node.pos)
      speeds.push(1)
    }
  }
  return { pts, speeds }
}

function segmentStats(
  world: World,
  segments: number[],
): { roadFactor: number; signals: number } {
  let total = 0
  let weighted = 0
  let signals = 0
  for (const id of segments) {
    const segment = world.segmentById[id]
    if (!segment) continue
    total += segment.length
    weighted += segment.length * (ROADS[segment.tier]?.speedMul ?? 1)
    segment.traffic += 1
    if (world.nodeById[segment.a]?.signal) signals += 1
    if (world.nodeById[segment.b]?.signal) signals += 1
  }
  return { roadFactor: total > 0 ? weighted / total : 1, signals }
}

function routeHaul(
  world: World,
  vehicleId: number,
  sourceNode: number,
  destNode: number,
): { path: Pt[]; speeds: number[]; loadIndex: number; signals: number } | null {
  const vehicle = world.vehicles.find((v) => v.id === vehicleId)
  if (!vehicle) return null
  const vNode = nearestNode(world, vehicle.pos)
  if (!vNode) return null
  const p1 = findPath(world, vNode.id, sourceNode)
  const p2 = findPath(world, sourceNode, destNode)
  if (!p1 || !p2) return null
  const first = pathPointsWithSpeed(world, p1.nodes, p1.segments)
  const second = pathPointsWithSpeed(world, p2.nodes, p2.segments)
  const stats = segmentStats(world, [...p1.segments, ...p2.segments])
  const path = join(first.pts, second.pts)
  const speeds = first.speeds.slice()
  for (let i = 1; i < second.speeds.length; i++) speeds.push(second.speeds[i])
  return {
    path,
    speeds,
    loadIndex: Math.max(0, first.pts.length - 1),
    signals: stats.signals,
  }
}

export function assignJobs(world: World): void {
  const pending = world.jobs
    .filter(isTarget)
    .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)

  for (const job of pending) {
    const idle = world.vehicles.filter(
      (vehicle) =>
        vehicle.state === 'idle' &&
        (job.kind === 'construct' || job.kind === 'demolish' || job.kind === 'pave'
          ? vehicle.role === 'builder'
          : vehicle.role === 'hauler'),
    )
    if (idle.length === 0) continue

    let assigned = false
    for (const vehicle of idle) {
      if (job.kind === 'haul' || job.kind === 'roadhaul') {
        const source = world.buildingById[job.sourceId]
        if (!source) continue
        let destNode = source.nodeId
        let sitePos = source.pos
        if (job.kind === 'haul') {
          if (job.conveyorId >= 0) {
            const conveyor = world.conveyors.find((c) => c.id === job.conveyorId)
            const anchor = conveyor ? world.buildingById[conveyor.fromId] : undefined
            if (!anchor) continue
            destNode = anchor.nodeId
            sitePos = anchor.pos
          } else {
            const dest = world.buildingById[job.destId]
            if (!dest) continue
            destNode = dest.nodeId
            sitePos = dest.pos
          }
        } else {
          const segment = world.segmentById[job.segmentId]
          if (!segment) continue
          destNode = segment.reverse ? segment.b : segment.a
          sitePos = segment.reverse ? segment.pts[1] : segment.pts[0]
        }
        const route = routeHaul(world, vehicle.id, source.nodeId, destNode)
        if (route) {
          vehicle.path = join(route.path, [sitePos])
          vehicle.pathSpeed = route.speeds.slice()
          vehicle.pathSpeed.push(1)
          vehicle.loadIndex = route.loadIndex
          vehicle.speedMul = 1 + SIGNAL_SPEED_BONUS * route.signals
        } else {
          vehicle.path = [source.pos, sitePos]
          vehicle.pathSpeed = [1, 1]
          vehicle.loadIndex = 1
          vehicle.speedMul = 1
        }
        vehicle.pathIndex = 0
        vehicle.state = 'toSource'
      } else {
        const vNode = nearestNode(world, vehicle.pos)
        if (!vNode) continue
        let destNode = -1
        if (job.kind === 'demolish' && job.segmentId >= 0) {
          const segment = world.segmentById[job.segmentId]
          if (!segment) continue
          destNode = segment.a
        } else if (job.kind === 'pave' && job.segmentId >= 0) {
          const segment = world.segmentById[job.segmentId]
          if (!segment) continue
          destNode = segment.reverse ? segment.b : segment.a
        } else if (job.kind === 'buildbelt' && job.conveyorId >= 0) {
          const conveyor = world.conveyors.find((c) => c.id === job.conveyorId)
          const anchor = conveyor ? world.buildingById[conveyor.fromId] : undefined
          if (!anchor) continue
          destNode = anchor.nodeId
        } else {
          const dest = world.buildingById[job.destId]
          if (!dest) continue
          destNode = dest.nodeId
        }
        const p = findPath(world, vNode.id, destNode)
        if (p) {
          const withSpeed = pathPointsWithSpeed(world, p.nodes, p.segments)
          vehicle.path = withSpeed.pts
          vehicle.pathSpeed = withSpeed.speeds
          const stats = segmentStats(world, p.segments)
          vehicle.speedMul = 1 + SIGNAL_SPEED_BONUS * stats.signals
        } else {
          const target = world.nodeById[destNode]
          vehicle.path = target ? [vehicle.pos, target.pos] : []
          vehicle.pathSpeed = [1, 1]
          vehicle.speedMul = 1
        }
        vehicle.pathIndex = 0
        vehicle.loadIndex = -1
        vehicle.state = 'toSite'
      }
      job.state = 'assigned'
      job.assigned = vehicle.id
      vehicle.jobId = job.id
      assigned = true
      break
    }
    void assigned
  }
}

export function planReturnHome(world: World): void {
  const depots = world.buildings.filter(
    (building) => building.key === 'depot' && building.state === 'active',
  )
  if (depots.length === 0) return

  for (const vehicle of world.vehicles) {
    if (vehicle.role !== 'builder') continue
    if (vehicle.state !== 'idle' || vehicle.jobId >= 0) continue
    let nearest = depots[0]
    let nearestD = dist(vehicle.pos, nearest.pos)
    for (const depot of depots) {
      const d = dist(vehicle.pos, depot.pos)
      if (d < nearestD) {
        nearestD = d
        nearest = depot
      }
    }
    if (nearestD < 14) continue
    const vNode = nearestNode(world, vehicle.pos)
    if (!vNode) continue
    const path = findPath(world, vNode.id, nearest.nodeId)
    if (!path) continue
    const withSpeed = pathPointsWithSpeed(world, path.nodes, path.segments)
    vehicle.path = withSpeed.pts
    vehicle.pathSpeed = withSpeed.speeds
    vehicle.pathIndex = 0
    vehicle.loadIndex = -1
    vehicle.speedMul = 1
    vehicle.state = 'toDepot'
  }
}

export function requestBuildingDemolition(
  world: World,
  buildingId: number,
  clock: number,
): boolean {
  const already = world.jobs.some(
    (job) =>
      job.state !== 'done' && job.kind === 'demolish' && job.destId === buildingId,
  )
  if (already) return false
  if (
    world.jobs.some((job) => job.state !== 'done' && job.kind === 'demolish')
  ) {
    return false
  }
  makeJob(world, {
    kind: 'demolish',
    destId: buildingId,
    amount: DEMOLISH_WORK,
    priority: 2,
    createdAt: clock,
  })
  return true
}

export function cleanupJobs(world: World): void {
  world.jobs = world.jobs.filter((job) => {
    if (job.state === 'done') return false
    if (job.sourceId >= 0 && !world.buildingById[job.sourceId]) return false
    if (job.destId >= 0 && !world.buildingById[job.destId]) return false
    if (job.segmentId >= 0 && !world.segmentById[job.segmentId]) return false
    if (
      job.conveyorId >= 0 &&
      !world.conveyors.some((conveyor) => conveyor.id === job.conveyorId)
    ) {
      return false
    }
    return true
  })
}
