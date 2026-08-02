/**
 * select tool — empty-canvas click clears selection, drag creates a marquee;
 * element interactions (select, move, resize, rename, upload, context menu)
 * are owned by the tool. Driven through the tool manager against the real
 * document + runtime stores.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { createToolManager, toolRegistry } from '../renderer/tools'
import { selectTool } from '../renderer/tools/tools/select'
import { resetStore, makeDevice, makeTextBox, makeImage, makeShape } from './helpers'

type Ptr = {
  pointerId: number
  button: number
  clientX: number
  clientY: number
  altKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

function evt(partial: Partial<Ptr>): PointerEvent {
  return {
    pointerId: 1,
    button: 0,
    clientX: 0,
    clientY: 0,
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
    ...partial
  } as unknown as PointerEvent
}

function mouse(partial: Partial<{ clientX: number; clientY: number; preventDefault: () => void }>): MouseEvent {
  return { clientX: 0, clientY: 0, preventDefault: () => {}, ...partial } as unknown as MouseEvent
}

function point(x: number, y: number) {
  return { x, y }
}

function mountElement(id: string, kind: string, locked = false) {
  const el = document.createElement('div')
  el.setAttribute('data-element-id', id)
  el.setAttribute('data-element-kind', kind)
  el.setAttribute('data-element-locked', locked ? 'true' : 'false')
  document.body.appendChild(el)
  return el
}

function withDevice(x = 100, y = 100, w = 600, h = 400) {
  const device = makeDevice({ x, y, width: w, height: h })
  useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [device] }] })
  return device
}

describe('select tool', () => {
  beforeEach(() => {
    resetStore()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('clicking empty canvas clears the current selection', () => {
    const device = makeDevice({ x: 100, y: 100, width: 600, height: 400 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [device] }] })
    useStore.setState({ selectedIds: [device.id], selectionMode: 'single' })

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()
    expect(tool.id).toBe('select')

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(50, 50), toolId: 'select' }), evt({ clientX: 70, clientY: 70 }))

    expect(useStore.getState().selectedIds).toEqual([])
    expect(manager.getOwner(1)).toBeNull()
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('pointer down on an element selects it and starts a move interaction (no marquee)', () => {
    const device = withDevice()
    mountElement(device.id, 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false }, toolId: 'select' }),
      evt({ clientX: 170, clientY: 170 })
    )

    expect(manager.getOwner(1)).toBe('select')
    expect(useStore.getState().selectedIds).toEqual([device.id])
    expect(useRuntimeStore.getState().activeInteraction?.kind).toBe('move')
    expect(useRuntimeStore.getState().marqueeRect).toBeNull()
  })

  it('dragging an element moves it live and commits on pointer up', () => {
    const device = withDevice()
    const el = mountElement(device.id, 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false }, toolId: 'select' }),
      evt({ clientX: 170, clientY: 170 })
    )

    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(250, 250), toolId: 'select' }),
      evt({ clientX: 270, clientY: 270 })
    )

    expect(el.style.left).toBe('200px')
    expect(el.style.top).toBe('200px')

    const historyBefore = useStore.getState().undoStack.length
    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(250, 250), toolId: 'select' }),
      evt({ clientX: 270, clientY: 270 })
    )

    const dev = useStore.getState().scenes[0].devices[0]
    expect(dev.x).toBe(200)
    expect(dev.y).toBe(200)
    expect(useStore.getState().undoStack.length).toBe(historyBefore + 1)
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
    expect(useRuntimeStore.getState().snapGuides).toEqual({ verticalGuides: [], horizontalGuides: [] })
  })

  it('emits a dashed ghost preview on the moving bounds and clears it on commit', () => {
    const device = withDevice()
    mountElement(device.id, 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false }, toolId: 'select' }),
      evt({ clientX: 170, clientY: 170 })
    )

    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(250, 250), toolId: 'select' }),
      evt({ clientX: 270, clientY: 270 })
    )

    const duringDrag = useRuntimeStore.getState().preview
    expect(duringDrag).not.toBeNull()
    expect(duringDrag!.visuals).toHaveLength(1)
    expect(duringDrag!.visuals[0]).toMatchObject({ kind: 'rect', x: 200, y: 200, width: 600, height: 400 })
    expect(duringDrag!.style).toMatchObject({ lineDash: [6, 4], glow: true })

    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(250, 250), toolId: 'select' }),
      evt({ clientX: 270, clientY: 270 })
    )

    expect(useRuntimeStore.getState().preview).toBeNull()
  })

  it('a cancelled drag clears the ghost preview', () => {
    const device = withDevice()
    mountElement(device.id, 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false }, toolId: 'select' }),
      evt({ clientX: 170, clientY: 170 })
    )
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(250, 250), toolId: 'select' }),
      evt({ clientX: 270, clientY: 270 })
    )
    expect(useRuntimeStore.getState().preview).not.toBeNull()

    tool.onPointerCancel?.(
      manager.buildContext({ scenePoint: point(250, 250), toolId: 'select' }),
      evt({ clientX: 270, clientY: 270 })
    )

    expect(useRuntimeStore.getState().preview).toBeNull()
  })

  it('escape mid-drag cancels the drag and a later pointer up does not commit', () => {
    const device = withDevice()
    const el = mountElement(device.id, 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false }, toolId: 'select' }),
      evt({ clientX: 170, clientY: 170 })
    )
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(250, 250), toolId: 'select' }),
      evt({ clientX: 270, clientY: 270 })
    )
    expect(el.style.left).toBe('200px')

    manager.handleEscape()

    // Session cancelled, runtime interaction cleared, DOM restored, store untouched.
    expect(el.style.left).toBe('100px')
    expect(el.style.top).toBe('100px')
    expect(useStore.getState().scenes[0].devices[0].x).toBe(100)
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
    expect(useRuntimeStore.getState().snapGuides).toEqual({ verticalGuides: [], horizontalGuides: [] })

    // A late pointer-up for the abandoned pointer must not commit the move.
    const historyBefore = useStore.getState().undoStack.length
    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(250, 250), toolId: 'select' }),
      evt({ clientX: 270, clientY: 270 })
    )
    expect(useStore.getState().scenes[0].devices[0].x).toBe(100)
    expect(useStore.getState().undoStack.length).toBe(historyBefore)
  })

  it('escape mid-resize cancels the resize and a later pointer up does not commit', () => {
    const device = withDevice()
    mountElement(device.id, 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({
        scenePoint: point(650, 450),
        hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false },
        resizeHandle: 'se',
        toolId: 'select'
      }),
      evt({ clientX: 670, clientY: 470 })
    )
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(700, 500), toolId: 'select' }),
      evt({ clientX: 720, clientY: 520 })
    )
    expect(useStore.getState().scenes[0].devices[0].width).toBe(600)

    manager.handleEscape()

    expect(useStore.getState().scenes[0].devices[0].width).toBe(600)
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()

    const historyBefore = useStore.getState().undoStack.length
    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(700, 500), toolId: 'select' }),
      evt({ clientX: 720, clientY: 520 })
    )
    expect(useStore.getState().scenes[0].devices[0].width).toBe(600)
    expect(useStore.getState().undoStack.length).toBe(historyBefore)
  })

  it('selecting an already-selected element keeps the multi-selection and drags all', () => {
    const dev1 = makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })
    const dev2 = makeDevice({ id: 'dev-2', x: 900, y: 100, width: 600, height: 400 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [dev1, dev2] }] })
    useStore.setState({ selectedIds: ['dev-1', 'dev-2'], selectionMode: 'multi' })
    mountElement('dev-1', 'device')
    mountElement('dev-2', 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: 'dev-1', kind: 'device', zIndex: 0, locked: false }, toolId: 'select' }),
      evt({ clientX: 170, clientY: 170 })
    )

    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(250, 250), toolId: 'select' }),
      evt({ clientX: 270, clientY: 270 })
    )

    const scene = useStore.getState().scenes[0]
    expect(scene.devices.find((d) => d.id === 'dev-1')?.x).toBe(200)
    expect(scene.devices.find((d) => d.id === 'dev-2')?.x).toBe(1000)
  })

  it('locked elements can be selected but not dragged', () => {
    const device = makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400, locked: true })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [device] }] })

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: true }, toolId: 'select' }),
      evt({ clientX: 170, clientY: 170 })
    )

    expect(useStore.getState().selectedIds).toEqual([device.id])
    expect(manager.getOwner(1)).toBeNull()
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('ctrl+click adds an element to the existing selection (multi-select)', () => {
    const dev1 = makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })
    const dev2 = makeDevice({ id: 'dev-2', x: 900, y: 100, width: 600, height: 400 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [dev1, dev2] }] })
    useStore.setState({ selectedIds: ['dev-1'], selectionMode: 'single' })

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(950, 150), hitResult: { id: 'dev-2', kind: 'device', zIndex: 0, locked: false }, toolId: 'select' }),
      evt({ clientX: 970, clientY: 170, ctrlKey: true })
    )

    const selected = useStore.getState().selectedIds
    expect(selected).toContain('dev-1')
    expect(selected).toContain('dev-2')
    expect(useStore.getState().selectionMode).toBe('multi')
  })

  it('clicking a grouped member selects the whole group', () => {
    const shape1 = makeShape({ id: 's-1', groupId: 'g-1' })
    const shape2 = makeShape({ id: 's-2', groupId: 'g-1' })
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        shapes: [shape1, shape2],
        groups: [{ id: 'g-1', name: 'G', childIds: ['s-1', 's-2'] }]
      }]
    })

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(210, 210), hitResult: { id: 's-1', kind: 'shape', zIndex: 0, locked: false }, toolId: 'select' }),
      evt({ clientX: 210, clientY: 210 })
    )

    expect(useStore.getState().selectedIds).toEqual(['s-1', 's-2'])
  })

  it('clicking a dimmed element while focused clears the selection and never drags', () => {
    const inside = makeDevice({ id: 'dev-in', x: 100, y: 100, width: 600, height: 400, groupId: 'g-1' })
    const outside = makeDevice({ id: 'dev-out', x: 900, y: 100, width: 600, height: 400, groupId: null })
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        devices: [inside, outside],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-in'] }]
      }]
    })
    useStore.setState({ selectedIds: ['dev-in'], selectionMode: 'single' })
    useRuntimeStore.getState().enterFocus('g-1')
    mountElement('dev-out', 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(950, 150), hitResult: { id: 'dev-out', kind: 'device', zIndex: 0, locked: false }, toolId: 'select' }),
      evt({ clientX: 970, clientY: 170 })
    )

    expect(useStore.getState().selectedIds).toEqual([])
    expect(manager.getOwner(1)).toBeNull()
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('clicking an in-focus element while focused still selects and drags', () => {
    const inside = makeDevice({ id: 'dev-in', x: 100, y: 100, width: 600, height: 400, groupId: 'g-1' })
    const outside = makeDevice({ id: 'dev-out', x: 900, y: 100, width: 600, height: 400, groupId: null })
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        devices: [inside, outside],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-in'] }]
      }]
    })
    useRuntimeStore.getState().enterFocus('g-1')
    mountElement('dev-in', 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: 'dev-in', kind: 'device', zIndex: 0, locked: false }, toolId: 'select' }),
      evt({ clientX: 170, clientY: 170 })
    )

    expect(useStore.getState().selectedIds).toEqual(['dev-in'])
    expect(useRuntimeStore.getState().activeInteraction?.kind).toBe('move')

    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(250, 250), toolId: 'select' }),
      evt({ clientX: 270, clientY: 270 })
    )
  })

  it('double-clicking a locked device does not trigger screenshot upload', () => {
    const device = makeDevice({ id: 'dev-locked', x: 100, y: 100, width: 600, height: 400, locked: true })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [device] }] })

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    const ctx = manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: true } })
    const spy = vi.spyOn(ctx.actions, 'uploadScreenImage')
    tool.onDoubleClick?.(ctx, mouse({}))

    expect(spy).not.toHaveBeenCalled()
    expect(useRuntimeStore.getState().editing).toBeNull()
  })

  it('double-clicking a locked text box does not start text editing', () => {
    const tb = makeTextBox({ id: 'tb-locked', locked: true })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [tb] }] })

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onDoubleClick?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: 'tb-locked', kind: 'textBox', zIndex: 0, locked: true } }),
      mouse({})
    )

    expect(useRuntimeStore.getState().editing).toBeNull()
  })

  it('double-clicking a grouped shape selects only that shape (break out of group)', () => {
    const shape1 = makeShape({ id: 's-1', groupId: 'g-1' })
    const shape2 = makeShape({ id: 's-2', groupId: 'g-1' })
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        shapes: [shape1, shape2],
        groups: [{ id: 'g-1', name: 'G', childIds: ['s-1', 's-2'] }]
      }]
    })
    useStore.setState({ selectedIds: ['s-1', 's-2'], selectionMode: 'multi' })

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onDoubleClick?.(
      manager.buildContext({ scenePoint: point(210, 210), hitResult: { id: 's-1', kind: 'shape', zIndex: 0, locked: false } }),
      mouse({})
    )

    expect(useStore.getState().selectedIds).toEqual(['s-1'])
  })

  it('resize handles start a resize interaction that updates width/height', () => {
    const device = withDevice()
    const el = mountElement(device.id, 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({
        scenePoint: point(700, 500),
        hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false },
        resizeHandle: 'se',
        toolId: 'select'
      }),
      evt({ clientX: 720, clientY: 520 })
    )

    expect(useRuntimeStore.getState().activeInteraction?.kind).toBe('resize')

    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(800, 600), toolId: 'select' }),
      evt({ clientX: 820, clientY: 620 })
    )
    expect(el.style.width).toBe('700px')
    expect(el.style.height).toBe('500px')

    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(800, 600), toolId: 'select' }),
      evt({ clientX: 820, clientY: 620 })
    )

    const dev = useStore.getState().scenes[0].devices[0]
    expect(dev.width).toBe(700)
    expect(dev.height).toBe(500)
  })

  it('a locked-aspect element resizes proportionally without shift', () => {
    const device = makeDevice({ x: 100, y: 100, width: 600, height: 400, lockAspectRatio: true })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [device] }] })
    mountElement(device.id, 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({
        scenePoint: point(700, 500),
        hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false },
        resizeHandle: 'se',
        toolId: 'select'
      }),
      evt({ clientX: 720, clientY: 520 })
    )
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(800, 600), toolId: 'select' }),
      evt({ clientX: 820, clientY: 620 })
    )
    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(800, 600), toolId: 'select' }),
      evt({ clientX: 820, clientY: 620 })
    )

    const dev = useStore.getState().scenes[0].devices[0]
    expect(dev.width).toBe(700)
    expect(dev.height).toBe(467)
  })

  it('an unlocked element resizes free-form without shift', () => {
    const device = withDevice()
    mountElement(device.id, 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({
        scenePoint: point(700, 500),
        hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false },
        resizeHandle: 'se',
        toolId: 'select'
      }),
      evt({ clientX: 720, clientY: 520 })
    )
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(800, 600), toolId: 'select' }),
      evt({ clientX: 820, clientY: 620 })
    )
    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(800, 600), toolId: 'select' }),
      evt({ clientX: 820, clientY: 620 })
    )

    const dev = useStore.getState().scenes[0].devices[0]
    expect(dev.width).toBe(700)
    expect(dev.height).toBe(500)
  })

  it('pointer cancel on a drag restores the original position', () => {
    const device = withDevice()
    mountElement(device.id, 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false }, toolId: 'select' }),
      evt({ clientX: 170, clientY: 170 })
    )
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(250, 250), toolId: 'select' }),
      evt({ clientX: 270, clientY: 270 })
    )
    tool.onPointerCancel?.(
      manager.buildContext({ scenePoint: point(250, 250), toolId: 'select' }),
      evt({ clientX: 270, clientY: 270 })
    )

    expect(useStore.getState().scenes[0].devices[0].x).toBe(100)
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('does not claim a pointer already owned by another tool', () => {
    const manager = createToolManager(toolRegistry)
    expect(manager.acquirePointer(7, 'hand')).toBe(true)
    expect(manager.acquirePointer(7, 'select')).toBe(false)
  })

  it('marquee uses the marquee variant when it is active', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('marquee')
    expect(manager.getActiveTool().id).toBe('marquee')

    const ctx = manager.buildContext({ scenePoint: point(10, 10), toolId: 'marquee' })
    expect(ctx.effectiveToolId).toBe('marquee')
  })

  it('select tool exposes its variants for group cycling', () => {
    expect(selectTool.variants).toEqual(['select', 'marquee', 'focus', 'hand'])
    expect(selectTool.shortcut).toBe('v')
  })

  it('double-clicking a text box starts inline text editing', () => {
    const tb = makeTextBox({ id: 'tb-1' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [tb] }] })

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    const ctx = manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: 'tb-1', kind: 'textBox', zIndex: 0, locked: false } })
    tool.onDoubleClick?.(ctx, mouse({}))

    expect(useRuntimeStore.getState().editing).toEqual({ id: 'tb-1', mode: 'text' })
  })

  it('triple-clicking a text box starts rename instead of text editing', () => {
    const tb = makeTextBox({ id: 'tb-2' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [tb] }] })

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    const ctx = manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: 'tb-2', kind: 'textBox', zIndex: 0, locked: false } })
    tool.onDoubleClick?.(ctx, mouse({}))
    expect(useRuntimeStore.getState().editing).toEqual({ id: 'tb-2', mode: 'text' })

    tool.onDoubleClick?.(ctx, mouse({}))
    expect(useRuntimeStore.getState().editing).toEqual({ id: 'tb-2', mode: 'rename' })
  })

  it('double-clicking a device triggers the screenshot upload action', () => {
    const device = withDevice()

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    const ctx = manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false } })
    const spy = vi.spyOn(ctx.actions, 'uploadScreenImage')
    tool.onDoubleClick?.(ctx, mouse({}))

    expect(spy).toHaveBeenCalledWith(device.id)
  })

  it('double-clicking an image does nothing (not editable)', () => {
    const img = makeImage({ id: 'img-1' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], images: [img] }] })

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    const ctx = manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: 'img-1', kind: 'image', zIndex: 0, locked: false } })
    tool.onDoubleClick?.(ctx, mouse({}))

    expect(useRuntimeStore.getState().editing).toBeNull()
  })

  it('hover tracking writes the hovered element to the runtime store', () => {
    const device = withDevice()
    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onHover?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false } }),
      evt({})
    )

    expect(useRuntimeStore.getState().hoveredElement).toEqual({ id: device.id, kind: 'device' })
  })

  it('hover clears when the pointer is not over an element', () => {
    const device = withDevice()
    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onHover?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false } }),
      evt({})
    )
    expect(useRuntimeStore.getState().hoveredElement).toEqual({ id: device.id, kind: 'device' })

    tool.onHover?.(manager.buildContext({ scenePoint: point(50, 50) }), evt({}))
    expect(useRuntimeStore.getState().hoveredElement).toBeNull()
  })

  it('context menu on an element opens the runtime context menu', () => {
    const device = withDevice()

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    const ctx = manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: device.id, kind: 'device', zIndex: 0, locked: false } })
    tool.onContextMenu?.(ctx, mouse({ clientX: 150, clientY: 150 }))

    const menu = useRuntimeStore.getState().contextMenu
    expect(menu).not.toBeNull()
    expect(menu!.x).toBe(150)
    expect(menu!.items.map((i) => i.label)).toEqual([
      'Bring to Front',
      'Send to Back',
      'Bring Forward',
      'Send Backward',
      '',
      'Duplicate',
      'Delete'
    ])
  })

  it('context menu on a container offers Enter Focus', () => {
    const container = makeDevice({ id: 'cont-1', x: 100, y: 100, width: 600, height: 400 })
    const child = makeTextBox({ id: 'tb-child', containerId: 'cont-1' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [container], textBoxes: [child] }] })

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    const ctx = manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: container.id, kind: 'device', zIndex: 0, locked: false } })
    tool.onContextMenu?.(ctx, mouse({ clientX: 150, clientY: 150 }))

    const menu = useRuntimeStore.getState().contextMenu
    expect(menu).not.toBeNull()
    expect(menu!.items[0].label).toBe('Enter Focus')

    menu!.items[0].action()
    expect(useRuntimeStore.getState().focusElementId).toBe('cont-1')
    expect(useRuntimeStore.getState().focusGroupId).toBeNull()
  })

  it('context menu on a non-container does not offer Enter Focus', () => {
    const lonely = makeDevice({ id: 'lonely-1', x: 100, y: 100, width: 600, height: 400 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [lonely] }] })

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onContextMenu?.(manager.buildContext({ scenePoint: point(150, 150), hitResult: { id: lonely.id, kind: 'device', zIndex: 0, locked: false } }), mouse({ clientX: 150, clientY: 150 }))

    const menu = useRuntimeStore.getState().contextMenu
    expect(menu!.items[0].label).toBe('Bring to Front')
  })

  it('empty-canvas context menu with 2+ selected offers grouping', () => {
    const dev1 = makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })
    const dev2 = makeDevice({ id: 'dev-2', x: 900, y: 100, width: 600, height: 400 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [dev1, dev2] }] })
    useStore.setState({ selectedIds: ['dev-1', 'dev-2'], selectionMode: 'multi' })

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onContextMenu?.(manager.buildContext({ scenePoint: point(50, 50) }), mouse({ clientX: 60, clientY: 60 }))

    const menu = useRuntimeStore.getState().contextMenu
    expect(menu).not.toBeNull()
    expect(menu!.items.map((i) => i.label)).toEqual(['Group'])
  })

  it('empty-canvas context menu with no selection does not open a menu', () => {
    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onContextMenu?.(manager.buildContext({ scenePoint: point(50, 50) }), mouse({}))

    expect(useRuntimeStore.getState().contextMenu).toBeNull()
  })

  it('dragging an element onto another element nests it into that container', () => {
    const target = makeDevice({ id: 'dev-target', x: 0, y: 0, width: 200, height: 200, zIndex: 0 })
    const dragged = makeTextBox({ id: 'tb-drag', x: 300, y: 300, width: 100, height: 100, zIndex: 1 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [target], textBoxes: [dragged] }] })
    mountElement('tb-drag', 'textBox')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(350, 350), hitResult: { id: 'tb-drag', kind: 'textBox', zIndex: 1, locked: false }, toolId: 'select' }),
      evt({ clientX: 350, clientY: 350 })
    )

    // The live drop ring follows the pointer over the target.
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(100, 100), toolId: 'select' }),
      evt({ clientX: 100, clientY: 100 })
    )
    expect(useRuntimeStore.getState().containerDropTarget).toBe('dev-target')

    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(100, 100), toolId: 'select' }),
      evt({ clientX: 100, clientY: 100 })
    )

    const tb = useStore.getState().scenes[0].textBoxes[0]
    expect(tb.containerId).toBe('dev-target')
    expect(useStore.getState().undoStack.at(-1)?.label).toBe('Move into container')
    expect(useRuntimeStore.getState().containerDropTarget).toBeNull()
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('dropping a nested child on empty canvas un-nests it', () => {
    const target = makeDevice({ id: 'dev-target', x: 0, y: 0, width: 200, height: 200, zIndex: 0 })
    const child = makeTextBox({ id: 'tb-child', containerId: 'dev-target', x: 50, y: 50, width: 100, height: 100, zIndex: 1 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [target], textBoxes: [child] }] })
    mountElement('tb-child', 'textBox')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(100, 100), hitResult: { id: 'tb-child', kind: 'textBox', zIndex: 1, locked: false }, toolId: 'select' }),
      evt({ clientX: 100, clientY: 100 })
    )
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(500, 500), toolId: 'select' }),
      evt({ clientX: 500, clientY: 500 })
    )
    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(500, 500), toolId: 'select' }),
      evt({ clientX: 500, clientY: 500 })
    )

    const tb = useStore.getState().scenes[0].textBoxes[0]
    expect(tb.containerId).toBeNull()
    expect(useStore.getState().undoStack.at(-1)?.label).toBe('Move out of container')
  })

  it('a click without movement does not nest', () => {
    const target = makeDevice({ id: 'dev-target', x: 0, y: 0, width: 200, height: 200, zIndex: 0 })
    const dragged = makeTextBox({ id: 'tb-drag', x: 300, y: 300, width: 100, height: 100, zIndex: 1 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [target], textBoxes: [dragged] }] })
    mountElement('tb-drag', 'textBox')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(350, 350), hitResult: { id: 'tb-drag', kind: 'textBox', zIndex: 1, locked: false }, toolId: 'select' }),
      evt({ clientX: 350, clientY: 350 })
    )
    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(350, 350), toolId: 'select' }),
      evt({ clientX: 350, clientY: 350 })
    )

    const tb = useStore.getState().scenes[0].textBoxes[0]
    expect(tb.containerId).toBeNull()
    expect(useStore.getState().undoStack.at(-1)?.label).toBe('Move text box')
  })

  it('dragging onto an element outside the focus scope does not nest', () => {
    const inside = makeDevice({ id: 'dev-in', x: 0, y: 0, width: 200, height: 200, zIndex: 1 })
    const outside = makeDevice({ id: 'dev-out', x: 300, y: 0, width: 200, height: 200, zIndex: 2 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [inside, outside] }] })
    useRuntimeStore.getState().enterElementFocus('dev-in')
    mountElement('dev-in', 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(50, 50), hitResult: { id: 'dev-in', kind: 'device', zIndex: 1, locked: false }, toolId: 'select' }),
      evt({ clientX: 50, clientY: 50 })
    )
    // Over the out-of-scope element the ring must stay clear and the drop
    // resolves to a plain move, never a nest.
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(350, 100), toolId: 'select' }),
      evt({ clientX: 350, clientY: 100 })
    )
    expect(useRuntimeStore.getState().containerDropTarget).toBeNull()

    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(350, 100), toolId: 'select' }),
      evt({ clientX: 350, clientY: 100 })
    )

    const dev = useStore.getState().scenes[0].devices[0]
    expect(dev.containerId).toBeNull()
    expect(useStore.getState().undoStack.at(-1)?.label).toBe('Move device')
    expect(useRuntimeStore.getState().containerDropTarget).toBeNull()
  })

  it('multi-drag is a pure move and never nests', () => {
    const target = makeDevice({ id: 'dev-target', x: 0, y: 0, width: 200, height: 200, zIndex: 0 })
    const d1 = makeDevice({ id: 'dev-1', x: 300, y: 300, width: 100, height: 100, zIndex: 1 })
    const d2 = makeDevice({ id: 'dev-2', x: 450, y: 300, width: 100, height: 100, zIndex: 2 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [target, d1, d2] }] })
    useStore.setState({ selectedIds: ['dev-1', 'dev-2'], selectionMode: 'multi' })
    mountElement('dev-1', 'device')
    mountElement('dev-2', 'device')

    const manager = createToolManager(toolRegistry)
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(350, 350), hitResult: { id: 'dev-1', kind: 'device', zIndex: 1, locked: false }, toolId: 'select' }),
      evt({ clientX: 350, clientY: 350 })
    )
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(100, 100), toolId: 'select' }),
      evt({ clientX: 100, clientY: 100 })
    )
    expect(useRuntimeStore.getState().containerDropTarget).toBeNull()

    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(100, 100), toolId: 'select' }),
      evt({ clientX: 100, clientY: 100 })
    )

    const scene = useStore.getState().scenes[0]
    expect(scene.devices.find((d) => d.id === 'dev-1')?.containerId).toBeNull()
    expect(scene.devices.find((d) => d.id === 'dev-2')?.containerId).toBeNull()
    expect(useStore.getState().undoStack.at(-1)?.label).toBe('Move device')
  })
})
