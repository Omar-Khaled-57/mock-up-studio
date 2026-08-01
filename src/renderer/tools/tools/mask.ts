import { Tool, InteractionContext } from '../types'
import { MaskPoint, Scene } from '@shared/types'
import { getCapabilities } from '../../services/capabilities'
import { isInFocusScope } from '../../services/focus'
import { ElementGeometry, resolveElementGeometry, toLocalPoint } from '../../services/bitmap-targets'
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
  /** The mask being re-drawn (edit), or null when drawing a fresh one. */
  existingMaskId: string | null
}

let pendingMask: PendingMask | null = null

const MIN_DRAG_DISTANCE_SQ = 9
const BRUSH_MIN_DISTANCE_SQ = 2.25

function pushPreview(rt: RuntimeSlice, pm: PendingMask): void {
  rt.setMaskPreview({
    targetId: pm.targetId,
    shape: pm.shape,
    points: pm.shape === 'brush' ? pm.points : [pm.anchor, pm.last]
  })
}

function boundsOf(points: MaskPoint[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
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
    if (!hit) return
    if (!getCapabilities(hit.kind).maskable || hit.locked) return

    const rt = ctx.getRuntime()
    const scene = safeScene(useStore.getState())
    if (rt.focusGroupId && !isInFocusScope(hit.id, rt.focusGroupId, scene)) {
      ctx.actions.clearSelection()
      return
    }

    const element = resolveMaskGeometry(scene, hit)
    if (!element) return
    if (!ctx.claimPointer(e.pointerId)) return

    const existing = scene.masks.find((m) => m.targetId === hit.id) ?? null
    pendingMask = {
      pointerId: e.pointerId,
      targetId: hit.id,
      shape: rt.maskShape,
      inverted: rt.maskMode === 'unmask',
      element,
      anchor: { x: ctx.scenePoint.x, y: ctx.scenePoint.y },
      last: { x: ctx.scenePoint.x, y: ctx.scenePoint.y },
      points: [{ x: ctx.scenePoint.x, y: ctx.scenePoint.y }],
      existingMaskId: existing?.id ?? null
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

    const rt = ctx.getRuntime()
    rt.endInteraction()
    rt.setMaskPreview(null)

    if (pm.shape !== 'brush') {
      const dx = pm.last.x - pm.anchor.x
      const dy = pm.last.y - pm.anchor.y
      if (dx * dx + dy * dy < MIN_DRAG_DISTANCE_SQ) return
    } else if (pm.points.length < 2) {
      return
    }

    const localAnchor = toLocalPoint(pm.element, ZERO_ORIGIN, pm.anchor)
    const localLast = toLocalPoint(pm.element, ZERO_ORIGIN, pm.last)

    const state = useStore.getState()
    state.pushHistory(pm.existingMaskId ? 'Edit mask' : pm.inverted ? 'Unmask' : 'Add mask')

    if (pm.shape === 'brush') {
      const localPoints = pm.points.map((p) => toLocalPoint(pm.element, ZERO_ORIGIN, p))
      const box = boundsOf(localPoints)
      const patch = {
        shape: 'brush' as const,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        points: localPoints
      }
      if (pm.existingMaskId) {
        state.updateMask(pm.existingMaskId, { ...patch, inverted: pm.inverted })
      } else {
        state.addMask({ id: generateId(), targetId: pm.targetId, inverted: pm.inverted, ...patch })
      }
    } else {
      const rect = {
        x: Math.min(localAnchor.x, localLast.x),
        y: Math.min(localAnchor.y, localLast.y),
        width: Math.abs(localLast.x - localAnchor.x),
        height: Math.abs(localLast.y - localAnchor.y)
      }
      if (pm.existingMaskId) {
        state.updateMask(pm.existingMaskId, { shape: pm.shape, x: rect.x, y: rect.y, width: rect.width, height: rect.height, points: [], inverted: pm.inverted })
      } else {
        state.addMask({ id: generateId(), targetId: pm.targetId, shape: pm.shape, points: [], inverted: pm.inverted, ...rect })
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
