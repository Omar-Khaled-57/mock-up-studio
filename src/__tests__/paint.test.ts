/**
 * paint tool — M11 paint brush. Strokes committed through the tool manager
 * against the real document + runtime stores; rasterization is mocked so the
 * commit pipeline (per-stroke layer creation, naming, history granularity,
 * undo, focus registration) is fully observable without a canvas 2d context.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { createToolManager, toolRegistry } from '../renderer/tools'
import { PAINT_LAYER_PREFIX, isPaintLayer } from '../renderer/services/paint-layers'
import { compositeStrokeToRegion } from '../renderer/services/rasterizer'
import { resetStore, makeDevice } from './helpers'

vi.mock('../renderer/services/rasterizer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../renderer/services/rasterizer')>()
  let counter = 0
  return {
    ...mod,
    compositeStrokeToRegion: vi.fn(async (...args: unknown[]) => {
      const points = args[2] as { x: number; y: number }[]
      const brush = args[3] as { size: number }
      const radius = Math.max(0.25, brush.size / 2)
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of points) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
      }
      const x = Math.floor(minX - radius)
      const y = Math.floor(minY - radius)
      return {
        src: `data:image/png;base64,stroke-${++counter}`,
        region: {
          x,
          y,
          width: Math.ceil(maxX + radius) - x,
          height: Math.ceil(maxY + radius) - y
        }
      }
    })
  }
})

const compositeMock = compositeStrokeToRegion as unknown as ReturnType<typeof vi.fn>

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

describe('paint tool', () => {
  beforeEach(() => {
    resetStore()
    compositeMock.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes options and is reachable via its shortcut group', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('paint')
    const tool = manager.getActiveTool()
    expect(tool.id).toBe('paint')
    expect(tool.options).toBe(true)
    expect(tool.variants).toEqual(['paint', 'pencil', 'airbrush', 'marker', 'calligraphy', 'pixel'])
  })

  it('a paint stroke creates a paint layer clipped to the stroke bounds and a single history entry', async () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('paint')

    await strokeTo(manager, 'paint', [
      { x: 100, y: 100 },
      { x: 200, y: 150 }
    ])

    const scene = useStore.getState().scenes[0]
    expect(scene.images).toHaveLength(1)
    const layer = scene.images[0]
    expect(layer.name).toBe(`${PAINT_LAYER_PREFIX}1`)
    expect(isPaintLayer(layer)).toBe(true)
    expect(layer.src).toMatch(/^data:image\/png;base64,stroke-/)
    expect(layer.x).toBe(88)
    expect(layer.y).toBe(88)
    expect(layer.width).toBe(124)
    expect(layer.height).toBe(74)
    expect(layer.groupId).toBeNull()

    expect(useStore.getState().undoStack.length).toBe(1)
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('each stroke creates its own sequentially-named layer', async () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('paint')

    await strokeTo(manager, 'paint', [
      { x: 100, y: 100 },
      { x: 200, y: 150 }
    ])

    await strokeTo(manager, 'paint', [
      { x: 300, y: 300 },
      { x: 400, y: 350 }
    ])

    const scene = useStore.getState().scenes[0]
    expect(scene.images).toHaveLength(2)
    expect(scene.images.map((img) => img.name)).toEqual([`${PAINT_LAYER_PREFIX}1`, `${PAINT_LAYER_PREFIX}2`])
    expect(scene.images[0].src).not.toBe(scene.images[1].src)
    expect(useStore.getState().undoStack.length).toBe(2)
  })

  it('a single-point stroke paints a dot', async () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('paint')

    await strokeTo(manager, 'paint', [{ x: 150, y: 150 }])

    expect(useStore.getState().scenes[0].images).toHaveLength(1)
    expect(compositeMock).toHaveBeenCalledTimes(1)
  })

  it('undo removes one layer per stroke', async () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('paint')

    await strokeTo(manager, 'paint', [
      { x: 100, y: 100 },
      { x: 200, y: 150 }
    ])
    const firstId = useStore.getState().scenes[0].images[0].id

    await strokeTo(manager, 'paint', [
      { x: 300, y: 300 },
      { x: 400, y: 350 }
    ])
    expect(useStore.getState().scenes[0].images).toHaveLength(2)

    useStore.getState().undo()
    expect(useStore.getState().scenes[0].images).toHaveLength(1)
    expect(useStore.getState().scenes[0].images[0].id).toBe(firstId)

    useStore.getState().undo()
    expect(useStore.getState().scenes[0].images).toHaveLength(0)
  })

  it('pointer cancel leaves no layer and no history entry', async () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('paint')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(100, 100), toolId: 'paint' }),
      evt({ clientX: 100, clientY: 100 })
    )
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(200, 150), toolId: 'paint' }),
      evt({ clientX: 200, clientY: 150 })
    )
    tool.onPointerCancel?.(
      manager.buildContext({ scenePoint: point(200, 150), toolId: 'paint' }),
      evt({ clientX: 200, clientY: 150 })
    )
    await flushCommits()

    expect(useStore.getState().scenes[0].images).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(0)
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
    expect(useRuntimeStore.getState().strokeBuffer).toEqual([])
  })

  it('non-primary buttons do not start a stroke', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('paint')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(100, 100), toolId: 'paint' }),
      evt({ button: 2 })
    )

    expect(manager.getOwner(1)).toBeNull()
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('focus mode registers every stroke as its own layer in the focused group', async () => {
    const dev = makeDevice({ id: 'dev-1', groupId: 'g-1', x: 100, y: 100, width: 600, height: 400 })
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        devices: [dev],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-1'] }]
      }]
    })
    useRuntimeStore.getState().enterFocus('g-1')

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('paint')

    await strokeTo(manager, 'paint', [
      { x: 100, y: 100 },
      { x: 200, y: 150 }
    ])
    await strokeTo(manager, 'paint', [
      { x: 300, y: 300 },
      { x: 400, y: 350 }
    ])

    const state = useStore.getState()
    const layers = state.scenes[0].images
    expect(layers).toHaveLength(2)
    expect(layers.map((layer) => layer.groupId)).toEqual(['g-1', 'g-1'])
    const group = state.scenes[0].groups[0]
    expect(group.childIds).toEqual(['dev-1', layers[0].id, layers[1].id])
  })

  it('uses the runtime brush settings for the composite', async () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('paint')
    useRuntimeStore.getState().setBrush({ size: 40, hardness: 0.8, color: '#ff0000' })

    await strokeTo(manager, 'paint', [
      { x: 100, y: 100 },
      { x: 200, y: 150 }
    ])

    const lastCall = compositeMock.mock.calls[compositeMock.mock.calls.length - 1]
    expect(lastCall[3]).toEqual({ size: 40, hardness: 0.8, color: '#ff0000', shape: 'round', opacity: 1 })
    expect(lastCall[4]).toBe(useStore.getState().scenes[0].canvas.width)
    expect(lastCall[5]).toBe(useStore.getState().scenes[0].canvas.height)
  })

  it('writes the stroke buffer and dirty flag during a live stroke', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('paint')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(100, 100), toolId: 'paint' }),
      evt({ clientX: 100, clientY: 100 })
    )
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(200, 150), toolId: 'paint' }),
      evt({ clientX: 200, clientY: 150 })
    )

    expect(useRuntimeStore.getState().strokeDirty).toBe(true)

    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(200, 150), toolId: 'paint' }),
      evt({ clientX: 200, clientY: 150 })
    )

    const rt = useRuntimeStore.getState()
    expect(rt.strokeBuffer.length).toBeGreaterThanOrEqual(2)
    expect(rt.strokeDirty).toBe(false)
    return flushCommits()
  })
})
