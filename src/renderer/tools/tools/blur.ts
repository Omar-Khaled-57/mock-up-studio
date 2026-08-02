import { InteractionContext, Tool } from '../types'
import { applyBlurRegion, BlurGeometry, blurRadiusFromBrush } from '../../services/rasterizer'
import { isInFocusScope } from '../../services/focus'
import {
  BitmapTarget,
  ElementGeometry,
  resolveBitmapTarget,
  resolveElementGeometry,
  toLocalPoint
} from '../../services/bitmap-targets'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'
import { safeScene } from '../../store/sceneSlice'
import { getFastOverlayHost } from '../../services/stroke-host'
import { buildBlurRegionPreview } from '../../services/preview'
import { createDestructiveTool, commitBitmapSrc, ensureBitmapSrc } from './destructive'

export const BLUR_VARIANTS = ['blur', 'blur-element', 'blur-rect', 'blur-ellipse', 'blur-line']

/**
 * Blur category — one shape-agnostic engine (`applyBlurRegion`) fed by five
 * different geometry inputs. The brush variant blurs a freehand stroke, the
 * element variant blurs a whole bitmap, and the rect/ellipse/line variants
 * blur a dragged region. Only the input geometry differs; the blur + clip
 * math is shared.
 */
export const blurTool = createDestructiveTool({
  id: 'blur',
  group: 'blur',
  label: 'Blur',
  icon: 'blur',
  brushType: 'blur',
  historyLabel: 'Blur stroke',
  variants: BLUR_VARIANTS
})

type BlurRegionKind = 'rect' | 'ellipse' | 'line'

interface PendingBlurRegion {
  pointerId: number
  target: BitmapTarget
  element: ElementGeometry
  start: { x: number; y: number }
  kind: BlurRegionKind
}

let pendingRegion: PendingBlurRegion | null = null
let regionCommitChain: Promise<void> = Promise.resolve()

export function createBlurRegionTool(id: string, label: string, icon: string, kind: BlurRegionKind): Tool {
  return {
    id,
    group: 'blur',
    label,
    icon,
    cursor: 'crosshair',
    variants: BLUR_VARIANTS,
    options: true,

    onPointerDown(ctx, e) {
      if (e.button !== 0) return
      const rt = ctx.getRuntime()
      const scene = safeScene(useStore.getState())
      const hit = ctx.hitResult
      if (!hit) return

      const target = resolveBitmapTarget(scene, hit)
      const element = resolveElementGeometry(scene, hit)
      if (!target || !element) return

      if ((rt.focusGroupId || rt.focusElementId) && !isInFocusScope(element.id, rt.focusGroupId, scene, rt.focusElementId)) {
        ctx.actions.clearSelection()
        return
      }

      if (!ctx.claimPointer(e.pointerId)) return
      pendingRegion = {
        pointerId: e.pointerId,
        target,
        element,
        start: { x: ctx.scenePoint.x, y: ctx.scenePoint.y },
        kind
      }
      rt.beginInteraction({ toolId: id, pointerId: e.pointerId, kind: id, startedAt: Date.now() })
    },

    onPointerUp(ctx, e) {
      const pending = pendingRegion
      if (!pending || pending.pointerId !== e.pointerId) return
      pendingRegion = null
      const rt = ctx.getRuntime()
      rt.setPreview(null)
      rt.endInteraction()
      regionCommitChain = regionCommitChain.then(() =>
        commitRegion(ctx, pending, { x: ctx.scenePoint.x, y: ctx.scenePoint.y })
      )
    },

    onPointerMove(ctx, e) {
      const pending = pendingRegion
      if (!pending || pending.pointerId !== e.pointerId) return
      const rt = ctx.getRuntime()
      const geometry = buildGeometry(kind, pending.start, { x: ctx.scenePoint.x, y: ctx.scenePoint.y }, rt.brush.size)
      rt.setPreview(buildBlurRegionPreview(geometry))
    },

    onPointerCancel(ctx, e) {
      const pending = pendingRegion
      if (!pending || pending.pointerId !== e.pointerId) return
      pendingRegion = null
      const rt = ctx.getRuntime()
      rt.setPreview(null)
      rt.endInteraction()
    },

    onInterrupt() {
      if (!pendingRegion) return
      pendingRegion = null
      const rt = useRuntimeStore.getState()
      rt.setPreview(null)
      rt.endInteraction()
      getFastOverlayHost()?.clear()
    }
  }
}

