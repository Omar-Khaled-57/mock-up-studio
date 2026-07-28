import { StateCreator } from 'zustand'
import { Scene } from '@shared/types'
import { StoreState } from './index'

interface Snapshot {
  id: string
  timestamp: number
  label: string
  scenesJson: string
  activeSceneIndex: number
}

export interface VersionHistorySlice {
  snapshots: Snapshot[]
  autoSnapshotEnabled: boolean
  lastSnapshotTime: number
  createSnapshot: (label: string) => void
  restoreSnapshot: (snapshotId: string) => void
  deleteSnapshot: (snapshotId: string) => void
  clearSnapshots: () => void
  setAutoSnapshotEnabled: (enabled: boolean) => void
  maybeAutoSnapshot: () => void
}

const MAX_SNAPSHOTS = 50
const AUTO_SNAPSHOT_INTERVAL = 5 * 60 * 1000

function generateSnapshotId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const createVersionHistorySlice: StateCreator<StoreState, [], [], VersionHistorySlice> = (set, get) => ({
  snapshots: [],
  autoSnapshotEnabled: true,
  lastSnapshotTime: Date.now(),

  createSnapshot: (label) => {
    const state = get()
    const snapshot: Snapshot = {
      id: generateSnapshotId(),
      timestamp: Date.now(),
      label,
      scenesJson: JSON.stringify(state.scenes),
      activeSceneIndex: state.activeSceneIndex
    }
    set((s) => {
      const snapshots = [snapshot, ...s.snapshots].slice(0, MAX_SNAPSHOTS)
      return { snapshots, lastSnapshotTime: Date.now() }
    })
  },

  restoreSnapshot: (snapshotId) => {
    const state = get()
    const snapshot = state.snapshots.find((s) => s.id === snapshotId)
    if (!snapshot) return
    set({
      scenes: JSON.parse(snapshot.scenesJson) as Scene[],
      activeSceneIndex: snapshot.activeSceneIndex,
      selectedIds: []
    })
  },

  deleteSnapshot: (snapshotId) => {
    set((s) => ({
      snapshots: s.snapshots.filter((snap) => snap.id !== snapshotId)
    }))
  },

  clearSnapshots: () => set({ snapshots: [] }),

  setAutoSnapshotEnabled: (enabled) => set({ autoSnapshotEnabled: enabled }),

  maybeAutoSnapshot: () => {
    const state = get()
    if (!state.autoSnapshotEnabled) return
    if (Date.now() - state.lastSnapshotTime < AUTO_SNAPSHOT_INTERVAL) return
    state.createSnapshot('Auto-snapshot')
  }
})
