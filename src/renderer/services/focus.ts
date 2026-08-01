/**
 * focus — pure focus-mode resolution.
 *
 * Focus mode scopes all editing to a group's subtree. The focused scope is the
 * group itself plus every descendant group reachable through the existing
 * `parentGroupId` chain (children + nested subgroups). When no focus is active
 * every element is editable; `focusFilterFor` yields the no-op filter used as
 * the default by selection operations.
 */

import { ElementGroup, Scene } from '@shared/types'
import { Rect, unionBounds } from './geometry'
import { ElementGeometry, getElementGeometry } from './selection-chrome'

export type FocusFilter = (id: string) => boolean

/** Ids of every subgroup nested under `groupId` (recursively). Cycle-safe. */
export function getDescendantGroupIds(scene: Scene, groupId: string): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  const visit = (parent: string) => {
    for (const group of scene.groups) {
      if (group.parentGroupId !== parent || seen.has(group.id)) continue
      seen.add(group.id)
      result.push(group.id)
      visit(group.id)
    }
  }
  visit(groupId)
  return result
}

/** Element ids of the group's entire subtree (own members + nested groups). */
export function getFocusSubtreeIds(scene: Scene, groupId: string): string[] {
  const group = scene.groups.find((g) => g.id === groupId)
  if (!group) return []
  const ids = new Set<string>(group.childIds)
  for (const descendantId of getDescendantGroupIds(scene, groupId)) {
    const descendant = scene.groups.find((g) => g.id === descendantId)
    if (descendant) for (const childId of descendant.childIds) ids.add(childId)
  }
  return [...ids]
}

/** True when no focus is active or the element belongs to the focused subtree. */
export function isInFocusScope(id: string, focusGroupId: string | null, scene: Scene): boolean {
  if (!focusGroupId) return true
  return getFocusSubtreeIds(scene, focusGroupId).includes(id)
}

/** Returns a predicate over element ids limited to the focused subtree (no-op default). */
export function focusFilterFor(focusGroupId: string | null, scene: Scene): FocusFilter {
  if (!focusGroupId) return () => true
  const allowed = new Set(getFocusSubtreeIds(scene, focusGroupId))
  return (id) => allowed.has(id)
}

/** Group ancestry from the root down to the focused group (empty when not focused). */
export function getFocusPath(scene: Scene, focusGroupId: string | null): ElementGroup[] {
  if (!focusGroupId) return []
  const path: ElementGroup[] = []
  const seen = new Set<string>()
  let current = scene.groups.find((g) => g.id === focusGroupId) ?? null
  while (current && !seen.has(current.id)) {
    const group = current
    seen.add(group.id)
    path.unshift(group)
    current = group.parentGroupId
      ? scene.groups.find((g) => g.id === group.parentGroupId) ?? null
      : null
  }
  return path
}

/** Union bounds of the visible members of the focused subtree (for the ring). */
export function getFocusBounds(scene: Scene, focusGroupId: string | null): Rect | null {
  if (!focusGroupId) return null
  const geometries = getFocusSubtreeIds(scene, focusGroupId)
    .map((id) => getElementGeometry(scene, id))
    .filter((el): el is ElementGeometry => !!el && el.visible)
  if (geometries.length === 0) return null
  return unionBounds(geometries)
}
