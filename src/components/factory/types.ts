import type { Pt } from './geometry'

export type Env = { width: number; height: number; rng: () => number }

export type MaterialAmount = { mat: number; qty: number }

export type NodeKind = 'junction' | 'building'

export type RoadNode = {
  id: number
  pos: Pt
  kind: NodeKind
  buildingId: number
  segments: number[]
  signal: boolean
}

export type RoadSegment = {
  id: number
  a: number
  b: number
  pts: Pt[]
  cum: number[]
  length: number
  tier: number
  progress: number
  built: boolean
  materialRequired: number
  materialDelivered: number
  demolish: boolean
  reverse: boolean
  belt: boolean
  traffic: number
  age: number
}

export type BuildingState = 'site' | 'active' | 'complete'

export type Building = {
  id: number
  key: string
  tier: number
  pos: Pt
  nodeId: number
  state: BuildingState
  cost: MaterialAmount[]
  delivered: Record<number, number>
  work: number
  workRequired: number
  inputs: Record<number, number>
  output: Record<number, number>
  vehicleOrders: number
  progress: number
  pulse: number
  produceAt: number
  idleSince: number
  lastUsed: number
}

export type VehicleRole = 'hauler' | 'builder'

export type VehicleState =
  | 'idle'
  | 'toSource'
  | 'loading'
  | 'toDest'
  | 'unloading'
  | 'toSite'
  | 'working'
  | 'paving'
  | 'toDepot'

export type Vehicle = {
  id: number
  role: VehicleRole
  tier: number
  capacity: number
  speed: number
  speedMul: number
  pos: Pt
  angle: number
  cargo: MaterialAmount[]
  state: VehicleState
  jobId: number
  path: Pt[]
  pathIndex: number
  pathSpeed: number[]
  loadIndex: number
  timer: number
}

export type JobKind =
  | 'haul'
  | 'roadhaul'
  | 'pave'
  | 'construct'
  | 'demolish'
  | 'upgrade'
  | 'buildbelt'

export type JobState = 'pending' | 'assigned' | 'done'

export type Job = {
  id: number
  kind: JobKind
  state: JobState
  mat: number
  qty: number
  amount: number
  sourceId: number
  destId: number
  segmentId: number
  buildingId: number
  conveyorId: number
  vehicleTier: number
  assigned: number
  createdAt: number
  priority: number
}

export type Conveyor = {
  id: number
  fromId: number
  toId: number
  mat: number
  pts: Pt[]
  cum: number[]
  length: number
  segments: number[]
  cost: MaterialAmount[]
  delivered: Record<number, number>
  work: number
  workRequired: number
  progress: number
  built: boolean
  transferAt: number
  pulse: number
  items: number[]
}

export type Pulse = {
  x: number
  y: number
  t: number
  max: number
  r: number
  rgb: [number, number, number]
  width: number
}

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  rgb: [number, number, number]
  size: number
}

export type Ambient = {
  x: number
  y: number
  trail: number[]
  speed: number
  life: number
  brightness: number
}

export type Phase = 'grow' | 'dissolve'

export type World = {
  nodes: RoadNode[]
  nodeById: (RoadNode | undefined)[]
  segments: RoadSegment[]
  segmentById: (RoadSegment | undefined)[]
  buildings: Building[]
  buildingById: (Building | undefined)[]
  vehicles: Vehicle[]
  jobs: Job[]
  conveyors: Conveyor[]
  ambient: Ambient[]
  pulses: Pulse[]
  particles: Particle[]
  nextNodeId: number
  nextSegmentId: number
  nextBuildingId: number
  nextVehicleId: number
  nextJobId: number
  nextConveyorId: number
  produced: number[]
  consumed: number[]
  anchor: Pt
  lastPlanAt: number
  phase: Phase
  dissolveAt: number
  dissolveStart: number
  landmarkDone: boolean
  highways: number
  signals: number
  warehouseBuilt: boolean
  boundsW0: number
  boundsH0: number
  lastExpandAt: number
  districts: Record<string, Pt>
  lastRefineAt: number
  topoDirty: boolean
  rng: () => number
}
