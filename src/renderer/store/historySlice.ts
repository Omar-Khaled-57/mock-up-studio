/**
 * historySlice — Undo/redo via JSON snapshots of the scenes array.
 *
 * How it works:
 *   - `pushHistory()` serializes the current scenes to a JSON string and
 *     pushes it onto the undoStack. The redoStack is cleared on every push
 *     (branching history is not supported).
 *   - `undo()` pops the most recent entry, pushes the CURRENT state onto
 *     the redoStack, and restores the snapshot.
 *   - `redo()` is the mirror of undo.
 *   - `activeSceneIndex` is clamped after restore to prevent out-of-bounds
 *     if a scene was deleted between the snapshot and the undo.
 *
 * Performance:
 *   - Snapshots are JSON strings (not parsed objects) to reduce memory.
 *   - Max 500 entries; oldest entries are shifted off the front.
 *   - Each `pushHistory()` also triggers `maybeAutoSnapshot()` (from
 *     versionHistorySlice) on the next tick via setTimeout(0).
 *
 * Usage contract:
 *   - Callers MUST pushHistory BEFORE mutating state, so that undo restores
 *     the pre-mutation state. If you push after, undo skips the mutation.
 */

import { StateCreator } from 'zustand'
import { StoreState } from './index'

interface HistoryEntry {
  /** Pre-serialized JSON string of the scenes array (avoids repeated parse/stringify). */
  scenesSnapshot: string
  timestamp: number
  label?: string
}

export interface HistorySlice {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  /** Pushes the current scenes onto the undoStack. Clears the redoStack. */
  pushHistory: (label?: string) => void
  /** Restores the most recent undo entry. Returns false if nothing to undo. */
  undo: () => boolean
  /** Restores the most recent redo entry. Returns false if nothing to redo. */
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
}

const MAX_HISTORY = 500

export const createHistorySlice: StateCreator<StoreState, [], [], HistorySlice> = (set, get) => ({
  undoStack: [],
  redoStack: [],

  pushHistory: (label) =>
    set((state) => {
      const snapshot = JSON.stringify(state.scenes)
      const entry: HistoryEntry = { scenesSnapshot: snapshot, timestamp: Date.now(), label }
      const stack = [...state.undoStack, entry]
      if (stack.length > MAX_HISTORY) stack.shift()

      // Trigger auto-snapshot (version history) on next tick to avoid
      // mutating state inside a set() callback.
      setTimeout(() => get().maybeAutoSnapshot(), 0)

      return { undoStack: stack, redoStack: [] }
    }),

  undo: () => {
    const state = get()
    const { undoStack, scenes, activeSceneIndex } = state
    if (undoStack.length === 0) return false

    // Save current state to redoStack before restoring the snapshot.
    const currentSnapshot = JSON.stringify(scenes)
    const entry = undoStack[undoStack.length - 1]
    const restoredScenes = JSON.parse(entry.scenesSnapshot) as StoreState['scenes']

    set({
      scenes: restoredScenes,
      activeSceneIndex: Math.min(activeSceneIndex, restoredScenes.length - 1),
      undoStack: undoStack.slice(0, -1),
      redoStack: [...state.redoStack, { scenesSnapshot: currentSnapshot, timestamp: Date.now() }]
    })
    return true
  },

  redo: () => {
    const state = get()
    const { redoStack, scenes, activeSceneIndex } = state
    if (redoStack.length === 0) return false

    // Save current state to undoStack before restoring the snapshot.
    const currentSnapshot = JSON.stringify(scenes)
    const entry = redoStack[redoStack.length - 1]
    const restoredScenes = JSON.parse(entry.scenesSnapshot) as StoreState['scenes']

    set({
      scenes: restoredScenes,
      activeSceneIndex: Math.min(activeSceneIndex, restoredScenes.length - 1),
      redoStack: redoStack.slice(0, -1),
      undoStack: [...state.undoStack, { scenesSnapshot: currentSnapshot, timestamp: Date.now() }]
    })
    return true
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0
})
