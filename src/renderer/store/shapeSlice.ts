/**
 * shapeSlice — CRUD and z-order operations for shape elements.
 *
 * Follows the same patterns as sceneSlice for devices/textboxes/images.
 * Shapes are stored in `Scene.shapes[]` and participate in the unified
 * z-order system alongside all other element types.
 */

import { StateCreator } from 'zustand'
import { Shape, ShapeKind } from '@shared/types'
import { StoreState } from './index'
import { generateId } from '../lib/id'
import { applyFocusParent } from './sceneSlice'

const DEFAULT_SHAPE_SIZE = 120

export function createDefaultShape(kind: ShapeKind, canvasWidth: number, canvasHeight: number): Shape {
  return {
    id: generateId(),
    kind,
    name: `${kind.charAt(0).toUpperCase() + kind.slice(1).replace('-', ' ')}`,
    x: Math.round((canvasWidth - DEFAULT_SHAPE_SIZE) / 2),
    y: Math.round((canvasHeight - DEFAULT_SHAPE_SIZE) / 2),
    width: DEFAULT_SHAPE_SIZE,
    height: DEFAULT_SHAPE_SIZE,
    rotation: 0,
    opacity: 100,
    color: '#6366f1',
    gradient: null,
    blur: 0,
    glow: [],
    shadow: [],
    zIndex: 0,
    locked: false,
    visible: true,
    cornerRadius: 0,
    backgroundImage: null,
    angles: [60, 60, 60],
    crossThickness: 0.3,
    plusThickness: 0.3,
    arrowThickness: 0.5,
    groupId: null,
    containerId: null
  }
}

export interface ShapeSlice {
  addShape: (shape: Shape) => void
  updateShape: (shapeId: string, patch: Partial<Shape>) => void
  removeShape: (shapeId: string) => void
}

export const createShapeSlice: StateCreator<StoreState, [], [], ShapeSlice> = (set) => ({
  addShape: (shape) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        shapes: [...scene.shapes, applyFocusParent(scene, shape)]
      }
      return { scenes }
    }),

  updateShape: (shapeId, patch) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        shapes: scene.shapes.map((s) => (s.id === shapeId ? { ...s, ...patch } : s))
      }
      return { scenes }
    }),

  removeShape: (shapeId) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        shapes: scene.shapes.filter((s) => s.id !== shapeId)
      }
      return { scenes }
    })
})
