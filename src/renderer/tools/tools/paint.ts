import { InteractionContext, Tool } from '../types'
import { StrokeSampler, StrokePoint } from '../../services/stroke'
import { StrokeBrush } from '../../services/rasterizer'
import { createPaintLayer, resolvePaintCommit } from '../../services/paint-layers'
import { getFastOverlayHost } from '../../services/stroke-host'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'
import { safeScene } from '../../store/sceneSlice'
import { BRUSH_PRESETS, BRUSH_PRESET_IDS, BrushPreset, getBrushPreset } from '../../lib/brush-presets'

export const PAINT_VARIANTS = BRUSH_PRESET_IDS

interface PendingStroke {
  pointerId: number
  sampler: StrokeSampler
}

let pendingStroke: PendingStroke | null = null
let commitChain: Promise<void> = Promise.resolve()

/**
 * Paint brush factory — every variant in the brush group is a preset over one
 * shared engine. Only the preset id/label/icon/defaults differ; the stroke
 * sampling, paint-layer commit and history contract are shared. Every stroke
 * commits as its OWN raster paint layer (`Paint N`), so layers stack per
 * stroke instead of compositing onto a shared one. Activating a preset applies
 * its non-color defaults (color is global).
 */
export function createPaintBrush(preset: BrushPreset): Tool {
  return {
    id: preset.id,
    group: 'brush',
    label: preset.label,
    icon: preset.icon,
    cursor: 'crosshair',
    shortcut: preset.id === 'paint' ? 'b' : undefined,
    variants: PAINT_VARIANTS,
    options: true,

    onActivate() {
      const d = preset.defaults
      useRuntimeStore.getState().setBrush({ size: d.size, hardness: d.hardness, shape: d.shape, opacity: d.opacity })
    },

    onPointerDown(ctx, e) {
      if (e.button !== 0) return
      const rt = ctx.getRuntime()

      if (!ctx.claimPointer(e.pointerId)) return

      const brush = rt.brush
      const sampler = new StrokeSampler()
      sampler.begin({
        brushType: 'paint',
        size: brush.size,
        hardness: brush.hardness,
        color: brush.color,
        targetId: null,
        seed: Date.now()
      })
      sampler.append(ctx.scenePoint.x, ctx.scenePoint.y)
      pendingStroke = { pointerId: e.pointerId, sampler }

      rt.beginInteraction({ toolId: preset.id, pointerId: e.pointerId, kind: 'paint', startedAt: Date.now() })

      ctx.fastOverlay?.beginStroke({
        color: brush.color,
        width: brush.size,
        hardness: brush.hardness,
        pressure: 1,
        shape: brush.shape,
        opacity: brush.opacity
      })
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
            { color: brush.color, width: brush.size, hardness: brush.hardness, pressure: 1, shape: brush.shape, opacity: brush.opacity }
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

      commitChain = commitChain.then(() => commitStroke(ctx, points))
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
}

export const paintTool = createPaintBrush(getBrushPreset('paint'))
export const pencilTool = createPaintBrush(getBrushPreset('pencil'))
export const airbrushTool = createPaintBrush(getBrushPreset('airbrush'))
export const markerTool = createPaintBrush(getBrushPreset('marker'))
export const calligraphyTool = createPaintBrush(getBrushPreset('calligraphy'))
export const pixelTool = createPaintBrush(getBrushPreset('pixel'))

export function isPaintPreset(id: string): boolean {
  return id in BRUSH_PRESETS
}

async function commitStroke(ctx: InteractionContext, points: StrokePoint[]): Promise<void> {
  ctx.fastOverlay?.clear()
  const state = useStore.getState()
  const scene = safeScene(state)
  const brush: StrokeBrush = ctx.getRuntime().brush

  const commit = await resolvePaintCommit(scene, points, brush)
  if (!commit) return

  const focusGroupId = ctx.getRuntime().focusGroupId
  state.pushHistory('Brush stroke')
  const layer = createPaintLayer(scene, commit.src, focusGroupId, commit.region)
  state.addImage(layer)
  if (focusGroupId) state.addToGroup(focusGroupId, layer.id)
}
