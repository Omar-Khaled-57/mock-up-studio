import { Tool } from '../types'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'

interface PanState {
  pointerId: number
  startX: number
  startY: number
  panX: number
  panY: number
}

let panState: PanState | null = null

export const handTool: Tool = {
  id: 'hand',
  group: 'select',
  label: 'Hand',
  icon: 'hand',
  cursor: 'grab',
  shortcut: 'h',

  onPointerDown(ctx, e) {
    if (e.button !== 0 && e.button !== 1) return
    if (!ctx.claimPointer(e.pointerId)) return
    const vp = ctx.actions.getViewport()
    panState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: vp.panX,
      panY: vp.panY
    }
    ctx.actions.setIsPanning(true)
    ctx.getRuntime().beginInteraction({
      toolId: 'hand',
      pointerId: e.pointerId,
      kind: 'pan',
      startedAt: Date.now()
    })
  },

  onPointerMove(ctx, e) {
    const p = panState
    if (!p || p.pointerId !== e.pointerId) return
    const dx = e.clientX - p.startX
    const dy = e.clientY - p.startY
    ctx.actions.setPan(p.panX + dx, p.panY + dy)
  },

  onPointerUp(ctx, e) {
    const p = panState
    if (!p || p.pointerId !== e.pointerId) return
    panState = null
    ctx.actions.setIsPanning(false)
    ctx.getRuntime().endInteraction()
  },

  onPointerCancel(ctx, e) {
    if (!panState || panState.pointerId !== e.pointerId) return
    panState = null
    ctx.actions.setIsPanning(false)
    ctx.getRuntime().endInteraction()
  },

  onInterrupt() {
    if (!panState) return
    panState = null
    useStore.getState().setIsPanning(false)
    useRuntimeStore.getState().endInteraction()
  }
}
