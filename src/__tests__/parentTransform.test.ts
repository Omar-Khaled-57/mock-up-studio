import { describe, it, expect } from 'vitest'
import { Scene } from '@shared/types'
import {
  getComposedBox,
  getParentChain,
  getSceneTransform,
  localToScene,
  sceneToLocal,
  getSceneRect,
  rescaleChildGeometry
} from '../renderer/services/parent-transform'
import { getRotatedBounds } from '../renderer/services/geometry'
import { makeDevice, makeTextBox, makeShape, makeImage } from './helpers'

function makeScene(els: {
  devices?: ReturnType<typeof makeDevice>[]
  textBoxes?: ReturnType<typeof makeTextBox>[]
  images?: ReturnType<typeof makeImage>[]
  shapes?: ReturnType<typeof makeShape>[]
}): Scene {
  return {
    id: 's1',
    name: 'Test',
    pinned: false,
    canvas: { width: 1280, height: 800, aspectRatio: '16:10' },
    background: { type: 'solid', color: '#000000' },
    devices: els.devices ?? [],
    textBoxes: els.textBoxes ?? [],
    images: els.images ?? [],
    shapes: els.shapes ?? [],
    guides: [],
    grid: { enabled: false, size: 10, color: '#000000', opacity: 0.5, snapEnabled: false, style: 'lines' },
    groups: [],
    masks: []
  }
}

