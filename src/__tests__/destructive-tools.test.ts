/**
 * destructive tools — M12 blur / eraser / magic-eraser. Strokes committed
 * through the tool manager against the real document + runtime stores;
 * `applyDestructiveStroke` is mocked so the commit pipeline (target pinning,
 * local-coordinate translation, history granularity, undo, focus gating) is
 * fully observable without a canvas 2d context.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { createToolManager, toolRegistry } from '../renderer/tools'
import { applyDestructiveStroke } from '../renderer/services/rasterizer'
import { rasterizeShapeBitmap } from '../renderer/services/shape-rasterizer'
import { resetStore, makeDevice, makeImage, makeShape, makeTextBox } from './helpers'

vi.mock('../renderer/services/rasterizer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../renderer/services/rasterizer')>()
  let counter = 0
  return {
    ...mod,
    applyDestructiveStroke: vi.fn(async () => `data:image/png;base64,stroke-${++counter}`)
  }
})

vi.mock('../renderer/services/shape-rasterizer', () => ({
  rasterizeShapeBitmap: vi.fn(async () => 'data:image/png;base64,rasterized-shape')
}))

const applyMock = applyDestructiveStroke as unknown as ReturnType<typeof vi.fn>
const rasterizeMock = rasterizeShapeBitmap as unknown as ReturnType<typeof vi.fn>

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

function flushCommits(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function strokeTo(manager: ReturnType<typeof createToolManager>, toolId: string, points: { x: number; y: number }[]) {
  const tool = manager.getActiveTool()
  const [first, ...rest] = points
  tool.onPointerDown?.(
    manager.buildContext({ scenePoint: point(first.x, first.y), toolId }),
    evt({ clientX: first.x, clientY: first.y })
  )
  for (const p of rest) {
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(p.x, p.y), toolId }), evt({ clientX: p.x, clientY: p.y }))
  }
  const last = rest[rest.length - 1] ?? first
  tool.onPointerUp?.(
    manager.buildContext({ scenePoint: point(last.x, last.y), toolId }),
    evt({ clientX: last.x, clientY: last.y })
  )
  await flushCommits()
}

describe('destructive tools', () => {
  beforeEach(() => {
    resetStore()
    applyMock.mockClear()
    rasterizeMock.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('blur, eraser and magic-eraser are reachable brush/eraser tools', () => {
    const manager = createToolManager(toolRegistry)
    const variantsByTool: Record<string, string[]> = {
      blur: ['blur', 'blur-element', 'blur-rect', 'blur-ellipse', 'blur-line'],
      eraser: ['eraser', 'magic-eraser', 'delete'],
      'magic-eraser': ['eraser', 'magic-eraser', 'delete']
    }
    for (const id of ['blur', 'eraser', 'magic-eraser']) {
      manager.setActiveTool(id)
      const tool = manager.getActiveTool()
      expect(tool.id).toBe(id)
      expect(tool.options).toBe(true)
      expect(typeof tool.onPointerDown).toBe('function')
      expect(tool.variants).toEqual(variantsByTool[id])
    }
  })

  it('a blur stroke updates an image overlay and creates a single history entry', async () => {
    const img = makeImage({ id: 'img-1', x: 150, y: 150, width: 300, height: 200 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], images: [img] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('blur')

    await strokeTo(manager, 'blur', [
      { x: 200, y: 200 },
      { x: 250, y: 220 }
    ])

    const scene = useStore.getState().scenes[0]
    expect(scene.images).toHaveLength(1)
    expect(scene.images[0].src).toMatch(/^data:image\/png;base64,stroke-/)
    expect(useStore.getState().undoStack.length).toBe(1)
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('an eraser stroke updates a device screenshot with translated local points', async () => {
    const dev = makeDevice({ id: 'dev-1', type: 'monitor', x: 100, y: 100, width: 100, height: 100, screenImage: 'data:image/png;base64,dev' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [dev] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('eraser')

    await strokeTo(manager, 'eraser', [
      { x: 150, y: 150 },
      { x: 160, y: 160 }
    ])

    const scene = useStore.getState().scenes[0]
    expect(scene.devices[0].screenImage).toMatch(/^data:image\/png;base64,stroke-/)

    const lastCall = applyMock.mock.calls[applyMock.mock.calls.length - 1]
    expect(lastCall[0]).toMatchObject({ src: 'data:image/png;base64,dev', width: 100, height: 71 })
    expect(lastCall[1]).toBe('eraser')
    // scene (150,150) → element-local (50,50) → screen region top inset 12px → (50, 38)
    expect(lastCall[2][0]).toEqual({ x: 50, y: 38, pressure: 1 })
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('a magic-eraser stroke updates a shape background image', async () => {
    const shape = makeShape({ id: 'shp-1', x: 200, y: 200, width: 120, height: 120, backgroundImage: 'data:image/png;base64,shp' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], shapes: [shape] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('magic-eraser')

    await strokeTo(manager, 'magic-eraser', [{ x: 210, y: 210 }])

    const scene = useStore.getState().scenes[0]
    expect(scene.shapes[0].backgroundImage).toMatch(/^data:image\/png;base64,stroke-/)
    const lastCall = applyMock.mock.calls[applyMock.mock.calls.length - 1]
    expect(lastCall[1]).toBe('magic-eraser')
    expect(lastCall[2]).toHaveLength(1)
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('undo restores the pre-stroke src once per stroke', async () => {
    const img = makeImage({ id: 'img-1', x: 150, y: 150, width: 300, height: 200, src: 'data:image/png;base64,orig' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], images: [img] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('blur')
    await strokeTo(manager, 'blur', [{ x: 200, y: 200 }])
    const srcAfterFirst = useStore.getState().scenes[0].images[0].src
    expect(srcAfterFirst).not.toBe('data:image/png;base64,orig')

    await strokeTo(manager, 'blur', [{ x: 300, y: 250 }])
    expect(useStore.getState().undoStack.length).toBe(2)

    useStore.getState().undo()
    expect(useStore.getState().scenes[0].images[0].src).toBe(srcAfterFirst)
    useStore.getState().undo()
    expect(useStore.getState().scenes[0].images[0].src).toBe('data:image/png;base64,orig')
  })

  it('a subsequent stroke re-reads the updated bitmap from the store', async () => {
    const img = makeImage({ id: 'img-1', x: 150, y: 150, width: 300, height: 200, src: 'data:image/png;base64,orig' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], images: [img] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('blur')
    await strokeTo(manager, 'blur', [{ x: 200, y: 200 }])
    const srcAfterFirst = useStore.getState().scenes[0].images[0].src

    await strokeTo(manager, 'blur', [{ x: 300, y: 250 }])

    const lastCall = applyMock.mock.calls[applyMock.mock.calls.length - 1]
    expect(lastCall[0].src).toBe(srcAfterFirst)
  })

  it('pointer cancel leaves the bitmap untouched', async () => {
    const img = makeImage({ id: 'img-1', x: 150, y: 150, width: 300, height: 200 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], images: [img] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('eraser')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(200, 200), toolId: 'eraser' }),
      evt({ clientX: 200, clientY: 200 })
    )
    tool.onPointerCancel?.(
      manager.buildContext({ scenePoint: point(210, 210), toolId: 'eraser' }),
      evt({ clientX: 210, clientY: 210 })
    )
    await flushCommits()

    expect(useStore.getState().scenes[0].images[0].src).toBe(img.src)
    expect(useStore.getState().undoStack.length).toBe(0)
    expect(applyMock).not.toHaveBeenCalled()
    expect(useRuntimeStore.getState().strokeBuffer).toEqual([])
  })

  it('non-primary buttons do not start a stroke', () => {
    const img = makeImage({ id: 'img-1', x: 150, y: 150, width: 300, height: 200 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], images: [img] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('blur')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(200, 200), toolId: 'blur' }),
      evt({ button: 2 })
    )

    expect(manager.getOwner(1)).toBeNull()
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
    expect(applyMock).not.toHaveBeenCalled()
  })

  it('does not paint on text boxes or src-less elements', () => {
    const tb = makeTextBox({ id: 'tb-1', x: 50, y: 50, width: 200, height: 60 })
    const img = makeImage({ id: 'img-1', src: '' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [tb], images: [img] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('blur')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(100, 80), toolId: 'blur' }),
      evt({ clientX: 100, clientY: 80 })
    )
    expect(manager.getOwner(1)).toBeNull()
    expect(applyMock).not.toHaveBeenCalled()
  })

  it('focus mode rejects an out-of-scope target and clears the selection', async () => {
    const dev = makeDevice({ id: 'dev-1', groupId: 'g-1', x: 100, y: 100, width: 600, height: 400 })
    const img = makeImage({ id: 'img-1', x: 150, y: 150, width: 300, height: 200, zIndex: 100 })
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        devices: [dev],
        images: [img],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-1'] }]
      }],
      selectedIds: ['dev-1'],
      selectionMode: 'single'
    })
    useRuntimeStore.getState().enterFocus('g-1')

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('eraser')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(250, 250), toolId: 'eraser' }),
      evt({ clientX: 250, clientY: 250 })
    )

    expect(manager.getOwner(1)).toBeNull()
    expect(useStore.getState().selectedIds).toEqual([])
    expect(applyMock).not.toHaveBeenCalled()
  })

  it('focus mode allows destructive strokes on in-scope elements', async () => {
    const dev = makeDevice({ id: 'dev-1', groupId: 'g-1', x: 100, y: 100, width: 600, height: 400 })
    const img = makeImage({ id: 'img-1', groupId: 'g-1', x: 150, y: 150, width: 300, height: 200 })
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        devices: [dev],
        images: [img],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-1', 'img-1'] }]
      }]
    })
    useRuntimeStore.getState().enterFocus('g-1')

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('eraser')

    await strokeTo(manager, 'eraser', [{ x: 250, y: 250 }])

    expect(useStore.getState().scenes[0].images[0].src).toMatch(/^data:image\/png;base64,stroke-/)
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('uses the runtime brush settings and a pinned target for the stroke', async () => {
    useRuntimeStore.getState().setBrush({ size: 40, hardness: 0.8, color: '#ff0000' })
    const img = makeImage({ id: 'img-1', x: 150, y: 150, width: 300, height: 200 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], images: [img] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('blur')
    await strokeTo(manager, 'blur', [{ x: 200, y: 200 }])

    const lastCall = applyMock.mock.calls[applyMock.mock.calls.length - 1]
    expect(lastCall[3]).toEqual({ size: 40, hardness: 0.8, color: '#ff0000', shape: 'round', opacity: 1 })
  })

  it('writes the stroke buffer and dirty flag during a live stroke', () => {
    const img = makeImage({ id: 'img-1', x: 150, y: 150, width: 300, height: 200 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], images: [img] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('blur')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(200, 200), toolId: 'blur' }),
      evt({ clientX: 200, clientY: 200 })
    )
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(250, 220), toolId: 'blur' }),
      evt({ clientX: 250, clientY: 220 })
    )

    expect(useRuntimeStore.getState().strokeDirty).toBe(true)

    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(250, 220), toolId: 'blur' }),
      evt({ clientX: 250, clientY: 220 })
    )

    const rt = useRuntimeStore.getState()
    expect(rt.strokeBuffer.length).toBeGreaterThanOrEqual(2)
    expect(rt.strokeDirty).toBe(false)
    return flushCommits()
  })
})
