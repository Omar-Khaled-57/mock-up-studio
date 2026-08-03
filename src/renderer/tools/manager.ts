import { useRuntimeStore, registerFullResetHook } from '../runtime/store'
import { useStore } from '../store'
import { safeScene } from '../store/sceneSlice'
import { hitTest, HitTestResult } from '../services/hit-test'
import { focusFilterFor, isInFocusScope } from '../services/focus'
import { getFastOverlayHost } from '../services/stroke-host'
import { getComposedBox } from '../services/parent-transform'
import { pickImageFile } from '../lib/file-upload'
import {
  CapabilitySet,
  DocumentActions,
  InteractionContext,
  ModifierKey,
  Modifiers,
  NO_CAPABILITIES,
  NO_MODIFIERS,
  ResizeHandleName,
  Tool,
  ToolHost,
  TemporaryToolEntry
} from './types'
import {
  getTool,
  isToolReachable,
  ToolRegistry,
  toolRegistry
} from './registry'
import { DEFAULT_TOOL_ID, TemporaryToolUntil } from '../runtime/runtimeSlice'

export interface CursorOptions {
  pointerOwned?: boolean
  draggingCursor?: string
  hoveredCapabilities?: CapabilitySet
  focusDimmed?: boolean
  toolId?: string
}

export interface BuildContextOverrides {
  scenePoint?: { x: number; y: number }
  hitResult?: HitTestResult | null
  resizeHandle?: ResizeHandleName | null
  toolId?: string
}

export interface ToolManager {
  getActiveTool: () => Tool
  setActiveTool: (toolId: string) => void
  getEffectiveTool: () => Tool
  getEffectiveToolId: () => string
  pushTemporaryTool: (toolId: string, until: TemporaryToolUntil) => void
  popTemporaryTool: () => void
  releaseTemporaryUntil: (until: TemporaryToolUntil) => void
  releaseTemporaryTools: () => void
  getModifiers: () => Modifiers
  setModifier: (key: ModifierKey, active: boolean) => void
  acquirePointer: (pointerId: number, toolId: string) => boolean
  releasePointer: (pointerId: number) => void
  releaseAllPointers: () => void
  getOwner: (pointerId: number) => string | null
  isPointerOwned: () => boolean
  getCursor: (opts?: CursorOptions) => string
  handleToolShortcut: (key: string) => boolean
  handleReachableShortcut: (key: string) => boolean
  handleEscape: () => void
  interruptTools: () => void
  reset: () => void
  buildContext: (overrides?: BuildContextOverrides) => InteractionContext
}

