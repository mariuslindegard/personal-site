import {
  cumulative,
  dist,
  distToSegment,
  pointOnPolyline,
  projectParam,
  segmentIntersection,
  type Pt,
} from './geometry'
import { BUILDINGS, ROADS, SNAP_NODE_DIST } from './config'
import type { Building, RoadNode, RoadSegment, World } from './types'

export function addNode(
  world: World,
  pos: Pt,
  kind: RoadNode['kind'],
  buildingId = -1,
): RoadNode {
  const node: RoadNode = {
    id: world.nextNodeId++,
    pos,
    kind,
    buildingId,
    segments: [],
    signal: false,
  }
  world.nodes.push(node)
  world.nodeById[node.id] = node
  return node
}

export function nearestNode(
  world: World,
  pos: Pt,
  maxDist = Infinity,
  pred?: (node: RoadNode) => boolean,
): RoadNode | null {
  let best: RoadNode | null = null
  let bestD = maxDist
  for (const node of world.nodes) {
    if (pred && !pred(node)) continue
    const d = dist(node.pos, pos)
    if (d < bestD) {
      bestD = d
      best = node
    }
  }
  return best
}

function hasSegment(world: World, a: number, b: number): boolean {
  const node = world.nodeById[a]
  if (!node) return false
  for (const id of node.segments) {
    const seg = world.segmentById[id]
    if (seg && ((seg.a === a && seg.b === b) || (seg.a === b && seg.b === a))) {
      return true
    }
  }
  return false
}

function makeSegment(
  world: World,
  aId: number,
  bId: number,
  tier: number,
  built: boolean,
): RoadSegment | null {
  const a = world.nodeById[aId]
  const b = world.nodeById[bId]
  if (!a || !b || aId === bId) return null
  return makeSegmentPts(world, aId, bId, [a.pos, b.pos], tier, built)
}

function makeSegmentPts(
  world: World,
  aId: number,
  bId: number,
  pts: Pt[],
  tier: number,
  built: boolean,
): RoadSegment | null {
  const a = world.nodeById[aId]
  const b = world.nodeById[bId]
  if (!a || !b || aId === bId || pts.length < 2) return null
  const length = cumulative(pts).pop() ?? 0
  if (length < 4) return null
  const def = ROADS[tier] ?? ROADS[1]
  const required = Math.max(1, Math.round(length * def.costPerPx))
  const segment: RoadSegment = {
    id: world.nextSegmentId++,
    a: aId,
    b: bId,
    pts,
    cum: cumulative(pts),
    length,
    tier,
    progress: built ? 1 : 0,
    built,
    materialRequired: required,
    materialDelivered: built ? required : 0,
    demolish: false,
    reverse: false,
    belt: false,
    traffic: 0,
    age: 0,
  }
  world.segments.push(segment)
  world.segmentById[segment.id] = segment
  a.segments.push(segment.id)
  b.segments.push(segment.id)
  world.topoDirty = true
  return segment
}

function removeSegmentRaw(world: World, segment: RoadSegment): void {
  const a = world.nodeById[segment.a]
  const b = world.nodeById[segment.b]
  if (a) a.segments = a.segments.filter((id) => id !== segment.id)
  if (b) b.segments = b.segments.filter((id) => id !== segment.id)
  world.segments = world.segments.filter((s) => s.id !== segment.id)
  world.segmentById[segment.id] = undefined
  world.topoDirty = true
}

function splitSegment(world: World, segment: RoadSegment, point: Pt): RoadNode {
  const aId = segment.a
  const bId = segment.b
  const tier = segment.tier
  removeSegmentRaw(world, segment)
  const node = addNode(world, point, 'junction')
  makeSegment(world, aId, node.id, tier, true)
  makeSegment(world, node.id, bId, tier, true)
  return node
}

function blockedByBuilding(
  world: World,
  a: Pt,
  b: Pt,
  ignoreNodes: number[],
): Building | null {
  for (const building of world.buildings) {
    if (building.state === 'complete') continue
    if (ignoreNodes.includes(building.nodeId)) continue
    const def = BUILDINGS[building.key]
    if (!def) continue
    if (distToSegment(building.pos, a, b) < def.size / 2 + 12) return building
  }
  return null
}

function detourVia(world: World, fromId: number, toId: number): RoadNode | null {
  const from = world.nodeById[fromId]
  const to = world.nodeById[toId]
  if (!from || !to) return null
  const length = dist(from.pos, to.pos)
  if (length < 70) return null
  const hit = blockedByBuilding(world, from.pos, to.pos, [fromId, toId])
  if (!hit) return null
  const def = BUILDINGS[hit.key]
  if (!def) return null
  const perpX = -(to.pos.y - from.pos.y) / length
  const perpY = (to.pos.x - from.pos.x) / length
  const mid = {
    x: (from.pos.x + to.pos.x) / 2,
    y: (from.pos.y + to.pos.y) / 2,
  }
  const side =
    (hit.pos.x - mid.x) * perpX + (hit.pos.y - mid.y) * perpY >= 0 ? -1 : 1
  const clearance = def.size / 2 + 30
  const viaPos = {
    x: mid.x + perpX * side * clearance,
    y: mid.y + perpY * side * clearance,
  }
  if (blockedByBuilding(world, viaPos, viaPos, [])) return null
  if (dist(viaPos, from.pos) < 26 || dist(viaPos, to.pos) < 26) return null
  const existing = nearestNode(world, viaPos, 28)
  if (existing) return existing
  return addNode(world, viaPos, 'junction')
}

