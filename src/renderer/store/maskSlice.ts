/**
 * maskSlice — CRUD and operations for scene-layer masks (architecture §6.1).
 *
 * Masks are first-class scene layers: `Scene.masks[]` with scene-space
 * geometry and their own `name`/`zIndex`/`visible`/`locked` layer fields.
 * They are never tied to an element — a mask clips the whole canvas (via the
 * scene mask wrappers) independently of any object.
 *
 * History contract: callers MUST call `pushHistory()` BEFORE mutating so undo
 * restores the exact pre-mask state (same rule as every other document slice).
 */

import { StateCreator } from 'zustand'
import { Mask, Scene } from '@shared/types'
import { StoreState } from './index'
import { captureMaskSnapshot } from '../services/mask-snapshot'

export interface MaskSlice {
  /** Appends a fully-formed mask to the active scene. */
  addMask: (mask: Mask) => void
  /** Merges a partial patch into a mask by id. */
  updateMask: (maskId: string, patch: Partial<Mask>) => void
  /** Deletes a mask object by id. */
  removeMask: (maskId: string) => void
  /** Toggles the mask's invert flag (clip → punch). */
  reverseMask: (maskId: string) => void
  /**
   * Replaces the whole active scene's mask list — the commit boundary for a
   * subtractive unmask stroke (one history entry).
   */
  replaceMasks: (masks: Mask[]) => void
  /**
   * Removes every mask in the active scene. The in-app recovery path for stale
   * masks (e.g. a reveal mask tiling the whole canvas in checkerboards).
   */
  clearAllMasks: () => void
  /**
   * Re-captures a mask's frozen snapshot from the current canvas (the explicit
   * Refresh action) over the mask's own scene box. Frees any live-clip mask
   * too — a mask without a snapshot becomes frozen. Pushes ONE history entry;
   * a no-op (mask missing or capture failing) pushes nothing.
   */
  refreshMaskSnapshot: (maskId: string) => Promise<void>
}

/** Next available mask z-index: max over every element and mask z, plus one. */
export function nextMaskZIndex(scene: Scene): number {
  let max = -1
  for (const list of [scene.devices, scene.textBoxes, scene.images, scene.shapes ?? [], scene.masks]) {
    for (const entry of list) {
      if (entry.zIndex > max) max = entry.zIndex
    }
  }
  return max + 1
}

export const createMaskSlice: StateCreator<StoreState, [], [], MaskSlice> = (set, get) => ({
  addMask: (mask) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        masks: [...scene.masks, mask]
      }
      return { scenes }
    }),

  updateMask: (maskId, patch) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        masks: scene.masks.map((m) => (m.id === maskId ? { ...m, ...patch } : m))
      }
      return { scenes }
    }),

  removeMask: (maskId) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        masks: scene.masks.filter((m) => m.id !== maskId)
      }
      return { scenes }
    }),

  reverseMask: (maskId) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        masks: scene.masks.map((m) => (m.id === maskId ? { ...m, inverted: !m.inverted } : m))
      }
      return { scenes }
    }),

  replaceMasks: (masks) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        masks
      }
      return { scenes }
    }),

  clearAllMasks: () =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        masks: []
      }
      return { scenes }
    }),

  refreshMaskSnapshot: async (maskId) => {
    let snapshotBounds
    try {
      const state = get()
      const scene = state.scenes[state.activeSceneIndex]
      const mask = scene.masks.find((m) => m.id === maskId)
      if (!mask) return
      snapshotBounds = { x: mask.x, y: mask.y, width: mask.width, height: mask.height }
    } catch {
      return
    }
    let snapshot
    try {
      snapshot = await captureMaskSnapshot(snapshotBounds)
    } catch (err) {
      console.error('[refreshMaskSnapshot] Capture failed:', err)
      return
    }
    if (!snapshot) return
    try {
      const fresh = get()
      const freshScene = fresh.scenes[fresh.activeSceneIndex]
      const stillExists = freshScene?.masks?.some((m) => m.id === maskId)
      if (!stillExists) return
      fresh.pushHistory('Refresh mask')
      fresh.updateMask(maskId, { snapshot })
    } catch (err) {
      console.error('[refreshMaskSnapshot] Commit failed:', err)
    }
  }
})
