import { Tool } from '../types'
import { useRuntimeStore } from '../../runtime/store'
import { SELECT_VARIANTS } from './select'

interface PendingMarquee {
  pointerId: number
  startX: number
  startY: number
}

let pendingMarquee: PendingMarquee | null = null

export const marqueeTool: Tool = {
  id: 'marquee',
  group: 'select',
  label: 'Marquee',
  icon: 'marquee',
  cursor: 'crosshair',
  shortcut: 'm',
  variants: SELECT_VARIANTS,

  onPointerDown(ctx, e) {
    if (e.button !== 0) return
    if (!ctx.claimPointer(e.pointerId)) return
    pendingMarquee = { pointerId: e.pointerId, startX: ctx.scenePoint.x, startY: ctx.scenePoint.y }
    ctx.getRuntime().beginInteraction({
      toolId: 'marquee',
      pointerId: e.pointerId,
      kind: 'marquee',
      startedAt: Date.now()
    })
  },

  onPointerMove(ctx, e) {
    if (!pendingMarquee || pendingMarquee.pointerId !== e.pointerId) return
    const p = pendingMarquee
    ctx.getRuntime().setMarqueeRect({
      x: Math.min(p.startX, ctx.scenePoint.x),
      y: Math.min(p.startY, ctx.scenePoint.y),
      width: Math.abs(ctx.scenePoint.x - p.startX),
      height: Math.abs(ctx.scenePoint.y - p.startY)
    })
  },

  onPointerUp(ctx, e) {
    if (!pendingMarquee || pendingMarquee.pointerId !== e.pointerId) return
    const p = pendingMarquee
    pendingMarquee = null
    const w = ctx.scenePoint.x - p.startX
    const h = ctx.scenePoint.y - p.startY
    ctx.getRuntime().setMarqueeRect(null)
    ctx.getRuntime().endInteraction()
    if (Math.abs(w) > 3 || Math.abs(h) > 3) {
      ctx.actions.selectInRect(p.startX, p.startY, w, h)
    } else {
      ctx.actions.clearSelection()
    }
  },

  onPointerCancel(ctx, e) {
    if (!pendingMarquee || pendingMarquee.pointerId !== e.pointerId) return
    pendingMarquee = null
    ctx.getRuntime().setMarqueeRect(null)
    ctx.getRuntime().endInteraction()
  },

  onInterrupt() {
    if (!pendingMarquee) return
    pendingMarquee = null
    const rt = useRuntimeStore.getState()
    rt.setMarqueeRect(null)
    rt.endInteraction()
  }
}
