import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { focusFilterFor } from '../renderer/services/focus'
import { resetStore, makeDevice, makeTextBox, makeImage, makeShape } from './helpers'
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

  it('includes all devices in the scene', () => {
    const d = makeDevice({ id: 'sel-all-dev' })
    useStore.getState().addDevice(d)
    useStore.getState().selectAll()
    expect(useStore.getState().selectedIds).toContain('sel-all-dev')
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

describe('alignSelected', () => {
  beforeEach(() => {
    // Add 3 devices at different positions
    useStore.getState().addDevice(makeDevice({ id: 'd1', x: 0, y: 0, width: 100, height: 100 }))
    useStore.getState().addDevice(makeDevice({ id: 'd2', x: 200, y: 200, width: 100, height: 100 }))
    useStore.getState().addDevice(makeDevice({ id: 'd3', x: 400, y: 400, width: 100, height: 100 }))
    useStore.getState().select('d1', true)
    useStore.getState().select('d2', true)
    useStore.getState().select('d3', true)
  })

  it('aligns left edges', () => {
    useStore.getState().alignSelected('left')
    const state = useStore.getState()
    const d1 = state.scenes[0].devices.find((d) => d.id === 'd1')!
    const d2 = state.scenes[0].devices.find((d) => d.id === 'd2')!
    const d3 = state.scenes[0].devices.find((d) => d.id === 'd3')!
    expect(d1.x).toBe(0)
    expect(d2.x).toBe(0)
    expect(d3.x).toBe(0)
  })

  it('aligns center X', () => {
    useStore.getState().alignSelected('center-x')
    const state = useStore.getState()
    const d1 = state.scenes[0].devices.find((d) => d.id === 'd1')!
    const d2 = state.scenes[0].devices.find((d) => d.id === 'd2')!
    const d3 = state.scenes[0].devices.find((d) => d.id === 'd3')!
    // Bounding box: minX=0, maxX=500, centerX=250
    // Each device is 100 wide, so x = 250 - 50 = 200
    expect(d1.x).toBe(200)
    expect(d2.x).toBe(200)
    expect(d3.x).toBe(200)
  })

  it('aligns right edges', () => {
    useStore.getState().alignSelected('right')
    const state = useStore.getState()
    const d1 = state.scenes[0].devices.find((d) => d.id === 'd1')!
    const d2 = state.scenes[0].devices.find((d) => d.id === 'd2')!
    const d3 = state.scenes[0].devices.find((d) => d.id === 'd3')!
    // maxX = 500, right edge = 500 - 100 = 400
    expect(d1.x).toBe(400)
    expect(d2.x).toBe(400)
    expect(d3.x).toBe(400)
  })

  it('aligns top edges', () => {
    useStore.getState().alignSelected('top')
    const state = useStore.getState()
    const d1 = state.scenes[0].devices.find((d) => d.id === 'd1')!
    const d2 = state.scenes[0].devices.find((d) => d.id === 'd2')!
    const d3 = state.scenes[0].devices.find((d) => d.id === 'd3')!
    expect(d1.y).toBe(0)
    expect(d2.y).toBe(0)
    expect(d3.y).toBe(0)
  })

  it('aligns center Y', () => {
    useStore.getState().alignSelected('center-y')
    const state = useStore.getState()
    const d1 = state.scenes[0].devices.find((d) => d.id === 'd1')!
    const d2 = state.scenes[0].devices.find((d) => d.id === 'd2')!
    const d3 = state.scenes[0].devices.find((d) => d.id === 'd3')!
    // Bounding box: minY=0, maxY=500, centerY=250
    // Each device is 100 tall, so y = 250 - 50 = 200
    expect(d1.y).toBe(200)
    expect(d2.y).toBe(200)
    expect(d3.y).toBe(200)
  })

  it('aligns bottom edges', () => {
    useStore.getState().alignSelected('bottom')
    const state = useStore.getState()
    const d1 = state.scenes[0].devices.find((d) => d.id === 'd1')!
    const d2 = state.scenes[0].devices.find((d) => d.id === 'd2')!
    const d3 = state.scenes[0].devices.find((d) => d.id === 'd3')!
    // maxY = 500, bottom = 500 - 100 = 400
    expect(d1.y).toBe(400)
    expect(d2.y).toBe(400)
    expect(d3.y).toBe(400)
  })

  it('does nothing with fewer than 2 selected elements', () => {
    useStore.getState().clearSelection()
    useStore.getState().select('d1')
    const stateBefore = useStore.getState()
    const d1Before = stateBefore.scenes[0].devices.find((d) => d.id === 'd1')!
    useStore.getState().alignSelected('left')
    const stateAfter = useStore.getState()
    const d1After = stateAfter.scenes[0].devices.find((d) => d.id === 'd1')!
    expect(d1After.x).toBe(d1Before.x)
  })

  it('aligns shapes alongside devices', () => {
    useStore.getState().addShape(makeShape({ id: 's1', x: 300, y: 300, width: 80, height: 80 }))
    useStore.getState().select('s1', true)
    useStore.getState().alignSelected('left')
    const state = useStore.getState()
    const d1 = state.scenes[0].devices.find((d) => d.id === 'd1')!
    const s1 = state.scenes[0].shapes.find((s) => s.id === 's1')!
    // minX = 0 (d1), so shape x should be 0
    expect(d1.x).toBe(0)
    expect(s1.x).toBe(0)
  })
})

describe('selectDirect', () => {
  it('selects a single element without group expansion', () => {
    const d1 = makeDevice({ id: 'sel-direct-1' })
    const d2 = makeDevice({ id: 'sel-direct-2' })
    const store = useStore.getState()
    store.addDevice(d1)
    store.addDevice(d2)
    store.select('sel-direct-1')
    store.select('sel-direct-2', true)
    store.selectDirect('sel-direct-1')
    expect(useStore.getState().selectedIds).toEqual(['sel-direct-1'])
    expect(useStore.getState().selectionMode).toBe('single')
  })

  it('replaces full selection with the single element', () => {
    const d1 = makeDevice()
    const d2 = makeDevice()
    const store = useStore.getState()
    store.addDevice(d1)
    store.addDevice(d2)
    store.select(d1.id)
    store.select(d2.id, true)
    store.selectDirect(d1.id)
    expect(useStore.getState().selectedIds).toEqual([d1.id])
  })
})

describe('selectInRect', () => {
  it('selects devices intersecting the rect', () => {
    const d1 = makeDevice({ x: 0, y: 0, width: 100, height: 100 })
    const d2 = makeDevice({ x: 300, y: 300, width: 100, height: 100 })
    useStore.getState().addDevice(d1)
    useStore.getState().addDevice(d2)
    useStore.getState().selectInRect(0, 0, 200, 200)
    expect(useStore.getState().selectedIds).toContain(d1.id)
    expect(useStore.getState().selectedIds).not.toContain(d2.id)
  })

  it('selects nothing when rect hits no elements', () => {
    const d1 = makeDevice({ x: 0, y: 0, width: 100, height: 100 })
    useStore.getState().addDevice(d1)
    useStore.getState().selectInRect(500, 500, 10, 10)
    expect(useStore.getState().selectedIds).toHaveLength(0)
  })

  it('handles negative width/height rect (rubber-band drag left/up)', () => {
    const d1 = makeDevice({ x: 50, y: 50, width: 100, height: 100 })
    useStore.getState().addDevice(d1)
    useStore.getState().selectInRect(150, 150, -150, -150)
    expect(useStore.getState().selectedIds).toContain(d1.id)
  })

  it('selects all element types in rect', () => {
    const d = makeDevice({ x: 0, y: 0, width: 100, height: 100 })
    const t = makeTextBox({ x: 10, y: 10, width: 100, height: 50 })
    const s = makeShape({ x: 20, y: 20, width: 80, height: 80 })
    useStore.getState().addDevice(d)
    useStore.getState().addTextBox(t)
    useStore.getState().addShape(s)
    useStore.getState().selectInRect(0, 0, 300, 300)
    expect(useStore.getState().selectedIds).toHaveLength(3)
  })
})

describe('group-aware select', () => {
  it('selects all group members when clicking one', () => {
    const d1 = makeDevice({ id: 'grp-dev-1' })
    const d2 = makeDevice({ id: 'grp-dev-2' })
    const store = useStore.getState()
    store.addDevice(d1)
    store.addDevice(d2)
    store.select('grp-dev-1')
    store.select('grp-dev-2', true)
    store.groupSelected()
    store.clearSelection()
    store.select('grp-dev-1')
    store.select('grp-dev-1', true)
    expect(useStore.getState().selectedIds).toEqual([])
  })
})

describe('focus-filtered selection', () => {
  function focusedScene() {
    const devIn = makeDevice({ id: 'dev-in', x: 0, y: 0, width: 100, height: 100, groupId: 'g-1' })
    const devInSub = makeDevice({ id: 'dev-in-sub', x: 200, y: 0, width: 100, height: 100, groupId: 'g-1-1' })
    const devOut = makeDevice({ id: 'dev-out', x: 0, y: 200, width: 100, height: 100 })
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        devices: [devIn, devInSub, devOut],
        groups: [
          { id: 'g-1', name: 'G', childIds: ['dev-in', 'dev-in-sub'], parentGroupId: null },
          { id: 'g-1-1', name: 'Sub', childIds: ['dev-in-sub'], parentGroupId: 'g-1' }
        ]
      }]
    })
  }

  it('selectAll with a focus filter selects only the focused subtree', () => {
    focusedScene()
    const scene = useStore.getState().scenes[0]
    useStore.getState().selectAll(focusFilterFor('g-1', scene))
    expect(useStore.getState().selectedIds).toEqual(['dev-in', 'dev-in-sub'])
  })

  it('selectAll with a nested focus filter selects only that subgroup', () => {
    focusedScene()
    const scene = useStore.getState().scenes[0]
    useStore.getState().selectAll(focusFilterFor('g-1-1', scene))
    expect(useStore.getState().selectedIds).toEqual(['dev-in-sub'])
  })

  it('selectInRect with a focus filter excludes out-of-scope elements', () => {
    focusedScene()
    const scene = useStore.getState().scenes[0]
    useStore.getState().selectInRect(0, 0, 400, 400, focusFilterFor('g-1', scene))
    expect(useStore.getState().selectedIds).toEqual(['dev-in', 'dev-in-sub'])
  })

  it('select with a focus filter cannot select an out-of-scope element', () => {
    focusedScene()
    const scene = useStore.getState().scenes[0]
    useStore.getState().select('dev-out', false, focusFilterFor('g-1', scene))
    expect(useStore.getState().selectedIds).toEqual([])
  })

  it('select with a focus filter still expands group members within scope', () => {
    focusedScene()
    const scene = useStore.getState().scenes[0]
    useStore.getState().select('dev-in', false, focusFilterFor('g-1', scene))
    expect(useStore.getState().selectedIds).toEqual(['dev-in', 'dev-in-sub'])
  })
})