const documentActions: DocumentActions = {
  getViewport: () => {
    const s = useStore.getState()
    return { zoom: s.zoom, panX: s.panX, panY: s.panY, isPanning: s.isPanning }
  },
  setPan: (x, y) => useStore.getState().setPan(x, y),
  setIsPanning: (panning) => useStore.getState().setIsPanning(panning),
  clearSelection: () => useStore.getState().clearSelection(),
  selectInRect: (x, y, width, height) => {
    const state = useStore.getState()
    const rt = useRuntimeStore.getState()
    const filter = focusFilterFor(rt.focusGroupId, safeScene(state), rt.focusElementId)
    state.selectInRect(x, y, width, height, filter)
  },
  getSelectedIds: () => useStore.getState().selectedIds,
  select: (id, multi) => {
    const state = useStore.getState()
    const rt = useRuntimeStore.getState()
    const filter = focusFilterFor(rt.focusGroupId, safeScene(state), rt.focusElementId)
    state.select(id, multi, filter)
  },
  selectDirect: (id) => useStore.getState().selectDirect(id),
  getElementBounds: (id) => {
    // Composed scene-space box: children resolve through their parent chain so
    // drag/resize sessions move/scale them in scene coordinates and commit the
    // result back into the parent-local stored frame.
    const scene = safeScene(useStore.getState())
    const box = getComposedBox(scene, id)
    if (!box) return null
    const d = scene.devices.find((el) => el.id === id)
    if (d) return { id: d.id, kind: 'device' as const, x: box.x, y: box.y, width: box.width, height: box.height, rotation: box.rotation ?? 0, lockAspectRatio: d.lockAspectRatio ?? false }
    const t = scene.textBoxes.find((el) => el.id === id)
    if (t) return { id: t.id, kind: 'textBox' as const, x: box.x, y: box.y, width: box.width, height: box.height }
    const i = scene.images.find((el) => el.id === id)
    if (i) return { id: i.id, kind: 'image' as const, x: box.x, y: box.y, width: box.width, height: box.height, rotation: box.rotation ?? 0, lockAspectRatio: i.lockAspectRatio ?? false }
    const s = scene.shapes.find((el) => el.id === id)
    if (s) return { id: s.id, kind: 'shape' as const, x: box.x, y: box.y, width: box.width, height: box.height, rotation: box.rotation ?? 0, lockAspectRatio: s.lockAspectRatio ?? false }
    return null
  },
  updateElement: (id, patch) => {
    const state = useStore.getState()
    const scene = safeScene(state)
    if (scene.devices.some((el) => el.id === id)) {
      state.updateDevice(id, patch)
    } else if (scene.textBoxes.some((el) => el.id === id)) {
      state.updateTextBox(id, patch)
    } else if (scene.images.some((el) => el.id === id)) {
      state.updateImage(id, patch)
    } else if (scene.shapes.some((el) => el.id === id)) {
      state.updateShape(id, patch)
    }
  },
  setElementContainer: (id, containerId) => {
    const state = useStore.getState()
    const scene = safeScene(state)
    if (scene.devices.some((el) => el.id === id)) state.updateDevice(id, { containerId })
    else if (scene.textBoxes.some((el) => el.id === id)) state.updateTextBox(id, { containerId })
    else if (scene.images.some((el) => el.id === id)) state.updateImage(id, { containerId })
    else if (scene.shapes.some((el) => el.id === id)) state.updateShape(id, { containerId })
  },
  pushHistory: (label) => useStore.getState().pushHistory(label),
  uploadScreenImage: (id) => {
    pickImageFile((dataUrl) => {
      const state = useStore.getState()
      state.pushHistory('Upload screenshot')
      state.updateDevice(id, { screenImage: dataUrl })
    })
  }
}

