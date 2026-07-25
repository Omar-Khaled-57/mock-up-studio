import { StateCreator } from 'zustand'
import { StoreState } from './index'

export interface SelectionSlice {
  selectedIds: string[]
  selectionMode: 'single' | 'multi'
  select: (id: string, multi?: boolean) => void
  deselect: (id: string) => void
  clearSelection: () => void
  selectAll: () => void
  isSelected: (id: string) => boolean
}

export const createSelectionSlice: StateCreator<StoreState, [], [], SelectionSlice> = (set, get) => ({
  selectedIds: [],
  selectionMode: 'single',

  select: (id, multi = false) =>
    set((state) => {
      if (multi) {
        const exists = state.selectedIds.includes(id)
        return {
          selectedIds: exists
            ? state.selectedIds.filter((sid) => sid !== id)
            : [...state.selectedIds, id],
          selectionMode: 'multi'
        }
      }
      return { selectedIds: [id], selectionMode: 'single' }
    }),

  deselect: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.filter((sid) => sid !== id)
    })),

  clearSelection: () => set({ selectedIds: [], selectionMode: 'single' }),

  selectAll: () =>
    set((state: StoreState) => {
      const scene = state.scenes[state.activeSceneIndex]
      const allIds = [
        ...scene.devices.map((d) => d.id),
        ...scene.textBoxes.map((t) => t.id),
        ...scene.images.map((i) => i.id)
      ]
      return { selectedIds: allIds, selectionMode: 'multi' }
    }),

  isSelected: (id) => get().selectedIds.includes(id)
})
