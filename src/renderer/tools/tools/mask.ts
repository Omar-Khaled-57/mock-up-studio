import { Tool, InteractionContext } from '../types'
import { ellipseRing, rectRing, resolveUnmaskCommit } from '../../services/mask-diff'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'
import { safeScene } from '../../store/sceneSlice'
import { nextMaskZIndex } from '../../store/maskSlice'
import { RuntimeSlice } from '../../runtime/runtimeSlice'
import { generateId } from '../../lib/id'
import { boundsOf, buildMaskStrokePolygon } from '../../services/mask-brush'

/**
 * Pending mask stroke — geometry is SCENE-space (canvas coordinates) for every
 * shape, so the commit path needs no element targeting or local-frame mapping.
 */
interface PendingMask {
  pointerId: number
  shape: 'rectangle' | 'ellipse' | 'brush'
  /** 'mask' mode commits an inverted (punch) mask. */
  inverted: boolean
  anchor: { x: number; y: number }
  last: { x: number; y: number }
  /** Scene-space polyline for brush strokes. */
  points: { x: number; y: number }[]
  /** Brush radius in scene units (brush strokes only). */
  radius: number
}

let pendingMask: PendingMask | null = null

const MIN_DRAG_DISTANCE_SQ = 9
const BRUSH_MIN_DISTANCE_SQ = 2.25

function pushPreview(rt: RuntimeSlice, pm: PendingMask): void {
  rt.setMaskPreview({
    shape: pm.shape,
    points: pm.shape === 'brush' ? pm.points : [pm.anchor, pm.last],
    inverted: pm.inverted,
    radius: pm.shape === 'brush' ? pm.radius : undefined
  })
}

/**
 * Commits a mask-mode (inverted) stroke as a LIVE mask: pushes a single history
 * entry and adds the mask with no snapshot, so the masked region renders the
 * transparency checkerboard and the mask stays visible right after the stroke.
 *
 * A mask is frozen (embedding a whole-scene capture) only via the explicit
 * MasksPanel Refresh action (`refreshMaskSnapshot`). Auto-capturing at creation
 * was reverted: a snapshot taken at creation time captures the same canvas the
 * user is looking at, so the frozen pixels are pixel-identical to the live scene
 * and the freshly-drawn mask is invisible — exactly the reported "the mask
 * disappears on mouse release" regression.
 */
function commitLiveMask(pm: PendingMask, rect: { x: number; y: number; width: number; height: number }): void {
  const state = useStore.getState()
  const scene = safeScene(state)
  state.pushHistory('Add mask')
  const base = {
    name: `Mask ${scene.masks.length + 1}`,
    zIndex: nextMaskZIndex(scene),
    visible: true,
    locked: false
  }
  if (pm.shape === 'brush') {
    // The brush mask is stored as the closed capsule polygon (round caps +
    // joins), NOT the raw polyline — `maskOuterRing`/`mask-diff` consume the
    // ring directly, so committing the raw centre-line would render a zero-width
    // stroke. Same builder the live preview uses, so what you see is what commits.
    const polygon = buildMaskStrokePolygon(pm.points, pm.radius)
    const box = boundsOf(polygon)
    state.addMask({
      id: generateId(),
      ...base,
      inverted: true,
      shape: 'brush' as const,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      points: polygon
    })
  } else {
    state.addMask({
      id: generateId(),
      ...base,
      shape: pm.shape,
      points: [],
      inverted: true,
      ...rect
    })
  }
}

