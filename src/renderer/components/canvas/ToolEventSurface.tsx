import { useMemo, useRef } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { toolManager, toolRegistry, Tool, NO_CAPABILITIES } from '../../tools'
import { getCapabilities } from '../../services/capabilities'
import { isInFocusScope } from '../../services/focus'
import { screenToScene } from '../../services/viewport'
import { hitTest, HitTestResult, SceneElementKind } from '../../services/hit-test'
import { placeComponentAt } from '../../lib/component-utils'

interface ToolEventSurfaceProps {
  onWheel: (e: React.WheelEvent) => void
  children: React.ReactNode
}

const DRAG_CURSORS: Record<string, string> = {
  move: 'move',
  resize: 'nwse-resize',
  pan: 'grabbing',
  marquee: 'crosshair',
  paint: 'crosshair',
  blur: 'crosshair',
  eraser: 'crosshair',
  'magic-eraser': 'crosshair',
  mask: 'crosshair'
}

export default function ToolEventSurface({ onWheel, children }: ToolEventSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const zoom = useStore((s) => s.zoom)
  const panX = useStore((s) => s.panX)
  const panY = useStore((s) => s.panY)
  const activeToolId = useRuntimeStore((s) => s.activeToolId)
  const temporaryToolStack = useRuntimeStore((s) => s.temporaryToolStack)
  const hoveredElement = useRuntimeStore((s) => s.hoveredElement)
  const activeInteraction = useRuntimeStore((s) => s.activeInteraction)
  const focusGroupId = useRuntimeStore((s) => s.focusGroupId)
  const focusElementId = useRuntimeStore((s) => s.focusElementId)

  const effectiveToolId =
    temporaryToolStack.length > 0 ? temporaryToolStack[temporaryToolStack.length - 1].toolId : activeToolId

  const cursor = useMemo(() => {
    const caps = hoveredElement
      ? getCapabilities(hoveredElement.kind as SceneElementKind)
      : NO_CAPABILITIES
    const focusDimmed =
      !!hoveredElement && (!!focusGroupId || !!focusElementId) &&
      !isInFocusScope(hoveredElement.id, focusGroupId, safeScene(useStore.getState()), focusElementId)
    return toolManager.getCursor({
      toolId: effectiveToolId,
      pointerOwned: activeInteraction !== null,
      draggingCursor: activeInteraction ? DRAG_CURSORS[activeInteraction.kind] : undefined,
      hoveredCapabilities: caps,
      focusDimmed
    })
  }, [effectiveToolId, hoveredElement, activeInteraction, focusGroupId, focusElementId])

  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const panRef = useRef({ x: panX, y: panY })
  panRef.current = { x: panX, y: panY }

  const scenePointFor = (e: { clientX: number; clientY: number }) => {
    const container = containerRef.current
    return screenToScene(
      e.clientX,
      e.clientY,
      container ? container.getBoundingClientRect() : null,
      panRef.current,
      zoomRef.current
    )
  }

  const isCanvasChromeTarget = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null
    if (!el?.closest) return false
    return !!el.closest('[data-canvas-chrome], [data-guide]')
  }

  const resolveChromeHit = (target: EventTarget | null): HitTestResult | null => {
    const chrome = (target as HTMLElement | null)?.closest?.('[data-chrome-element-id]') as HTMLElement | null
    const id = chrome?.getAttribute('data-chrome-element-id')
    if (!id) return null
    const scene = safeScene(useStore.getState())
    const d = scene.devices.find((x) => x.id === id)
    if (d) return { id, kind: 'device', zIndex: d.zIndex, locked: d.locked }
    const t = scene.textBoxes.find((x) => x.id === id)
    if (t) return { id, kind: 'textBox', zIndex: t.zIndex, locked: t.locked }
    const i = scene.images.find((x) => x.id === id)
    if (i) return { id, kind: 'image', zIndex: i.zIndex, locked: i.locked }
    const s = scene.shapes.find((x) => x.id === id)
    if (s) return { id, kind: 'shape', zIndex: s.zIndex, locked: s.locked }
    return null
  }

  const computeHit = (target: EventTarget | null, scenePoint: { x: number; y: number }): HitTestResult | null => {
    const hit = hitTest(safeScene(useStore.getState()), scenePoint)
    if (hit) return hit
    const el = (target as HTMLElement | null)?.closest?.('[data-element-id]') as HTMLElement | null
    if (el) {
      return {
        id: el.dataset.elementId ?? '',
        kind: (el.dataset.elementKind as SceneElementKind) ?? 'device',
        zIndex: 0,
        locked: el.dataset.elementLocked === 'true'
      }
    }
    // Resize handles render inside the selection-chrome wrapper
    // (`data-chrome-element-id`), which sits outside the element's own box.
    // Resolve the hit from the scene so a handle grab always targets the
    // selected element regardless of where the handle is clicked.
    return resolveChromeHit(target)
  }

  const resolveHandle = (target: EventTarget | null): 'nw' | 'ne' | 'sw' | 'se' | null => {
    const handle = (target as HTMLElement | null)?.closest?.('[data-resize-handle]') as HTMLElement | null
    const value = handle?.getAttribute('data-resize-handle') as 'nw' | 'ne' | 'sw' | 'se' | null
    return value ?? null
  }

  const isPanGesture = (e: React.PointerEvent) =>
    e.button === 1 || (e.button === 0 && (e.altKey || toolManager.getModifiers().alt))

  const resolveTool = (e: React.PointerEvent): Tool | undefined => {
    const owner = toolManager.getOwner(e.pointerId)
    if (owner) return toolRegistry.get(owner)
    if (isPanGesture(e)) return toolRegistry.get('hand')
    return toolManager.getEffectiveTool()
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isCanvasChromeTarget(e.target)) return
    const panGesture = isPanGesture(e)
    if (panGesture) e.preventDefault()
    const scenePoint = scenePointFor(e)
    const rt = useRuntimeStore.getState()
    rt.setPointerScenePos(scenePoint)
    rt.setPointerInCanvas(true)
    rt.setHoveredElement(null)

    // Resize handles are tool-independent selection chrome: grabbing a corner
    // handle resizes the selected element for ANY active tool. Route the grab
    // to the Select tool's resize path before dispatching to the active tool
    // (which would otherwise draw/paint/mask over the element). The chrome hit
    // resolution in `computeHit` makes the handle click target the element.
    const handle = resolveHandle(e.target)
    if (handle && !panGesture) {
      const select = toolRegistry.get('select')
      if (select?.onPointerDown) {
        select.onPointerDown(
          toolManager.buildContext({
            scenePoint,
            hitResult: computeHit(e.target, scenePoint),
            resizeHandle: handle,
            toolId: 'select'
          }),
          e.nativeEvent
        )
        if (toolManager.getOwner(e.pointerId) === 'select') {
          e.currentTarget.setPointerCapture?.(e.pointerId)
        }
      }
      return
    }

    const tool = resolveTool(e)
    if (!tool?.onPointerDown) return
    const hitResult = computeHit(e.target, scenePoint)
    tool.onPointerDown(
      toolManager.buildContext({ scenePoint, hitResult, resizeHandle: resolveHandle(e.target), toolId: tool.id }),
      e.nativeEvent
    )
    if (toolManager.getOwner(e.pointerId) === tool.id) {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const scenePoint = scenePointFor(e)
    const rt = useRuntimeStore.getState()
    rt.setPointerScenePos(scenePoint)
    rt.setPointerInCanvas(true)

    const owner = toolManager.getOwner(e.pointerId)
    if (owner) {
      const tool = toolRegistry.get(owner)
      tool?.onPointerMove?.(toolManager.buildContext({ scenePoint, toolId: owner }), e.nativeEvent)
      return
    }

    const tool = toolManager.getEffectiveTool()
    tool?.onHover?.(toolManager.buildContext({ scenePoint, toolId: tool.id }), e.nativeEvent)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const scenePoint = scenePointFor(e)
    const owner = toolManager.getOwner(e.pointerId)
    if (owner) {
      const tool = toolRegistry.get(owner)
      tool?.onPointerUp?.(toolManager.buildContext({ scenePoint, toolId: owner }), e.nativeEvent)
      toolManager.releasePointer(e.pointerId)
      if (containerRef.current?.hasPointerCapture?.(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId)
      }
    }
    useRuntimeStore.getState().setPointerInCanvas(false)
  }

  const handlePointerCancel = (e: React.PointerEvent) => {
    const owner = toolManager.getOwner(e.pointerId)
    if (owner) {
      const tool = toolRegistry.get(owner)
      tool?.onPointerCancel?.(toolManager.buildContext({ toolId: owner }), e.nativeEvent)
      toolManager.releasePointer(e.pointerId)
    }
    useRuntimeStore.getState().setPointerInCanvas(false)
  }

  const handlePointerLeave = () => {
    const rt = useRuntimeStore.getState()
    rt.setPointerInCanvas(false)
    rt.setHoveredElement(null)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isCanvasChromeTarget(e.target)) return
    const tool = toolManager.getEffectiveTool()
    if (!tool.onDoubleClick) return
    const scenePoint = scenePointFor(e)
    tool.onDoubleClick(
      toolManager.buildContext({ scenePoint, hitResult: computeHit(e.target, scenePoint), toolId: tool.id }),
      e.nativeEvent
    )
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isCanvasChromeTarget(e.target)) return
    const tool = toolManager.getEffectiveTool()
    if (!tool.onContextMenu) return
    const scenePoint = scenePointFor(e)
    tool.onContextMenu(
      toolManager.buildContext({ scenePoint, hitResult: computeHit(e.target, scenePoint), toolId: tool.id }),
      e.nativeEvent
    )
  }

  // --- Drag-and-drop from component panel ---

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-mockup-unit-id')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    const componentId = e.dataTransfer.getData('application/x-mockup-unit-id')
    if (!componentId) return
    e.preventDefault()

    const scene = useStore.getState().scenes[useStore.getState().activeSceneIndex]
    if (!scene) return

    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    const sp = screenToScene(
      e.clientX,
      e.clientY,
      containerRect,
      panRef.current,
      zoomRef.current
    )

    const definitions = useStore.getState().definitions
    const def = definitions.find((d) => d.id === componentId)
    if (!def) return

    placeComponentAt(def, sp.x, sp.y)
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative"
      style={{ cursor, touchAction: 'none' }}
      onWheel={onWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
    </div>
  )
}
