/**
 * MaskRenderer — mask clip-path builder + mask overlay rendering (M13).
 *
 * The clip is a CSS `clip-path` applied on the target's own positioned box so
 * it lives in the element's local coordinate frame and rotates with it
 * (architecture §10.2). `ElementFacade` applies it; the `MaskOverlay` draws
 * editable outlines + control points and the live tool preview in scene
 * coordinates (a sibling overlay, never part of `[data-scene-export]`).
 *
 * Inversion ("punch") uses evenodd clip-path compositing: the full element
 * bounds as the outer contour plus the mask shape as a hole (architecture
 * §10.2 "punch → inverse via clip-path compositing"). Ellipse holes are
 * approximated as a 32-point polygon.
 */

import { Scene } from '@shared/types'
import type { Mask, MaskPoint, MaskShape } from '@shared/types'
import type { MaskPreviewState } from '../../runtime/runtimeSlice'

export interface MaskOutlineItem {
  maskId: string
  targetId: string
  shape: MaskShape
  inverted: boolean
  /** Scene-space center of the target element (rotation pivot). */
  center: { x: number; y: number }
  /** Target element rotation in degrees. */
  rotation: number
  /** Scene-space origin of the target element box. */
  origin: { x: number; y: number }
  /** Mask bounding box in element-local coordinates. */
  rect: { x: number; y: number; width: number; height: number }
  /** Brush (freehand) polygon in element-local coordinates (null for rect/ellipse). */
  points: MaskPoint[] | null
}

function fmt(v: number): string {
  return `${Math.round(v * 100) / 100}px`
}

function invertedOuter(width: number, height: number): string {
  return `0px 0px, ${fmt(width)} 0px, ${fmt(width)} ${fmt(height)}, 0px ${fmt(height)}`
}

function ellipsePolygonPoints(mask: Mask, count: number): string {
  const cx = mask.x + mask.width / 2
  const cy = mask.y + mask.height / 2
  const rx = mask.width / 2
  const ry = mask.height / 2
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2
    parts.push(`${fmt(cx + rx * Math.cos(t))} ${fmt(cy + ry * Math.sin(t))}`)
  }
  return parts.join(', ')
}

/**
 * Builds the CSS `clip-path` value for a mask in a target box of the given
 * local dimensions. Null is never returned for a well-formed mask.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function buildMaskClipPath(mask: Mask, width: number, height: number): string {
  if (mask.shape === 'rectangle') {
    if (mask.inverted) {
      const inner = `${fmt(mask.x)} ${fmt(mask.y)}, ${fmt(mask.x + mask.width)} ${fmt(mask.y)}, ${fmt(mask.x + mask.width)} ${fmt(mask.y + mask.height)}, ${fmt(mask.x)} ${fmt(mask.y + mask.height)}`
      return `polygon(${invertedOuter(width, height)}, ${inner}, evenodd)`
    }
    const right = width - mask.x - mask.width
    const bottom = height - mask.y - mask.height
    return `inset(${fmt(mask.y)} ${fmt(right)} ${fmt(bottom)} ${fmt(mask.x)})`
  }
  if (mask.shape === 'ellipse') {
    if (mask.inverted) {
      return `polygon(${invertedOuter(width, height)}, ${ellipsePolygonPoints(mask, 32)}, evenodd)`
    }
    const cx = mask.x + mask.width / 2
    const cy = mask.y + mask.height / 2
    return `ellipse(${fmt(mask.width / 2)} ${fmt(mask.height / 2)} at ${fmt(cx)} ${fmt(cy)})`
  }
  const points = mask.points.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(', ')
  if (mask.inverted) {
    return `polygon(${invertedOuter(width, height)}, ${points}, evenodd)`
  }
  return `polygon(${points})`
}

interface MaskTarget {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  visible: boolean
}

function findMaskTarget(scene: Scene, id: string): MaskTarget | null {
  const d = scene.devices.find((x) => x.id === id)
  if (d) return { id: d.id, x: d.x, y: d.y, width: d.width, height: d.height, rotation: d.rotation ?? 0, visible: d.visible }
  const t = scene.textBoxes.find((x) => x.id === id)
  if (t) return { id: t.id, x: t.x, y: t.y, width: t.width, height: t.height, rotation: 0, visible: t.visible }
  const i = scene.images.find((x) => x.id === id)
  if (i) return { id: i.id, x: i.x, y: i.y, width: i.width, height: i.height, rotation: i.rotation ?? 0, visible: i.visible }
  const s = scene.shapes.find((x) => x.id === id)
  if (s) return { id: s.id, x: s.x, y: s.y, width: s.width, height: s.height, rotation: s.rotation ?? 0, visible: s.visible }
  return null
}

/** Resolves every visible-target mask to a scene-space outline for the overlay renderer. */
// eslint-disable-next-line react-refresh/only-export-components
export function collectMaskOutlines(scene: Scene): MaskOutlineItem[] {
  const items: MaskOutlineItem[] = []
  for (const mask of scene.masks) {
    const el = findMaskTarget(scene, mask.targetId)
    if (!el || !el.visible) continue
    items.push({
      maskId: mask.id,
      targetId: mask.targetId,
      shape: mask.shape,
      inverted: mask.inverted,
      center: { x: el.x + el.width / 2, y: el.y + el.height / 2 },
      rotation: el.rotation,
      origin: { x: el.x, y: el.y },
      rect: { x: mask.x, y: mask.y, width: mask.width, height: mask.height },
      points: mask.shape === 'brush' ? mask.points : null
    })
  }
  return items
}

