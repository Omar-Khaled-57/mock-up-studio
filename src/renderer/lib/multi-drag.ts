import { useStore } from '../store'
import { safeScene } from '../store/sceneSlice'
import type { MultiDragEntry } from '../hooks/useDrag'

export function getMultiDragEntries(currentId: string): MultiDragEntry[] {
  const state = useStore.getState()
  const ids = state.selectedIds
  if (ids.length < 2) return []
  const scene = safeScene(state)
  const entries: MultiDragEntry[] = []
  for (const id of ids) {
    if (id === currentId) continue
    const dev = scene.devices.find((d) => d.id === id)
    if (dev) {
      const el = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement | null
      if (el) entries.push({ id, startElemX: dev.x, startElemY: dev.y, el, commit: (eid, x, y) => useStore.getState().updateDevice(eid, { x, y }) })
      continue
    }
    const tb = scene.textBoxes.find((t) => t.id === id)
    if (tb) {
      const el = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement | null
      if (el) entries.push({ id, startElemX: tb.x, startElemY: tb.y, el, commit: (eid, x, y) => useStore.getState().updateTextBox(eid, { x, y }) })
      continue
    }
    const img = scene.images.find((i) => i.id === id)
    if (img) {
      const el = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement | null
      if (el) entries.push({ id, startElemX: img.x, startElemY: img.y, el, commit: (eid, x, y) => useStore.getState().updateImage(eid, { x, y }) })
      continue
    }
    const shape = scene.shapes.find((s) => s.id === id)
    if (shape) {
      const el = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement | null
      if (el) entries.push({ id, startElemX: shape.x, startElemY: shape.y, el, commit: (eid, x, y) => useStore.getState().updateShape(eid, { x, y }) })
    }
  }
  return entries
}