export function createToolManager(registry: ToolRegistry): ToolManager {
  let activeToolId = 'select'
  let temporaryStack: TemporaryToolEntry[] = []
  let modifiers: Modifiers = { ...NO_MODIFIERS }
  const ownership = new Map<number, string>()

  const runtime = () => useRuntimeStore.getState()

  const host: ToolHost = {
    getEffectiveToolId: () => getEffectiveToolId(),
    setActiveTool: (toolId) => setActiveTool(toolId)
  }

  function getEffectiveToolId(): string {
    return temporaryStack.length > 0
      ? temporaryStack[temporaryStack.length - 1].toolId
      : activeToolId
  }

  function getEffectiveTool(): Tool {
    return getTool(registry, getEffectiveToolId()) ?? getTool(registry, activeToolId)!
  }

  function buildContext(overrides?: BuildContextOverrides): InteractionContext {
    const rt = useRuntimeStore.getState()
    const toolId = overrides?.toolId ?? getEffectiveToolId()
    const scenePoint = overrides?.scenePoint ?? rt.pointerScenePos ?? { x: 0, y: 0 }
    const hitResult =
      overrides?.hitResult ?? hitTest(safeScene(useStore.getState()), scenePoint)
    return {
      effectiveToolId: getEffectiveToolId(),
      modifiers: { ...modifiers },
      pointerScenePos: rt.pointerScenePos,
      scenePoint,
      hitResult,
      resizeHandle: overrides?.resizeHandle ?? null,
      actions: documentActions,
      getRuntime: () => useRuntimeStore.getState(),
      focusEditable: (id) => {
        const rt = useRuntimeStore.getState()
        return isInFocusScope(id, rt.focusGroupId, safeScene(useStore.getState()), rt.focusElementId)
      },
      fastOverlay: getFastOverlayHost(),
      claimPointer: (pointerId) => acquirePointer(pointerId, toolId),
      releasePointer: (pointerId) => releasePointer(pointerId)
    }
  }

  function setActiveTool(toolId: string): void {
    const next = getTool(registry, toolId)
    if (!next || next.id === activeToolId) return
    const previous = getTool(registry, activeToolId)
    previous?.onDeactivate?.(host)
    activeToolId = next.id
    next.onActivate?.(host)
    runtime().setActiveTool(next.id)
  }

  function pushTemporaryTool(toolId: string, until: TemporaryToolUntil): void {
    if (!getTool(registry, toolId)) return
    temporaryStack = [...temporaryStack, { toolId, until }]
    runtime().pushTemporaryTool(toolId, until)
  }

  function popTemporaryTool(): void {
    if (temporaryStack.length === 0) return
    temporaryStack = temporaryStack.slice(0, -1)
    runtime().popTemporaryTool()
  }

  function releaseTemporaryUntil(until: TemporaryToolUntil): void {
    while (temporaryStack.length > 0 && temporaryStack[temporaryStack.length - 1].until === until) {
      popTemporaryTool()
    }
  }

  function releaseTemporaryTools(): void {
    temporaryStack = []
    runtime().clearTemporaryToolStack()
  }

  function setModifier(key: ModifierKey, active: boolean): void {
    if (modifiers[key] === active) return
    modifiers = { ...modifiers, [key]: active }
    getEffectiveTool().onModifierChange?.(buildContext(), { ...modifiers })
  }

  function acquirePointer(pointerId: number, toolId: string): boolean {
    const existing = ownership.get(pointerId)
    if (existing !== undefined && existing !== toolId) return false
    ownership.set(pointerId, toolId)
    return true
  }

  function releasePointer(pointerId: number): void {
    ownership.delete(pointerId)
  }

  function releaseAllPointers(): void {
    ownership.clear()
  }

  function getOwner(pointerId: number): string | null {
    return ownership.get(pointerId) ?? null
  }

  function isPointerOwned(): boolean {
    return ownership.size > 0
  }

  function getCursor(opts: CursorOptions = {}): string {
    const { pointerOwned, draggingCursor, hoveredCapabilities = NO_CAPABILITIES, focusDimmed, toolId } = opts
    if (pointerOwned) return draggingCursor ?? 'grabbing'
    const effective = toolId ? (getTool(registry, toolId) ?? getEffectiveTool()) : getEffectiveTool()
    if (temporaryStack.length > 0) return effective.cursor
    if (focusDimmed) return 'default'
    if (effective.id === 'select' && hoveredCapabilities.moveable) return 'move'
    return effective.cursor
  }

  function handleToolShortcut(key: string): boolean {
    const matches = [...registry.values()].filter((tool) => tool.shortcut === key.toLowerCase())
    if (matches.length === 0) return false
    const index = matches.findIndex((tool) => tool.id === activeToolId)
    if (index === -1) {
      setActiveTool(matches[0].id)
    } else {
      setActiveTool(matches[(index + 1) % matches.length].id)
    }
    return true
  }

  function handleReachableShortcut(key: string): boolean {
    const matches = [...registry.values()].filter(
      (tool) => tool.shortcut === key.toLowerCase() && isToolReachable(tool)
    )
    if (matches.length === 0) return false
    const index = matches.findIndex((tool) => tool.id === activeToolId)
    if (index === -1) {
      setActiveTool(matches[0].id)
    } else {
      setActiveTool(matches[(index + 1) % matches.length].id)
    }
    return true
  }

  function handleEscape(): void {
    temporaryStack = []
    runtime().clearTemporaryToolStack()
    ownership.clear()
    interruptTools()
  }

  function interruptTools(): void {
    // Every tool abandons its module-level pending gesture so a mid-drag
    // Escape/blur/reset can't strand a session that a later pointer event
    // would otherwise commit against a fresh scene.
    for (const tool of registry.values()) {
      tool.onInterrupt?.()
    }
  }

  function reset(): void {
    activeToolId = DEFAULT_TOOL_ID
    temporaryStack = []
    modifiers = { ...NO_MODIFIERS }
    ownership.clear()
    runtime().setActiveTool(DEFAULT_TOOL_ID)
    runtime().clearTemporaryToolStack()
    interruptTools()
  }

  return {
    getActiveTool: () => getTool(registry, activeToolId)!,
    setActiveTool,
    getEffectiveTool,
    getEffectiveToolId,
    pushTemporaryTool,
    popTemporaryTool,
    releaseTemporaryUntil,
    releaseTemporaryTools,
    getModifiers: () => ({ ...modifiers }),
    setModifier,
    acquirePointer,
    releasePointer,
    releaseAllPointers,
    getOwner,
    isPointerOwned,
    getCursor,
    handleToolShortcut,
    handleReachableShortcut,
    handleEscape,
    interruptTools,
    reset,
    buildContext
  }
}

export const toolManager: ToolManager = createToolManager(toolRegistry)

registerFullResetHook(() => toolManager.reset())
