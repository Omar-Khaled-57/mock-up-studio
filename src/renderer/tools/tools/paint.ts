import { InteractionContext, Tool } from '../types'
import { StrokeSampler, StrokePoint } from '../../services/stroke'
import { StrokeBrush } from '../../services/rasterizer'
import { createPaintLayer, findActivePaintLayer, resolvePaintCommit } from '../../services/paint-layers'
import { isInFocusScope } from '../../services/focus'
import { getFastOverlayHost } from '../../services/stroke-host'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'
import { safeScene } from '../../store/sceneSlice'

export const PAINT_VARIANTS = ['paint', 'blur']

interface PendingStroke {
  pointerId: number
  sampler: StrokeSampler
  targetLayerId: string | null
}

let pendingStroke: PendingStroke | null = null
let commitChain: Promise<void> = Promise.resolve()

export const paintTool: Tool = {
  id: 'paint',
  group: 'brush',
  label: 'Paint Brush',
  icon: 'brush',
  cursor: 'crosshair',
  shortcut: 'b',
  variants: PAINT_VARIANTS,
  options: true,

  onPointerDown(ctx, e) {
    if (e.button !== 0) return
    const rt = ctx.getRuntime()
    const scene = safeScene(useStore.getState())
    const active = findActivePaintLayer(scene)

    // Focus mode: painting an existing paint layer outside the focused subtree
    // would edit dimmed content — reject it the same way the Select tool does.
    if (rt.focusGroupId && active && !isInFocusScope(active.id, rt.focusGroupId, scene)) {
      ctx.actions.clearSelection()
      return
    }

    if (!ctx.claimPointer(e.pointerId)) return

    const brush = rt.brush
    const sampler = new StrokeSampler()
    sampler.begin({
      brushType: 'paint',
      size: brush.size,
      hardness: brush.hardness,
      color: brush.color,
      targetId: active?.id ?? null,
      seed: Date.now()
    })
    sampler.append(ctx.scenePoint.x, ctx.scenePoint.y)
    pendingStroke = { pointerId: e.pointerId, sampler, targetLayerId: active?.id ?? null }

    rt.beginInteraction({ toolId: 'paint', pointerId: e.pointerId, kind: 'paint', startedAt: Date.now() })

    ctx.fastOverlay?.beginStroke({ color: brush.color, width: brush.size, hardness: brush.hardness, pressure: 1 })
  },

  onPointerMove(ctx, e) {
    const stroke = pendingStroke
    if (!stroke || stroke.pointerId !== e.pointerId) return
    if (!stroke.sampler.append(ctx.scenePoint.x, ctx.scenePoint.y)) return

    const rt = ctx.getRuntime()
    const brush = rt.brush
    if (!rt.strokeDirty) rt.setStrokeDirty(true)

    const host = ctx.fastOverlay
    if (host) {
      const n = stroke.sampler.length
      if (n >= 2) {
        host.strokeLine(
          { x: stroke.sampler.x(n - 2), y: stroke.sampler.y(n - 2) },
          { x: stroke.sampler.x(n - 1), y: stroke.sampler.y(n - 1) },
          { color: brush.color, width: brush.size, hardness: brush.hardness, pressure: 1 }
        )
      }
    }
  },

  onPointerUp(ctx, e) {
    const stroke = pendingStroke
    if (!stroke || stroke.pointerId !== e.pointerId) return
    pendingStroke = null

    const rt = ctx.getRuntime()
    rt.endInteraction()
    const points = stroke.sampler.toPoints()
    rt.setStrokeBuffer(points)
    rt.setStrokeDirty(false)

    commitChain = commitChain.then(() => commitStroke(ctx, stroke, points))
  },

  onPointerCancel(ctx, e) {
    const stroke = pendingStroke
    if (!stroke || stroke.pointerId !== e.pointerId) return
    pendingStroke = null

    const rt = ctx.getRuntime()
    rt.endInteraction()
    rt.setStrokeBuffer([])
    rt.setStrokeDirty(false)
    ctx.fastOverlay?.clear()
  },

  onInterrupt() {
    if (!pendingStroke) return
    pendingStroke = null
    const rt = useRuntimeStore.getState()
    rt.endInteraction()
    rt.setStrokeBuffer([])
    rt.setStrokeDirty(false)
    getFastOverlayHost()?.clear()
  }
}

async function commitStroke(ctx: InteractionContext, stroke: PendingStroke, points: StrokePoint[]): Promise<void> {
  ctx.fastOverlay?.clear()
  const state = useStore.getState()
  const scene = safeScene(state)
  const active = stroke.targetLayerId
    ? scene.images.find((img) => img.id === stroke.targetLayerId) ?? null
    : null
  const brush: StrokeBrush = ctx.getRuntime().brush

  const dataUrl = await resolvePaintCommit(scene, active, points, brush)
  if (!dataUrl) return

  const focusGroupId = ctx.getRuntime().focusGroupId
  state.pushHistory('Brush stroke')
  if (active) {
    state.updateImage(active.id, { src: dataUrl })
  } else {
    const layer = createPaintLayer(scene, dataUrl, focusGroupId)
    state.addImage(layer)
    if (focusGroupId) state.addToGroup(focusGroupId, layer.id)
  }
}