function localCorners(rect: { x: number; y: number; width: number; height: number }): MaskPoint[] {
  const { x, y, width, height } = rect
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ]
}

const OUTLINE_STROKE = '#8b5cf6'
const INVERTED_STROKE = '#f59e0b'

function PreviewShape({ preview }: { preview: MaskPreviewState }) {
  if (preview.shape === 'brush') {
    if (preview.points.length < 2) return null
    return (
      <polyline
        points={preview.points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={OUTLINE_STROKE}
        strokeWidth={1}
        strokeDasharray="4 3"
      />
    )
  }
  const a = preview.points[0]
  const b = preview.points[1]
  if (!a || !b) return null
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const w = Math.abs(b.x - a.x)
  const h = Math.abs(b.y - a.y)
  const common = {
    fill: 'rgba(139, 92, 246, 0.15)',
    stroke: OUTLINE_STROKE,
    strokeWidth: 1,
    strokeDasharray: '4 3'
  } as const
  if (preview.shape === 'ellipse') {
    return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} />
  }
  return <rect x={x} y={y} width={w} height={h} {...common} />
}

export interface MaskOverlayProps {
  width: number
  height: number
  outlines: MaskOutlineItem[]
  preview: MaskPreviewState | null
}

/**
 * Overlay layer drawing every committed mask outline (+ control points) and
 * the live mask being drawn. Rendered in scene coordinates inside the
 * transformed canvas space; never part of the export node.
 */
export function MaskOverlay({ width, height, outlines, preview }: MaskOverlayProps) {
  return (
    <div data-mask-overlay className="absolute inset-0" style={{ pointerEvents: 'none' }}>
      <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {outlines.map((item) => {
          const stroke = item.inverted ? INVERTED_STROKE : OUTLINE_STROKE
          return (
            <g key={item.maskId} transform={`rotate(${item.rotation} ${item.center.x} ${item.center.y})`}>
              {item.shape === 'brush' && item.points ? (
                <>
                  <polygon
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    points={item.points.map((p) => `${item.origin.x + p.x},${item.origin.y + p.y}`).join(' ')}
                  />
                  {item.points.map((p, i) => (
                    <circle
                      key={i}
                      cx={item.origin.x + p.x}
                      cy={item.origin.y + p.y}
                      r={2.5}
                      fill="#ffffff"
                      stroke={stroke}
                      strokeWidth={1}
                    />
                  ))}
                </>
              ) : (
                <>
                  {item.shape === 'ellipse' ? (
                    <ellipse
                      cx={item.origin.x + item.rect.x + item.rect.width / 2}
                      cy={item.origin.y + item.rect.y + item.rect.height / 2}
                      rx={item.rect.width / 2}
                      ry={item.rect.height / 2}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                    />
                  ) : (
                    <rect
                      x={item.origin.x + item.rect.x}
                      y={item.origin.y + item.rect.y}
                      width={item.rect.width}
                      height={item.rect.height}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                    />
                  )}
                  {localCorners(item.rect).map((p, i) => (
                    <circle
                      key={i}
                      cx={item.origin.x + p.x}
                      cy={item.origin.y + p.y}
                      r={2.5}
                      fill="#ffffff"
                      stroke={stroke}
                      strokeWidth={1}
                    />
                  ))}
                </>
              )}
            </g>
          )
        })}
        {preview && <PreviewShape preview={preview} />}
      </svg>
    </div>
  )
}
