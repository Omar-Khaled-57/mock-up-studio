import { useStore } from '../store'
import { safeScene } from '../store/sceneSlice'
import { getParentChain, scenePointToStored, storedToScenePoint } from '../services/parent-transform'
import type { MultiDragEntry } from '../hooks/useDrag'

/**
 * Builds follower entries for a multi-select drag. Each entry's `startElemX/Y`
 * are the COMPOSED scene coordinates of the element (via `storedToScenePoint`),
 * so the drag session moves every selected element in scene space. Live DOM
 * writes and commits map back to the element's STORED (parent-local) frame via
 * `scenePointToStored`, and a selected element nested under another dragged
 * element is skipped entirely (`skipCommit`) — its ancestor moves it as part of
 * its own subtree.
 */
export function getMultiDragEntries(currentId: string): MultiDragEntry[] {
  const state = useStore.getState()
  const ids = state.selectedIds
  if (ids.length < 2) return []
  const scene = safeScene(state)
  const dragSet = new Set(ids)
  const entries: MultiDragEntry[] = []

  const push = (id: string, raw: { x: number; y: number }, update: (eid: string, x: number, y: number) => void): void => {
    const el = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement | null
    if (!el) return
    const start = storedToScenePoint(scene, id, { x: raw.x, y: raw.y })
    const chain = getParentChain(scene, id)
    const hasAncestorInDrag = chain.slice(0, -1).some((anc) => dragSet.has(anc))
    entries.push({
      id,
      startElemX: start.x,
      startElemY: start.y,
      el,
      skipCommit: hasAncestorInDrag,
      toStored: (x, y) => scenePointToStored(safeScene(useStore.getState()), id, { x, y }),
      commit: (eid, x, y) => {
        const p = scenePointToStored(safeScene(useStore.getState()), eid, { x, y })
        update(eid, Math.round(p.x), Math.round(p.y))
      }
    })
  }

  for (const id of ids) {
    if (id === currentId) continue
    const dev = scene.devices.find((d) => d.id === id)
    if (dev) {
      push(id, dev, (eid, x, y) => useStore.getState().updateDevice(eid, { x, y }))
      continue
    }
    const tb = scene.textBoxes.find((t) => t.id === id)
    if (tb) {
      push(id, tb, (eid, x, y) => useStore.getState().updateTextBox(eid, { x, y }))
      continue
    }
    const img = scene.images.find((i) => i.id === id)
    if (img) {
      push(id, img, (eid, x, y) => useStore.getState().updateImage(eid, { x, y }))
      continue
    }
    const shape = scene.shapes.find((s) => s.id === id)
    if (shape) {
      push(id, shape, (eid, x, y) => useStore.getState().updateShape(eid, { x, y }))
    }
  }
  return entries
}
