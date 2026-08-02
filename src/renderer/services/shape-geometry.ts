/**
 * shape-geometry — pure SVG path geometry for the shape kinds.
 *
 * Extracted from ShapeRenderer so render-time container clipping can reuse the
 * exact shape outlines without a component dependency. `getShapePath` returns
 * an SVG path string in the shape's local coordinate frame (0..w / 0..h).
 */

import { ShapeKind } from '@shared/types'

export function getShapePath(
  kind: ShapeKind,
  w: number,
  h: number,
  cornerRadius: number,
  angles?: [number, number, number],
  thickness?: number
): string {
  switch (kind) {
    case 'rectangle': {
      if (cornerRadius <= 0) return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`
      const r = Math.min(cornerRadius, w / 2, h / 2)
      return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`
    }
    case 'circle': {
      const r = Math.min(w, h) / 2
      const cx = w / 2
      const cy = h / 2
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
    }
    case 'ellipse': {
      const rx = w / 2
      const ry = h / 2
      const cx = w / 2
      const cy = h / 2
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy} Z`
    }
    case 'triangle': {
      const [A, B] = angles || [60, 60]
      const C = 180 - A - B
      if (C <= 1 || C >= 179) return `M 0 ${h} L ${w} ${h} L ${w / 2} ${h * 0.1} Z`
      const aR = A * Math.PI / 180, bR = B * Math.PI / 180, cR = C * Math.PI / 180
      const b = w * Math.sin(bR) / Math.sin(cR)
      const x3 = Math.round(b * Math.cos(aR))
      const y3 = Math.round(h - b * Math.sin(aR))
      const cx = Math.max(0, Math.min(w, x3))
      const cy = Math.max(0, Math.min(h * 0.95, y3))
      return `M 0 ${h} L ${w} ${h} L ${cx} ${cy} Z`
    }
    case 'star': {
      const cx = w / 2
      const cy = h / 2
      const outerR = Math.min(w, h) / 2
      const innerR = outerR * 0.4
      const pts: string[] = []
      for (let i = 0; i < 5; i++) {
        const outerAngle = (i * 72 - 90) * (Math.PI / 180)
        const innerAngle = ((i * 72 + 36) - 90) * (Math.PI / 180)
        pts.push(`${cx + outerR * Math.cos(outerAngle)},${cy + outerR * Math.sin(outerAngle)}`)
        pts.push(`${cx + innerR * Math.cos(innerAngle)},${cy + innerR * Math.sin(innerAngle)}`)
      }
      return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`
    }
    case 'hexagon':
      return `M ${w * 0.25} 0 L ${w * 0.75} 0 L ${w} ${h * 0.5} L ${w * 0.75} ${h} L ${w * 0.25} ${h} L 0 ${h * 0.5} Z`
    case 'diamond':
      return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`
    case 'parallelogram':
      return `M ${w * 0.25} 0 L ${w} 0 L ${w * 0.75} ${h} L 0 ${h} Z`
    case 'trapezoid':
      return `M ${w * 0.2} 0 L ${w * 0.8} 0 L ${w} ${h} L 0 ${h} Z`
    case 'cross':
      return ''
    case 'plus': {
      const t = (thickness ?? 0.3) * Math.min(w, h)
      const cw = w / 2, ch = h / 2, ht = t / 2
      return `M ${cw - ht} 0 L ${cw + ht} 0 L ${cw + ht} ${ch - ht} L ${w} ${ch - ht} L ${w} ${ch + ht} L ${cw + ht} ${ch + ht} L ${cw + ht} ${h} L ${cw - ht} ${h} L ${cw - ht} ${ch + ht} L 0 ${ch + ht} L 0 ${ch - ht} L ${cw - ht} ${ch - ht} Z`
    }
    case 'heart': {
      const cx = w / 2
      const tipY = h * 0.9
      return `M ${cx} ${tipY} C ${cx * 1.5} ${h * 0.55}, ${w} ${h * 0.4}, ${w} ${h * 0.3} C ${w} ${h * 0.1}, ${cx * 1.2} ${h * 0.05}, ${cx} ${h * 0.2} C ${cx * 0.8} ${h * 0.05}, 0 ${h * 0.1}, 0 ${h * 0.3} C 0 ${h * 0.4}, ${cx * 0.5} ${h * 0.55}, ${cx} ${tipY} Z`
    }
    case 'arrow-right': {
      const t = (thickness ?? 0.5) * h
      const halfT = t * 0.5, cy = h / 2, sx = w * 0.6
      return `M 0 ${cy - halfT} L ${sx} ${cy - halfT} L ${sx} ${cy - t} L ${w} ${cy} L ${sx} ${cy + t} L ${sx} ${cy + halfT} L 0 ${cy + halfT} Z`
    }
    default:
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`
  }
}
