import { StateCreator } from 'zustand'
import { StoreState } from './index'

interface HistoryEntry {
  scenesSnapshot: string
  timestamp: number
  label?: string
}

export interface HistorySlice {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  pushHistory: (label?: string) => void
  undo: () => boolean
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
      return { undoStack: stack, redoStack: [] }
    }),

  undo: () => {
    const { undoStack, scenes, activeSceneIndex } = get()
    if (undoStack.length === 0) return false

    const currentSnapshot = JSON.stringify(scenes)
    const entry = undoStack[undoStack.length - 1]
    const restoredScenes = JSON.parse(entry.scenesSnapshot) as StoreState['scenes']

    set({
      scenes: restoredScenes,
      activeSceneIndex: Math.min(activeSceneIndex, restoredScenes.length - 1),
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, { scenesSnapshot: currentSnapshot, timestamp: Date.now() }]
    })
    return true
  },

  redo: () => {
    const { redoStack, scenes } = get()
    if (redoStack.length === 0) return false

    const currentSnapshot = JSON.stringify(scenes)
    const entry = redoStack[redoStack.length - 1]
    const restoredScenes = JSON.parse(entry.scenesSnapshot) as StoreState['scenes']

    set({
      scenes: restoredScenes,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, { scenesSnapshot: currentSnapshot, timestamp: Date.now() }]
    })
    return true
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0
})
