/**
 * MaskOverlay — scene-layer mask visualization.
 *
 * Rendered as a sibling overlay (never inside `[data-scene-export]`), in scene
 * coordinates, on top of the scene. Masks are Z-AWARE scene layers: a mask
 * preserves everything strictly below its z-index and punches out content at
 * or above it — so a masked region shows the preserved content beneath it,
 * never transparency. Committed masks therefore render as a dashed OUTLINE
 * plus a faint 50%-opacity checkerboard over the masked-out region: purely a
 * visual affordance so a committed mask still reads as a cutout (the preserved
 * content shows through it), never exported.
 *
 * While a mask stroke is in flight the overlay renders a live preview of the
 * stroke: a checkerboard over the region that will be punched out plus a
 * "restore" highlight, so the user sees exactly what the commit will do.
 *
 * The overlay is transient editor chrome: the export engine clones only the
 * scene node and the overlay is its sibling, so it can never appear in
 * exports. Masks are independent scene layers with scene-space geometry
 * (origin = mask x/y, no rotation), so each mask's visuals render at its own
 * box — the overlay aligns with the canvas exactly like the mask clip layers.
 */

import { MaskPreviewState } from '../../runtime/runtimeSlice'
import { MaskVisual, MaskVisualItem, previewToMaskVisual } from '../../services/mask-visualization'
import { CHECKER_BG, CHECKER_DARK, CHECKER_BLUE, CHECKER_SIZE } from '../shared/Checkerboard'

// Legacy re-exports — the checkerboard tokens live in the shared Checkerboard
// module so the transparent-canvas scene layer reuses the exact same pattern.
export { CHECKER_DARK, CHECKER_BLUE, CHECKER_SIZE }

const OUTLINE = '#6366f1'
const INVERTED_OUTLINE = '#f59e0b'

function localCorners(rect: { x: number; y: number; width: number; height: number }): { x: number; y: number }[] {
  const { x, y, width, height } = rect
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ]
}

function MaskOutline({ item, emphasized }: { item: MaskVisualItem; emphasized: boolean }) {
  const stroke = item.inverted ? INVERTED_OUTLINE : OUTLINE
  const strokeWidth = emphasized ? 1.5 : 1
  const dash = emphasized ? '6 3' : '4 3'
  const controls = emphasized ? 3 : 2
  if (item.shape === 'brush' && item.points && item.points.length >= 2) {
    return (
      <g>
        <polygon
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          points={item.points.map((p) => `${p.x},${p.y}`).join(' ')}
        />
        {item.holes?.map((h, i) => (
          <polygon
            key={i}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
            points={h.map((p) => `${p.x},${p.y}`).join(' ')}
          />
        ))}
      </g>
    )
  }
  if (item.shape === 'ellipse') {
    return (
      <g>
        <ellipse
          cx={item.rect.x + item.rect.width / 2}
          cy={item.rect.y + item.rect.height / 2}
          rx={item.rect.width / 2}
          ry={item.rect.height / 2}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
        />
        {localCorners(item.rect).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={controls} fill="#0f0f14" stroke={stroke} strokeWidth={1} />
        ))}
      </g>
    )
  }
  return (
    <g>
      <rect
        x={item.rect.x}
        y={item.rect.y}
        width={item.rect.width}
        height={item.rect.height}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
      />
      {localCorners(item.rect).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={controls} fill="#0f0f14" stroke={stroke} strokeWidth={1} />
      ))}
    </g>
  )
}

function rotateStyle(rotation: number, width: number, height: number): React.CSSProperties {
  return rotation
    ? { transform: `rotate(${rotation}deg)`, transformOrigin: `${width / 2}px ${height / 2}px` }
    : {}
}

function MaskElementVisual({ visual, editing }: { visual: MaskVisual; editing: boolean }) {
  return (
    <div
      data-mask-visual
      data-mask-for={visual.maskId}
      style={{
        position: 'absolute',
        left: visual.origin.x,
        top: visual.origin.y,
        width: visual.width,
        height: visual.height,
        ...rotateStyle(visual.rotation, visual.width, visual.height)
      }}
    >
      {/* Committed masks keep a faint checkerboard over their masked-out region
          at 50% opacity (visual only) so a committed mask still reads as a
          transparency cutout; the preserved content shows through it. */}
      {visual.items.map((item) => (
        <div key={item.maskId} data-mask-checkerboard style={{ position: 'absolute', inset: 0, clipPath: item.hiddenClipPath, ...CHECKER_BG, opacity: 0.5 }} />
      ))}
      <svg width={visual.width} height={visual.height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {visual.items.map((item) => (
          <MaskOutline key={item.maskId} item={item} emphasized={editing} />
        ))}
      </svg>
    </div>
  )
}

function MaskPreviewVisual({ preview, canvasWidth, canvasHeight }: { preview: MaskPreviewState; canvasWidth: number; canvasHeight: number }) {
  const visual = previewToMaskVisual(preview, canvasWidth, canvasHeight)
  if (!visual) return null
  const item = visual.items[0]
  return (
    <div
      data-mask-preview
      style={{
        position: 'absolute',
        left: visual.origin.x,
        top: visual.origin.y,
        width: visual.width,
        height: visual.height,
        ...rotateStyle(visual.rotation, visual.width, visual.height)
      }}
    >
      {/* Mask strokes show a checkerboard preview of the region that will
          become transparent. Unmask strokes are subtractive — nothing is being
          masked — so they render as a "restore" highlight over the stroke
          instead of a checkerboard. */}
      {preview.inverted && (
        <div data-mask-preview-checkerboard style={{ position: 'absolute', inset: 0, clipPath: item.hiddenClipPath, ...CHECKER_BG, opacity: 0.7 }} />
      )}
      <div
        data-mask-preview-highlight
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: item.visibleClipPath,
          background: preview.inverted ? 'rgba(59, 130, 246, 0.18)' : 'rgba(52, 211, 153, 0.22)'
        }}
      />
      <svg width={visual.width} height={visual.height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <MaskOutline item={item} emphasized />
      </svg>
    </div>
  )
}

export interface MaskOverlayProps {
  width: number
  height: number
  visuals: MaskVisual[]
  preview: MaskPreviewState | null
}

/**
 * Overlay layer drawing the transparency checkerboard for every visible mask,
 * plus the live mask preview while a stroke is in flight. Rendered in scene
 * coordinates inside the transformed canvas space; never part of the export
 * node.
 */
export function MaskOverlay({ width, height, visuals, preview }: MaskOverlayProps) {
  return (
    <div data-mask-overlay className="absolute inset-0" style={{ pointerEvents: 'none' }}>
      {visuals.map((visual) => (
        <MaskElementVisual key={visual.maskId} visual={visual} editing={preview != null} />
      ))}
      {preview && <MaskPreviewVisual preview={preview} canvasWidth={width} canvasHeight={height} />}
    </div>
  )
}
