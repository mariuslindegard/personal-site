import type { MaterialAmount } from './types'

export const MATERIAL_COUNT = 6

export const MATERIAL_NAMES = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']

export const MATERIAL_RGB: [number, number, number][] = [
  [150, 160, 170],
  [111, 211, 199],
  [255, 192, 110],
  [179, 157, 255],
  [122, 162, 255],
  [255, 143, 168],
]

export type Recipe = {
  inputs: MaterialAmount[]
  output: MaterialAmount | null
  producesVehicle: boolean
  addsProgress: number
  time: number
  manual?: boolean
}

export type BuildingDef = {
  key: string
  glyph: string
  tier: number
  size: number
  rgb: [number, number, number]
  recipe: Recipe | null
  cost: MaterialAmount[]
  buffer: number
  work: number
  unlock: number
}

export const BUILDINGS: Record<string, BuildingDef> = {
  extractor: {
    key: 'extractor',
    glyph: 'A',
    tier: 0,
    size: 20,
    rgb: [150, 160, 170],
    recipe: { inputs: [], output: { mat: 0, qty: 1 }, producesVehicle: false, addsProgress: 0, time: 1050 },
    cost: [{ mat: 0, qty: 3 }],
    buffer: 6,
    work: 6,
    unlock: -1,
  },
  assembly: {
    key: 'assembly',
    glyph: 'B',
    tier: 1,
    size: 24,
    rgb: [111, 211, 199],
    recipe: {
      inputs: [{ mat: 0, qty: 2 }],
      output: { mat: 1, qty: 1 },
      producesVehicle: false,
      addsProgress: 0,
      time: 1250,
    },
    cost: [{ mat: 0, qty: 3 }],
    buffer: 6,
    work: 8,
    unlock: 0,
  },
  depot: {
    key: 'depot',
    glyph: 'V',
    tier: 1,
    size: 26,
    rgb: [190, 200, 220],
    recipe: null,
    cost: [{ mat: 0, qty: 3 }],
    buffer: 6,
    work: 10,
    unlock: 0,
  },
  warehouse: {
    key: 'warehouse',
    glyph: 'W',
    tier: 1,
    size: 28,
    rgb: [170, 190, 220],
    recipe: null,
    cost: [{ mat: 0, qty: 4 }],
    buffer: 24,
    work: 12,
    unlock: 0,
  },
  vehicle: {
    key: 'vehicle',
    glyph: 'C',
    tier: 2,
    size: 26,
    rgb: [155, 224, 127],
    recipe: {
      inputs: [{ mat: 1, qty: 2 }],
      output: null,
      producesVehicle: false,
      addsProgress: 0,
      time: 1600,
      manual: true,
    },
    cost: [{ mat: 0, qty: 3 }, { mat: 1, qty: 1 }],
    buffer: 6,
    work: 10,
    unlock: 1,
  },
  concrete: {
    key: 'concrete',
    glyph: 'D',
    tier: 2,
    size: 26,
    rgb: [255, 192, 110],
    recipe: {
      inputs: [{ mat: 1, qty: 2 }],
      output: { mat: 2, qty: 1 },
      producesVehicle: false,
      addsProgress: 0,
      time: 1600,
    },
    cost: [{ mat: 0, qty: 3 }, { mat: 1, qty: 1 }],
    buffer: 6,
    work: 10,
    unlock: 1,
  },
  systems: {
    key: 'systems',
    glyph: 'E',
    tier: 3,
    size: 28,
    rgb: [179, 157, 255],
    recipe: {
      inputs: [{ mat: 2, qty: 2 }],
      output: { mat: 3, qty: 1 },
      producesVehicle: false,
      addsProgress: 0,
      time: 1800,
    },
    cost: [{ mat: 2, qty: 3 }],
    buffer: 6,
    work: 12,
    unlock: 2,
  },
  design: {
    key: 'design',
    glyph: 'F',
    tier: 4,
    size: 30,
    rgb: [122, 162, 255],
    recipe: {
      inputs: [{ mat: 3, qty: 2 }],
      output: { mat: 4, qty: 1 },
      producesVehicle: false,
      addsProgress: 0,
      time: 2000,
    },
    cost: [{ mat: 3, qty: 3 }],
    buffer: 6,
    work: 14,
    unlock: 3,
  },
  megaplant: {
    key: 'megaplant',
    glyph: 'G',
    tier: 5,
    size: 32,
    rgb: [255, 143, 168],
    recipe: {
      inputs: [{ mat: 4, qty: 2 }],
      output: { mat: 5, qty: 1 },
      producesVehicle: false,
      addsProgress: 0,
      time: 2200,
    },
    cost: [{ mat: 3, qty: 3 }, { mat: 4, qty: 2 }],
    buffer: 6,
    work: 16,
    unlock: 4,
  },
  landmark: {
    key: 'landmark',
    glyph: 'H',
    tier: 6,
    size: 40,
    rgb: [240, 220, 160],
    recipe: {
      inputs: [{ mat: 5, qty: 2 }],
      output: null,
      producesVehicle: false,
      addsProgress: 1,
      time: 2800,
    },
    cost: [{ mat: 4, qty: 2 }, { mat: 5, qty: 2 }],
    buffer: 6,
    work: 20,
    unlock: 5,
  },
}

