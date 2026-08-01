/**
 * marquee tool — drag on empty canvas selects elements inside the rectangle.
 * Owned by the Marquee tool (M key, V cycles within the select group); the
 * Select tool no longer creates marquees.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { createToolManager, toolRegistry } from '../renderer/tools'
import { resetStore, makeDevice } from './helpers'

type Ptr = {
  pointerId: number
  button: number
  clientX: number
  clientY: number
}

function evt(partial: Partial<Ptr>): PointerEvent {
  return {
    pointerId: 1,
    button: 0,
    clientX: 0,
    clientY: 0,
    ...partial
  } as unknown as PointerEvent
}

function point(x: number, y: number) {
  return { x, y }
}

function managerWithMarquee() {
  const manager = createToolManager(toolRegistry)
  manager.setActiveTool('marquee')
  return manager
}

describe('marquee tool', () => {
  beforeEach(() => {
    resetStore()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('drag selects elements inside the rectangle', () => {
    const dev1 = makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })
    const dev2 = makeDevice({ id: 'dev-2', x: 900, y: 100, width: 600, height: 400 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [dev1, dev2] }] })

    const manager = managerWithMarquee()
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(50, 50), toolId: 'marquee' }), evt({ clientX: 70, clientY: 70 }))
    expect(useRuntimeStore.getState().activeInteraction?.kind).toBe('marquee')

    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(750, 450), toolId: 'marquee' }), evt({ clientX: 770, clientY: 470 }))
    const during = useRuntimeStore.getState().marqueeRect
    expect(during).toEqual({ x: 50, y: 50, width: 700, height: 400 })

    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(750, 450), toolId: 'marquee' }), evt({ clientX: 770, clientY: 470 }))

    const selected = useStore.getState().selectedIds
    expect(selected).toContain('dev-1')
    expect(selected).not.toContain('dev-2')
    expect(useRuntimeStore.getState().marqueeRect).toBeNull()
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('normalizes negative drag direction', () => {
    const dev = makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [dev] }] })

    const manager = managerWithMarquee()
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(750, 450), toolId: 'marquee' }), evt({ clientX: 770, clientY: 470 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(50, 50), toolId: 'marquee' }), evt({ clientX: 70, clientY: 70 }))
    const during = useRuntimeStore.getState().marqueeRect
    expect(during).toEqual({ x: 50, y: 50, width: 700, height: 400 })

    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(50, 50), toolId: 'marquee' }), evt({ clientX: 70, clientY: 70 }))

    expect(useStore.getState().selectedIds).toContain('dev-1')
  })

  it('sub-3px drag clears the selection (click semantics)', () => {
    const device = makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [device] }] })
    useStore.setState({ selectedIds: ['dev-1'], selectionMode: 'single' })

    const manager = managerWithMarquee()
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(50, 50), toolId: 'marquee' }), evt({ clientX: 70, clientY: 70 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(52, 52), toolId: 'marquee' }), evt({ clientX: 72, clientY: 72 }))

    expect(useStore.getState().selectedIds).toEqual([])
  })

  it('pointer cancel clears marquee state and interaction', () => {
    const manager = managerWithMarquee()
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(50, 50), toolId: 'marquee' }), evt({ clientX: 70, clientY: 70 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(200, 200), toolId: 'marquee' }), evt({ clientX: 220, clientY: 220 }))
    expect(useRuntimeStore.getState().marqueeRect).not.toBeNull()

    tool.onPointerCancel?.(manager.buildContext({ scenePoint: point(200, 200), toolId: 'marquee' }), evt({ clientX: 220, clientY: 220 }))

    expect(useRuntimeStore.getState().marqueeRect).toBeNull()
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('is reachable (has pointer handling) and claimable', () => {
    const manager = managerWithMarquee()
    expect(manager.getActiveTool().id).toBe('marquee')
    expect(manager.getActiveTool().onPointerDown).toBeTypeOf('function')

    const tool = manager.getActiveTool()
    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(10, 10), toolId: 'marquee' }), evt({ clientX: 10, clientY: 10 }))
    expect(manager.getOwner(1)).toBe('marquee')
  })

  it('marquee respects the active focus scope when selecting', () => {
    const devIn = makeDevice({ id: 'dev-in', x: 100, y: 100, width: 600, height: 400, groupId: 'g-1' })
    const devOut = makeDevice({ id: 'dev-out', x: 800, y: 100, width: 600, height: 400 })
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        devices: [devIn, devOut],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-in'], parentGroupId: null }]
      }]
    })
    useRuntimeStore.getState().enterFocus('g-1')

    const manager = managerWithMarquee()
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(50, 50), toolId: 'marquee' }), evt({ clientX: 70, clientY: 70 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(1450, 450), toolId: 'marquee' }), evt({ clientX: 1470, clientY: 470 }))

    expect(useStore.getState().selectedIds).toEqual(['dev-in'])
  })
})
