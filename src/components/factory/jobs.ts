import { clamp, dist, pointOnPolyline, type Pt } from './geometry'
import {
  BUILDINGS,
  DEMOLISH_WORK,
  FLEET_MAX,
  MAX_ROAD_BUILDS,
  SIGNAL_SPEED_BONUS,
} from './config'
import { createVehicle } from './fleet'
import { buildingsConnected, findPath, nearestNode, pathPoints } from './network'
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
  let bestD = Infinity
  for (const building of world.buildings) {
    if (building.id === dest.id || building.state !== 'active') continue
    if (availableOutput(building, world, mat) <= 0) continue
    const d = dist(building.pos, dest.pos)
    if (d >= bestD) continue
    if (!findPath(world, dest.nodeId, building.nodeId)) continue
    bestD = d
    best = building
  }
  return best
}

export function planHaulJobs(world: World, clock: number): void {
  const cap = maxCapacity(world)
  let pendingCount = 0
  for (const job of world.jobs) if (job.state !== 'done' && job.kind === 'haul') pendingCount++
  if (pendingCount > 48) return

  for (const building of world.buildings) {
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
}

export function planRoadJobs(world: World, clock: number): void {
  let active = 0
  for (const job of world.jobs) {
    if (job.state !== 'done' && job.kind === 'pave') active++
  }
  if (active >= MAX_ROAD_BUILDS) return

  const cap = maxCapacity(world)
  for (const segment of world.segments) {
    if (segment.built || segment.demolish) continue
    const already = world.jobs.some(
      (job) => job.state !== 'done' && job.kind === 'pave' && job.segmentId === segment.id,
    )
    if (already) continue
    const mat = segment.tier === 1 ? 0 : segment.tier === 2 ? 1 : 2
    let source: Building | null = null
    let bestD = Infinity
  const ordered = world.buildings.slice().sort((a, b) => {
    const rank = (x: Building): number => {
      if (x.state === 'site') return 0
      const r = BUILDINGS[x.key]?.recipe
      return r?.manual ? 2 : 1
    }
    return rank(a) - rank(b)
  })

  for (const building of ordered) {
      if (building.state !== 'active') continue
      if (availableOutput(building, world, mat) <= 0) continue
      const d = dist(building.pos, segment.pts[0])
      if (d >= bestD) continue
      if (!findPath(world, building.nodeId, segment.a)) continue
      bestD = d
      source = building
    }
    if (!source) continue
    const remaining = segment.materialRequired - segment.materialDelivered
    const qty = Math.min(remaining, cap, availableOutput(source, world, mat))
    if (qty < 1) continue
    makeJob(world, {
      kind: 'pave',
      mat,
      qty,
      sourceId: source.id,
      segmentId: segment.id,
      priority: 0,
      createdAt: clock + Math.random(),
    })
  }
}

export function planDemolishJobs(world: World, clock: number): void {
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

function routeHaul(
  world: World,
  vehicleId: number,
  sourceNode: number,
  destNode: number,
): { path: Pt[]; loadIndex: number; signals: number } | null {
  const vehicle = world.vehicles.find((v) => v.id === vehicleId)
  if (!vehicle) return null
  const vNode = nearestNode(world, vehicle.pos)
  if (!vNode) return null
  const p1 = findPath(world, vNode.id, sourceNode)
  if (!p1) return null
  const p2 = findPath(world, sourceNode, destNode)
  if (!p2) return null
  const pts1 = pathPoints(world, p1.nodes, p1.segments)
  const pts2 = pathPoints(world, p2.nodes, p2.segments)
  let signals = 0
  for (const id of p1.nodes) if (world.nodeById[id]?.signal) signals++
  for (const id of p2.nodes) if (world.nodeById[id]?.signal) signals++
  return { path: join(pts1, pts2), loadIndex: Math.max(0, pts1.length - 1), signals }
}

export function assignJobs(world: World): void {
  const pending = world.jobs
    .filter(isTarget)
    .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)

  for (const job of pending) {
    const idle = world.vehicles.filter(
      (vehicle) =>
        vehicle.state === 'idle' &&
        (job.kind === 'construct' || job.kind === 'demolish'
          ? vehicle.role === 'builder'
          : vehicle.role === 'hauler'),
    )
    if (idle.length === 0) continue

    let assigned = false
    for (const vehicle of idle) {
      if (job.kind === 'haul' || job.kind === 'pave') {
        const source = world.buildingById[job.sourceId]
        if (!source) continue
        let sourceNode = source.nodeId
        let destNode = sourceNode
        if (job.kind === 'haul') {
          const dest = world.buildingById[job.destId]
          if (!dest) continue
          destNode = dest.nodeId
        } else {
          const segment = world.segmentById[job.segmentId]
          if (!segment) continue
          destNode = segment.a
        }
        const route = routeHaul(world, vehicle.id, sourceNode, destNode)
        if (!route) continue
        if (job.kind === 'pave') {
          const segment = world.segmentById[job.segmentId]
          if (!segment) continue
          const tip = pointOnPolyline(segment.pts, segment.cum, segment.progress * segment.length)
          const start = segment.pts[0]
          const path = join(route.path, [start, tip])
          vehicle.path = path
          vehicle.pathIndex = 0
          vehicle.loadIndex = route.loadIndex
        } else {
          vehicle.path = route.path
          vehicle.pathIndex = 0
          vehicle.loadIndex = route.loadIndex
        }
        vehicle.state = 'toSource'
        vehicle.speedMul = 1 + SIGNAL_SPEED_BONUS * route.signals
      } else {
        const vNode = nearestNode(world, vehicle.pos)
        if (!vNode) continue
        let destNode = -1
        if (job.kind === 'demolish' && job.segmentId >= 0) {
          const segment = world.segmentById[job.segmentId]
          if (!segment) continue
          destNode = segment.a
        } else {
          const dest = world.buildingById[job.destId]
          if (!dest) continue
          destNode = dest.nodeId
        }
        const p = findPath(world, vNode.id, destNode)
        if (!p) continue
        vehicle.path = pathPoints(world, p.nodes, p.segments)
        vehicle.pathIndex = 0
        vehicle.loadIndex = -1
        vehicle.state = 'toSite'
        let signals = 0
        for (const id of p.nodes) if (world.nodeById[id]?.signal) signals++
        vehicle.speedMul = 1 + SIGNAL_SPEED_BONUS * signals
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

export function cleanupJobs(world: World): void {
  if (world.jobs.length < 240) return
  world.jobs = world.jobs.filter((job) => job.state !== 'done')
}
