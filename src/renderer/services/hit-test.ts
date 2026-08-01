import { Scene } from '@shared/types'
import { ElementLike, getRotatedBounds } from './geometry'

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

export function collectSceneElements(scene: Scene): HitTestElement[] {
  const devices: HitTestElement[] = scene.devices
    .filter((d) => d.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((d) => ({
      id: d.id,
      kind: 'device' as const,
      x: d.x,
      y: d.y,
      width: d.width,
      height: d.height,
      rotation: d.rotation,
      zIndex: d.zIndex,
      locked: d.locked,
      visible: true
    }))

  const textBoxes: HitTestElement[] = scene.textBoxes
    .filter((t) => t.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((t) => ({
      id: t.id,
      kind: 'textBox' as const,
      x: t.x,
      y: t.y,
      width: t.width,
      height: t.height,
      zIndex: t.zIndex,
      locked: t.locked,
      visible: true
    }))

  const images: HitTestElement[] = scene.images
    .filter((i) => i.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((i) => ({
      id: i.id,
      kind: 'image' as const,
      x: i.x,
      y: i.y,
      width: i.width,
      height: i.height,
      rotation: i.rotation,
      zIndex: i.zIndex,
      locked: i.locked,
      visible: true
    }))

  const shapes: HitTestElement[] = scene.shapes
    .filter((s) => s.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((s) => ({
      id: s.id,
      kind: 'shape' as const,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      rotation: s.rotation,
      zIndex: s.zIndex,
      locked: s.locked,
      visible: true
    }))

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