export function addRoad(
  world: World,
  aPos: Pt,
  bPos: Pt,
  tier: number,
  built: boolean,
): number[] | null {
  const aNode =
    nearestNode(world, aPos, SNAP_NODE_DIST) ?? addNode(world, aPos, 'junction')
  const bNode =
    nearestNode(world, bPos, SNAP_NODE_DIST) ?? addNode(world, bPos, 'junction')
  if (aNode.id === bNode.id) return []

  const a = aNode.pos
  const b = bNode.pos
  const stops: { t: number; node: RoadNode }[] = []
  const snapshot = world.segments.slice()

  for (const seg of snapshot) {
    if (seg.a === aNode.id || seg.b === aNode.id) continue
    if (seg.a === bNode.id || seg.b === bNode.id) continue
    const hit = segmentIntersection(a, b, seg.pts[0], seg.pts[seg.pts.length - 1])
    if (!hit) continue
    if (seg.belt) continue
    if (!seg.built) continue
    let node = nearestNode(world, hit.point, 16)
    if (!node) node = splitSegment(world, seg, hit.point)
    if (!stops.some((s) => s.node.id === node.id)) stops.push({ t: hit.t, node })
  }

  for (const node of world.nodes) {
    if (node.id === aNode.id || node.id === bNode.id) continue
    const proj = projectParam(a, b, node.pos)
    if (proj.t <= 0.001 || proj.t >= 0.999) continue
    if (dist(node.pos, proj.point) > 12) continue
    if (!stops.some((s) => s.node.id === node.id)) stops.push({ t: proj.t, node })
  }

  stops.sort((p, q) => p.t - q.t)
  const chain: number[] = [aNode.id, ...stops.map((s) => s.node.id), bNode.id]
  const created: number[] = []
  for (let i = 0; i < chain.length - 1; i++) {
    const from = chain[i]
    const to = chain[i + 1]
    if (from === to || hasSegment(world, from, to)) continue
    const via = detourVia(world, from, to)
    if (via && via.id !== from && via.id !== to) {
      if (!hasSegment(world, from, via.id)) {
        const first = makeSegment(world, from, via.id, tier, built)
        if (first) created.push(first.id)
      }
      if (!hasSegment(world, via.id, to)) {
        const second = makeSegment(world, via.id, to, tier, built)
        if (second) created.push(second.id)
      }
    } else {
      const seg = makeSegment(world, from, to, tier, built)
      if (seg) created.push(seg.id)
    }
  }
  return created
}

export function removeSegmentById(world: World, id: number): void {
  const segment = world.segmentById[id]
  if (segment) removeSegmentRaw(world, segment)
}

export function simplifyNetwork(world: World): void {
  let merges = 0
  let changed = true
  while (changed && merges < 40) {
    changed = false
    for (const node of world.nodes) {
      if (node.kind === 'building' || node.signal) continue
      if (node.segments.length !== 2) continue
      const s1 = world.segmentById[node.segments[0]]
      const s2 = world.segmentById[node.segments[1]]
      if (!s1 || !s2) continue
      if (!s1.built || !s2.built) continue
      if (s1.tier !== s2.tier) continue
      if (s1.belt || s2.belt || s1.demolish || s2.demolish) continue
      const e1 = s1.a === node.id ? s1.b : s1.a
      const e2 = s2.a === node.id ? s2.b : s2.a
      if (e1 === e2) continue
      const n1 = world.nodeById[e1]
      const n2 = world.nodeById[e2]
      if (!n1 || !n2) continue
      const v1x = n1.pos.x - node.pos.x
      const v1y = n1.pos.y - node.pos.y
      const v2x = n2.pos.x - node.pos.x
      const v2y = n2.pos.y - node.pos.y
      const m1 = Math.hypot(v1x, v1y)
      const m2 = Math.hypot(v2x, v2y)
      if (m1 < 1 || m2 < 1) continue
      const cos = (v1x * v2x + v1y * v2y) / (m1 * m2)
      if (cos > -0.965) continue
      if (hasSegment(world, e1, e2)) continue
      const traffic = s1.traffic + s2.traffic
      const tier = s1.tier
      removeSegmentRaw(world, s1)
      removeSegmentRaw(world, s2)
      const merged = makeSegmentPts(
        world,
        e1,
        e2,
        [n1.pos, node.pos, n2.pos],
        tier,
        true,
      )
      if (merged) merged.traffic = traffic
      world.nodes = world.nodes.filter((candidate) => candidate.id !== node.id)
      world.nodeById[node.id] = undefined
      world.topoDirty = true
      merges += 1
      changed = true
      break
    }
  }
}

