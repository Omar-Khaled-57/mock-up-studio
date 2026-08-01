/**
 * selection-chrome — resolves which scene elements get selection chrome and
 * where. The OverlayRenderer consumes this so selection chrome renders
 * outside the `[data-scene-export]` node (fixing the export leak).
 *
 * Chrome is only drawn for selected elements that are visible and unlocked,
 * matching the pre-M6 behavior where `isSelected && !locked` gates were
 * baked into the element components.
 */

import { Scene } from '@shared/types'
import { ElementLike, getRotatedBounds, Rect, unionBounds } from './geometry'
import { SceneElementKind } from './hit-test'

export interface SelectionChromeItem {
  id: string
  kind: SceneElementKind
  bounds: Rect
  groupId: string | null
  groupName: string | null
}

export interface ElementGeometry extends ElementLike {
  kind: SceneElementKind
  visible: boolean
  locked: boolean
  groupId: string | null
}

export function getElementGeometry(scene: Scene, id: string): ElementGeometry | null {
  const d = scene.devices.find((el) => el.id === id)
  if (d) return { id: d.id, kind: 'device', x: d.x, y: d.y, width: d.width, height: d.height, rotation: d.rotation, visible: d.visible, locked: d.locked, groupId: d.groupId }
  const t = scene.textBoxes.find((el) => el.id === id)
  if (t) return { id: t.id, kind: 'textBox', x: t.x, y: t.y, width: t.width, height: t.height, visible: t.visible, locked: t.locked, groupId: t.groupId }
  const i = scene.images.find((el) => el.id === id)
  if (i) return { id: i.id, kind: 'image', x: i.x, y: i.y, width: i.width, height: i.height, rotation: i.rotation, visible: i.visible, locked: i.locked, groupId: i.groupId }
  const s = scene.shapes.find((el) => el.id === id)
  if (s) return { id: s.id, kind: 'shape', x: s.x, y: s.y, width: s.width, height: s.height, rotation: s.rotation, visible: s.visible, locked: s.locked, groupId: s.groupId }
  return null
}

export function collectSelectionChrome(scene: Scene, ids: string[]): SelectionChromeItem[] {
  const nameFor = (gid: string | null): string | null =>
    gid ? scene.groups.find((g) => g.id === gid)?.name ?? null : null

  const items: SelectionChromeItem[] = []
  for (const id of ids) {
    const el = getElementGeometry(scene, id)
    if (!el || !el.visible || el.locked) continue
    items.push({
      id: el.id,
      kind: el.kind,
      bounds: getRotatedBounds(el),
      groupId: el.groupId,
      groupName: nameFor(el.groupId)
    })
  }
  return items
}

export function selectionUnionBounds(items: SelectionChromeItem[]): Rect | null {
  return unionBounds(items.map((i) => ({ id: i.id, ...i.bounds })))
}
