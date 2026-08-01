/**
 * runtimeStore tests — covers the transient editor-runtime store and its
 * reset integration with the document store (undo/redo, scene switches,
 * project load/new).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { useRuntimeStore, resetRuntime } from '../renderer/runtime/store'
import { DEFAULT_BRUSH_OPTIONS } from '../renderer/runtime/runtimeSlice'
import { resetStore, makeDevice } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

function seedTransientState() {
  const rt = useRuntimeStore.getState()
  rt.setActiveTool('paint')
  rt.enterFocus('group-1')
  rt.pushTemporaryTool('hand', 'keyup')
  rt.setHoveredElement({ id: 'dev-1', kind: 'device' })
  rt.setPointerScenePos({ x: 10, y: 20 })
  rt.setPointerInCanvas(true)
  rt.beginInteraction({ toolId: 'paint', pointerId: 1, kind: 'stroke', startedAt: 0 })
  rt.setMarqueeRect({ x: 0, y: 0, width: 100, height: 100 })
  rt.setStrokeBuffer([{ x: 0, y: 0, pressure: 0.5 }])
  rt.setStrokeDirty(true)
  rt.setTemporaryTransform({ elementId: 'dev-1', kind: 'device', deltaX: 5, deltaY: 5 })
  rt.setSnapGuides({ verticalGuides: [50], horizontalGuides: [60] })
  rt.setMaskPreview({ targetId: 'dev-1', shape: 'rectangle', points: [] })
  rt.setMaskShape('ellipse')
  rt.setMaskMode('unmask')
  rt.setEditing({ id: 'tb-1', mode: 'text' })
  rt.setBrush({ size: 40, hardness: 0.8, color: '#ff0000' })
}

describe('initial state', () => {
  it('starts with default tool and empty transient state', () => {
    const rt = useRuntimeStore.getState()
    expect(rt.activeToolId).toBe('select')
    expect(rt.temporaryToolStack).toEqual([])
    expect(rt.hoveredElement).toBeNull()
    expect(rt.pointerScenePos).toBeNull()
    expect(rt.pointerInCanvas).toBe(false)
    expect(rt.activeInteraction).toBeNull()
    expect(rt.marqueeRect).toBeNull()
    expect(rt.strokeBuffer).toEqual([])
    expect(rt.strokeDirty).toBe(false)
    expect(rt.temporaryTransform).toBeNull()
    expect(rt.focusGroupId).toBeNull()
    expect(rt.snapGuides).toEqual({ verticalGuides: [], horizontalGuides: [] })
    expect(rt.maskPreview).toBeNull()
    expect(rt.maskShape).toBe('rectangle')
    expect(rt.maskMode).toBe('mask')
    expect(rt.editing).toBeNull()
    expect(rt.brush).toEqual(DEFAULT_BRUSH_OPTIONS)
  })
})

describe('setBrush', () => {
  it('merges partial patches into the current brush', () => {
    useRuntimeStore.getState().setBrush({ size: 64 })
    const rt = useRuntimeStore.getState()
    expect(rt.brush.size).toBe(64)
    expect(rt.brush.hardness).toBe(DEFAULT_BRUSH_OPTIONS.hardness)
    expect(rt.brush.color).toBe(DEFAULT_BRUSH_OPTIONS.color)

    useRuntimeStore.getState().setBrush({ hardness: 0.25, color: '#00ff00' })
    expect(useRuntimeStore.getState().brush).toEqual({ size: 64, hardness: 0.25, color: '#00ff00' })
  })
})

describe('resetRuntime', () => {
  it('transient reset clears in-flight state but preserves tool and focus', () => {
    seedTransientState()
    resetRuntime('transient')

    const rt = useRuntimeStore.getState()
    expect(rt.hoveredElement).toBeNull()
    expect(rt.pointerScenePos).toBeNull()
    expect(rt.pointerInCanvas).toBe(false)
    expect(rt.activeInteraction).toBeNull()
    expect(rt.marqueeRect).toBeNull()
    expect(rt.strokeBuffer).toEqual([])
    expect(rt.strokeDirty).toBe(false)
    expect(rt.temporaryTransform).toBeNull()
    expect(rt.snapGuides).toEqual({ verticalGuides: [], horizontalGuides: [] })
    expect(rt.maskPreview).toBeNull()
    expect(rt.editing).toBeNull()

    expect(rt.activeToolId).toBe('paint')
    expect(rt.focusGroupId).toBe('group-1')
    expect(rt.temporaryToolStack).toHaveLength(1)
    expect(rt.brush).toEqual({ size: 40, hardness: 0.8, color: '#ff0000' })
    expect(rt.maskShape).toBe('ellipse')
    expect(rt.maskMode).toBe('unmask')
  })

  it('all reset restores the default tool and clears focus and temporary stack', () => {
    seedTransientState()
    resetRuntime('all')

    const rt = useRuntimeStore.getState()
    expect(rt.activeToolId).toBe('select')
    expect(rt.focusGroupId).toBeNull()
    expect(rt.temporaryToolStack).toEqual([])
    expect(rt.hoveredElement).toBeNull()
    expect(rt.marqueeRect).toBeNull()
    expect(rt.editing).toBeNull()
    expect(rt.brush).toEqual(DEFAULT_BRUSH_OPTIONS)
    expect(rt.maskShape).toBe('rectangle')
    expect(rt.maskMode).toBe('mask')
  })

  it('default scope is transient', () => {
    seedTransientState()
    resetRuntime()

    const rt = useRuntimeStore.getState()
    expect(rt.activeToolId).toBe('paint')
    expect(rt.focusGroupId).toBe('group-1')
    expect(rt.marqueeRect).toBeNull()
  })
})

describe('scene switch resets transient state', () => {
  it('setActiveSceneIndex clears stale hover/marquee but keeps tool and focus', () => {
    useStore.getState().addScene()
    useStore.getState().setActiveSceneIndex(1)

    seedTransientState()
    useStore.getState().setActiveSceneIndex(0)

    const rt = useRuntimeStore.getState()
    expect(rt.hoveredElement).toBeNull()
    expect(rt.marqueeRect).toBeNull()
    expect(rt.activeToolId).toBe('paint')
    expect(rt.focusGroupId).toBe('group-1')
  })

  it('addScene resets transient state for the new scene', () => {
    seedTransientState()
    useStore.getState().addScene()

    const rt = useRuntimeStore.getState()
    expect(rt.hoveredElement).toBeNull()
    expect(rt.marqueeRect).toBeNull()
  })
})

describe('undo/redo resets transient state', () => {
  it('undo clears transient state while preserving the active tool', () => {
    useRuntimeStore.getState().setActiveTool('paint')
    seedTransientState()

    useStore.getState().pushHistory('before add')
    useStore.getState().addDevice(makeDevice({ id: 'undo-dev' }))
    useStore.getState().undo()

    const rt = useRuntimeStore.getState()
    expect(rt.marqueeRect).toBeNull()
    expect(rt.hoveredElement).toBeNull()
    expect(rt.activeToolId).toBe('paint')
  })

  it('redo clears transient state while preserving the active tool', () => {
    useRuntimeStore.getState().setActiveTool('paint')
    useStore.getState().pushHistory('before add')
    useStore.getState().addDevice(makeDevice({ id: 'redo-dev' }))
    useStore.getState().undo()

    seedTransientState()
    useStore.getState().redo()

    const rt = useRuntimeStore.getState()
    expect(rt.marqueeRect).toBeNull()
    expect(rt.hoveredElement).toBeNull()
    expect(rt.activeToolId).toBe('paint')
  })
})

describe('project reset', () => {
  it('newProject resets tool, focus, and transient state', () => {
    seedTransientState()
    useStore.getState().newProject()

    const rt = useRuntimeStore.getState()
    expect(rt.activeToolId).toBe('select')
    expect(rt.focusGroupId).toBeNull()
    expect(rt.temporaryToolStack).toEqual([])
    expect(rt.hoveredElement).toBeNull()
    expect(rt.marqueeRect).toBeNull()
  })
})
