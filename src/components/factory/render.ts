import { clamp, pointOnPolyline, type Pt } from './geometry'
import {
  BUILDINGS,
  LANDMARK_PROGRESS,
  MATERIAL_RGB,
  ROADS,
  VEHICLES,
} from './config'
import type { Ambient, Building, Particle, Pulse, RoadSegment, Vehicle, World } from './types'

function rgba(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

function lighten(rgb: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.min(255, rgb[0] + amount),
    Math.min(255, rgb[1] + amount),
    Math.min(255, rgb[2] + amount),
  ]
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + radius, y)
  g.arcTo(x + w, y, x + w, y + h, radius)
  g.arcTo(x + w, y + h, x, y + h, radius)
  g.arcTo(x, y + h, x, y, radius)
  g.arcTo(x, y, x + w, y, radius)
  g.closePath()
}

function strokePath(g: CanvasRenderingContext2D, pts: Pt[]) {
  g.beginPath()
  g.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
  g.stroke()
}

function drawSegment(g: CanvasRenderingContext2D, segment: RoadSegment) {
  const def = ROADS[segment.tier] ?? ROADS[1]
  const a = segment.pts[0]
  const b = segment.pts[1]
  if (segment.demolish && segment.built) {
    g.setLineDash([2, 4])
    g.strokeStyle = 'rgba(255, 140, 130, 0.8)'
    g.lineWidth = def.width
    strokePath(g, segment.pts)
    g.setLineDash([])
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    g.beginPath()
    g.arc(mid.x, mid.y, 3, 0, Math.PI * 2)
    g.strokeStyle = 'rgba(255, 140, 130, 0.9)'
    g.lineWidth = 1
    g.stroke()
    return
  }
  if (segment.built) {
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = rgba(def.rgb, 0.16)
    g.lineWidth = def.width + 3.4
    strokePath(g, segment.pts)
    g.strokeStyle = rgba(def.rgb, 0.85)
    g.lineWidth = def.width
    strokePath(g, segment.pts)
    if (segment.tier === 3) {
      g.setLineDash([7, 7])
      g.strokeStyle = rgba(lighten(def.rgb, 50), 0.8)
      g.lineWidth = 0.9
      strokePath(g, segment.pts)
      g.setLineDash([])
    }
  } else {
    g.setLineDash([3, 5])
    g.strokeStyle = rgba(def.rgb, 0.3)
    g.lineWidth = 1.1
    strokePath(g, segment.pts)
    g.setLineDash([])
    if (segment.progress > 0) {
      const d = segment.reverse
        ? (1 - segment.progress) * segment.length
        : segment.progress * segment.length
      const tip = pointOnPolyline(segment.pts, segment.cum, d)
      const startPt = segment.reverse ? b : a
      g.lineCap = 'round'
      g.strokeStyle = rgba(lighten(def.rgb, 30), 0.9)
      g.lineWidth = def.width
      strokePath(g, [startPt, tip])
    }
    void b
  }
}

export function drawRoads(g: CanvasRenderingContext2D, world: World) {
  for (const segment of world.segments) {
    drawSegment(g, segment)
  }
}

export function drawJunctions(
  g: CanvasRenderingContext2D,
  world: World,
  now: number,
) {
  for (const node of world.nodes) {
    if (node.segments.length < 2 || node.kind === 'building') continue
    g.beginPath()
    g.arc(node.pos.x, node.pos.y, 2.1, 0, Math.PI * 2)
    g.fillStyle = 'rgba(150, 165, 190, 0.5)'
    g.fill()
    if (node.signal) {
      const blink = 0.5 + 0.5 * Math.sin(now * 0.004)
      g.beginPath()
      g.arc(node.pos.x, node.pos.y, 3.2, 0, Math.PI * 2)
      g.fillStyle = `rgba(120, 255, 170, ${0.55 + blink * 0.4})`
      g.fill()
    }
  }
}

function drawHBar(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  p: number,
  rgb: [number, number, number],
) {
  g.fillStyle = 'rgba(9, 11, 19, 0.85)'
  g.fillRect(x, y, w, h)
  g.fillStyle = rgba(rgb, 0.9)
  g.fillRect(x, y, w * clamp(p, 0, 1), h)
  g.strokeStyle = rgba(rgb, 0.35)
  g.lineWidth = 0.5
  g.strokeRect(x, y, w, h)
}

