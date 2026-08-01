import { useMemo, useRef } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { toolManager, toolRegistry, Tool, NO_CAPABILITIES } from '../../tools'
import { getCapabilities } from '../../services/capabilities'
import { isInFocusScope } from '../../services/focus'
import { screenToScene } from '../../services/viewport'
import { hitTest, HitTestResult, SceneElementKind } from '../../services/hit-test'

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

  const effectiveToolId =
    temporaryToolStack.length > 0 ? temporaryToolStack[temporaryToolStack.length - 1].toolId : activeToolId

  const cursor = useMemo(() => {
    const caps = hoveredElement
      ? getCapabilities(hoveredElement.kind as SceneElementKind)
      : NO_CAPABILITIES
    const focusDimmed =
      !!hoveredElement && !!focusGroupId &&
      !isInFocusScope(hoveredElement.id, focusGroupId, safeScene(useStore.getState()))
    return toolManager.getCursor({
      toolId: effectiveToolId,
      pointerOwned: activeInteraction !== null,
      draggingCursor: activeInteraction ? DRAG_CURSORS[activeInteraction.kind] : undefined,
      hoveredCapabilities: caps,
      focusDimmed
    })
  }, [effectiveToolId, hoveredElement, activeInteraction, focusGroupId])

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

  const computeHit = (target: EventTarget | null, scenePoint: { x: number; y: number }): HitTestResult | null => {
    const hit = hitTest(safeScene(useStore.getState()), scenePoint)
    if (hit) return hit
    const el = (target as HTMLElement | null)?.closest?.('[data-element-id]') as HTMLElement | null
    if (!el) return null
    return {
      id: el.dataset.elementId ?? '',
      kind: (el.dataset.elementKind as SceneElementKind) ?? 'device',
      zIndex: 0,
      locked: el.dataset.elementLocked === 'true'
    }
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
    if (isPanGesture(e)) e.preventDefault()
    const scenePoint = scenePointFor(e)
    const rt = useRuntimeStore.getState()
    rt.setPointerScenePos(scenePoint)
    rt.setPointerInCanvas(true)
    rt.setHoveredElement(null)

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
    if (isCanvasChromeTarget(e.target)) return
    const tool = toolManager.getEffectiveTool()
    if (!tool.onContextMenu) return
    const scenePoint = scenePointFor(e)
    tool.onContextMenu(
      toolManager.buildContext({ scenePoint, hitResult: computeHit(e.target, scenePoint), toolId: tool.id }),
      e.nativeEvent
    )
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
    >
      {children}
    </div>
  )
}
