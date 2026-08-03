import { Scene } from '@shared/types'
import { ElementLike, getRotatedBounds } from './geometry'
import { getComposedBox } from './parent-transform'

export type SceneElementKind = 'device' | 'textBox' | 'image' | 'shape'

export interface HitTestElement extends ElementLike {
  kind: SceneElementKind
  visible: boolean
  locked: boolean
  zIndex: number
}

export interface HitTestResult {
  id: string
  kind: SceneElementKind
  zIndex: number
  locked: boolean
}

/**
 * Maps a per-kind element array to composed scene-space hit elements. Children
 * (elements with a `containerId`) resolve through `getComposedBox`, so their
 * box reflects the whole parent chain and `getRotatedBounds` on the result is
 * the true composed AABB.
 */
function composedHitElements(
  scene: Scene,
  kind: SceneElementKind,
  elements: { id: string; zIndex: number; locked: boolean; visible: boolean }[]
): HitTestElement[] {
  return elements
    .filter((el) => el.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .flatMap((el) => {
      const box = getComposedBox(scene, el.id)
      if (!box) return []
      return [
        {
          id: el.id,
          kind,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          rotation: box.rotation,
          zIndex: el.zIndex,
          locked: el.locked,
          visible: true
        }
      ]
    })
}

export function collectSceneElements(scene: Scene): HitTestElement[] {
  const devices = composedHitElements(scene, 'device', scene.devices)
  const textBoxes = composedHitElements(scene, 'textBox', scene.textBoxes)
  const images = composedHitElements(scene, 'image', scene.images)
  const shapes = composedHitElements(scene, 'shape', scene.shapes)
  return [...devices, ...textBoxes, ...images, ...shapes].sort((a, b) => a.zIndex - b.zIndex)
}

export function hitTest(scene: Scene, point: { x: number; y: number }): HitTestResult | null {
  const elements = collectSceneElements(scene)
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]
    const bounds = getRotatedBounds(el)
    if (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    ) {
      return { id: el.id, kind: el.kind, zIndex: el.zIndex, locked: el.locked }
    }
  }
  return null
}
