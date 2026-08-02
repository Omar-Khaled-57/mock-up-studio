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
import { Device, TextBox, ImageOverlay, Shape, Mask } from '@shared/types'
import { StoreState } from './index'
import { safeScene } from './sceneSlice'
import { generateId } from '../lib/id'

interface ClipboardEntry {
  id: string
  kind: 'device' | 'textbox' | 'image' | 'shape'
  data: Device | TextBox | ImageOverlay | Shape
  /** Masks targeting the copied element, cloned so paste can re-target them. */
  masks: Mask[]
}

export type ElementKind4 = 'device' | 'textbox' | 'image' | 'shape'

/** Appearance-only style snapshot for Copy/Paste Style (no transform/content). */
export interface CopiedStyle {
  kind: ElementKind4
  patch: Record<string, unknown>
}

const DEVICE_STYLE_FIELDS: (keyof Device)[] = ['colorTheme', 'customBezelColor', 'customBorderColor', 'objectFit']

const TEXTBOX_STYLE_FIELDS: (keyof TextBox)[] = [
  'fontSize', 'fontFamily', 'fontWeight', 'textAlign', 'lineHeight', 'letterSpacing',
  'wordSpacing', 'textTransform', 'strokeColor', 'strokeWidth', 'color', 'gradient',
  'glow', 'shadow', 'backgroundVisible', 'backgroundColor', 'borderVisible',
  'borderColor', 'borderRadius', 'stylePreset'
]

const IMAGE_STYLE_FIELDS: (keyof ImageOverlay)[] = [
  'opacity', 'borderRadius', 'blendMode', 'flipX', 'flipY', 'blur', 'glow', 'shadow', 'effects'
]

const SHAPE_STYLE_FIELDS: (keyof Shape)[] = [
  'color', 'gradient', 'opacity', 'blur', 'glow', 'shadow', 'cornerRadius',
  'backgroundImage', 'angles', 'crossThickness', 'plusThickness', 'arrowThickness', 'effects'
]

function pickStyle(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    if (obj[f] !== undefined) out[f] = obj[f]
  }
  return out
}

function styleFieldsFor(kind: ElementKind4): string[] {
  if (kind === 'device') return DEVICE_STYLE_FIELDS as unknown as string[]
  if (kind === 'textbox') return TEXTBOX_STYLE_FIELDS as unknown as string[]
  if (kind === 'image') return IMAGE_STYLE_FIELDS as unknown as string[]
  return SHAPE_STYLE_FIELDS as unknown as string[]
}

function findKindOf(state: StoreState, id: string): ElementKind4 | null {
  const scene = safeScene(state)
  if (scene.devices.some((d) => d.id === id)) return 'device'
  if (scene.textBoxes.some((t) => t.id === id)) return 'textbox'
  if (scene.images.some((i) => i.id === id)) return 'image'
  if (scene.shapes.some((s) => s.id === id)) return 'shape'
  return null
}

function findElementData(state: StoreState, id: string): Record<string, unknown> | null {
  const scene = safeScene(state)
  const dev = scene.devices.find((d) => d.id === id)
  if (dev) return dev as unknown as Record<string, unknown>
  const tb = scene.textBoxes.find((t) => t.id === id)
  if (tb) return tb as unknown as Record<string, unknown>
  const img = scene.images.find((i) => i.id === id)
  if (img) return img as unknown as Record<string, unknown>
  const shape = scene.shapes.find((s) => s.id === id)
  if (shape) return shape as unknown as Record<string, unknown>
  return null
}

export interface ClipboardSlice {
  clipboard: ClipboardEntry[]
  clipboardMode: 'copy' | 'cut' | null
  copiedStyle: CopiedStyle | null
  /** Deep-clones selected elements into the clipboard (copy mode). */
  copySelected: () => void
  /** Copies selected elements and then deletes them from the scene (cut mode). */
  cutSelected: () => void
  /**
   * Pastes clipboard contents into the active scene.
   * Returns the IDs of newly created elements. Clears clipboard if mode is 'cut'.
   */
  pasteClipboard: () => string[]
  /** Snapshots the appearance of the first selected element (Copy Style). */
  copyStyleSelected: () => void
  /** Applies the copied style to every selected element of the same kind. */
  pasteStyleToSelected: () => void
}