export const PROGRESSION = [
  'assembly',
  'vehicle',
  'concrete',
  'systems',
  'design',
  'megaplant',
  'landmark',
]

export type RoadDef = {
  tier: number
  width: number
  rgb: [number, number, number]
  material: number
  costPerPx: number
  speedMul: number
}

export const ROADS: Record<number, RoadDef> = {
  1: { tier: 1, width: 2.2, rgb: [120, 130, 150], material: 0, costPerPx: 0.005, speedMul: 1 },
  2: { tier: 2, width: 3.6, rgb: [130, 175, 195], material: 1, costPerPx: 0.012, speedMul: 1.25 },
  3: { tier: 3, width: 8, rgb: [228, 178, 108], material: 2, costPerPx: 0.018, speedMul: 1.6 },
}

export type VehicleDef = {
  tier: number
  capacity: number
  speed: number
  rgb: [number, number, number]
  size: number
}

export const VEHICLES: VehicleDef[] = [
  { tier: 1, capacity: 1, speed: 0.068, rgb: [180, 200, 255], size: 11 },
  { tier: 2, capacity: 2, speed: 0.071, rgb: [150, 220, 200], size: 13 },
  { tier: 3, capacity: 3, speed: 0.074, rgb: [255, 205, 140], size: 15 },
  { tier: 4, capacity: 4, speed: 0.077, rgb: [205, 185, 255], size: 17 },
  { tier: 5, capacity: 5, speed: 0.08, rgb: [255, 170, 190], size: 19 },
  { tier: 6, capacity: 6, speed: 0.083, rgb: [190, 240, 170], size: 21 },
]

export const BUILDER_DEF = {
  capacity: 1,
  speed: 0.072,
  rgb: [240, 220, 150],
  size: 12,
}

export const MAX_TIER = 6
export const PLAN_MS = 320
export const MAX_SITES = 2
export const MAX_ROAD_BUILDS = 2
export const SNAP_NODE_DIST = 44
export const BUILDING_SEP = 82
export const MARGIN = 40
export const START_HAULERS = 2
export const LOAD_MS = 500
export const UNLOAD_MS = 450
export const WORK_MS = 240
export const PULSE_MS = 1050
export const OUTPUT_CAP = 6
export const FLEET_MAX = 12
export const HIGHWAY_MIN_BUILDINGS = 8
export const HIGHWAY_PARALLEL_DIST = 110
export const MAX_SIGNALS = 8
export const SIGNAL_SPEED_BONUS = 0.06
export const DEMOLISH_WORK = 5
export const ROAD_BUILD_MS = 3200
export const LANDMARK_PROGRESS = 5
export const CONVEYOR_COST: MaterialAmount[] = [
  { mat: 1, qty: 2 },
  { mat: 2, qty: 1 },
]
export const CONVEYOR_WORK = 14
export const CONVEYOR_TRANSFER_MS = 1500
export const CONVEYOR_MAX = 5
export const CONVEYOR_UNLOCK = 3
export const CONVEYOR_MIN_BUILDINGS = 8
export const CONVEYOR_STOCK = 10
export const ROAD_OPTIMIZE_AGE = 180000
export const CONVEYOR_ITEM_SPEED = 0.05
export const CONVEYOR_ITEM_MAX = 8
export const WAREHOUSE_IDLE_MS = 360000
export const ROAD_OPTIMIZE_DETOUR = 1.8
export const DISSOLVE_MS = 12000
export const LINGER_MS = 90000