export const maskTool: Tool = {
  id: 'mask',
  group: 'mask',
  label: 'Mask Tool',
  icon: 'mask',
  cursor: 'crosshair',
  shortcut: 'g',
  options: true,

  onPointerDown(ctx: InteractionContext, e: PointerEvent) {
    if (e.button !== 0) return
    const rt = ctx.getRuntime()
    if (!ctx.claimPointer(e.pointerId)) return

    pendingMask = {
      pointerId: e.pointerId,
      shape: rt.maskShape,
      // 'mask' mode cuts the DRAWN region out of the canvas (the shape becomes
      // transparent); 'unmask' mode keeps the drawn region and hides the rest.
      inverted: rt.maskMode === 'mask',
      anchor: { x: ctx.scenePoint.x, y: ctx.scenePoint.y },
      last: { x: ctx.scenePoint.x, y: ctx.scenePoint.y },
      points: [{ x: ctx.scenePoint.x, y: ctx.scenePoint.y }],
      radius: rt.brush.size / 2
    }

    rt.beginInteraction({ toolId: 'mask', pointerId: e.pointerId, kind: 'mask', startedAt: Date.now() })
    pushPreview(rt, pendingMask)
  },

  onPointerMove(ctx: InteractionContext, e: PointerEvent) {
    const pm = pendingMask
    if (!pm || pm.pointerId !== e.pointerId) return
    pm.last = { x: ctx.scenePoint.x, y: ctx.scenePoint.y }
    if (pm.shape === 'brush') {
      const prev = pm.points[pm.points.length - 1]
      const dx = ctx.scenePoint.x - prev.x
      const dy = ctx.scenePoint.y - prev.y
      if (dx * dx + dy * dy >= BRUSH_MIN_DISTANCE_SQ) {
        pm.points.push({ x: ctx.scenePoint.x, y: ctx.scenePoint.y })
      }
    }
    pushPreview(ctx.getRuntime(), pm)
  },

  onPointerUp(ctx: InteractionContext, e: PointerEvent) {
    const pm = pendingMask
    if (!pm || pm.pointerId !== e.pointerId) return
    pendingMask = null

    // The pointer-up point is authoritative even when no move was delivered.
    pm.last = { x: ctx.scenePoint.x, y: ctx.scenePoint.y }
    // Cap the brush polyline at the release point so the stroke reaches the
    // cursor even when the final move was more than the sample distance away.
    if (pm.shape === 'brush') {
      const prev = pm.points[pm.points.length - 1]
      const dx = pm.last.x - prev.x
      const dy = pm.last.y - prev.y
      if (dx * dx + dy * dy >= BRUSH_MIN_DISTANCE_SQ) {
        pm.points.push({ x: pm.last.x, y: pm.last.y })
      }
    }

    const rt = ctx.getRuntime()
    rt.endInteraction()
    rt.setMaskPreview(null)

    if (pm.shape !== 'brush') {
      const dx = pm.last.x - pm.anchor.x
      const dy = pm.last.y - pm.anchor.y
      if (dx * dx + dy * dy < MIN_DRAG_DISTANCE_SQ) return
    }

    const rect = {
      x: Math.min(pm.anchor.x, pm.last.x),
      y: Math.min(pm.anchor.y, pm.last.y),
      width: Math.abs(pm.last.x - pm.anchor.x),
      height: Math.abs(pm.last.y - pm.anchor.y)
    }
    const stroke =
      pm.shape === 'brush'
        ? buildMaskStrokePolygon(pm.points, pm.radius)
        : pm.shape === 'ellipse'
          ? ellipseRing(rect.x, rect.y, rect.width, rect.height)
          : rectRing(rect.x, rect.y, rect.width, rect.height)

    if (pm.inverted) {
      // Mask mode: the drawn region becomes transparent. Additive — every
      // stroke adds a fresh mask and never removes a previous one (masks
      // compose by intersection, so strokes stack). Committed LIVE so the
      // checkerboard stays visible; Refresh freezes the current canvas into
      // the mask (`refreshMaskSnapshot`).
      commitLiveMask(pm, rect)
    } else {
      // Unmask mode: the drawn region is restored. Subtractive — carve the
      // stroke out of every scene mask whose hidden region it touches. A
      // no-op stroke (nothing masked under the stroke) changes nothing and
      // pushes no history entry, so unmask never masks anything by itself.
      const scene = safeScene(useStore.getState())
      const commit = resolveUnmaskCommit(scene.masks, stroke, scene.canvas.width, scene.canvas.height)
      if (commit) {
        const state = useStore.getState()
        state.pushHistory('Unmask')
        state.replaceMasks(commit)
      }
    }
  },

  onPointerCancel(ctx: InteractionContext, e: PointerEvent) {
    const pm = pendingMask
    if (!pm || pm.pointerId !== e.pointerId) return
    pendingMask = null
    const rt = ctx.getRuntime()
    rt.endInteraction()
    rt.setMaskPreview(null)
  },

  onInterrupt() {
    if (!pendingMask) return
    pendingMask = null
    const rt = useRuntimeStore.getState()
    rt.endInteraction()
    rt.setMaskPreview(null)
  }
}
