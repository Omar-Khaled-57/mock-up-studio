/**
 * maskSlice — CRUD and operations for reusable masks (architecture §6.1, §10).
 *
 * Masks are first-class scene content: `Scene.masks[]` where each mask
 * references its target element by id (not the other way around), so any
 * element kind can be masked with zero per-type code. Geometry is stored in
 * the target element's local coordinate frame and never participates in
 * z-order — it rides along with the target element.
 *
 * History contract: callers MUST call `pushHistory()` BEFORE mutating so undo
 * restores the exact pre-mask state (same rule as every other document slice).
 */

import { StateCreator } from 'zustand'
import { Mask } from '@shared/types'
import { StoreState } from './index'
import { generateId } from '../lib/id'
import { findMaskTarget } from '../services/mask-visualization'
import { captureMaskSnapshot } from '../services/mask-snapshot'

export interface MaskSlice {
  /** Appends a fully-formed mask to the active scene. */
  addMask: (mask: Mask) => void
  /** Merges a partial patch into a mask by id. */
  updateMask: (maskId: string, patch: Partial<Mask>) => void
  /** Deletes a mask object by id. */
  removeMask: (maskId: string) => void
  /** Creates a full-bounds rectangle mask covering the given element geometry. */
  maskElement: (elementId: string, geometry: { width: number; height: number }) => void
  /** Removes every mask targeting an element. */
  removeMaskFromElement: (elementId: string) => void
  /** Toggles the mask's invert flag (clip → punch). */
  reverseMask: (maskId: string) => void
  /**
   * Replaces every mask targeting an element with a fresh list — the commit
   * boundary for a subtractive unmask stroke (one history entry).
   */
  replaceTargetMasks: (targetId: string, masks: Mask[]) => void
  /**
   * Removes every mask in the active scene — all targets, including the
   * canvas/background sentinel. The in-app recovery path for stale masks
   * (e.g. a reveal mask tiling the whole canvas in checkerboards).
   */
  clearAllMasks: () => void
  /**
   * Re-captures a mask's frozen snapshot from the current canvas (the explicit
   * Refresh action). Frees any live-clip mask too — a mask without a snapshot
   * becomes frozen. Pushes ONE history entry; a no-op (mask/target missing or
   * capture failing) pushes nothing.
   */
  refreshMaskSnapshot: (maskId: string) => Promise<void>
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

  maskElement: (elementId, geometry) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      const mask: Mask = {
        id: generateId(),
        targetId: elementId,
        shape: 'rectangle',
        x: 0,
        y: 0,
        width: geometry.width,
        height: geometry.height,
        points: [],
        inverted: false
      }
      scenes[state.activeSceneIndex] = {
        ...scene,
        masks: [...scene.masks, mask]
      }
      return { scenes }
    }),

  removeMaskFromElement: (elementId) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        masks: scene.masks.filter((m) => m.targetId !== elementId)
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

  replaceTargetMasks: (targetId, masks) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        masks: [...scene.masks.filter((m) => m.targetId !== targetId), ...masks]
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
    const state = get()
    const scene = state.scenes[state.activeSceneIndex]
    const mask = scene.masks.find((m) => m.id === maskId)
    if (!mask) return
    const target = findMaskTarget(scene, mask.targetId)
    if (!target) return
    const snapshot = await captureMaskSnapshot({
      x: target.x,
      y: target.y,
      width: target.width,
      height: target.height
    })
    if (!snapshot) return
    state.pushHistory('Refresh mask')
    state.updateMask(maskId, { snapshot })
  }
})
