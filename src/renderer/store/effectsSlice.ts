/**
 * effectsSlice — CRUD for per-element non-destructive image effects.
 *
 * Effects live on `ImageOverlay.effects` / `Shape.effects` as an optional
 * `ImageEffects` object (100 = neutral). `updateEffects` merges a partial
 * patch onto the current object (creating it with neutral defaults on first
 * use); `resetEffects` removes the field entirely (neutral again).
 * Mutation is dispatched to the right element array by id lookup.
 */

import { StateCreator } from 'zustand'
import { ImageEffects } from '@shared/types'
import { StoreState } from './index'
import { DEFAULT_EFFECTS } from '../lib/effects'

export interface EffectsSlice {
  updateEffects: (elementId: string, patch: Partial<ImageEffects>) => void
  resetEffects: (elementId: string) => void
}

export const createEffectsSlice: StateCreator<StoreState, [], [], EffectsSlice> = (set) => ({
  updateEffects: (elementId, patch) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      const img = scene.images.find((i) => i.id === elementId)
      if (img) {
        scenes[state.activeSceneIndex] = {
          ...scene,
          images: scene.images.map((i) =>
            i.id === elementId ? { ...i, effects: { ...DEFAULT_EFFECTS, ...i.effects, ...patch } } : i
          )
        }
        return { scenes }
      }
      const shape = scene.shapes.find((s) => s.id === elementId)
      if (shape) {
        scenes[state.activeSceneIndex] = {
          ...scene,
          shapes: scene.shapes.map((s) =>
            s.id === elementId ? { ...s, effects: { ...DEFAULT_EFFECTS, ...s.effects, ...patch } } : s
          )
        }
        return { scenes }
      }
      return state
    }),

  resetEffects: (elementId) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      const img = scene.images.find((i) => i.id === elementId)
      if (img) {
        scenes[state.activeSceneIndex] = {
          ...scene,
          images: scene.images.map((i) => (i.id === elementId ? { ...i, effects: undefined } : i))
        }
        return { scenes }
      }
      const shape = scene.shapes.find((s) => s.id === elementId)
      if (shape) {
        scenes[state.activeSceneIndex] = {
          ...scene,
          shapes: scene.shapes.map((s) => (s.id === elementId ? { ...s, effects: undefined } : s))
        }
        return { scenes }
      }
      return state
    })
})
