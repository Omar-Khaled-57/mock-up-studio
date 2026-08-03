/**
 * selection-chrome — resolves which selected elements get chrome and where it
 * is drawn. Pure logic feeding the OverlayRenderer (which sits outside the
 * `[data-scene-export]` node).
 */
import { describe, it, expect } from 'vitest'
import { useStore } from '../renderer/store'
import {
  collectSelectionChrome,
  getElementGeometry,
  selectionUnionBounds
} from '../renderer/services/selection-chrome'
import { resetStore, makeDevice, makeTextBox, makeImage, makeShape } from './helpers'

function sceneWith(elements: { devices?: import('@shared/types').Device[]; textBoxes?: import('@shared/types').TextBox[]; images?: import('@shared/types').ImageOverlay[]; shapes?: import('@shared/types').Shape[]; groups?: import('@shared/types').ElementGroup[] }) {
  const scene = useStore.getState().scenes[0]
  return {
    ...scene,
    devices: elements.devices ?? [],
    textBoxes: elements.textBoxes ?? [],
    images: elements.images ?? [],
    shapes: elements.shapes ?? [],
    groups: elements.groups ?? []
  }
}

describe('getElementGeometry', () => {
  it('returns null for an unknown id', () => {
    expect(getElementGeometry(sceneWith({}), 'nope')).toBeNull()
  })

  it('resolves each element kind to its geometry', () => {
    const device = makeDevice({ id: 'd-1' })
    const textBox = makeTextBox({ id: 't-1' })
    const image = makeImage({ id: 'i-1' })
    const shape = makeShape({ id: 's-1' })
    const scene = sceneWith({ devices: [device], textBoxes: [textBox], images: [image], shapes: [shape] })

    expect(getElementGeometry(scene, 'd-1')).toMatchObject({ kind: 'device', x: 100, y: 100, width: 600, height: 400, rotation: 0, locked: false })
    expect(getElementGeometry(scene, 't-1')).toMatchObject({ kind: 'textBox', locked: false })
    expect(getElementGeometry(scene, 'i-1')).toMatchObject({ kind: 'image', locked: false })
    expect(getElementGeometry(scene, 's-1')).toMatchObject({ kind: 'shape', locked: false })
  })
})

describe('collectSelectionChrome', () => {
  beforeEach(() => {
    resetStore()
  })

  it('collects a selected visible unlocked element', () => {
    const device = makeDevice({ id: 'd-1' })
    const scene = sceneWith({ devices: [device] })
    const items = collectSelectionChrome(scene, ['d-1'])
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'd-1', kind: 'device', groupId: null, groupName: null })
    expect(items[0].bounds).toEqual({ x: 100, y: 100, width: 600, height: 400 })
  })

  it('skips locked and hidden elements', () => {
    const locked = makeDevice({ id: 'd-locked', locked: true })
    const hidden = makeDevice({ id: 'd-hidden', visible: false })
    const scene = sceneWith({ devices: [locked, hidden] })
    expect(collectSelectionChrome(scene, ['d-locked', 'd-hidden'])).toHaveLength(0)
  })

  it('resolves the group name for grouped elements', () => {
    const shape = makeShape({ id: 's-1', groupId: 'g-1' })
    const scene = sceneWith({ shapes: [shape], groups: [{ id: 'g-1', name: 'Hero', childIds: ['s-1'], parentGroupId: null }] })
    const items = collectSelectionChrome(scene, ['s-1'])
    expect(items[0].groupId).toBe('g-1')
    expect(items[0].groupName).toBe('Hero')
  })

  it('carries the element rotation alongside the unrotated box', () => {
    const shape = makeShape({ id: 's-1', x: 0, y: 0, width: 100, height: 100, rotation: 90 })
    const scene = sceneWith({ shapes: [shape] })
    const items = collectSelectionChrome(scene, ['s-1'])
    expect(items[0].rotation).toBe(90)
    expect(items[0].bounds).toEqual({ x: 0, y: 0, width: 100, height: 100 })
  })

  it('defaults rotation to 0 for unrotated elements', () => {
    const device = makeDevice({ id: 'd-1', x: 10, y: 20, width: 100, height: 50 })
    const items = collectSelectionChrome(sceneWith({ devices: [device] }), ['d-1'])
    expect(items[0].rotation).toBe(0)
    expect(items[0].bounds).toEqual({ x: 10, y: 20, width: 100, height: 50 })
  })

  it('composes chrome bounds for a nested element under a translated parent', () => {
    const parent = makeDevice({ id: 'par-1', x: 100, y: 100, width: 400, height: 300 })
    const child = makeDevice({ id: 'ch-1', x: 20, y: 20, width: 100, height: 100, containerId: 'par-1' })
    const items = collectSelectionChrome(sceneWith({ devices: [parent, child] }), ['ch-1'])
    expect(items[0].bounds).toEqual({ x: 120, y: 120, width: 100, height: 100 })
    expect(items[0].rotation).toBe(0)
  })

  it('composes chrome bounds and total rotation for a child of a rotated parent', () => {
    const parent = makeDevice({ id: 'par-1', x: 100, y: 50, width: 200, height: 100, rotation: 90 })
    const child = makeDevice({ id: 'ch-1', x: 30, y: 20, width: 100, height: 100, containerId: 'par-1' })
    const items = collectSelectionChrome(sceneWith({ devices: [parent, child] }), ['ch-1'])
    expect(items[0].rotation).toBe(90)
    expect(items[0].bounds.x).toBeCloseTo(130, 10)
    expect(items[0].bounds.y).toBeCloseTo(30, 10)
    expect(items[0].bounds.width).toBe(100)
    expect(items[0].bounds.height).toBe(100)
  })
})

describe('selectionUnionBounds', () => {
  it('returns null for an empty collection', () => {
    expect(selectionUnionBounds([])).toBeNull()
  })

  it('unions the rotated bounds of multiple items', () => {
    const device = makeDevice({ id: 'd-1', x: 0, y: 0, width: 100, height: 100 })
    const textBox = makeTextBox({ id: 't-1', x: 200, y: 300, width: 50, height: 50 })
    const scene = sceneWith({ devices: [device], textBoxes: [textBox] })
    const items = collectSelectionChrome(scene, ['d-1', 't-1'])
    expect(selectionUnionBounds(items)).toEqual({ x: 0, y: 0, width: 250, height: 350 })
  })

  it('is still rotation-aware (rotated box AABB drives the union)', () => {
    const shape = makeShape({ id: 's-1', x: 0, y: 0, width: 100, height: 100, rotation: 45 })
    const items = collectSelectionChrome(sceneWith({ shapes: [shape] }), ['s-1'])
    const union = selectionUnionBounds(items)!
    expect(union.x).toBeCloseTo(-20.71, 1)
    expect(union.y).toBeCloseTo(-20.71, 1)
    expect(union.width).toBeCloseTo(141.42, 1)
    expect(union.height).toBeCloseTo(141.42, 1)
  })
})