describe('parent-transform', () => {
  describe('getParentChain', () => {
    it('returns just the element for a root (no containerId)', () => {
      const scene = makeScene({ devices: [makeDevice({ id: 'a', x: 100, y: 50 })] })
      expect(getParentChain(scene, 'a')).toEqual(['a'])
    })

    it('walks containerId ancestors from the root down to the element', () => {
      const scene = makeScene({
        devices: [
          makeDevice({ id: 'root', x: 0, y: 0 }),
          makeDevice({ id: 'mid', x: 50, y: 50, containerId: 'root' }),
          makeDevice({ id: 'leaf', x: 10, y: 10, containerId: 'mid' })
        ]
      })
      expect(getParentChain(scene, 'leaf')).toEqual(['root', 'mid', 'leaf'])
    })

    it('drops a dangling containerId (element treated as root)', () => {
      const scene = makeScene({ devices: [makeDevice({ id: 'c', x: 10, y: 20, containerId: 'missing' })] })
      expect(getParentChain(scene, 'c')).toEqual(['c'])
    })

    it('is cycle-safe for a containerId loop', () => {
      const scene = makeScene({
        devices: [
          makeDevice({ id: 'a', x: 0, y: 0, containerId: 'b' }),
          makeDevice({ id: 'b', x: 10, y: 10, containerId: 'a' })
        ]
      })
      expect(getParentChain(scene, 'a').length).toBeLessThanOrEqual(2)
      expect(getParentChain(scene, 'b').length).toBeLessThanOrEqual(2)
    })
  })

  describe('getSceneTransform / getSceneRect (roots)', () => {
    it('returns the raw geometry for an unrotated root', () => {
      const scene = makeScene({ devices: [makeDevice({ id: 'a', x: 100, y: 50, width: 200, height: 100 })] })
      expect(getSceneTransform(scene, 'a')).toEqual({ x: 100, y: 50, rotation: 0 })
      expect(getSceneRect(scene, 'a')).toEqual({ x: 100, y: 50, width: 200, height: 100 })
    })

    it('composes a rotated root top-left through its center pivot', () => {
      const scene = makeScene({ devices: [makeDevice({ id: 'a', x: 100, y: 50, width: 200, height: 100, rotation: 45 })] })
      const t = getSceneTransform(scene, 'a')
      expect(t.rotation).toBe(45)
      // 200x100 rotated 45° about center (200,100): TL corner (100,50) → (164.64, -6.07)
      expect(t.x).toBeCloseTo(164.64, 1)
      expect(t.y).toBeCloseTo(-6.07, 1)
      const r = getSceneRect(scene, 'a')
      expect(r.width).toBeCloseTo(212.13, 1)
      expect(r.height).toBeCloseTo(212.13, 1)
    })

    it('returns a zero rect for a missing element', () => {
      const scene = makeScene({})
      expect(getSceneRect(scene, 'nope')).toEqual({ x: 0, y: 0, width: 0, height: 0 })
      expect(getSceneTransform(scene, 'nope')).toEqual({ x: 0, y: 0, rotation: 0 })
    })
  })

  describe('child composition', () => {
    it('offsets a child by its parent top-left when the parent is unrotated', () => {
      const scene = makeScene({
        devices: [
          makeDevice({ id: 'p', x: 100, y: 50, width: 600, height: 400 }),
          makeDevice({ id: 'c', x: 30, y: 20, width: 100, height: 100, containerId: 'p' })
        ]
      })
      expect(getSceneTransform(scene, 'c')).toEqual({ x: 130, y: 70, rotation: 0 })
      expect(getSceneRect(scene, 'c')).toEqual({ x: 130, y: 70, width: 100, height: 100 })
    })

    it('composes rotation through a rotated parent (center pivot)', () => {
      const scene = makeScene({
        devices: [
          makeDevice({ id: 'p', x: 100, y: 50, width: 200, height: 100, rotation: 90 }),
          makeDevice({ id: 'c', x: 30, y: 20, width: 100, height: 100, containerId: 'p' })
        ]
      })
      const t = getSceneTransform(scene, 'c')
      expect(t.rotation).toBe(90)
      // child offset (30,20) in a 200x100 parent at (100,50) rotated 90° about (200,100):
      // unrotated TL (130,70) → (230, 30)
      expect(t.x).toBeCloseTo(230, 1)
      expect(t.y).toBeCloseTo(30, 1)
      // 100x100 child rotated 90° → AABB is a 100x100 box at the child's scene center (180,80)
      const r = getSceneRect(scene, 'c')
      expect(r.x).toBeCloseTo(130, 1)
      expect(r.y).toBeCloseTo(30, 1)
      expect(r.width).toBeCloseTo(100, 1)
      expect(r.height).toBeCloseTo(100, 1)
    })

    it('sums rotations across the whole chain', () => {
      const scene = makeScene({
        devices: [
          makeDevice({ id: 'p', x: 0, y: 0, width: 100, height: 100, rotation: 90 }),
          makeDevice({ id: 'c', x: 0, y: 0, width: 100, height: 100, rotation: 45, containerId: 'p' })
        ]
      })
      expect(getSceneTransform(scene, 'c').rotation).toBe(135)
    })

    it('composes a nested chain (3 levels) with mixed rotation and translation', () => {
      const scene = makeScene({
        devices: [
          makeDevice({ id: 'root', x: 0, y: 0, width: 200, height: 200, rotation: 45 }),
          makeDevice({ id: 'mid', x: 50, y: 50, width: 100, height: 100, rotation: 90, containerId: 'root' }),
          makeImage({ id: 'leaf', x: 10, y: 10, width: 50, height: 50, containerId: 'mid' })
        ]
      })
      const t = getSceneTransform(scene, 'leaf')
      expect(t.rotation).toBeCloseTo(135, 1)
      expect(t.x).toBeCloseTo(156.57, 1)
      expect(t.y).toBeCloseTo(100, 1)
      // mid's scene top-left = (170.71, 100)
      const mid = getSceneTransform(scene, 'mid')
      expect(mid.x).toBeCloseTo(170.71, 1)
      expect(mid.y).toBeCloseTo(100, 1)
    })
  })

  describe('getComposedBox', () => {
    it('returns the stored box verbatim for a root', () => {
      const scene = makeScene({ devices: [makeDevice({ id: 'a', x: 100, y: 50, width: 200, height: 100, rotation: 45 })] })
      expect(getComposedBox(scene, 'a')).toEqual({ id: 'a', x: 100, y: 50, width: 200, height: 100, rotation: 45 })
    })

    it('resolves a child of an unrotated parent to the offset box', () => {
      const scene = makeScene({
        devices: [
          makeDevice({ id: 'p', x: 100, y: 50, width: 600, height: 400 }),
          makeDevice({ id: 'c', x: 30, y: 20, width: 100, height: 100, containerId: 'p' })
        ]
      })
      expect(getComposedBox(scene, 'c')).toEqual({ id: 'c', x: 130, y: 70, width: 100, height: 100, rotation: 0 })
    })

    it('returns null for a missing element', () => {
      expect(getComposedBox(makeScene({}), 'nope')).toBeNull()
    })

    it('its getRotatedBounds equals getSceneRect for a rotated-parent child', () => {
      const scene = makeScene({
        devices: [
          makeDevice({ id: 'p', x: 100, y: 50, width: 200, height: 100, rotation: 90 }),
          makeDevice({ id: 'c', x: 30, y: 20, width: 100, height: 100, containerId: 'p' })
        ]
      })
      const box = getComposedBox(scene, 'c')!
      expect(box.rotation).toBeCloseTo(90, 10)
      expect(box.x).toBeCloseTo(130, 10)
      expect(box.y).toBeCloseTo(30, 10)
      expect(box.width).toBeCloseTo(100, 10)
      expect(box.height).toBeCloseTo(100, 10)
      const viaRotated = getRotatedBounds(box)
      const viaRect = getSceneRect(scene, 'c')
      expect(viaRotated.x).toBeCloseTo(viaRect.x, 10)
      expect(viaRotated.y).toBeCloseTo(viaRect.y, 10)
      expect(viaRotated.width).toBeCloseTo(viaRect.width, 10)
      expect(viaRotated.height).toBeCloseTo(viaRect.height, 10)
    })

    it('carries the total rotation for a 3-level chain child', () => {
      const scene = makeScene({
        devices: [
          makeDevice({ id: 'root', x: 0, y: 0, width: 200, height: 200, rotation: 45 }),
          makeDevice({ id: 'mid', x: 50, y: 50, width: 100, height: 100, rotation: 90, containerId: 'root' }),
          makeImage({ id: 'leaf', x: 10, y: 10, width: 50, height: 50, containerId: 'mid' })
        ]
      })
      const box = getComposedBox(scene, 'leaf')!
      expect(box.rotation).toBeCloseTo(135, 10)
      // getRotatedBounds(composedBox) is the true composed AABB (getSceneRect).
      const viaRotated = getRotatedBounds(box)
      const viaRect = getSceneRect(scene, 'leaf')
      expect(viaRotated.x).toBeCloseTo(viaRect.x, 10)
      expect(viaRotated.y).toBeCloseTo(viaRect.y, 10)
      expect(viaRotated.width).toBeCloseTo(viaRect.width, 10)
      expect(viaRotated.height).toBeCloseTo(viaRect.height, 10)
    })
  })

  describe('localToScene / sceneToLocal', () => {
    it('round-trips through an unrotated parent', () => {
      const scene = makeScene({
        devices: [
          makeDevice({ id: 'p', x: 100, y: 50, width: 200, height: 100 }),
          makeDevice({ id: 'c', x: 30, y: 20, width: 100, height: 100, containerId: 'p' })
        ]
      })
      const sp = localToScene(scene, 'p', { x: 30, y: 20 })
      expect(sp).toEqual({ x: 130, y: 70 })
      expect(sceneToLocal(scene, 'p', sp)).toEqual({ x: 30, y: 20 })
      expect(localToScene(scene, 'c', { x: 5, y: 5 })).toEqual({ x: 135, y: 75 })
    })

    it('round-trips through a rotated parent', () => {
      const scene = makeScene({
        devices: [
          makeDevice({ id: 'p', x: 100, y: 50, width: 200, height: 100, rotation: 90 }),
          makeDevice({ id: 'c', x: 30, y: 20, width: 100, height: 100, containerId: 'p' })
        ]
      })
      const sp = localToScene(scene, 'p', { x: 30, y: 20 })
      // p's box top-left rotates 90° about center (200,100) → (250,0); local (30,20) → (230,30)
      expect(sp.x).toBeCloseTo(230, 1)
      expect(sp.y).toBeCloseTo(30, 1)
      const back = sceneToLocal(scene, 'p', sp)
      expect(back.x).toBeCloseTo(30, 1)
      expect(back.y).toBeCloseTo(20, 1)
    })

    it('round-trips multiple points through a 3-level chain', () => {
      const scene = makeScene({
        devices: [
          makeDevice({ id: 'root', x: 0, y: 0, width: 200, height: 200, rotation: 45 }),
          makeDevice({ id: 'mid', x: 50, y: 50, width: 100, height: 100, rotation: 90, containerId: 'root' }),
          makeImage({ id: 'leaf', x: 10, y: 10, width: 50, height: 50, containerId: 'mid' })
        ]
      })
      for (const p of [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 25, y: 10 },
        { x: -3, y: 12 }
      ]) {
        const sp = localToScene(scene, 'leaf', p)
        const back = sceneToLocal(scene, 'leaf', sp)
        expect(back.x).toBeCloseTo(p.x, 1)
        expect(back.y).toBeCloseTo(p.y, 1)
      }
    })
  })

  describe('element kinds', () => {
    it('resolves textBox, image and shape children through the same chain', () => {
      const scene = makeScene({
        devices: [makeDevice({ id: 'p', x: 0, y: 0, width: 100, height: 100 })],
        textBoxes: [makeTextBox({ id: 'tb', x: 5, y: 5, width: 50, height: 20, containerId: 'p' })],
        images: [makeImage({ id: 'im', x: 5, y: 5, width: 50, height: 20, containerId: 'p' })],
        shapes: [makeShape({ id: 'sh', x: 5, y: 5, width: 50, height: 20, containerId: 'p' })]
      })
      expect(getSceneTransform(scene, 'tb')).toEqual({ x: 5, y: 5, rotation: 0 })
      expect(getSceneTransform(scene, 'im')).toEqual({ x: 5, y: 5, rotation: 0 })
      expect(getSceneTransform(scene, 'sh')).toEqual({ x: 5, y: 5, rotation: 0 })
    })

    it('keeps a textBox child frame unrotated (textBox has no rotation)', () => {
      const scene = makeScene({
        devices: [
          makeDevice({ id: 'p', x: 0, y: 0, width: 100, height: 100, rotation: 90 }),
          makeTextBox({ id: 'tb', x: 0, y: 0, width: 50, height: 20, containerId: 'p' })
        ]
      })
      const t = getSceneTransform(scene, 'tb')
      expect(t.rotation).toBe(90)
      expect(t.x).toBeCloseTo(100, 1)
      expect(t.y).toBeCloseTo(0, 1)
    })
  })

  describe('rescaleChildGeometry', () => {
    const child = { id: 'c', x: 10, y: 20, width: 100, height: 50, rotation: 0 }

    it('scales local offset and dimensions proportionally per axis', () => {
      expect(rescaleChildGeometry(child, 100, 200, 150, 100)).toEqual({ x: 15, y: 10, width: 150, height: 25 })
    })

    it('leaves an axis unchanged when the old dimension is degenerate', () => {
      expect(rescaleChildGeometry(child, 0, 200, 150, 100)).toEqual({ x: 10, y: 10, width: 100, height: 25 })
      expect(rescaleChildGeometry(child, 100, 0, 150, 100)).toEqual({ x: 15, y: 20, width: 150, height: 50 })
    })

    it('rounds to 2dp to avoid float drift', () => {
      expect(rescaleChildGeometry({ ...child, x: 33, width: 33 }, 3, 1, 2, 2)).toEqual({
        x: 22,
        y: 40,
        width: 22,
        height: 100
      })
    })
  })
})
