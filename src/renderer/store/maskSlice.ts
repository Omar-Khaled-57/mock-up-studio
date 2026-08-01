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
}

export const createMaskSlice: StateCreator<StoreState, [], [], MaskSlice> = (set) => ({
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
    })
})
