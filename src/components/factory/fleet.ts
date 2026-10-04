import { angleOf, clamp, dist, pointOnPolyline, type Pt } from './geometry'
import {
  BUILDER_DEF,
  HIGHWAY_PARALLEL_DIST,
  LOAD_MS,
  OUTPUT_CAP,
  ROAD_BUILD_MS,
  UNLOAD_MS,
  VEHICLES,
  WORK_MS,
} from './config'
import { markParallel, removeSegmentById } from './network'
import type { Job, Vehicle, VehicleRole, World } from './types'

export function createVehicle(
  world: World,
  tier: number,
  role: VehicleRole,
  pos: Pt,
): Vehicle {
  const def = VEHICLES[clamp(tier, 1, VEHICLES.length) - 1]
  const vehicle: Vehicle = {
    id: world.nextVehicleId++,
    role,
    tier: role === 'builder' ? 0 : def.tier,
    capacity: role === 'builder' ? BUILDER_DEF.capacity : def.capacity,
    speed: role === 'builder' ? BUILDER_DEF.speed : def.speed,
    speedMul: 1,
    pos: { x: pos.x, y: pos.y },
    angle: Math.random() * Math.PI * 2,
    cargo: [],
    state: 'idle',
    jobId: -1,
    path: [],
    pathIndex: 0,
    loadIndex: -1,
    timer: 0,
  }
  world.vehicles.push(vehicle)
  return vehicle
}

export function jobById(world: World, id: number): Job | undefined {
  return world.jobs.find((job) => job.id === id)
}

function setCargo(vehicle: Vehicle, mat: number, qty: number): void {
  vehicle.cargo = qty > 0 ? [{ mat, qty }] : []
}

function advance(vehicle: Vehicle, dtMs: number): boolean {
  while (vehicle.pathIndex < vehicle.path.length) {
    const target = vehicle.path[vehicle.pathIndex]
    const d = dist(vehicle.pos, target)
    const step = vehicle.speed * vehicle.speedMul * dtMs
    if (d <= step + 0.5) {
      vehicle.pos = { x: target.x, y: target.y }
      vehicle.pathIndex++
      continue
    }
    vehicle.angle = angleOf(vehicle.pos, target)
    vehicle.pos = {
      x: vehicle.pos.x + ((target.x - vehicle.pos.x) / d) * step,
      y: vehicle.pos.y + ((target.y - vehicle.pos.y) / d) * step,
    }
    return false
  }
  return true
}

function deposit(world: World, job: Job, vehicle: Vehicle): void {
  const building = world.buildingById[job.destId]
  if (building) {
    for (const item of vehicle.cargo) {
      if (building.state === 'site') {
        building.delivered[item.mat] = (building.delivered[item.mat] ?? 0) + item.qty
      } else {
        building.inputs[item.mat] = Math.min(
          OUTPUT_CAP,
          (building.inputs[item.mat] ?? 0) + item.qty,
        )
      }
    }
  }
  setCargo(vehicle, 0, 0)
}

function finish(world: World, vehicle: Vehicle): void {
  const job = jobById(world, vehicle.jobId)
  if (job) job.state = 'done'
  vehicle.jobId = -1
  vehicle.state = 'idle'
  vehicle.path = []
  vehicle.pathIndex = 0
  vehicle.loadIndex = -1
}

function roadhaulDeposit(world: World, job: Job, vehicle: Vehicle): void {
  const segment = world.segmentById[job.segmentId]
  if (segment) {
    let qty = 0
    for (const item of vehicle.cargo) qty += item.qty
    segment.materialDelivered = Math.min(
      segment.materialRequired,
      segment.materialDelivered + qty,
    )
    const site = segment.reverse ? segment.pts[1] : segment.pts[0]
    world.pulses.push({
      x: site.x,
      y: site.y,
      t: 0,
      max: 10,
      r: 2.5,
      rgb: [180, 220, 255],
      width: 0.8,
    })
  }
  setCargo(vehicle, 0, 0)
}

