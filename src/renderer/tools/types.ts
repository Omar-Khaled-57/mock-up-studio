import type { RuntimeSlice, TemporaryToolUntil } from '../runtime/runtimeSlice'
import type { HitTestResult, SceneElementKind } from '../services/hit-test'
import type { FastOverlayHost } from '../services/stroke-host'

export type ResizeHandleName = 'nw' | 'ne' | 'sw' | 'se'

export type ToolGroup = 'select' | 'brush' | 'eraser' | 'mask'

export type ToolCapability = 'moveable' | 'resizable' | 'editable' | 'paintable' | 'maskable'

export type CapabilitySet = Record<ToolCapability, boolean>

export const NO_CAPABILITIES: CapabilitySet = {
  moveable: false,
  resizable: false,
  editable: false,
  paintable: false,
  maskable: false
}

export type ModifierKey = 'shift' | 'ctrl' | 'alt' | 'meta'

export interface Modifiers {
  shift: boolean
  ctrl: boolean
  alt: boolean
  meta: boolean
}

export const NO_MODIFIERS: Modifiers = { shift: false, ctrl: false, alt: false, meta: false }

export interface ToolIdentity {
  id: string
  group: ToolGroup
  label: string
  icon: string
  cursor: string
  shortcut?: string
  variants?: string[]
  options?: boolean
  /** Render a divider before this tool inside a variant flyout. */
  dividerBefore?: boolean
}

export interface InteractionContext {
  effectiveToolId: string
  modifiers: Modifiers
  pointerScenePos: { x: number; y: number } | null
  scenePoint: { x: number; y: number }
  hitResult: HitTestResult | null
  resizeHandle: ResizeHandleName | null
  actions: DocumentActions
  getRuntime: () => RuntimeSlice
  focusEditable: (id: string) => boolean
  fastOverlay: FastOverlayHost | null
  claimPointer: (pointerId: number) => boolean
  releasePointer: (pointerId: number) => void
}

export interface ViewportFacts {
  zoom: number
  panX: number
  panY: number
  isPanning: boolean
}

export interface ElementBounds {
  id: string
  kind: SceneElementKind
  x: number
  y: number
  width: number
  height: number
}

export interface ElementPatch {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
}

export interface DocumentActions {
  getViewport: () => ViewportFacts
  setPan: (x: number, y: number) => void
  setIsPanning: (panning: boolean) => void
  clearSelection: () => void
  selectInRect: (x: number, y: number, width: number, height: number) => void
  getSelectedIds: () => string[]
  select: (id: string, multi?: boolean) => void
  selectDirect: (id: string) => void
  getElementBounds: (id: string) => ElementBounds | null
  updateElement: (id: string, patch: ElementPatch) => void
  pushHistory: (label: string) => void
  uploadScreenImage: (id: string) => void
}

export interface ToolHost {
  getEffectiveToolId: () => string
  setActiveTool: (toolId: string) => void
}

export interface Tool extends ToolIdentity {
  onActivate?: (host: ToolHost) => void
  onDeactivate?: (host: ToolHost) => void
  onPointerDown?: (ctx: InteractionContext, event: PointerEvent) => void
  onPointerMove?: (ctx: InteractionContext, event: PointerEvent) => void
  onPointerUp?: (ctx: InteractionContext, event: PointerEvent) => void
  onPointerCancel?: (ctx: InteractionContext, event: PointerEvent) => void
  onHover?: (ctx: InteractionContext, event: PointerEvent) => void
  onDoubleClick?: (ctx: InteractionContext, event: MouseEvent) => void
  onContextMenu?: (ctx: InteractionContext, event: MouseEvent) => void
  onKeyDown?: (ctx: InteractionContext, event: KeyboardEvent) => void
  onKeyUp?: (ctx: InteractionContext, event: KeyboardEvent) => void
  onModifierChange?: (ctx: InteractionContext, modifiers: Modifiers) => void
  onHistoryUndo?: (ctx: InteractionContext) => void
  onHistoryRedo?: (ctx: InteractionContext) => void
  onFocusChange?: (ctx: InteractionContext, focusGroupId: string | null) => void
  /**
   * Called when an in-flight gesture must be abandoned without a pointer-up:
   * Escape, window blur, or a full manager reset. The tool must cancel any
   * module-level pending session and restore its runtime interaction state.
   */
  onInterrupt?: () => void
}

export interface TemporaryToolEntry {
  toolId: string
  until: TemporaryToolUntil
}
