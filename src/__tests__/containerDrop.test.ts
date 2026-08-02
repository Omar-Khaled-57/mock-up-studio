/**
 * container-drop — pure drop-target resolution for the Select tool's
 * drag-to-nest gesture (nest into the element under the pointer, un-nest on
 * empty canvas, cycle guard, focus-scope gating).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../renderer/store'
import { resetStore, makeDevice, makeTextBox, makeShape, makeImage } from './helpers'
import {
  ContainerDropFocus,
  getElementContainerId,
  isNestedUnder,
  resolveContainerDrop,
  resolveContainerDropTarget
} from '../renderer/services/container-drop'

const NO_FOCUS: ContainerDropFocus = { focusGroupId: null, focusElementId: null }

function sceneWith(overrides: {
  devices?: ReturnType<typeof makeDevice>[]
  textBoxes?: ReturnType<typeof makeTextBox>[]
  images?: ReturnType<typeof makeImage>[]
  shapes?: ReturnType<typeof makeShape>[]
}) {
  const scene = useStore.getState().scenes[0]
  useStore.setState({
    scenes: [{
      ...scene,
      devices: overrides.devices ?? [],
      textBoxes: overrides.textBoxes ?? [],
      images: overrides.images ?? [],
      shapes: overrides.shapes ?? []
    }]
  })
  return useStore.getState().scenes[0]
}

const at = (x: number, y: number) => ({ x, y })

describe('getElementContainerId', () => {
  beforeEach(() => resetStore())

  it('resolves containerId across all four element kinds', () => {
    const scene = sceneWith({
      devices: [makeDevice({ id: 'dev', containerId: 'outer' })],
      textBoxes: [makeTextBox({ id: 'tb', containerId: 'outer' })],
      images: [makeImage({ id: 'img', containerId: 'outer' })],
      shapes: [makeShape({ id: 'shp', containerId: 'outer' })]
    })
    expect(getElementContainerId(scene, 'dev')).toBe('outer')
    expect(getElementContainerId(scene, 'tb')).toBe('outer')
    expect(getElementContainerId(scene, 'img')).toBe('outer')
    expect(getElementContainerId(scene, 'shp')).toBe('outer')
  })

  it('returns null for free elements and missing elements', () => {
    const scene = sceneWith({ devices: [makeDevice({ id: 'dev' })] })
    expect(getElementContainerId(scene, 'dev')).toBeNull()
    expect(getElementContainerId(scene, 'nope')).toBeNull()
  })
})

describe('isNestedUnder', () => {
  beforeEach(() => resetStore())

  it('detects direct and transitive nesting', () => {
    const scene = sceneWith({
      devices: [makeDevice({ id: 'a' }), makeDevice({ id: 'b', containerId: 'a' })],
      textBoxes: [makeTextBox({ id: 'c', containerId: 'b' })]
    })
    expect(isNestedUnder(scene, 'c', 'a')).toBe(true)
    expect(isNestedUnder(scene, 'b', 'a')).toBe(true)
    expect(isNestedUnder(scene, 'c', 'b')).toBe(true)
    expect(isNestedUnder(scene, 'a', 'c')).toBe(false)
    expect(isNestedUnder(scene, 'b', 'c')).toBe(false)
  })

  it('is cycle-safe on malformed self-referential containers', () => {
    const scene = sceneWith({ devices: [makeDevice({ id: 'a', containerId: 'a' })] })
    expect(isNestedUnder(scene, 'a', 'a')).toBe(false)
  })
})

describe('resolveContainerDropTarget', () => {
  beforeEach(() => resetStore())

  it('picks the topmost visible unlocked element containing the point', () => {
    const scene = sceneWith({
      devices: [makeDevice({ id: 'low', x: 0, y: 0, width: 200, height: 200, zIndex: 1 })],
      textBoxes: [makeTextBox({ id: 'high', x: 50, y: 50, width: 100, height: 100, zIndex: 9 })]
    })
    expect(resolveContainerDropTarget(scene, 'dragged', at(60, 60), NO_FOCUS)).toBe('high')
    expect(resolveContainerDropTarget(scene, 'dragged', at(10, 10), NO_FOCUS)).toBe('low')
  })

  it('never returns the dragged element itself or its descendants', () => {
    const scene = sceneWith({
      devices: [makeDevice({ id: 'parent', x: 0, y: 0, width: 200, height: 200, zIndex: 1 })],
      textBoxes: [makeTextBox({ id: 'child', containerId: 'parent', x: 50, y: 50, width: 100, height: 100, zIndex: 9 })]
    })
    // Dropping the parent over its own child is a cycle — no candidate.
    expect(resolveContainerDropTarget(scene, 'parent', at(60, 60), NO_FOCUS)).toBeNull()
    // Dropping the child over the parent stays in the parent (valid).
    expect(resolveContainerDropTarget(scene, 'child', at(60, 60), NO_FOCUS)).toBe('parent')
  })

  it('skips locked and hidden targets', () => {
    const scene = sceneWith({
      devices: [
        makeDevice({ id: 'locked', x: 0, y: 0, width: 200, height: 200, locked: true }),
        makeDevice({ id: 'hidden', x: 0, y: 0, width: 200, height: 200, visible: false })
      ],
      textBoxes: [makeTextBox({ id: 'free', x: 0, y: 0, width: 200, height: 200, zIndex: 5 })]
    })
    expect(resolveContainerDropTarget(scene, 'dragged', at(100, 100), NO_FOCUS)).toBe('free')
  })

  it('returns null when nothing valid is under the point', () => {
    const scene = sceneWith({ devices: [makeDevice({ id: 'd', x: 0, y: 0, width: 100, height: 100 })] })
    expect(resolveContainerDropTarget(scene, 'dragged', at(500, 500), NO_FOCUS)).toBeNull()
  })

  it('prefers the current parent over a sibling stacked on top', () => {
    const scene = sceneWith({
      devices: [makeDevice({ id: 'parent', x: 0, y: 0, width: 200, height: 200, zIndex: 1 })],
      textBoxes: [
        makeTextBox({ id: 'child', containerId: 'parent', x: 50, y: 50, width: 100, height: 100, zIndex: 2 }),
        makeTextBox({ id: 'sibling', containerId: 'parent', x: 60, y: 60, width: 80, height: 80, zIndex: 9 })
      ]
    })
    // Dropping the child over its sibling — still the parent, so no re-nest.
    expect(resolveContainerDropTarget(scene, 'child', at(70, 70), NO_FOCUS)).toBe('parent')
  })

  it('gates targets to the active focus scope', () => {
    const scene = sceneWith({
      devices: [
        makeDevice({ id: 'in', x: 0, y: 0, width: 200, height: 200, zIndex: 1 }),
        makeDevice({ id: 'out', x: 300, y: 0, width: 200, height: 200, zIndex: 2 })
      ]
    })
    const focus: ContainerDropFocus = { focusGroupId: null, focusElementId: 'in' }
    expect(resolveContainerDropTarget(scene, 'dragged', at(350, 100), focus)).toBeNull()
    expect(resolveContainerDropTarget(scene, 'dragged', at(100, 100), focus)).toBe('in')
  })
})

describe('resolveContainerDrop', () => {
  beforeEach(() => resetStore())

  it('nests a free element dropped onto a container', () => {
    const scene = sceneWith({
      devices: [makeDevice({ id: 'target', x: 0, y: 0, width: 200, height: 200 })],
      textBoxes: [makeTextBox({ id: 'dragged', x: 300, y: 300, width: 100, height: 100 })]
    })
    expect(resolveContainerDrop(scene, 'dragged', at(100, 100), NO_FOCUS)).toEqual({ type: 'nest', targetId: 'target' })
  })

  it('keeps a child dropped inside its current parent (no-op)', () => {
    const scene = sceneWith({
      devices: [makeDevice({ id: 'parent', x: 0, y: 0, width: 200, height: 200 })],
      textBoxes: [makeTextBox({ id: 'child', containerId: 'parent', x: 50, y: 50, width: 100, height: 100 })]
    })
    expect(resolveContainerDrop(scene, 'child', at(100, 100), NO_FOCUS)).toEqual({ type: 'none' })
  })

  it('re-nests a child dropped onto a different container', () => {
    const scene = sceneWith({
      devices: [
        makeDevice({ id: 'a', x: 0, y: 0, width: 200, height: 200 }),
        makeDevice({ id: 'b', x: 400, y: 0, width: 200, height: 200 })
      ],
      textBoxes: [makeTextBox({ id: 'child', containerId: 'a', x: 50, y: 50, width: 100, height: 100 })]
    })
    expect(resolveContainerDrop(scene, 'child', at(450, 100), NO_FOCUS)).toEqual({ type: 'nest', targetId: 'b' })
  })

  it('un-nests a child dropped on empty canvas', () => {
    const scene = sceneWith({
      devices: [makeDevice({ id: 'parent', x: 0, y: 0, width: 200, height: 200 })],
      textBoxes: [makeTextBox({ id: 'child', containerId: 'parent', x: 300, y: 300, width: 100, height: 100 })]
    })
    expect(resolveContainerDrop(scene, 'child', at(500, 500), NO_FOCUS)).toEqual({ type: 'unnest' })
  })

  it('does nothing for a free element dropped on empty canvas', () => {
    const scene = sceneWith({ textBoxes: [makeTextBox({ id: 'dragged', x: 300, y: 300, width: 100, height: 100 })] })
    expect(resolveContainerDrop(scene, 'dragged', at(500, 500), NO_FOCUS)).toEqual({ type: 'none' })
  })

  it('refuses to nest a container into its own descendant', () => {
    const scene = sceneWith({
      devices: [
        makeDevice({ id: 'parent', x: 0, y: 0, width: 200, height: 200 }),
        makeDevice({ id: 'other', x: 300, y: 300, width: 100, height: 100, zIndex: 9 })
      ],
      textBoxes: [makeTextBox({ id: 'child', containerId: 'parent', x: 50, y: 50, width: 100, height: 100 })]
    })
    // Dropping the parent onto its own child is blocked; onto 'other' is fine.
    expect(resolveContainerDrop(scene, 'parent', at(60, 60), NO_FOCUS)).toEqual({ type: 'none' })
    expect(resolveContainerDrop(scene, 'parent', at(350, 350), NO_FOCUS)).toEqual({ type: 'nest', targetId: 'other' })
  })
})