export const createClipboardSlice: StateCreator<StoreState, [], [], ClipboardSlice> = (set, get) => ({
  clipboard: [],
  clipboardMode: null,
  copiedStyle: null,

  copySelected: () => {
    const state = get()
    const scene = safeScene(state)
    const entries: ClipboardEntry[] = []

    for (const id of state.selectedIds) {
      const masks = scene.masks.filter((m) => m.targetId === id).map((m) => ({ ...m }))
      const dev = scene.devices.find((d) => d.id === id)
      if (dev) {
        entries.push({ id: dev.id, kind: 'device', data: { ...dev }, masks })
        continue
      }
      const tb = scene.textBoxes.find((t) => t.id === id)
      if (tb) {
        entries.push({ id: tb.id, kind: 'textbox', data: { ...tb }, masks })
        continue
      }
      const img = scene.images.find((i) => i.id === id)
      if (img) {
        entries.push({ id: img.id, kind: 'image', data: { ...img }, masks })
        continue
      }
      const shape = scene.shapes.find((s) => s.id === id)
      if (shape) {
        entries.push({ id: shape.id, kind: 'shape', data: { ...shape }, masks })
      }
    }

    set({ clipboard: entries, clipboardMode: 'copy' })
  },

  cutSelected: () => {
    const state = get()
    const scene = safeScene(state)
    const entries: ClipboardEntry[] = []

    for (const id of state.selectedIds) {
      const masks = scene.masks.filter((m) => m.targetId === id).map((m) => ({ ...m }))
      const dev = scene.devices.find((d) => d.id === id)
      if (dev) {
        entries.push({ id: dev.id, kind: 'device', data: { ...dev }, masks })
        continue
      }
      const tb = scene.textBoxes.find((t) => t.id === id)
      if (tb) {
        entries.push({ id: tb.id, kind: 'textbox', data: { ...tb }, masks })
        continue
      }
      const img = scene.images.find((i) => i.id === id)
      if (img) {
        entries.push({ id: img.id, kind: 'image', data: { ...img }, masks })
        continue
      }
      const shape = scene.shapes.find((s) => s.id === id)
      if (shape) {
        entries.push({ id: shape.id, kind: 'shape', data: { ...shape }, masks })
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

    // Assign new ids up front so children pasted alongside their container can
    // be re-targeted (old container id -> pasted container's new id).
    const idMap = new Map<string, string>()
    for (const entry of clipboard) {
      const newId = generateId()
      idMap.set(entry.id, newId)
      newIds.push(newId)
    }

    const remapContainer = (cid: string | null): string | null =>
      cid ? (idMap.get(cid) ?? cid) : null

    state.pushHistory('Paste')

    for (const entry of clipboard) {
      const newId = idMap.get(entry.id)!
      maxZ++

      if (entry.kind === 'device') {
        const orig = entry.data as Device
        const dup: Device = {
          ...orig,
          id: newId,
          name: `${orig.name} copy`,
          x: orig.x + offset,
          y: orig.y + offset,
          zIndex: maxZ,
          containerId: remapContainer(orig.containerId)
        }
        state.addDevice(dup)
      } else if (entry.kind === 'textbox') {
        const orig = entry.data as TextBox
        const dup: TextBox = {
          ...orig,
          id: newId,
          x: orig.x + offset,
          y: orig.y + offset,
          zIndex: maxZ,
          containerId: remapContainer(orig.containerId)
        }
        state.addTextBox(dup)
      } else if (entry.kind === 'image') {
        const orig = entry.data as ImageOverlay
        const dup: ImageOverlay = {
          ...orig,
          id: newId,
          x: orig.x + offset,
          y: orig.y + offset,
          zIndex: maxZ,
          containerId: remapContainer(orig.containerId)
        }
        state.addImage(dup)
      } else if (entry.kind === 'shape') {
        const orig = entry.data as Shape
        const dup: Shape = {
          ...orig,
          id: newId,
          name: `${orig.name} copy`,
          x: orig.x + offset,
          y: orig.y + offset,
          zIndex: maxZ,
          containerId: remapContainer(orig.containerId)
        }
        state.addShape(dup)
      }

      for (const m of entry.masks ?? []) {
        state.addMask({ ...m, id: generateId(), targetId: newId })
      }
    }

    if (clipboardMode === 'cut') {
      set({ clipboard: [], clipboardMode: null })
    }

    set({ selectedIds: newIds })
    return newIds
  },

  copyStyleSelected: () => {
    const state = get()
    const id = state.selectedIds[0]
    if (!id) return
    const kind = findKindOf(state, id)
    const data = findElementData(state, id)
    if (!kind || !data) return
    set({ copiedStyle: { kind, patch: pickStyle(data, styleFieldsFor(kind)) } })
  },

  pasteStyleToSelected: () => {
    const state = get()
    const { copiedStyle } = state
    if (!copiedStyle) return
    const targets = state.selectedIds.filter((id) => findKindOf(state, id) === copiedStyle.kind)
    if (targets.length === 0) return

    state.pushHistory('Paste style')

    const patch = copiedStyle.patch
    for (const id of targets) {
      if (copiedStyle.kind === 'device') state.updateDevice(id, patch as Partial<Device>)
      else if (copiedStyle.kind === 'textbox') state.updateTextBox(id, patch as Partial<TextBox>)
      else if (copiedStyle.kind === 'image') state.updateImage(id, patch as Partial<ImageOverlay>)
      else state.updateShape(id, patch as Partial<Shape>)
    }
  }
})
