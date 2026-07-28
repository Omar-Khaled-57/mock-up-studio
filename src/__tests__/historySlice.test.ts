import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { resetStore, makeDevice } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

describe('pushHistory', () => {
  it('adds an entry to the undo stack', () => {
    useStore.getState().pushHistory('test')
    expect(useStore.getState().undoStack).toHaveLength(1)
  })

  it('clears the redo stack on new push', () => {
    useStore.getState().pushHistory('first')
    useStore.getState().undo()
    expect(useStore.getState().redoStack).toHaveLength(1)
    useStore.getState().pushHistory('second')
    expect(useStore.getState().redoStack).toHaveLength(0)
  })

  it('enforces max 500 entries', () => {
    for (let i = 0; i < 510; i++) {
      useStore.getState().pushHistory(`entry-${i}`)
    }
    expect(useStore.getState().undoStack.length).toBeLessThanOrEqual(500)
  })
})

describe('undo', () => {
  it('restores previous state', () => {
    // Start with default scene
    useStore.getState().pushHistory('before add')
    const dev = makeDevice({ id: 'undo-dev' })
    useStore.getState().addDevice(dev)
    expect(safeScene(useStore.getState()).devices).toHaveLength(2)

    useStore.getState().undo()
    expect(safeScene(useStore.getState()).devices).toHaveLength(1)
  })

  it('returns false when nothing to undo', () => {
    expect(useStore.getState().undo()).toBe(false)
  })

  it('pushes current state to redo stack', () => {
    useStore.getState().pushHistory('before')
    useStore.getState().addDevice(makeDevice({ id: 'x' }))
    useStore.getState().undo()
    expect(useStore.getState().redoStack).toHaveLength(1)
  })
})

describe('redo', () => {
  it('restores undone state', () => {
    useStore.getState().pushHistory('before')
    useStore.getState().addDevice(makeDevice({ id: 'redo-dev' }))
    useStore.getState().undo()
    expect(safeScene(useStore.getState()).devices).toHaveLength(1)

    useStore.getState().redo()
    expect(safeScene(useStore.getState()).devices).toHaveLength(2)
  })

  it('returns false when nothing to redo', () => {
    expect(useStore.getState().redo()).toBe(false)
  })
})

describe('canUndo / canRedo', () => {
  it('canUndo is true after pushHistory', () => {
    useStore.getState().pushHistory('test')
    expect(useStore.getState().canUndo()).toBe(true)
  })

  it('canRedo is true after undo', () => {
    useStore.getState().pushHistory('test')
    useStore.getState().undo()
    expect(useStore.getState().canRedo()).toBe(true)
  })

  it('canUndo is false on fresh store', () => {
    expect(useStore.getState().canUndo()).toBe(false)
  })
})

describe('undo/redo preserves activeSceneIndex', () => {
  it('clamps activeSceneIndex after undo when scene was deleted', () => {
    useStore.getState().addScene() // 2 scenes
    useStore.getState().setActiveSceneIndex(1)
    useStore.getState().pushHistory('before delete')
    useStore.getState().deleteScene(1) // back to 1 scene, index clamped
    useStore.getState().undo()
    // The restored state has 2 scenes, but index was clamped during undo
    const state = useStore.getState()
    expect(state.activeSceneIndex).toBeLessThan(state.scenes.length)
  })
})

// Helper imported inline to avoid circular dependency issues
import { safeScene } from '../renderer/store/sceneSlice'
