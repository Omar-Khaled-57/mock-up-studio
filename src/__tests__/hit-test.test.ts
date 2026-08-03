/**
 * hit-test tests — top-down z-merge hit testing with rotation-aware bounds.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { hitTest } from '../renderer/services/hit-test'
import { createDefaultScene } from '../renderer/store/sceneSlice'
import { makeDevice, makeTextBox, makeImage, makeShape } from './helpers'
import { Scene } from '@shared/types'

let scene: Scene

beforeEach(() => {
  scene = createDefaultScene()
  scene.textBoxes = []
})

describe('hitTest', () => {
  it('returns null on an empty scene', () => {
    expect(hitTest(scene, { x: 300, y: 300 })).toBeNull()
  })

  it('hits a single device inside its bounds', () => {
    scene.devices = [makeDevice({ id: 'dev-1', x: 100, y: 100, width: 200, height: 100 })]
    expect(hitTest(scene, { x: 150, y: 150 })).toEqual({
      id: 'dev-1',
      kind: 'device',
      zIndex: 0,
      locked: false
    })
  })

  it('misses a point outside bounds', () => {
    scene.devices = [makeDevice({ id: 'dev-1', x: 100, y: 100, width: 200, height: 100 })]
    expect(hitTest(scene, { x: 400, y: 400 })).toBeNull()
  })

  it('returns the topmost element by zIndex', () => {
    scene.devices = [makeDevice({ id: 'back', x: 100, y: 100, width: 200, height: 200, zIndex: 0 })]
    scene.shapes = [makeShape({ id: 'front', x: 100, y: 100, width: 200, height: 200, zIndex: 5 })]
    expect(hitTest(scene, { x: 150, y: 150 })?.id).toBe('front')
  })

  it('uses render order to break zIndex ties (shapes over devices)', () => {
    scene.devices = [makeDevice({ id: 'device', x: 100, y: 100, width: 200, height: 200, zIndex: 1 })]
    scene.shapes = [makeShape({ id: 'shape', x: 100, y: 100, width: 200, height: 200, zIndex: 1 })]
    expect(hitTest(scene, { x: 150, y: 150 })?.id).toBe('shape')
  })

  it('ignores invisible elements', () => {
    scene.devices = [
      makeDevice({ id: 'hidden', x: 0, y: 0, width: 500, height: 500, visible: false }),
      makeDevice({ id: 'shown', x: 10, y: 10, width: 50, height: 50, zIndex: 5 })
    ]
    expect(hitTest(scene, { x: 20, y: 20 })?.id).toBe('shown')
  })

  it('reports locked elements but still hits them', () => {
    scene.devices = [makeDevice({ id: 'locked', x: 0, y: 0, width: 100, height: 100, locked: true })]
    const result = hitTest(scene, { x: 50, y: 50 })
    expect(result?.id).toBe('locked')
    expect(result?.locked).toBe(true)
  })

  it('uses rotation-aware bounds', () => {
    scene.devices = [makeDevice({ id: 'rot', x: 100, y: 100, width: 100, height: 50, rotation: 90 })]
    const bounds = { x: 100 + 50 - 25, y: 100 + 25 - 50, width: 50, height: 100 }
    expect(hitTest(scene, { x: bounds.x + 1, y: bounds.y + 1 })?.id).toBe('rot')
    expect(hitTest(scene, { x: 105, y: 105 })).toBeNull()
  })

  it('hits text boxes and images', () => {
    scene.textBoxes = [makeTextBox({ id: 'tb', x: 50, y: 50, width: 100, height: 40, zIndex: 1 })]
    scene.images = [makeImage({ id: 'img', x: 10, y: 10, width: 30, height: 30, zIndex: 2 })]
    expect(hitTest(scene, { x: 60, y: 60 })?.kind).toBe('textBox')
    expect(hitTest(scene, { x: 20, y: 20 })?.kind).toBe('image')
  })

  it('hits a child at its composed position under a translated parent', () => {
    scene.devices = [
      makeDevice({ id: 'par', x: 100, y: 100, width: 400, height: 300, zIndex: 0 }),
      makeDevice({ id: 'child', x: 20, y: 20, width: 100, height: 100, zIndex: 1, containerId: 'par' })
    ]
    expect(hitTest(scene, { x: 120, y: 120 })?.id).toBe('child')
    expect(hitTest(scene, { x: 150, y: 350 })?.id).toBe('par')
  })

  it('hits a child of a rotated parent through its composed AABB', () => {
    scene.devices = [
      makeDevice({ id: 'par', x: 100, y: 50, width: 200, height: 100, rotation: 90, zIndex: 0 }),
      makeDevice({ id: 'child', x: 30, y: 20, width: 100, height: 100, zIndex: 1, containerId: 'par' })
    ]
    // composed AABB of the child = { x: 130, y: 30, width: 100, height: 100 }
    expect(hitTest(scene, { x: 131, y: 31 })?.id).toBe('child')
    // inside the raw local box (30,20,100,100) but outside the composed AABB → miss
    expect(hitTest(scene, { x: 35, y: 25 })).toBeNull()
  })
})