export function updateVehicles(world: World, dtMs: number): void {
  if (world.vehicles.length === 0) return

  for (const vehicle of world.vehicles) {
    if (vehicle.state === 'idle') continue

    if (vehicle.state === 'loading') {
      vehicle.timer -= dtMs
      if (vehicle.timer <= 0) {
        const job = jobById(world, vehicle.jobId)
        if (!job) {
          vehicle.state = 'idle'
          continue
        }
        const source = world.buildingById[job.sourceId]
        const qty = Math.min(job.qty, vehicle.capacity)
        if (source && (job.kind === 'haul' || job.kind === 'roadhaul')) {
          source.output[job.mat] = Math.max(0, (source.output[job.mat] ?? 0) - qty)
        }
        setCargo(vehicle, job.mat, qty)
        if (vehicle.pathIndex >= vehicle.path.length) finish(world, vehicle)
        else vehicle.state = 'toDest'
      }
      continue
    }

    if (vehicle.state === 'unloading') {
      vehicle.timer -= dtMs
      if (vehicle.timer <= 0) {
        const job = jobById(world, vehicle.jobId)
        if (job) {
          if (job.kind === 'roadhaul') roadhaulDeposit(world, job, vehicle)
          else deposit(world, job, vehicle)
        }
        finish(world, vehicle)
      }
      continue
    }

    if (vehicle.state === 'working') {
      const activeJob = jobById(world, vehicle.jobId)
      if (activeJob && activeJob.kind === 'pave' && activeJob.segmentId >= 0) {
        const segment = world.segmentById[activeJob.segmentId]
        if (!segment || segment.built) {
          finish(world, vehicle)
          continue
        }
        segment.progress = clamp(segment.progress + dtMs / ROAD_BUILD_MS, 0, 1)
        const d = segment.reverse
          ? (1 - segment.progress) * segment.length
          : segment.progress * segment.length
        const tip = pointOnPolyline(segment.pts, segment.cum, d)
        if (Math.random() < 0.3) {
          world.particles.push({
            x: tip.x + (Math.random() - 0.5) * 8,
            y: tip.y + (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 0.01,
            vy: -0.008 - Math.random() * 0.008,
            life: 0,
            max: 700,
            rgb: [255, 220, 160],
            size: 1.4,
          })
        }
        if (segment.progress >= 1) {
          segment.built = true
          segment.progress = 1
          world.topoDirty = true
          if (segment.tier === 3) markParallel(world, segment, HIGHWAY_PARALLEL_DIST)
          const end = segment.pts[segment.pts.length - 1]
          world.pulses.push({
            x: end.x,
            y: end.y,
            t: 0,
            max: 22,
            r: 3,
            rgb: [180, 220, 255],
            width: 1,
          })
          finish(world, vehicle)
        }
        continue
      }
      vehicle.timer -= dtMs
      if (vehicle.timer <= 0) {
        const job = jobById(world, vehicle.jobId)
        if (!job) {
          finish(world, vehicle)
          continue
        }

        if (job.kind === 'demolish') {
          job.amount -= 1
          if (job.segmentId >= 0) {
            const segment = world.segmentById[job.segmentId]
            if (segment) {
              const mid = {
                x: (segment.pts[0].x + segment.pts[1].x) / 2,
                y: (segment.pts[0].y + segment.pts[1].y) / 2,
              }
              world.particles.push({
                x: mid.x + (Math.random() - 0.5) * 18,
                y: mid.y + (Math.random() - 0.5) * 18,
                vx: (Math.random() - 0.5) * 0.02,
                vy: -0.01 - Math.random() * 0.01,
                life: 0,
                max: 800,
                rgb: [255, 150, 140],
                size: 1.7,
              })
            }
          }
          if (job.amount <= 0) {
            if (job.segmentId >= 0) removeSegmentById(world, job.segmentId)
            finish(world, vehicle)
          } else {
            vehicle.timer = WORK_MS
          }
          continue
        }

        const building = world.buildingById[job.destId]
        if (building) {
          building.work -= 1
          building.pulse = 0.6
          world.particles.push({
            x: building.pos.x + (Math.random() - 0.5) * 16,
            y: building.pos.y - 4 - Math.random() * 10,
            vx: (Math.random() - 0.5) * 0.012,
            vy: -0.012 - Math.random() * 0.012,
            life: 0,
            max: 900,
            rgb: [255, 220, 160],
            size: 1.6,
          })
          if (building.work <= 0) {
            building.work = 0
            building.state = 'active'
            building.pulse = 1
            finish(world, vehicle)
          } else {
            vehicle.timer = WORK_MS
          }
        } else {
          finish(world, vehicle)
        }
      }
      continue
    }

    const arrived = advance(vehicle, dtMs)

    if (vehicle.loadIndex >= 0 && vehicle.pathIndex >= vehicle.loadIndex) {
      vehicle.loadIndex = -1
      vehicle.state = 'loading'
      vehicle.timer = LOAD_MS
      continue
    }

    if (!arrived) continue

    const job = jobById(world, vehicle.jobId)
    if (!job) {
      vehicle.state = 'idle'
      continue
    }

    if (job.kind === 'upgrade') {
      if (vehicle.role === 'hauler' && vehicle.tier < VEHICLES.length) {
        world.vehicles.push(
          createVehicle(world, vehicle.tier + 1, 'hauler', vehicle.pos),
        )
        world.pulses.push({
          x: vehicle.pos.x,
          y: vehicle.pos.y,
          t: 0,
          max: 22,
          r: 4,
          rgb: [200, 240, 200],
          width: 1,
        })
      }
      finish(world, vehicle)
      vehicle.tier = -1
      continue
    }

    if (vehicle.state === 'toSite') {
      vehicle.state = 'working'
      vehicle.timer = WORK_MS
      continue
    }

    vehicle.state = 'unloading'
    vehicle.timer = UNLOAD_MS
  }

  world.vehicles = world.vehicles.filter((vehicle) => vehicle.tier !== -1)
}
