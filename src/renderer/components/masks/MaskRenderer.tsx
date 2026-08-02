/**
 * MaskOverlay — checkerboard transparency visualization for masks.
 *
 * Rendered as a sibling overlay (never inside `[data-scene-export]`), in scene
 * coordinates, on top of the scene. It shows, per masked element, the classic
 * transparency checkerboard (dark + blue squares) exactly where the element is
 * masked out, so the user immediately sees "here is transparent, here is
 * content". While a mask stroke is in flight it additionally renders a focus
 * scrim (everything but the target dimmed), a live checkerboard preview of the
 * stroke, and a mode badge.
 *
 * The checkerboard is transient editor chrome: the export engine clones only
 * the scene node and the overlay is its sibling, so it can never appear in
 * exports. Mask geometry lives in the target's local frame and rotates with
 * the element; each element's visuals render inside a rotation-matched wrapper.
 */

import { MaskPreviewState } from '../../runtime/runtimeSlice'
import { buildSceneDimPunch, MaskVisual, MaskVisualItem, previewToMaskVisual } from '../../services/mask-visualization'

/** Black square of the transparency checkerboard. */
export const CHECKER_DARK = '#000000'
/** Blue square of the transparency checkerboard (Windows-Photos style). */
export const CHECKER_BLUE = '#2563eb'
/** Edge length of one checkerboard cell in scene units. */
export const CHECKER_SIZE = 64

const CHECKER_IMAGE = `repeating-conic-gradient(${CHECKER_DARK} 0% 25%, ${CHECKER_BLUE} 0% 50%)`
const CHECKER_BG: React.CSSProperties = {
  backgroundImage: CHECKER_IMAGE,
  // The conic gradient encodes a 2x2 checkerboard per tile, so the tile is
  // twice the cell edge to keep each square exactly CHECKER_SIZE wide/tall.
  backgroundSize: `${CHECKER_SIZE * 2}px ${CHECKER_SIZE * 2}px`
}

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
      data-mask-element-id={visual.elementId}
      style={{
        position: 'absolute',
        left: visual.origin.x,
        top: visual.origin.y,
        width: visual.width,
        height: visual.height,
        ...rotateStyle(visual.rotation, visual.width, visual.height)
      }}
    >
      {visual.items.map((item) => (
        <div
          key={item.maskId}
          data-mask-checkerboard
          data-mask-checker-for={item.maskId}
          style={{ position: 'absolute', inset: 0, clipPath: item.hiddenClipPath, ...CHECKER_BG, opacity: editing ? 1 : 0.85 }}
        />
      ))}
      {editing &&
        visual.items.map((item) => (
          <div
            key={item.maskId}
            data-mask-visible-highlight
            data-mask-highlight-for={item.maskId}
            style={{
              position: 'absolute',
              inset: 0,
              clipPath: item.visibleClipPath,
              background: 'rgba(59, 130, 246, 0.16)',
              boxShadow: item.inverted ? 'inset 0 0 0 1px rgba(245, 158, 11, 0.8)' : 'inset 0 0 0 1px rgba(59, 130, 246, 0.8)'
            }}
          />
        ))}
      <svg width={visual.width} height={visual.height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {visual.items.map((item) => (
          <MaskOutline key={item.maskId} item={item} emphasized={editing} />
        ))}
      </svg>
    </div>
  )
}

function MaskPreviewVisual({ preview }: { preview: MaskPreviewState }) {
  const visual = previewToMaskVisual(preview)
  if (!visual) return null
  const item = visual.items[0]
  return (
    <div
      data-mask-preview
      data-mask-preview-target={preview.targetId}
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
        <div data-mask-preview-checkerboard style={{ position: 'absolute', inset: 0, clipPath: item.hiddenClipPath, ...CHECKER_BG }} />
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
 * Overlay layer drawing the transparency checkerboard for every committed
 * mask, plus the live mask preview + focus scrim + mode badge while a stroke
 * is in flight. Rendered in scene coordinates inside the transformed canvas
 * space; never part of the export node.
 */
export function MaskOverlay({ width, height, visuals, preview }: MaskOverlayProps) {
  const target = preview?.element ?? null
  return (
    <div data-mask-overlay className="absolute inset-0" style={{ pointerEvents: 'none' }}>
      {target && (
        <div
          data-mask-edit-dim
          data-mask-edit-target={preview!.targetId}
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: buildSceneDimPunch(width, height, target.x, target.y, target.width, target.height, target.rotation) ?? undefined,
            background: 'rgba(9, 9, 11, 0.35)'
          }}
        />
      )}
      {visuals.map((visual) => (
        <MaskElementVisual key={visual.elementId} visual={visual} editing={preview?.targetId === visual.elementId} />
      ))}
      {preview && <MaskPreviewVisual preview={preview} />}
      {target && (
        <div
          data-mask-edit-badge
          data-mask-edit-target={preview!.targetId}
          style={{
            position: 'absolute',
            left: target.x,
            top: Math.max(4, target.y - 26),
            padding: '2px 8px',
            borderRadius: 999,
            background: 'rgba(15, 15, 20, 0.92)',
            border: '1px solid rgba(99, 102, 241, 0.5)',
            color: '#c7d2fe',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.2,
            whiteSpace: 'nowrap'
          }}
        >
          {preview!.inverted ? 'Hide mask' : 'Unmask'}
        </div>
      )}
    </div>
  )
}
