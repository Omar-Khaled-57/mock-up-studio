import { Tool, InteractionContext } from '../types'
import { Scene } from '@shared/types'
import { getCapabilities } from '../../services/capabilities'
import { isInFocusScope } from '../../services/focus'
import { ElementGeometry, resolveElementGeometry, toLocalPoint } from '../../services/bitmap-targets'
import { boundsOf, buildMaskStrokePolygon } from '../../services/mask-brush'
import { ellipseRing, rectRing, resolveUnmaskCommit } from '../../services/mask-diff'
import { BACKGROUND_MASK_TARGET_ID } from '../../services/mask-visualization'
import { HitTestResult } from '../../services/hit-test'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'
import { safeScene } from '../../store/sceneSlice'
import { RuntimeSlice } from '../../runtime/runtimeSlice'
import { generateId } from '../../lib/id'

const ZERO_ORIGIN = { originX: 0, originY: 0 }

/**
 * Element geometry for masking — extends `resolveElementGeometry` so text
 * boxes (maskable, but not bitmap targets) resolve to their box too.
 */
function resolveMaskGeometry(scene: Scene, hit: HitTestResult): ElementGeometry | null {
  if (hit.kind === 'textBox') {
    const t = scene.textBoxes.find((el) => el.id === hit.id)
    if (!t) return null
    return { id: t.id, x: t.x, y: t.y, width: t.width, height: t.height, rotation: 0 }
  }
  return resolveElementGeometry(scene, hit)
}

interface PendingMask {
  pointerId: number
  targetId: string
  shape: 'rectangle' | 'ellipse' | 'brush'
  /** unmask mode commits an inverted (punch) mask. */
  inverted: boolean
  element: ElementGeometry
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
    targetId: pm.targetId,
    shape: pm.shape,
    points: pm.shape === 'brush' ? pm.points : [pm.anchor, pm.last],
    element: pm.element,
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
 * PropertiesPanel Refresh action (`refreshMaskSnapshot`). Auto-capturing at
 * creation was reverted: a snapshot taken at creation time captures the same
 * canvas the user is looking at, so the frozen pixels are pixel-identical to
 * the live scene and the freshly-drawn mask is invisible — exactly the reported
 * "the mask disappears on mouse release" regression.
 */
function commitLiveMask(
  pm: PendingMask,
  rect: { x: number; y: number; width: number; height: number },
  stroke: { x: number; y: number }[]
): void {
  const state = useStore.getState()
  state.pushHistory('Add mask')
  if (pm.shape === 'brush') {
    const box = boundsOf(stroke)
    state.addMask({
      id: generateId(),
      targetId: pm.targetId,
      inverted: true,
      shape: 'brush' as const,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      points: stroke
    })
  } else {
    state.addMask({
      id: generateId(),
      targetId: pm.targetId,
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
    const hit = ctx.hitResult
    const rt = ctx.getRuntime()
    const scene = safeScene(useStore.getState())

    let targetId: string
    let element: ElementGeometry
    if (hit) {
      if (!getCapabilities(hit.kind).maskable || hit.locked) return
      if ((rt.focusGroupId || rt.focusElementId) && !isInFocusScope(hit.id, rt.focusGroupId, scene, rt.focusElementId)) {
        ctx.actions.clearSelection()
        return
      }
      const resolved = resolveMaskGeometry(scene, hit)
      if (!resolved) return
      targetId = hit.id
      element = resolved
      ctx.actions.selectDirect(hit.id)
    } else {
      // Painting on empty canvas targets the scene background, so the mask
      // brush behaves like the normal paint brush — freehand strokes apply
      // masks to the canvas layer itself (scene coords, origin 0,0).
      // The background is never part of the focus scope, so focus blocks it.
      if (rt.focusGroupId || rt.focusElementId) return
      targetId = BACKGROUND_MASK_TARGET_ID
      element = {
        id: BACKGROUND_MASK_TARGET_ID,
        x: 0,
        y: 0,
        width: scene.canvas.width,
        height: scene.canvas.height,
        rotation: 0
      }
    }

    if (!ctx.claimPointer(e.pointerId)) return

    pendingMask = {
      pointerId: e.pointerId,
      targetId,
      shape: rt.maskShape,
      // 'mask' mode cuts the DRAWN region out of the target (the shape becomes
      // transparent); 'unmask' mode keeps the drawn region and hides the rest.
      inverted: rt.maskMode === 'mask',
      element,
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

    const localAnchor = toLocalPoint(pm.element, ZERO_ORIGIN, pm.anchor)
    const localLast = toLocalPoint(pm.element, ZERO_ORIGIN, pm.last)
    const rect = {
      x: Math.min(localAnchor.x, localLast.x),
      y: Math.min(localAnchor.y, localLast.y),
      width: Math.abs(localLast.x - localAnchor.x),
      height: Math.abs(localLast.y - localAnchor.y)
    }
    const stroke =
      pm.shape === 'brush'
        ? buildMaskStrokePolygon(
            pm.points.map((p) => toLocalPoint(pm.element, ZERO_ORIGIN, p)),
            pm.radius
          )
        : pm.shape === 'ellipse'
          ? ellipseRing(rect.x, rect.y, rect.width, rect.height)
          : rectRing(rect.x, rect.y, rect.width, rect.height)

    if (pm.inverted) {
      // Mask mode: the drawn region becomes transparent. Additive — every
      // stroke adds a fresh mask and never removes a previous one on the same
      // target (masks compose by intersection, so strokes stack). Committed
      // LIVE so the checkerboard stays visible; Refresh freezes the current
      // canvas into the mask (`refreshMaskSnapshot`).
      commitLiveMask(pm, rect, stroke)
    } else {
      // Unmask mode: the drawn region is restored. Subtractive — carve the
      // stroke out of every existing mask on the target. A no-op stroke
      // (nothing masked under the stroke) changes nothing and pushes no
      // history entry, so unmask never masks anything by itself.
      const scene = safeScene(useStore.getState())
      const commit = resolveUnmaskCommit(
        scene.masks.filter((m) => m.targetId === pm.targetId),
        stroke,
        pm.element.width,
        pm.element.height
      )
      if (commit) {
        const state = useStore.getState()
        state.pushHistory('Unmask')
        state.replaceTargetMasks(pm.targetId, commit)
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
