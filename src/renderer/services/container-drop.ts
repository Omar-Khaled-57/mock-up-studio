/**
 * container-drop — pure drop-target resolution for drag-to-nest.
 *
 * Dragging an element with the Select tool and releasing it over another
 * element makes it a child of that element (`containerId`), clipping it to
 * the container's bounds at render time (Scene.tsx). Dropping a nested child
 * on empty canvas un-nests it (containerId → null). All decisions are pure
 * functions of the scene so the tool, the live drop ring, and tests share
 * one source of truth.
 *
 * Nesting rules:
 *  - The target must contain the pointer-up point and be visible and unlocked.
 *  - The target can never be the dragged element or one of its own descendants
 *    (cycle guard — a container can't be nested inside its own child).
 *  - While a focus scope is active (group or element), the target must belong
 *    to the scope — nesting into a dimmed element would edit outside focus.
 *  - A child released inside its current parent stays in that parent (the
 *    parent wins over any sibling on top), so repositioning inside a container
 *    never accidentally re-nests or un-nests.
 *  - The topmost (highest zIndex) valid candidate wins.
 *  - Releasing on empty canvas un-nests only when the dragged element is
 *    already a container child.
 */

import { Scene } from '@shared/types'
import { isInFocusScope } from './focus'
import { getSceneRect } from './parent-transform'

export interface ContainerDropFocus {
  focusGroupId: string | null
  focusElementId: string | null
}

export type ContainerDropResult =
  | { type: 'nest'; targetId: string }
  | { type: 'unnest' }
  | { type: 'none' }

/** The container element an element currently lives in, or null. */
export function getElementContainerId(scene: Scene, id: string): string | null {
  const d = scene.devices.find((el) => el.id === id)
  if (d) return d.containerId
  const t = scene.textBoxes.find((el) => el.id === id)
  if (t) return t.containerId
  const i = scene.images.find((el) => el.id === id)
  if (i) return i.containerId
  const s = scene.shapes.find((el) => el.id === id)
  return s?.containerId ?? null
}

/** True when `id` is nested (directly or transitively) under `ancestorId`. Cycle-safe. */
export function isNestedUnder(scene: Scene, id: string, ancestorId: string): boolean {
  const seen = new Set<string>()
  let current = getElementContainerId(scene, id)
  // A direct self-reference is malformed data, not a nested relationship.
  if (current === id) return false
  while (current && !seen.has(current)) {
    if (current === ancestorId) return true
    seen.add(current)
    current = getElementContainerId(scene, current)
  }
  return false
}

interface DropCandidate {
  id: string
  containerId: string | null
  zIndex: number
  x: number
  y: number
  width: number
  height: number
  visible: boolean
  locked: boolean
}

function collectElements(scene: Scene): DropCandidate[] {
  const elements: Array<{ id: string; containerId: string | null; zIndex: number; visible: boolean; locked: boolean }> = [
    ...scene.devices.map((d) => ({ id: d.id, containerId: d.containerId, zIndex: d.zIndex, visible: d.visible, locked: d.locked })),
    ...scene.textBoxes.map((t) => ({ id: t.id, containerId: t.containerId, zIndex: t.zIndex, visible: t.visible, locked: t.locked })),
    ...scene.images.map((i) => ({ id: i.id, containerId: i.containerId, zIndex: i.zIndex, visible: i.visible, locked: i.locked })),
    ...scene.shapes.map((s) => ({ id: s.id, containerId: s.containerId, zIndex: s.zIndex, visible: s.visible, locked: s.locked }))
  ]
  return elements.flatMap((el) => {
    const r = getSceneRect(scene, el.id)
    return [{ ...el, x: r.x, y: r.y, width: r.width, height: r.height }]
  })
}

function contains(candidate: DropCandidate, point: { x: number; y: number }): boolean {
  return (
    point.x >= candidate.x &&
    point.x <= candidate.x + candidate.width &&
    point.y >= candidate.y &&
    point.y <= candidate.y + candidate.height
  )
}

/**
 * The valid container under `point` (or null). Used both for the live drop
 * ring while dragging and, via resolveContainerDrop, for the commit decision.
 */
export function resolveContainerDropTarget(
  scene: Scene,
  draggedId: string,
  point: { x: number; y: number },
  focus: ContainerDropFocus
): string | null {
  const currentParent = getElementContainerId(scene, draggedId)
  let best: DropCandidate | null = null

  for (const el of collectElements(scene)) {
    if (!el.visible || el.locked) continue
    if (el.id === draggedId) continue
    // A container can never be nested inside one of its own descendants.
    if (isNestedUnder(scene, el.id, draggedId)) continue
    if (!contains(el, point)) continue
    if ((focus.focusGroupId || focus.focusElementId) && !isInFocusScope(el.id, focus.focusGroupId, scene, focus.focusElementId)) {
      continue
    }
    // Repositioning inside the current parent always stays there — the parent
    // beats any sibling stacked on top.
    if (el.id === currentParent) return el.id
    if (!best || el.zIndex > best.zIndex) best = el
  }

  return best ? best.id : null
}

/** What a pointer-up at `point` should do: nest, un-nest, or nothing. */
export function resolveContainerDrop(
  scene: Scene,
  draggedId: string,
  point: { x: number; y: number },
  focus: ContainerDropFocus
): ContainerDropResult {
  const currentParent = getElementContainerId(scene, draggedId)
  const target = resolveContainerDropTarget(scene, draggedId, point, focus)
  if (target) return target === currentParent ? { type: 'none' } : { type: 'nest', targetId: target }
  if (currentParent) return { type: 'unnest' }
  return { type: 'none' }
}
