import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { safeScene } from '../renderer/store/sceneSlice'
import { resetStore, makeDevice, makeTextBox, makeImage } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

describe('select', () => {
  it('selects a single element', () => {
    useStore.getState().select('abc')
    expect(useStore.getState().selectedIds).toEqual(['abc'])
  })

  it('replaces selection when multi is false', () => {
    useStore.getState().select('abc')
    useStore.getState().select('def')
    expect(useStore.getState().selectedIds).toEqual(['def'])
  })

  it('toggles element in multi mode', () => {
    useStore.getState().select('abc', true)
    useStore.getState().select('def', true)
    expect(useStore.getState().selectedIds).toEqual(['abc', 'def'])
  })

  it('removes element when toggling existing selection', () => {
    useStore.getState().select('abc', true)
    useStore.getState().select('abc', true)
    expect(useStore.getState().selectedIds).toEqual([])
  })
})

describe('deselect', () => {
  it('removes a specific element from selection', () => {
    useStore.getState().select('abc', true)
    useStore.getState().select('def', true)
    useStore.getState().deselect('abc')
    expect(useStore.getState().selectedIds).toEqual(['def'])
  })
})

describe('clearSelection', () => {
  it('clears all selected ids', () => {
    useStore.getState().select('abc', true)
    useStore.getState().select('def', true)
    useStore.getState().clearSelection()
    expect(useStore.getState().selectedIds).toEqual([])
    expect(useStore.getState().selectionMode).toBe('single')
  })
})

describe('selectAll', () => {
  it('selects all elements in the active scene', () => {
    useStore.getState().addDevice(makeDevice({ id: 'd1' }))
    useStore.getState().addTextBox(makeTextBox({ id: 't1' }))
    useStore.getState().addImage(makeImage({ id: 'i1' }))
    useStore.getState().selectAll()
    const ids = useStore.getState().selectedIds
    expect(ids).toContain('d1')
    expect(ids).toContain('t1')
    expect(ids).toContain('i1')
    expect(useStore.getState().selectionMode).toBe('multi')
  })

  it('includes the default monitor device', () => {
    useStore.getState().selectAll()
    const scene = safeScene(useStore.getState())
    const defaultDevId = scene.devices[0].id
    expect(useStore.getState().selectedIds).toContain(defaultDevId)
  })
})

describe('isSelected', () => {
  it('returns true for selected elements', () => {
    useStore.getState().select('abc')
    expect(useStore.getState().isSelected('abc')).toBe(true)
  })

  it('returns false for unselected elements', () => {
    expect(useStore.getState().isSelected('abc')).toBe(false)
  })
})