function drawVBar(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  p: number,
  rgb: [number, number, number],
) {
  g.fillStyle = 'rgba(9, 11, 19, 0.85)'
  g.fillRect(x, y, w, h)
  const fill = clamp(p, 0, 1) * h
  g.fillStyle = rgba(rgb, 0.9)
  g.fillRect(x, y + h - fill, w, fill)
  g.strokeStyle = rgba(rgb, 0.35)
  g.lineWidth = 0.5
  g.strokeRect(x, y, w, h)
}

function drawBuilding(
  g: CanvasRenderingContext2D,
  building: Building,
  now: number,
) {
  const def = BUILDINGS[building.key]
  if (!def) return
  const size = def.size
  const half = size / 2
  const rgb = def.rgb

  if (building.pulse > 0) {
    g.beginPath()
    g.arc(building.pos.x, building.pos.y, half + 3 + (1 - building.pulse) * half, 0, Math.PI * 2)
    g.strokeStyle = rgba(rgb, building.pulse * 0.5)
    g.lineWidth = 1.1
    g.stroke()
  }

  roundRect(g, building.pos.x - half, building.pos.y - half, size, size, half * 0.34)
  g.fillStyle = 'rgba(7, 9, 18, 0.82)'
  g.fill()

  if (building.state === 'site') {
    g.setLineDash([3, 4])
    g.strokeStyle = rgba(rgb, 0.85)
    g.lineWidth = 1.3
    g.stroke()
    g.setLineDash([])
    const done = 1 - building.work / Math.max(1, building.workRequired)
    if (done > 0) {
      g.save()
      roundRect(g, building.pos.x - half, building.pos.y - half, size, size, half * 0.34)
      g.clip()
      g.fillStyle = rgba(rgb, 0.34)
      g.fillRect(building.pos.x - half, building.pos.y + half - size * done, size, size * done)
      g.restore()
    }
    for (let i = 0; i < 3; i++) {
      const y = building.pos.y + half - size * done * ((i + 1) / 3)
      g.beginPath()
      g.moveTo(building.pos.x - half - 2, y)
      g.lineTo(building.pos.x + half + 2, y)
      g.strokeStyle = rgba(rgb, 0.42)
      g.lineWidth = 0.9
      g.stroke()
    }

    let need = 0
    let have = 0
    for (const cost of building.cost) {
      need += cost.qty
      have += Math.min(building.delivered[cost.mat] ?? 0, cost.qty)
    }
    if (need > 0) {
      drawHBar(
        g,
        building.pos.x - half,
        building.pos.y - half - 7,
        size,
        2.6,
        have / need,
        [228, 178, 108],
      )
    }
    drawHBar(
      g,
      building.pos.x - half,
      building.pos.y + half + 5,
      size,
      2.6,
      done,
      rgb,
    )
  } else {
    g.strokeStyle = rgba(rgb, 0.12)
    g.lineWidth = 3.4
    g.stroke()
    g.strokeStyle = rgba(rgb, 0.75)
    g.lineWidth = 1.1
    g.stroke()

    g.font = `600 ${Math.round(size * 0.5)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = rgba(lighten(rgb, 45), 0.95)
    g.fillText(def.glyph, building.pos.x, building.pos.y + 0.5)

    const recipe = def.recipe
    if (recipe) {
      let progress = 0
      if (recipe.addsProgress) {
        progress = building.progress / LANDMARK_PROGRESS
      } else if (building.produceAt !== 0) {
        progress = 1 - clamp((building.produceAt - now) / recipe.time, 0, 1)
      }
      drawHBar(
        g,
        building.pos.x - half,
        building.pos.y - half - 7,
        size,
        2.6,
        progress,
        lighten(rgb, 40),
      )

      if (recipe.inputs.length > 0) {
        let need = 0
        let have = 0
        for (const input of recipe.inputs) {
          need += input.qty
          have += Math.min(building.inputs[input.mat] ?? 0, input.qty)
        }
        drawHBar(
          g,
          building.pos.x - half,
          building.pos.y + half + 5,
          size,
          2.6,
          need > 0 ? have / need : 0,
          MATERIAL_RGB[recipe.inputs[0].mat],
        )
      }

      if (recipe.output) {
        const amount = building.output[recipe.output.mat] ?? 0
        drawVBar(
          g,
          building.pos.x + half + 4,
          building.pos.y - half,
          2.6,
          size,
          amount / def.buffer,
          MATERIAL_RGB[recipe.output.mat],
        )
      }
    }
  }
}

export function drawBuildings(
  g: CanvasRenderingContext2D,
  world: World,
  now: number,
) {
  for (const building of world.buildings) drawBuilding(g, building, now)
}

function drawVehicle(g: CanvasRenderingContext2D, vehicle: Vehicle) {
  const isBuilder = vehicle.role === 'builder'
  const def = VEHICLES[clamp(vehicle.tier, 1, VEHICLES.length) - 1]
  const rgb = isBuilder ? ([240, 220, 150] as [number, number, number]) : def.rgb
  const size = isBuilder ? 8 : def.size
  const bodyLen = size * 1.5
  const bodyWid = size * 0.9

  g.save()
  g.translate(vehicle.pos.x, vehicle.pos.y)
  g.rotate(vehicle.angle)
  roundRect(g, -bodyLen / 2, -bodyWid / 2, bodyLen, bodyWid, bodyWid * 0.32)
  g.fillStyle = 'rgba(8, 10, 18, 0.9)'
  g.fill()
  g.strokeStyle = isBuilder ? rgba(rgb, 0.9) : rgba(rgb, 0.8)
  g.lineWidth = 1
  if (isBuilder) g.setLineDash([2, 2])
  g.stroke()
  g.setLineDash([])

  if (isBuilder) {
    g.beginPath()
    g.moveTo(-bodyLen * 0.25, -bodyWid * 0.4)
    g.lineTo(bodyLen * 0.25, 0)
    g.lineTo(-bodyLen * 0.25, bodyWid * 0.4)
    g.closePath()
    g.fillStyle = rgba(rgb, 0.8)
    g.fill()
  } else {
    const slots = def.capacity
    const cargo = vehicle.cargo.reduce((n, item) => n + item.qty, 0)
    const cargoMat = vehicle.cargo[0]?.mat ?? 0
    const slotW = Math.min(2.6, (bodyLen - 4) / slots)
    const startX = -bodyLen / 2 + 1.6
    for (let i = 0; i < slots; i++) {
      const filled = i < cargo
      g.fillStyle = filled ? rgba(MATERIAL_RGB[cargoMat], 0.95) : rgba(rgb, 0.2)
      g.fillRect(startX + i * (slotW + 0.6), -bodyWid / 2 + 1.4, slotW, bodyWid - 2.8)
    }
  }
  g.restore()
}

export function drawVehicles(g: CanvasRenderingContext2D, world: World) {
  for (const vehicle of world.vehicles) drawVehicle(g, vehicle)
}

export function drawPulses(g: CanvasRenderingContext2D, pulses: Pulse[]) {
  for (const pulse of pulses) {
    const k = pulse.t / 1050
    if (k < 0 || k > 1) continue
    g.beginPath()
    g.arc(pulse.x, pulse.y, pulse.r + k * pulse.max, 0, Math.PI * 2)
    g.strokeStyle = rgba(pulse.rgb, (1 - k) ** 1.7 * 0.5 * pulse.width)
    g.lineWidth = pulse.width
    g.stroke()
  }
}

export function drawParticles(g: CanvasRenderingContext2D, particles: Particle[]) {
  for (const particle of particles) {
    const k = particle.life / particle.max
    g.fillStyle = rgba(particle.rgb, (1 - k) * 0.9)
    g.fillRect(particle.x, particle.y, particle.size, particle.size)
  }
}

export function drawAmbient(g: CanvasRenderingContext2D, particles: Ambient[]) {
  g.lineCap = 'round'
  for (const particle of particles) {
    const trail = particle.trail
    const len = trail.length / 2
    if (len < 3) continue
    const headX = trail[trail.length - 2]
    const headY = trail[trail.length - 1]
    const tailX = trail[0]
    const tailY = trail[1]
    const fadeIn = Math.min(1, particle.life / 140)
    const alpha = 0.3 * particle.brightness * fadeIn
    if (alpha <= 0.01) continue
    const gradient = g.createLinearGradient(tailX, tailY, headX, headY)
    gradient.addColorStop(0, 'rgba(122, 162, 255, 0)')
    gradient.addColorStop(0.6, `rgba(122, 162, 255, ${alpha * 0.3})`)
    gradient.addColorStop(1, `rgba(198, 218, 255, ${alpha})`)
    g.beginPath()
    g.moveTo(tailX, tailY)
    for (let i = 1; i < len - 1; i++) {
      const x = trail[i * 2]
      const y = trail[i * 2 + 1]
      const nx = trail[(i + 1) * 2]
      const ny = trail[(i + 1) * 2 + 1]
      g.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2)
    }
    g.lineTo(headX, headY)
    g.strokeStyle = gradient
    g.lineWidth = 1.1
    g.stroke()
  }
}

export function drawDissolve(g: CanvasRenderingContext2D, alpha: number) {
  g.fillStyle = `rgba(4, 5, 10, ${alpha})`
  g.fillRect(0, 0, g.canvas.width, g.canvas.height)
}
