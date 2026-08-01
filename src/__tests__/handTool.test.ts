/**
 * hand tool — middle-button or Alt+drag pans the viewport.
 * Driven through the tool manager against the real document + runtime stores.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { createToolManager, toolRegistry } from '../renderer/tools'
import { resetStore } from './helpers'

type Ptr = { pointerId: number; button: number; clientX: number; clientY: number; altKey: boolean }

function evt(partial: Partial<Ptr>): PointerEvent {
  return { pointerId: 1, button: 0, clientX: 0, clientY: 0, altKey: false, ...partial } as unknown as PointerEvent
}

function point(x: number, y: number) {
  return { x, y }
}

describe('hand tool', () => {
  beforeEach(() => {
    resetStore()
  })

  it('middle-button drag pans the viewport', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('hand')
    const tool = manager.getActiveTool()
    expect(tool.id).toBe('hand')

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 1, clientX: 100, clientY: 100 }))

    expect(useStore.getState().isPanning).toBe(true)
    expect(useRuntimeStore.getState().activeInteraction?.kind).toBe('pan')

    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 1, clientX: 150, clientY: 140 }))
    expect(useStore.getState().panX).toBe(50)
    expect(useStore.getState().panY).toBe(40)

    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 1, clientX: 150, clientY: 140 }))
    expect(useStore.getState().isPanning).toBe(false)
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('pan is additive from the pan origin at drag start', () => {
    useStore.setState({ panX: 100, panY: 200 })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('hand')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 1, clientX: 400, clientY: 300 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 1, clientX: 350, clientY: 350 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 1, clientX: 350, clientY: 350 }))

    expect(useStore.getState().panX).toBe(50)
    expect(useStore.getState().panY).toBe(250)
  })

  it('alt+drag with left button also pans', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('hand')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 0, altKey: true, clientX: 10, clientY: 10 }))
    expect(useStore.getState().isPanning).toBe(true)

    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 0, altKey: true, clientX: 30, clientY: 25 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 0, altKey: true, clientX: 30, clientY: 25 }))

    expect(useStore.getState().panX).toBe(20)
    expect(useStore.getState().panY).toBe(15)
  })

  it('left-button drag pans when the hand tool is the active tool', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('hand')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 0, altKey: false, clientX: 10, clientY: 10 }))
    expect(useStore.getState().isPanning).toBe(true)
    expect(useRuntimeStore.getState().activeInteraction?.kind).toBe('pan')

    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 0, clientX: 30, clientY: 25 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 0, clientX: 30, clientY: 25 }))

    expect(useStore.getState().panX).toBe(20)
    expect(useStore.getState().panY).toBe(15)
    expect(useStore.getState().isPanning).toBe(false)
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('left-drag pans while hand is a temporary tool (Space held)', () => {
    const manager = createToolManager(toolRegistry)
    manager.pushTemporaryTool('hand', 'keyup')
    const tool = manager.getEffectiveTool()
    expect(tool.id).toBe('hand')

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 0, altKey: false, clientX: 10, clientY: 10 }))
    expect(useStore.getState().isPanning).toBe(true)

    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 0, clientX: 30, clientY: 25 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 0, clientX: 30, clientY: 25 }))

    expect(useStore.getState().panX).toBe(20)
    expect(useStore.getState().panY).toBe(15)

    manager.releaseTemporaryUntil('keyup')
    expect(manager.getEffectiveToolId()).toBe('select')
  })

  it('pointer cancel ends the pan', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('hand')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 1, clientX: 10, clientY: 10 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 1, clientX: 40, clientY: 20 }))
    tool.onPointerCancel?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ button: 1, clientX: 40, clientY: 20 }))

    expect(useStore.getState().isPanning).toBe(false)
    expect(useStore.getState().panX).toBe(30)
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('second pointer cannot be claimed by hand while first is active', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('hand')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ pointerId: 1, button: 1, clientX: 10, clientY: 10 }))
    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(0, 0), toolId: 'hand' }), evt({ pointerId: 2, button: 1, clientX: 20, clientY: 20 }))

    const vp = useStore.getState()
    expect(vp.isPanning).toBe(true)
  })
})
