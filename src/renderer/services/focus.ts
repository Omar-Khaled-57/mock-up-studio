/**
 * focus — pure focus-mode resolution.
 *
 * Focus mode scopes all editing to either a group's subtree or a container
 * element's children. The group scope is the group itself plus every
 * descendant group reachable through the existing `parentGroupId` chain.
 * The container scope is the focused element plus every element whose
 * `containerId` references it (depth-1: nested containers need their own
 * focus). When no focus is active every element is editable; `focusFilterFor`
 * yields the no-op filter used as the default by selection operations.
 */

import { ElementGroup, Scene } from '@shared/types'
import { Rect, unionBounds } from './geometry'
import { ElementGeometry, getElementGeometry } from './selection-chrome'

export type FocusFilter = (id: string) => boolean

/** Minimal element identity used by container focus (name + linkage). */
export interface FocusedElement {
  id: string
  name: string
  containerId: string | null
  groupId: string | null
}

/** Resolves any element id to its identity, or null when absent. */
export function findSceneElement(scene: Scene, id: string): FocusedElement | null {
  const d = scene.devices.find((el) => el.id === id)
  if (d) return { id: d.id, name: d.name, containerId: d.containerId, groupId: d.groupId }
  const t = scene.textBoxes.find((el) => el.id === id)
  if (t) return { id: t.id, name: t.name, containerId: t.containerId, groupId: t.groupId }
  const i = scene.images.find((el) => el.id === id)
  if (i) return { id: i.id, name: i.name, containerId: i.containerId, groupId: i.groupId }
  const s = scene.shapes.find((el) => el.id === id)
  if (s) return { id: s.id, name: s.name || 'Shape', containerId: s.containerId, groupId: s.groupId }
  return null
}

/** Ids of every element whose `containerId` references `elementId` (depth-1). */
export function getContainerChildIds(scene: Scene, elementId: string): string[] {
  return [
    ...scene.devices.filter((d) => d.containerId === elementId).map((d) => d.id),
    ...scene.textBoxes.filter((t) => t.containerId === elementId).map((t) => t.id),
    ...scene.images.filter((i) => i.containerId === elementId).map((i) => i.id),
    ...scene.shapes.filter((s) => s.containerId === elementId).map((s) => s.id)
  ]
}

/** True when the element has at least one child (i.e. it acts as a container). */
export function isContainer(scene: Scene, elementId: string): boolean {
  return getContainerChildIds(scene, elementId).length > 0
}

/** Ids of the whole editable scope for the active focus target (empty when unfocused). */
export function getFocusScopeIds(
  scene: Scene,
  focusGroupId: string | null,
  focusElementId: string | null
): string[] {
  if (focusGroupId) return getFocusSubtreeIds(scene, focusGroupId)
  if (focusElementId) return [focusElementId, ...getContainerChildIds(scene, focusElementId)]
  return []
}

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

/** True when no focus is active or the element belongs to the focused scope. */
export function isInFocusScope(
  id: string,
  focusGroupId: string | null,
  scene: Scene,
  focusElementId: string | null = null
): boolean {
  if (!focusGroupId && !focusElementId) return true
  // A focused container that no longer exists means the focus is stale —
  // treat it as unfocused rather than dimming everything.
  if (focusElementId && !findSceneElement(scene, focusElementId)) return true
  return getFocusScopeIds(scene, focusGroupId, focusElementId).includes(id)
}

/** Returns a predicate over element ids limited to the focused scope (no-op default). */
export function focusFilterFor(
  focusGroupId: string | null,
  scene: Scene,
  focusElementId: string | null = null
): FocusFilter {
  if (!focusGroupId && !focusElementId) return () => true
  if (focusElementId && !findSceneElement(scene, focusElementId)) return () => true
  const allowed = new Set(getFocusScopeIds(scene, focusGroupId, focusElementId))
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

/** Container-element ancestry from the root container down to the focused element. */
export function getContainerFocusPath(scene: Scene, elementId: string): FocusedElement[] {
  const path: FocusedElement[] = []
  const seen = new Set<string>()
  let current = findSceneElement(scene, elementId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    path.unshift(current)
    current = current.containerId ? findSceneElement(scene, current.containerId) : null
  }
  return path
}

/** Unified breadcrumb path for the active focus target (groups or containers). */
export function getFocusBreadcrumb(
  scene: Scene,
  focusGroupId: string | null,
  focusElementId: string | null
): { kind: 'group' | 'element'; id: string; name: string }[] {
  if (focusGroupId) {
    return getFocusPath(scene, focusGroupId).map((g) => ({ kind: 'group' as const, id: g.id, name: g.name }))
  }
  if (focusElementId) {
    return getContainerFocusPath(scene, focusElementId).map((el) => ({ kind: 'element' as const, id: el.id, name: el.name }))
  }
  return []
}

/** Union bounds of the visible members of the focused scope (for the ring). */
export function getFocusScopeBounds(
  scene: Scene,
  focusGroupId: string | null,
  focusElementId: string | null
): Rect | null {
  if (!focusGroupId && !focusElementId) return null
  const geometries = getFocusScopeIds(scene, focusGroupId, focusElementId)
    .map((id) => getElementGeometry(scene, id))
    .filter((el): el is ElementGeometry => !!el && el.visible)
  if (geometries.length === 0) return null
  return unionBounds(geometries)
}

/** Union bounds of the visible members of the focused subtree (for the ring). */
export function getFocusBounds(scene: Scene, focusGroupId: string | null): Rect | null {
  return getFocusScopeBounds(scene, focusGroupId, null)
}