export const blurRectTool = createBlurRegionTool('blur-rect', 'Rectangle', 'blur-rect', 'rect')
export const blurEllipseTool = createBlurRegionTool('blur-ellipse', 'Ellipse', 'blur-ellipse', 'ellipse')
export const blurLineTool = createBlurRegionTool('blur-line', 'Line', 'blur-line', 'line')

/** Blur the whole element bitmap in one click (no drag session). */
export const blurElementTool: Tool = {
  id: 'blur-element',
  group: 'blur',
  label: 'Element',
  icon: 'blur-element',
  cursor: 'crosshair',
  variants: BLUR_VARIANTS,
  options: true,

  onPointerDown(ctx, e) {
    if (e.button !== 0) return
    const rt = ctx.getRuntime()
    const scene = safeScene(useStore.getState())
    const hit = ctx.hitResult
    if (!hit) return

    const target = resolveBitmapTarget(scene, hit)
    const element = resolveElementGeometry(scene, hit)
    if (!target || !element) return

    if ((rt.focusGroupId || rt.focusElementId) && !isInFocusScope(element.id, rt.focusGroupId, scene, rt.focusElementId)) {
      ctx.actions.clearSelection()
      return
    }

    regionCommitChain = regionCommitChain.then(() => commitElement(ctx, target))
  }
}

function buildGeometry(kind: BlurRegionKind, start: { x: number; y: number }, end: { x: number; y: number }, size: number): BlurGeometry {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const w = Math.max(Math.abs(end.x - start.x), 4)
  const h = Math.max(Math.abs(end.y - start.y), 4)
  if (kind === 'rect') return { type: 'rect', x, y, width: w, height: h }
  if (kind === 'ellipse') return { type: 'ellipse', x, y, width: w, height: h }
  return { type: 'line', x1: start.x, y1: start.y, x2: end.x, y2: end.y, width: size }
}

async function commitRegion(
  ctx: InteractionContext,
  pending: PendingBlurRegion,
  end: { x: number; y: number }
): Promise<void> {
  const state = useStore.getState()
  const scene = safeScene(state)
  const { target, element, kind, start } = pending
  const src = await ensureBitmapSrc(state, scene, target)
  if (!src) return

  const rt = ctx.getRuntime()
  const startLocal = toLocalPoint(element, target, start)
  const endLocal = toLocalPoint(element, target, end)
  const geometry = buildGeometry(kind, startLocal, endLocal, rt.brush.size)
  const dataUrl = await applyBlurRegion(
    { src, width: target.width, height: target.height },
    geometry,
    blurRadiusFromBrush(rt.brush)
  )
  if (!dataUrl) return

  state.pushHistory('Blur region')
  commitBitmapSrc(state, target, dataUrl)
}

async function commitElement(ctx: InteractionContext, target: BitmapTarget): Promise<void> {
  const state = useStore.getState()
  const scene = safeScene(state)
  const src = await ensureBitmapSrc(state, scene, target)
  if (!src) return

  const rt = ctx.getRuntime()
  const dataUrl = await applyBlurRegion(
    { src, width: target.width, height: target.height },
    { type: 'rect', x: 0, y: 0, width: target.width, height: target.height },
    blurRadiusFromBrush(rt.brush)
  )
  if (!dataUrl) return

  state.pushHistory('Blur element')
  commitBitmapSrc(state, target, dataUrl)
}
