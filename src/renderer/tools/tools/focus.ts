import { Tool } from '../types'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { getElementGeometry } from '../../services/selection-chrome'
import { getFocusPath } from '../../services/focus'

/**
 * Focus tool — picks a group to enter focus mode. Clicking an element inside
 * a group enters that group's focus; clicking again drills into a subgroup
 * within the current focus scope; dimmed (out-of-scope) elements are rejected
 * so the tool can never escape the focused subtree.
 */
export const focusTool: Tool = {
  id: 'focus',
  group: 'select',
  label: 'Focus Tool',
  icon: 'focus',
  cursor: 'crosshair',
  shortcut: 'x',

  onPointerDown(ctx, e) {
    if (e.button !== 0) return
    const rt = ctx.getRuntime()
    if (!ctx.hitResult) return
    const scene = safeScene(useStore.getState())
    const groupId = getElementGeometry(scene, ctx.hitResult.id)?.groupId ?? null
    if (!groupId) return
    const pathIds = new Set(getFocusPath(scene, groupId).map((g) => g.id))
    if (rt.focusGroupId && !pathIds.has(rt.focusGroupId)) return
    rt.enterFocus(groupId)
  }
}