export function findPath(
  world: World,
  fromId: number,
  toId: number,
  exclude = -1,
  allowBelt = false,
): { nodes: number[]; segments: number[] } | null {
  if (fromId === toId) return { nodes: [fromId], segments: [] }
  const start = world.nodeById[fromId]
  const goal = world.nodeById[toId]
  if (!start || !goal) return null

  const open: number[] = [fromId]
  const g = new Map<number, number>([[fromId, 0]])
  const f = new Map<number, number>([[fromId, dist(start.pos, goal.pos)]])
  const came = new Map<number, { node: number; seg: number }>()
  const closed = new Set<number>()

  while (open.length) {
    let bi = 0
    for (let i = 1; i < open.length; i++) {
      if ((f.get(open[i]) ?? Infinity) < (f.get(open[bi]) ?? Infinity)) bi = i
    }
    const cur = open.splice(bi, 1)[0]
    if (cur === toId) break
    closed.add(cur)
    const node = world.nodeById[cur]
    if (!node) continue
    for (const sid of node.segments) {
      const seg = world.segmentById[sid]
      if (!seg || !seg.built || seg.id === exclude) continue
      if (seg.belt && !allowBelt) continue
      const other = seg.a === cur ? seg.b : seg.a
      if (closed.has(other)) continue
      const tentative =
        (g.get(cur) ?? Infinity) +
        seg.length / (ROADS[seg.tier]?.speedMul ?? 1)
      if (tentative < (g.get(other) ?? Infinity)) {
        came.set(other, { node: cur, seg: sid })
        g.set(other, tentative)
        const otherNode = world.nodeById[other]
        f.set(
          other,
          tentative + (otherNode ? dist(otherNode.pos, goal.pos) / 1.6 : 0),
        )
        if (!open.includes(other)) open.push(other)
      }
    }
  }

  if (fromId !== toId && !came.has(toId)) return null
  const nodes = [toId]
  const segments: number[] = []
  let cur = toId
  while (cur !== fromId) {
    const prev = came.get(cur)
    if (!prev) return null
    segments.unshift(prev.seg)
    nodes.unshift(prev.node)
    cur = prev.node
  }
  return { nodes, segments }
}

export function pathPoints(
  world: World,
  nodes: number[],
  segments: number[],
): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < segments.length; i++) {
    const seg = world.segmentById[segments[i]]
    if (!seg) continue
    const from = nodes[i]
    const forward = seg.a === from
    const sp = forward ? seg.pts : seg.pts.slice().reverse()
    if (pts.length === 0) pts.push(...sp)
    else for (let k = 1; k < sp.length; k++) pts.push(sp[k])
  }
  if (pts.length === 0) {
    const node = world.nodeById[nodes[0]]
    if (node) pts.push(node.pos)
  }
  return pts
}

export function sampleAt(segment: RoadSegment, d: number): Pt {
  return pointOnPolyline(segment.pts, segment.cum, d)
}

export function markParallel(
  world: World,
  highway: RoadSegment,
  maxDist: number,
): void {
  for (const segment of world.segments) {
    if (segment.id === highway.id || segment.demolish || !segment.built) continue
    if (segment.tier >= highway.tier) continue
    const a = segment.pts[0]
    const b = segment.pts[1]
    const ha = projectParam(highway.pts[0], highway.pts[1], a)
    const hb = projectParam(highway.pts[0], highway.pts[1], b)
    if (dist(a, ha.point) < maxDist && dist(b, hb.point) < maxDist) {
      segment.demolish = true
    }
  }
}

export function components(world: World, exclude = -1): number[][] {
  const seen = new Set<number>()
  const groups: number[][] = []
  for (const node of world.nodes) {
    if (seen.has(node.id)) continue
    const group: number[] = []
    const stack = [node.id]
    seen.add(node.id)
    while (stack.length) {
      const id = stack.pop()
      if (id === undefined) break
      group.push(id)
      const n = world.nodeById[id]
      if (!n) continue
      for (const sid of n.segments) {
        if (sid === exclude) continue
        const seg = world.segmentById[sid]
        if (!seg || !seg.built || seg.belt) continue
        const other = seg.a === id ? seg.b : seg.a
        if (!seen.has(other)) {
          seen.add(other)
          stack.push(other)
        }
      }
    }
    groups.push(group)
  }
  return groups
}

export function buildingsConnected(world: World, exclude = -1): boolean {
  const groups = components(world, exclude)
  let count = 0
  for (const group of groups) {
    let hasBuilding = false
    for (const id of group) {
      if ((world.nodeById[id]?.buildingId ?? -1) >= 0) {
        hasBuilding = true
        break
      }
    }
    if (hasBuilding) count++
    if (count > 1) return false
  }
  return true
}
