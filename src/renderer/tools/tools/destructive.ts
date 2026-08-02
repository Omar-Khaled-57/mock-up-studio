import { InteractionContext, Tool, ToolGroup } from '../types'
import { StrokeSampler, StrokePoint } from '../../services/stroke'
import { applyDestructiveStroke, DestructiveBrushType, StrokeBrush } from '../../services/rasterizer'
import { isInFocusScope } from '../../services/focus'
import {
  BitmapTarget,
  ElementGeometry,
  resolveBitmapTarget,
  resolveElementGeometry,
  toLocalPoint
} from '../../services/bitmap-targets'
import { rasterizeShapeBitmap } from '../../services/shape-rasterizer'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'
import { safeScene } from '../../store/sceneSlice'
import { getFastOverlayHost } from '../../services/stroke-host'

export const ERASER_VARIANTS = ['eraser', 'magic-eraser', 'delete']

export interface DestructiveToolConfig {
  id: string
  group: ToolGroup
  label: string
  icon: string
  brushType: DestructiveBrushType
  historyLabel: string
  shortcut?: string
  variants?: string[]
}

interface PendingStroke {
  pointerId: number
  sampler: StrokeSampler
  target: BitmapTarget
  element: ElementGeometry
  brush: StrokeBrush
  brushType: DestructiveBrushType
  historyLabel: string
}

/** Per-pointer pending strokes (multi-touch safe, unlike the paint tool's single slot). */
const pendingStrokes = new Map<number, PendingStroke>()
let commitChain: Promise<void> = Promise.resolve()

const PREVIEW_COLORS: Record<DestructiveBrushType, string> = {
  blur: 'rgba(255,255,255,0.45)',
  eraser: 'rgba(0,0,0,0.4)',
  'magic-eraser': 'rgba(255,255,255,0.5)'
}

export function createDestructiveTool(config: DestructiveToolConfig): Tool {
  const { id, group, label, icon, brushType, historyLabel, shortcut, variants } = config

  return {
    id,
    group,
    label,
    icon,
    cursor: 'crosshair',
    shortcut,
    variants,
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

      // Focus mode: destructive edits to a dimmed (out-of-scope) element are
      // rejected the same way the Select tool rejects drags on dimmed content.
      if ((rt.focusGroupId || rt.focusElementId) && !isInFocusScope(element.id, rt.focusGroupId, scene, rt.focusElementId)) {
        ctx.actions.clearSelection()
        return
      }

      if (!ctx.claimPointer(e.pointerId)) return

      const brush = { ...rt.brush }
      const sampler = new StrokeSampler()
      sampler.begin({
        brushType,
        size: brush.size,
        hardness: brush.hardness,
        color: brush.color,
        targetId: element.id,
        seed: Date.now()
      })
      sampler.append(ctx.scenePoint.x, ctx.scenePoint.y)
      pendingStrokes.set(e.pointerId, {
        pointerId: e.pointerId,
        sampler,
        target,
        element,
        brush,
        brushType,
        historyLabel
      })

      rt.beginInteraction({ toolId: id, pointerId: e.pointerId, kind: id, startedAt: Date.now() })
      ctx.fastOverlay?.beginStroke({
        color: PREVIEW_COLORS[brushType],
        width: brush.size,
        hardness: brushType === 'blur' ? 0.2 : brush.hardness,
        pressure: 1
      })
    },

    onPointerMove(ctx, e) {
      const stroke = pendingStrokes.get(e.pointerId)
      if (!stroke) return
      if (!stroke.sampler.append(ctx.scenePoint.x, ctx.scenePoint.y)) return

      const rt = ctx.getRuntime()
      if (!rt.strokeDirty) rt.setStrokeDirty(true)

      const host = ctx.fastOverlay
      if (host) {
        const n = stroke.sampler.length
        if (n >= 2) {
          host.strokeLine(
            { x: stroke.sampler.x(n - 2), y: stroke.sampler.y(n - 2) },
            { x: stroke.sampler.x(n - 1), y: stroke.sampler.y(n - 1) },
            {
              color: PREVIEW_COLORS[brushType],
              width: stroke.brush.size,
              hardness: brushType === 'blur' ? 0.2 : stroke.brush.hardness,
              pressure: 1
            }
          )
        }
      }
    },

    onPointerUp(ctx, e) {
      const stroke = pendingStrokes.get(e.pointerId)
      if (!stroke) return
      pendingStrokes.delete(e.pointerId)

      const rt = ctx.getRuntime()
      rt.endInteraction()
      const points = stroke.sampler.toPoints()
      rt.setStrokeBuffer(points)
      rt.setStrokeDirty(false)

      commitChain = commitChain.then(() => commitStroke(ctx, stroke, points))
    },

    onPointerCancel(ctx, e) {
      const stroke = pendingStrokes.get(e.pointerId)
      if (!stroke) return
      pendingStrokes.delete(e.pointerId)

      const rt = ctx.getRuntime()
      rt.endInteraction()
      rt.setStrokeBuffer([])
      rt.setStrokeDirty(false)
      ctx.fastOverlay?.clear()
    },

    onInterrupt() {
      if (pendingStrokes.size === 0) return
      pendingStrokes.clear()
      const rt = useRuntimeStore.getState()
      rt.endInteraction()
      rt.setStrokeBuffer([])
      rt.setStrokeDirty(false)
      getFastOverlayHost()?.clear()
    }
  }
}

