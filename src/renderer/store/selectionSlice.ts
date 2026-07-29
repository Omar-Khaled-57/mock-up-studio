import { StateCreator } from 'zustand'
import { StoreState } from './index'
import { safeScene } from './sceneSlice'

export type AlignmentDirection = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom'

export interface SelectionSlice {
  selectedIds: string[]
  selectionMode: 'single' | 'multi'
  select: (id: string, multi?: boolean) => void
  selectDirect: (id: string) => void
  deselect: (id: string) => void
  clearSelection: () => void
  selectAll: () => void
  isSelected: (id: string) => boolean
  alignSelected: (direction: AlignmentDirection) => void
  selectInRect: (x: number, y: number, w: number, h: number) => void
}

interface AlignableElement {
  id: string
  type: 'device' | 'textbox' | 'image' | 'shape'
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
    if (img) { elements.push({ id, type: 'image', x: img.x, y: img.y, width: img.width, height: img.height }); continue }
    const shape = scene.shapes.find((s) => s.id === id)
    if (shape) { elements.push({ id, type: 'shape', x: shape.x, y: shape.y, width: shape.width, height: shape.height }) }
  }
  return elements
}

function patchElement(state: StoreState, id: string, patch: { x?: number; y?: number }) {
  const scene = safeScene(state)
  if (scene.devices.some((d) => d.id === id)) state.updateDevice(id, patch)
  else if (scene.textBoxes.some((t) => t.id === id)) state.updateTextBox(id, patch)
  else if (scene.images.some((i) => i.id === id)) state.updateImage(id, patch)
  else if (scene.shapes.some((s) => s.id === id)) state.updateShape(id, patch)
}

export const createSelectionSlice: StateCreator<StoreState, [], [], SelectionSlice> = (set, get) => ({
  selectedIds: [],
  selectionMode: 'single',

  select: (id, multi = false) =>
    set((state) => {
      const scene = safeScene(state)
      const findGroupIds = (elId: string): string[] => {
        for (const d of scene.devices) if (d.id === elId && d.groupId) {
          const group = scene.groups.find((g) => g.id === d.groupId)
          if (group) return group.childIds
        }
        for (const t of scene.textBoxes) if (t.id === elId && t.groupId) {
          const group = scene.groups.find((g) => g.id === t.groupId)
          if (group) return group.childIds
        }
        for (const i of scene.images) if (i.id === elId && i.groupId) {
          const group = scene.groups.find((g) => g.id === i.groupId)
          if (group) return group.childIds
        }
        for (const s of scene.shapes) if (s.id === elId && s.groupId) {
          const group = scene.groups.find((g) => g.id === s.groupId)
          if (group) return group.childIds
        }
        return [elId]
      }
      const targetIds = findGroupIds(id)
      if (multi) {
        const existing = new Set(state.selectedIds)
        if (existing.has(id)) {
          const filtered = state.selectedIds.filter((sid) => !targetIds.includes(sid))
          return {
            selectedIds: filtered,
            selectionMode: filtered.length > 1 ? 'multi' : 'single'
          }
        }
        const merged = [...state.selectedIds.filter((sid) => !targetIds.includes(sid)), ...targetIds]
        return { selectedIds: merged, selectionMode: 'multi' }
      }
      return { selectedIds: targetIds, selectionMode: targetIds.length > 1 ? 'multi' : 'single' }
    }),

  selectDirect: (id) =>
    set({ selectedIds: [id], selectionMode: 'single' }),

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
        ...scene.images.map((i) => i.id),
        ...scene.shapes.map((s) => s.id)
      ]
      return { selectedIds: allIds, selectionMode: 'multi' }
    }),

  isSelected: (id) => get().selectedIds.includes(id),

  selectInRect: (x, y, w, h) =>
    set((state) => {
      const scene = safeScene(state)
      const left = Math.min(x, x + w)
      const right = Math.max(x, x + w)
      const top = Math.min(y, y + h)
      const bottom = Math.max(y, y + h)
      const ids: string[] = []
      for (const d of scene.devices) {
        const dl = d.x, dr = d.x + d.width, dt = d.y, db = d.y + d.height
        if (dl < right && dr > left && dt < bottom && db > top) ids.push(d.id)
      }
      for (const t of scene.textBoxes) {
        const tl = t.x, tr = t.x + t.width, tt = t.y, tb = t.y + t.height
        if (tl < right && tr > left && tt < bottom && tb > top) ids.push(t.id)
      }
      for (const i of scene.images) {
        const il = i.x, ir = i.x + i.width, it = i.y, ib = i.y + i.height
        if (il < right && ir > left && it < bottom && ib > top) ids.push(i.id)
      }
      for (const s of scene.shapes) {
        const sl = s.x, sr = s.x + s.width, st = s.y, sb = s.y + s.height
        if (sl < right && sr > left && st < bottom && sb > top) ids.push(s.id)
      }
      return { selectedIds: ids, selectionMode: ids.length > 1 ? 'multi' : 'single' }
    }),

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
