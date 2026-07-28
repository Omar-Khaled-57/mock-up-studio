import { StateCreator } from 'zustand'
import { StoreState } from './index'
import { safeScene } from './sceneSlice'

export type AlignmentDirection = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom'

export interface SelectionSlice {
  selectedIds: string[]
  selectionMode: 'single' | 'multi'
  select: (id: string, multi?: boolean) => void
  deselect: (id: string) => void
  clearSelection: () => void
  selectAll: () => void
  isSelected: (id: string) => boolean
  alignSelected: (direction: AlignmentDirection) => void
}

interface AlignableElement {
  id: string
  type: 'device' | 'textbox' | 'image'
  x: number
  y: number
  width: number
  height: number
}

function findSelectedElements(state: StoreState): AlignableElement[] {
  const scene = safeScene(state)
  const elements: AlignableElement[] = []
  for (const id of state.selectedIds) {
    const dev = scene.devices.find((d) => d.id === id)
    if (dev) { elements.push({ id, type: 'device', x: dev.x, y: dev.y, width: dev.width, height: dev.height }); continue }
    const tb = scene.textBoxes.find((t) => t.id === id)
    if (tb) { elements.push({ id, type: 'textbox', x: tb.x, y: tb.y, width: tb.width, height: tb.height }); continue }
    const img = scene.images.find((i) => i.id === id)
    if (img) { elements.push({ id, type: 'image', x: img.x, y: img.y, width: img.width, height: img.height }) }
  }
  return elements
}

function patchElement(state: StoreState, id: string, patch: { x?: number; y?: number }) {
  const scene = safeScene(state)
  if (scene.devices.some((d) => d.id === id)) state.updateDevice(id, patch)
  else if (scene.textBoxes.some((t) => t.id === id)) state.updateTextBox(id, patch)
  else if (scene.images.some((i) => i.id === id)) state.updateImage(id, patch)
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
      const scene = safeScene(state)
      const allIds = [
        ...scene.devices.map((d) => d.id),
        ...scene.textBoxes.map((t) => t.id),
        ...scene.images.map((i) => i.id)
      ]
      return { selectedIds: allIds, selectionMode: 'multi' }
    }),

  isSelected: (id) => get().selectedIds.includes(id),

  alignSelected: (direction) => {
    const state = get()
    const elements = findSelectedElements(state)
    if (elements.length < 2) return

    state.pushHistory('Align')

    const minX = Math.min(...elements.map((e) => e.x))
    const maxX = Math.max(...elements.map((e) => e.x + e.width))
    const minY = Math.min(...elements.map((e) => e.y))
    const maxY = Math.max(...elements.map((e) => e.y + e.height))
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    for (const el of elements) {
      let x = el.x
      let y = el.y
      switch (direction) {
        case 'left': x = minX; break
        case 'center-x': x = centerX - el.width / 2; break
        case 'right': x = maxX - el.width; break
        case 'top': y = minY; break
        case 'center-y': y = centerY - el.height / 2; break
        case 'bottom': y = maxY - el.height; break
      }
      patchElement(state, el.id, { x: Math.round(x), y: Math.round(y) })
    }
  }
})
