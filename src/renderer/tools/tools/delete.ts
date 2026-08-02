import { Tool } from '../types'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { isInFocusScope } from '../../services/focus'
import { ERASER_VARIANTS } from './destructive'

/**
 * Delete tool — erases whole elements. A click on an element that is part of
 * the current selection deletes the selection; a click on anything else
 * deletes just the clicked element. It reuses the exact deletion pipeline the
 * Delete key / context menus use (pushHistory BEFORE deleteSelected) and is
 * focus-scope gated like every other editing tool.
 */
export const deleteTool: Tool = {
  id: 'delete',
  group: 'eraser',
  label: 'Delete',
  icon: 'delete',
  cursor: 'crosshair',
  variants: ERASER_VARIANTS,

  onPointerDown(ctx, e) {
    if (e.button !== 0) return
    const hit = ctx.hitResult
    if (!hit) return

    const rt = ctx.getRuntime()
    const scene = safeScene(useStore.getState())
    if ((rt.focusGroupId || rt.focusElementId) && !isInFocusScope(hit.id, rt.focusGroupId, scene, rt.focusElementId)) {
      ctx.actions.clearSelection()
      return
    }

    const state = useStore.getState()
    const selected = state.selectedIds
    const ids = selected.length > 0 && selected.includes(hit.id) ? selected : [hit.id]
    state.pushHistory('Delete')
    state.deleteSelected(ids)
  }
}
