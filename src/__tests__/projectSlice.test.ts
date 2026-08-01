import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { resetStore, makeTextBox } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

describe('projectSlice', () => {
  it('defaults to no project', () => {
    expect(useStore.getState().project).toBeNull()
    expect(useStore.getState().filePath).toBeNull()
    expect(useStore.getState().dirty).toBe(false)
  })

  it('newProject creates a fresh project', () => {
    useStore.getState().newProject()
    const state = useStore.getState()
    expect(state.project).not.toBeNull()
    expect(state.project!.name).toBe('Untitled')
    expect(state.scenes).toHaveLength(1)
    expect(state.filePath).toBeNull()
    expect(state.dirty).toBe(false)
    expect(state.undoStack).toHaveLength(0)
    expect(state.redoStack).toHaveLength(0)
    expect(state.selectedIds).toHaveLength(0)
  })

  it('setFilePath sets the file path', () => {
    useStore.getState().setFilePath('/tmp/test.mockup')
    expect(useStore.getState().filePath).toBe('/tmp/test.mockup')
  })

  it('setDirty marks dirty state', () => {
    useStore.getState().setDirty(true)
    expect(useStore.getState().dirty).toBe(true)
  })

  it('setProjectName updates project name and marks dirty', () => {
    useStore.getState().newProject()
    useStore.getState().setProjectName('My Project')
    expect(useStore.getState().project!.name).toBe('My Project')
    expect(useStore.getState().dirty).toBe(true)
  })

  it('clearProject resets project state', () => {
    useStore.getState().newProject()
    useStore.getState().setDirty(true)
    useStore.getState().clearProject()
    expect(useStore.getState().project).toBeNull()
    expect(useStore.getState().filePath).toBeNull()
    expect(useStore.getState().dirty).toBe(false)
  })

  it('marks the project dirty when the scene is mutated', () => {
    useStore.getState().newProject()
    expect(useStore.getState().dirty).toBe(false)
    useStore.getState().addTextBox(makeTextBox({ id: 'tb-1', zIndex: 5 }))
    expect(useStore.getState().dirty).toBe(true)
  })

  it('marks the project dirty after undo restores a snapshot', () => {
    useStore.getState().newProject()
    useStore.getState().pushHistory('Add text box')
    useStore.getState().addTextBox(makeTextBox({ id: 'tb-1', zIndex: 5 }))
    // Simulate a save, then an undo: the document now differs from disk.
    useStore.getState().setDirty(false)
    expect(useStore.getState().undo()).toBe(true)
    expect(useStore.getState().dirty).toBe(true)
  })

  it('keeps the project clean after resetStore (suppressed scenes swap)', () => {
    resetStore()
    expect(useStore.getState().dirty).toBe(false)
  })
})
