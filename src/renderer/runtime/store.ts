/**
 * Runtime store — separate Zustand store for transient editor state.
 *
 * Kept deliberately independent from the document store (src/renderer/store):
 * document slices import resetRuntime from here, so this module must never
 * import from the document store or a circular dependency is created.
 *
 * resetRuntime is the single entry point for clearing transient state. It is
 * invoked by the document store on undo/redo, scene switches, and project
 * load/new, and by tests via resetStore().
 */

import { create } from 'zustand'
import { createRuntimeSlice, DEFAULT_BRUSH_OPTIONS, DEFAULT_TOOL_ID, RuntimeSlice, RuntimeState, ResetScope } from './runtimeSlice'

export const useRuntimeStore = create<RuntimeSlice>()((...a) => ({
  ...createRuntimeSlice(...a)
}))

const TRANSIENT_RESET: Partial<RuntimeState> = {
  hoveredElement: null,
  pointerScenePos: null,
  pointerInCanvas: false,
  activeInteraction: null,
  marqueeRect: null,
  strokeBuffer: [],
  strokeDirty: false,
  temporaryTransform: null,
  snapGuides: { verticalGuides: [], horizontalGuides: [] },
  containerDropTarget: null,
  preview: null,
  maskPreview: null,
  editing: null,
  contextMenu: null
  // savePrompt is deliberately NOT in the transient reset: an in-flight
  // gesture/undo must never dismiss the blocking "Save changes?" modal. It is
  // cleared only by its own open/close actions and the full ('all') reset,
  // which represents a brand-new project where no guard can be pending.
}

const FULL_RESET: Partial<RuntimeState> = {
  ...TRANSIENT_RESET,
  activeToolId: DEFAULT_TOOL_ID,
  temporaryToolStack: [],
  focusGroupId: null,
  focusElementId: null,
  brush: { ...DEFAULT_BRUSH_OPTIONS },
  maskShape: 'rectangle',
  maskMode: 'mask',
  canvasEmptyStateDismissed: false,
  propertiesSections: {},
  exportModalOpen: false,
  toolbarToolsVisible: true,
  savePrompt: null,
  // updatePrompt is deliberately NOT in the transient reset (same contract as
  // savePrompt): an in-flight gesture/undo must never dismiss the styled update
  // prompt. It is cleared by closeUpdatePrompt and the full ('all') reset.
  updatePrompt: null
}

let fullResetHook: (() => void) | null = null

export function registerFullResetHook(fn: () => void): void {
  fullResetHook = fn
}

export function resetRuntime(scope: ResetScope = 'transient'): void {
  useRuntimeStore.setState(scope === 'all' ? FULL_RESET : TRANSIENT_RESET)
  if (scope === 'all') fullResetHook?.()
}
