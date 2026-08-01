/**
 * focus service tests — subtree resolution, focus scoping, path resolution,
 * and union bounds for the focus ring.
 */
import { describe, it, expect } from 'vitest'
import { Scene } from '@shared/types'
import {
  getDescendantGroupIds,
  getFocusSubtreeIds,
  isInFocusScope,
  focusFilterFor,
  getFocusPath,
  getFocusBounds
} from '../renderer/services/focus'
import { makeDevice, makeShape } from './helpers'

function makeScene(groups: Scene['groups'], elements: Scene['devices']): Scene {
  return {
    canvas: { width: 800, height: 600, aspectRatio: '4:3' },
    background: { type: 'solid', color: '#ffffff' },
    titleText: {
      content: '', visible: false, fontSize: 24, fontFamily: 'Inter', fontWeight: 400,
      textAlign: 'left', color: '#ffffff', x: 20, y: 20, zIndex: -1, lineHeight: 1.2,
      letterSpacing: 0, wordSpacing: 0, textTransform: 'none', strokeColor: '#ffffff', strokeWidth: 0
    },
    grid: { enabled: false, color: '#e4e4e7', size: 20, cellSize: 100, dotSize: 2 },
    guides: [],
    devices: elements,
    textBoxes: [],
    images: [],
    shapes: [],
    groups
  }
}

describe('getDescendantGroupIds', () => {
  it('returns nested subgroup ids recursively', () => {
    const scene = makeScene(
      [
        { id: 'a', name: 'A', childIds: [], parentGroupId: null },
        { id: 'b', name: 'B', childIds: [], parentGroupId: 'a' },
        { id: 'c', name: 'C', childIds: [], parentGroupId: 'b' }
      ],
      []
    )
    expect(getDescendantGroupIds(scene, 'a')).toEqual(['b', 'c'])
    expect(getDescendantGroupIds(scene, 'b')).toEqual(['c'])
    expect(getDescendantGroupIds(scene, 'c')).toEqual([])
  })

  it('survives a malformed parent cycle', () => {
    const scene = makeScene(
      [
        { id: 'a', name: 'A', childIds: [], parentGroupId: 'b' },
        { id: 'b', name: 'B', childIds: [], parentGroupId: 'a' }
      ],
      []
    )
    expect(getDescendantGroupIds(scene, 'a')).toEqual(['b', 'a'])
    expect(getDescendantGroupIds(scene, 'b')).toEqual(['a', 'b'])
  })
})

describe('getFocusSubtreeIds', () => {
  const devA = makeDevice({ id: 'dev-a', x: 0, y: 0, width: 100, height: 100, groupId: 'a', zIndex: 0 })
  const devB = makeDevice({ id: 'dev-b', x: 200, y: 0, width: 100, height: 100, groupId: 'b', zIndex: 1 })
  const devC = makeDevice({ id: 'dev-c', x: 400, y: 0, width: 100, height: 100, groupId: 'b', zIndex: 2 })
  const orphan = makeDevice({ id: 'dev-orphan', x: 0, y: 300, width: 100, height: 100, groupId: null, zIndex: 3 })

  it('collects own members and nested subgroup members', () => {
    const scene = makeScene(
      [
        { id: 'a', name: 'A', childIds: ['dev-a'], parentGroupId: null },
        { id: 'b', name: 'B', childIds: ['dev-b', 'dev-c'], parentGroupId: 'a' }
      ],
      [devA, devB, devC, orphan]
    )
    expect(getFocusSubtreeIds(scene, 'a')).toEqual(['dev-a', 'dev-b', 'dev-c'])
    expect(getFocusSubtreeIds(scene, 'b')).toEqual(['dev-b', 'dev-c'])
  })

  it('returns empty for a missing group', () => {
    const scene = makeScene([{ id: 'a', name: 'A', childIds: ['dev-a'], parentGroupId: null }], [devA])
    expect(getFocusSubtreeIds(scene, 'nope')).toEqual([])
  })
})

describe('isInFocusScope / focusFilterFor', () => {
  it('treats every element as editable when no focus is active', () => {
    const scene = makeScene([{ id: 'a', name: 'A', childIds: ['dev-a'], parentGroupId: null }], [makeDevice({ id: 'dev-a' })])
    expect(isInFocusScope('dev-a', null, scene)).toBe(true)
    expect(isInFocusScope('whatever', null, scene)).toBe(true)
    expect(focusFilterFor(null, scene)('anything')).toBe(true)
  })

  it('limits the filter to the focused subtree', () => {
    const scene = makeScene(
      [{ id: 'a', name: 'A', childIds: ['dev-a'], parentGroupId: null }],
      [makeDevice({ id: 'dev-a' }), makeDevice({ id: 'dev-x' })]
    )
    const filter = focusFilterFor('a', scene)
    expect(filter('dev-a')).toBe(true)
    expect(filter('dev-x')).toBe(false)
  })
})

describe('getFocusPath', () => {
  it('returns root-to-focused ancestry', () => {
    const scene = makeScene(
      [
        { id: 'a', name: 'Root', childIds: [], parentGroupId: null },
        { id: 'b', name: 'Group B', childIds: [], parentGroupId: 'a' },
        { id: 'c', name: 'Group C', childIds: [], parentGroupId: 'b' }
      ],
      []
    )
    expect(getFocusPath(scene, 'c').map((g) => g.id)).toEqual(['a', 'b', 'c'])
    expect(getFocusPath(scene, 'a').map((g) => g.id)).toEqual(['a'])
  })

  it('returns empty when not focused or the group is missing', () => {
    const scene = makeScene([{ id: 'a', name: 'A', childIds: [], parentGroupId: null }], [])
    expect(getFocusPath(scene, null)).toEqual([])
    expect(getFocusPath(scene, 'missing')).toEqual([])
  })
})

describe('getFocusBounds', () => {
  it('unions visible members of the subtree', () => {
    const scene = makeScene(
      [{ id: 'a', name: 'A', childIds: ['dev-a', 'dev-b'], parentGroupId: null }],
      [
        makeDevice({ id: 'dev-a', x: 0, y: 0, width: 100, height: 100, groupId: 'a' }),
        makeDevice({ id: 'dev-b', x: 200, y: 50, width: 100, height: 100, groupId: 'a' }),
        makeShape({ id: 'shp-hidden', x: 0, y: 0, width: 10, height: 10, visible: false, groupId: 'a' })
      ]
    )
    expect(getFocusBounds(scene, 'a')).toEqual({ x: 0, y: 0, width: 300, height: 150 })
  })

  it('returns null when nothing visible or not focused', () => {
    const scene = makeScene(
      [{ id: 'a', name: 'A', childIds: ['dev-a'], parentGroupId: null }],
      [makeDevice({ id: 'dev-a', visible: false, groupId: 'a' })]
    )
    expect(getFocusBounds(scene, 'a')).toBeNull()
    expect(getFocusBounds(scene, null)).toBeNull()
  })
})
