/**
 * clipboardSlice — Internal clipboard for copy/cut/paste of scene elements.
 *
 * Uses an in-memory clipboard (not the OS clipboard) so that rich scene
 * element data (positions, dimensions, z-indices, screen images) is
 * preserved across paste operations. The OS clipboard is only used for
 * the separate "Copy to Clipboard" image export flow.
 *
 * Paste behavior:
 *   - Each pasted element gets a new ID and is offset +30px in both axes.
 *   - Pasted elements are placed on top (maxZ + 1) and auto-selected.
 *   - After a cut-paste, the clipboard is cleared (move semantics).
 *   - After a copy-paste, the clipboard retains the entries (duplicate semantics).
 */

import { StateCreator } from 'zustand'
import { Device, TextBox, ImageOverlay, Shape } from '@shared/types'
import { StoreState } from './index'
import { safeScene } from './sceneSlice'
import { generateId } from '../lib/id'

interface ClipboardEntry {
  id: string
  kind: 'device' | 'textbox' | 'image' | 'shape'
  data: Device | TextBox | ImageOverlay | Shape
}

export interface ClipboardSlice {
  clipboard: ClipboardEntry[]
  clipboardMode: 'copy' | 'cut' | null
  /** Deep-clones selected elements into the clipboard (copy mode). */
  copySelected: () => void
  /** Copies selected elements and then deletes them from the scene (cut mode). */
  cutSelected: () => void
  /**
   * Pastes clipboard contents into the active scene.
   * Returns the IDs of newly created elements. Clears clipboard if mode is 'cut'.
   */
  pasteClipboard: () => string[]
}

export const createClipboardSlice: StateCreator<StoreState, [], [], ClipboardSlice> = (set, get) => ({
  clipboard: [],
  clipboardMode: null,

  copySelected: () => {
    const state = get()
    const scene = safeScene(state)
    const entries: ClipboardEntry[] = []

    for (const id of state.selectedIds) {
      const dev = scene.devices.find((d) => d.id === id)
      if (dev) {
        entries.push({ id: dev.id, kind: 'device', data: { ...dev } })
        continue
      }
      const tb = scene.textBoxes.find((t) => t.id === id)
      if (tb) {
        entries.push({ id: tb.id, kind: 'textbox', data: { ...tb } })
        continue
      }
      const img = scene.images.find((i) => i.id === id)
      if (img) {
        entries.push({ id: img.id, kind: 'image', data: { ...img } })
        continue
      }
      const shape = scene.shapes.find((s) => s.id === id)
      if (shape) {
        entries.push({ id: shape.id, kind: 'shape', data: { ...shape } })
      }
    }

    set({ clipboard: entries, clipboardMode: 'copy' })
  },

  cutSelected: () => {
    const state = get()
    const scene = safeScene(state)
    const entries: ClipboardEntry[] = []

    for (const id of state.selectedIds) {
      const dev = scene.devices.find((d) => d.id === id)
      if (dev) {
        entries.push({ id: dev.id, kind: 'device', data: { ...dev } })
        continue
      }
      const tb = scene.textBoxes.find((t) => t.id === id)
      if (tb) {
        entries.push({ id: tb.id, kind: 'textbox', data: { ...tb } })
        continue
      }
      const img = scene.images.find((i) => i.id === id)
      if (img) {
        entries.push({ id: img.id, kind: 'image', data: { ...img } })
        continue
      }
      const shape = scene.shapes.find((s) => s.id === id)
      if (shape) {
        entries.push({ id: shape.id, kind: 'shape', data: { ...shape } })
      }
    }

    if (entries.length > 0) {
      state.pushHistory('Cut')
      state.deleteSelected(state.selectedIds)
    }

    set({ clipboard: entries, clipboardMode: 'cut' })
  },

  pasteClipboard: () => {
    const state = get()
    const { clipboard, clipboardMode } = state
    if (clipboard.length === 0) return []

    const scene = safeScene(state)
    let maxZ = 0
    for (const d of scene.devices) maxZ = Math.max(maxZ, d.zIndex)
    for (const t of scene.textBoxes) maxZ = Math.max(maxZ, t.zIndex)
    for (const i of scene.images) maxZ = Math.max(maxZ, i.zIndex)
    for (const s of scene.shapes) maxZ = Math.max(maxZ, s.zIndex)

    const newIds: string[] = []
    const offset = 30

    for (const entry of clipboard) {
      const newId = generateId()
      maxZ++

      if (entry.kind === 'device') {
        const orig = entry.data as Device
        const dup: Device = {
          ...orig,
          id: newId,
          name: `${orig.name} copy`,
          x: orig.x + offset,
          y: orig.y + offset,
          zIndex: maxZ
        }
        state.addDevice(dup)
        newIds.push(newId)
      } else if (entry.kind === 'textbox') {
        const orig = entry.data as TextBox
        const dup: TextBox = {
          ...orig,
          id: newId,
          x: orig.x + offset,
          y: orig.y + offset,
          zIndex: maxZ
        }
        state.addTextBox(dup)
        newIds.push(newId)
      } else if (entry.kind === 'image') {
        const orig = entry.data as ImageOverlay
        const dup: ImageOverlay = {
          ...orig,
          id: newId,
          x: orig.x + offset,
          y: orig.y + offset,
          zIndex: maxZ
        }
        state.addImage(dup)
        newIds.push(newId)
      } else if (entry.kind === 'shape') {
        const orig = entry.data as Shape
        const dup: Shape = {
          ...orig,
          id: newId,
          name: `${orig.name} copy`,
          x: orig.x + offset,
          y: orig.y + offset,
          zIndex: maxZ
        }
        state.addShape(dup)
        newIds.push(newId)
      }
    }

    if (clipboardMode === 'cut') {
      set({ clipboard: [], clipboardMode: null })
    }

    state.pushHistory('Paste')
    set({ selectedIds: newIds })
    return newIds
  }
})