async function commitStroke(
  ctx: InteractionContext,
  stroke: PendingStroke,
  points: StrokePoint[]
): Promise<void> {
  ctx.fastOverlay?.clear()
  const state = useStore.getState()
  const scene = safeScene(state)
  const { target, element } = stroke

  // Resolve the bitmap source — rasterizing the shape on-demand when it has
  // no pre-existing backgroundImage (see ensureBitmapSrc for the contract).
  const src = await ensureBitmapSrc(state, scene, target)
  if (!src) return

  const localPoints = points.map((p) => {
    const local = toLocalPoint(element, target, { x: p.x, y: p.y })
    return { x: local.x, y: local.y, pressure: p.pressure }
  })

  const dataUrl = await applyDestructiveStroke(
    { src, width: target.width, height: target.height },
    stroke.brushType,
    localPoints,
    stroke.brush
  )
  if (!dataUrl) return

  state.pushHistory(stroke.historyLabel)
  commitBitmapSrc(state, target, dataUrl)
}

/** Writes a freshly rasterized bitmap back to the target element (shared by all bitmap-editing tools). */
export function commitBitmapSrc(state: ReturnType<typeof useStore.getState>, target: BitmapTarget, dataUrl: string): void {
  if (target.kind === 'device') {
    state.updateDevice(target.elementId, { screenImage: dataUrl })
  } else if (target.kind === 'shape') {
    state.updateShape(target.elementId, { backgroundImage: dataUrl })
  } else {
    state.updateImage(target.elementId, { src: dataUrl })
  }
}

export function readCurrentSrc(scene: ReturnType<typeof safeScene>, target: BitmapTarget): string | null {
  if (target.kind === 'device') {
    return scene.devices.find((d) => d.id === target.elementId)?.screenImage ?? null
  }
  if (target.kind === 'shape') {
    return scene.shapes.find((s) => s.id === target.elementId)?.backgroundImage ?? null
  }
  return scene.images.find((i) => i.id === target.elementId)?.src ?? null
}

/**
 * Resolves the bitmap source for a destructive commit, rasterizing the shape
 * on-demand when it has no pre-existing backgroundImage.
 *
 * For shapes without a backgroundImage, the shape's current fill (solid color
 * or gradient) is rendered to a bitmap via `rasterizeShapeBitmap` and returned.
 * The destructive pipeline then applies the stroke to this bitmap and commits
 * it as the shape's new `backgroundImage` — one history entry covers the
 * entire rasterize-then-edit operation (the history snapshot captures the
 * pre-mutation state where backgroundImage was null).
 *
 * Returns null only when the element genuinely has no editable bitmap (textBox,
 * src-less image, rasterization failure).
 */
export async function ensureBitmapSrc(
  state: ReturnType<typeof useStore.getState>,
  scene: ReturnType<typeof safeScene>,
  target: BitmapTarget
): Promise<string | null> {
  const existing = readCurrentSrc(scene, target)
  if (existing) return existing

  // Shapes without a backgroundImage can be rasterized from their data model.
  if (target.kind === 'shape') {
    const shape = scene.shapes.find((s) => s.id === target.elementId)
    if (!shape) return null
    return rasterizeShapeBitmap(shape)
  }

  return null
}
