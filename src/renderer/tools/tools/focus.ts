import { Tool } from '../types'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { findSceneElement, getFocusPath, isContainer, isInFocusScope } from '../../services/focus'

/**
 * Focus tool — picks a scope to enter focus mode. Clicking an element inside
 * a group enters that group's focus (M9); clicking a container element
 * (anything with children) enters element focus so its children become
 * editable and its clip is lifted. Clicking again drills into a container
 * within the current scope; dimmed (out-of-scope) elements are rejected so
 * the tool can never escape the focused scope.
 */
export const focusTool: Tool = {
  id: 'focus',
  group: 'select',
  label: 'Focus',
  icon: 'focus',
  cursor: 'crosshair',
  shortcut: 'x',

  onPointerDown(ctx, e) {
    if (e.button !== 0) return
    const rt = ctx.getRuntime()
    if (!ctx.hitResult) return
    const scene = safeScene(useStore.getState())
    const hitId = ctx.hitResult.id
    const el = findSceneElement(scene, hitId)
    if (!el) return

    // Dimmed (out-of-scope) content can never be focused — the tool can't
    // escape the current scope.
    if (!isInFocusScope(hitId, rt.focusGroupId, scene, rt.focusElementId)) return

    // Group focus (M9): entering a group that isn't reachable from the current
    // group focus is rejected so the tool can never leave the focused subtree.
    if (el.groupId) {
      const pathIds = new Set(getFocusPath(scene, el.groupId).map((g) => g.id))
      if (rt.focusGroupId && !pathIds.has(rt.focusGroupId)) return
      rt.enterFocus(el.groupId)
      return
    }

    if (isContainer(scene, hitId)) {
      rt.enterElementFocus(hitId)
    }
  }
}
