/**
 * runtimeSlice — Transient editor state, separate from the document store.
 *
 * This store holds state that describes what the editor is doing (active tool,
 * hovered element, marquee rectangle, live brush stroke, focus group) rather
 * than what the document contains. It is NEVER serialized into project files
 * and is NEVER snapshotted by the history system.
 *
 * Reset contract:
 *   - resetRuntime('transient') clears in-flight interaction state but keeps the
 *     active tool and focus group (used on undo/redo, scene switches, and the
 *     scene-iteration of multi-scene export).
 *   - resetRuntime('all') additionally restores the default tool and clears the
 *     temporary-tool stack and focus (used on project load/new).
 *
 * Dependency rule: this module must NOT import from the document store
 * (src/renderer/store/*). Document slices import resetRuntime from
 * src/renderer/runtime/store, so importing back here would create a cycle.
 */

import { StateCreator } from 'zustand'

export type ResetScope = 'all' | 'transient'
export type TemporaryToolUntil = 'keyup' | 'pointerup'
export type EditingMode = 'text' | 'rename' | 'upload'
export type MaskPreviewShape = 'rectangle' | 'ellipse' | 'brush'
export type MaskMode = 'mask' | 'unmask'

export interface BrushOptions {
  size: number
  hardness: number
  color: string
}

export const DEFAULT_BRUSH_OPTIONS: BrushOptions = {
  size: 24,
  hardness: 0.6,
  color: '#6366f1'
}

export interface TemporaryToolEntry {
  toolId: string
  until: TemporaryToolUntil
}

export interface HoverTarget {
  id: string
  kind: string
}

export interface InteractionDescriptor {
  toolId: string
  pointerId: number
  kind: string
  startedAt: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface StrokePoint {
  x: number
  y: number
  pressure: number
}

export interface EditingTarget {
  id: string
  mode: EditingMode
}

export interface SnapGuides {
  verticalGuides: number[]
  horizontalGuides: number[]
}

export interface MaskPreviewState {
  targetId: string
  shape: MaskPreviewShape
  points: { x: number; y: number }[]
}

export interface TemporaryTransform {
  elementId: string
  kind: string
  deltaX: number
  deltaY: number
}

export interface RuntimeContextMenuItem {
  label: string
  action: () => void
  divider?: boolean
  danger?: boolean
}

export interface RuntimeContextMenu {
  x: number
  y: number
  items: RuntimeContextMenuItem[]
}

export interface RuntimeState {
  activeToolId: string
  temporaryToolStack: TemporaryToolEntry[]
  hoveredElement: HoverTarget | null
  pointerScenePos: { x: number; y: number } | null
  pointerInCanvas: boolean
  activeInteraction: InteractionDescriptor | null
  marqueeRect: Rect | null
  strokeBuffer: StrokePoint[]
  strokeDirty: boolean
  brush: BrushOptions
  temporaryTransform: TemporaryTransform | null
  focusGroupId: string | null
  snapGuides: SnapGuides
  maskPreview: MaskPreviewState | null
  maskShape: MaskPreviewShape
  maskMode: MaskMode
  editing: EditingTarget | null
  contextMenu: RuntimeContextMenu | null
}

export const DEFAULT_TOOL_ID = 'select'

export const EMPTY_SNAP_GUIDES: SnapGuides = {
  verticalGuides: [],
  horizontalGuides: []
}

export interface RuntimeSlice extends RuntimeState {
  setActiveTool: (toolId: string) => void
  pushTemporaryTool: (toolId: string, until: TemporaryToolUntil) => void
  popTemporaryTool: () => void
  clearTemporaryToolStack: () => void
  setHoveredElement: (target: HoverTarget | null) => void
  setPointerScenePos: (pos: { x: number; y: number } | null) => void
  setPointerInCanvas: (inCanvas: boolean) => void
  beginInteraction: (descriptor: InteractionDescriptor) => void
  endInteraction: () => void
  setMarqueeRect: (rect: Rect | null) => void
  setStrokeBuffer: (points: StrokePoint[]) => void
  appendStrokePoint: (point: StrokePoint) => void
  setStrokeDirty: (dirty: boolean) => void
  setBrush: (patch: Partial<BrushOptions>) => void
  setTemporaryTransform: (transform: TemporaryTransform | null) => void
  enterFocus: (groupId: string) => void
  exitFocus: () => void
  setSnapGuides: (guides: SnapGuides) => void
  setMaskPreview: (preview: MaskPreviewState | null) => void
  setMaskShape: (shape: MaskPreviewShape) => void
  setMaskMode: (mode: MaskMode) => void
  setEditing: (target: EditingTarget | null) => void
  openContextMenu: (menu: RuntimeContextMenu) => void
  closeContextMenu: () => void
}

export const createRuntimeSlice: StateCreator<RuntimeState, [], [], RuntimeSlice> = (set) => ({
  activeToolId: DEFAULT_TOOL_ID,
  temporaryToolStack: [],
  hoveredElement: null,
  pointerScenePos: null,
  pointerInCanvas: false,
  activeInteraction: null,
  marqueeRect: null,
  strokeBuffer: [],
  strokeDirty: false,
  brush: { ...DEFAULT_BRUSH_OPTIONS },
  temporaryTransform: null,
  focusGroupId: null,
  snapGuides: { verticalGuides: [], horizontalGuides: [] },
  maskPreview: null,
  maskShape: 'rectangle',
  maskMode: 'mask',
  editing: null,
  contextMenu: null,

  setActiveTool: (toolId) => set({ activeToolId: toolId }),

  pushTemporaryTool: (toolId, until) =>
    set((state) => ({ temporaryToolStack: [...state.temporaryToolStack, { toolId, until }] })),

  popTemporaryTool: () =>
    set((state) => ({ temporaryToolStack: state.temporaryToolStack.slice(0, -1) })),

  clearTemporaryToolStack: () => set({ temporaryToolStack: [] }),

  setHoveredElement: (target) => set({ hoveredElement: target }),

  setPointerScenePos: (pos) => set({ pointerScenePos: pos }),

  setPointerInCanvas: (inCanvas) => set({ pointerInCanvas: inCanvas }),

  beginInteraction: (descriptor) => set({ activeInteraction: descriptor }),

  endInteraction: () => set({ activeInteraction: null, temporaryTransform: null }),

  setMarqueeRect: (rect) => set({ marqueeRect: rect }),

  setStrokeBuffer: (points) => set({ strokeBuffer: points }),

  appendStrokePoint: (point) =>
    set((state) => ({ strokeBuffer: [...state.strokeBuffer, point] })),

  setStrokeDirty: (dirty) => set({ strokeDirty: dirty }),

  setBrush: (patch) => set((state) => ({ brush: { ...state.brush, ...patch } })),

  setTemporaryTransform: (transform) => set({ temporaryTransform: transform }),

  enterFocus: (groupId) => set({ focusGroupId: groupId }),

  exitFocus: () => set({ focusGroupId: null }),

  setSnapGuides: (guides) => set({ snapGuides: guides }),

  setMaskPreview: (preview) => set({ maskPreview: preview }),
  setMaskShape: (shape) => set({ maskShape: shape }),
  setMaskMode: (mode) => set({ maskMode: mode }),

  setEditing: (target) => set({ editing: target }),

  openContextMenu: (menu) => set({ contextMenu: menu }),

  closeContextMenu: () => set({ contextMenu: null })
})
