/**
 * blur region tools — blur-rect / blur-ellipse / blur-line. Dragging emits a
 * live region preview (runtime store, rendered by PreviewSurface) and commits
 * `applyBlurRegion` on pointer-up. `applyBlurRegion` is mocked so the commit
 * pipeline and the preview lifecycle are observable without a 2d context.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { createToolManager, toolRegistry } from '../renderer/tools'
import { applyBlurRegion, blurRadiusFromBrush } from '../renderer/services/rasterizer'
import { resetStore, makeDevice } from './helpers'

vi.mock('../renderer/services/rasterizer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../renderer/services/rasterizer')>()
  let counter = 0
  return {
    ...mod,
    applyBlurRegion: vi.fn(async () => `data:image/png;base64,region-${++counter}`)
  }
})

const blurMock = applyBlurRegion as unknown as ReturnType<typeof vi.fn>

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

function hit(id: string, kind: string) {
  return { id, kind, zIndex: 0, locked: false }
}

describe('blur region tools', () => {
  beforeEach(() => {
    resetStore()
    blurMock.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a blur-rect drag emits a rect preview and commits the region on pointer up', async () => {
    const dev = makeDevice({ id: 'dev-1', type: 'monitor', x: 100, y: 100, width: 100, height: 100, screenImage: 'data:image/png;base64,dev' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [dev] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('blur-rect')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: hit('dev-1', 'device'), toolId: 'blur-rect' }),
      evt({ clientX: 150, clientY: 150 })
    )

    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(250, 200), toolId: 'blur-rect' }),
      evt({ clientX: 250, clientY: 200 })
    )

    const duringDrag = useRuntimeStore.getState().preview
    expect(duringDrag).not.toBeNull()
    expect(duringDrag!.visuals[0]).toMatchObject({ kind: 'rect', x: 150, y: 150, width: 100, height: 50 })
    expect(duringDrag!.style).toMatchObject({
      fill: 'rgba(255, 255, 255, 0.2)',
      stroke: 'rgba(255, 255, 255, 0.9)',
      hatch: true
    })

    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(250, 200), toolId: 'blur-rect' }),
      evt({ clientX: 250, clientY: 200 })
    )
    await flushCommits()

    expect(useRuntimeStore.getState().preview).toBeNull()
    expect(useStore.getState().scenes[0].devices[0].screenImage).toMatch(/^data:image\/png;base64,region-/)
    expect(useStore.getState().undoStack.length).toBe(1)

    const call = blurMock.mock.calls[blurMock.mock.calls.length - 1]
    expect(call[0]).toMatchObject({ src: 'data:image/png;base64,dev', width: 100, height: 71 })
    expect(call[1]).toEqual({ type: 'rect', x: 50, y: 38, width: 100, height: 50 })
    expect(call[2]).toBe(blurRadiusFromBrush(useRuntimeStore.getState().brush))
  })

  it('a blur-line drag keeps its brush-size width in the preview and commit', async () => {
    const dev = makeDevice({ id: 'dev-1', type: 'monitor', x: 100, y: 100, width: 100, height: 100, screenImage: 'data:image/png;base64,dev' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [dev] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('blur-line')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: hit('dev-1', 'device'), toolId: 'blur-line' }),
      evt({ clientX: 150, clientY: 150 })
    )
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(200, 200), toolId: 'blur-line' }),
      evt({ clientX: 200, clientY: 200 })
    )

    const duringDrag = useRuntimeStore.getState().preview
    expect(duringDrag!.visuals[0]).toMatchObject({
      kind: 'line',
      x1: 150,
      y1: 150,
      x2: 200,
      y2: 200,
      width: useRuntimeStore.getState().brush.size
    })

    tool.onPointerUp?.(
      manager.buildContext({ scenePoint: point(200, 200), toolId: 'blur-line' }),
      evt({ clientX: 200, clientY: 200 })
    )
    await flushCommits()

    const call = blurMock.mock.calls[blurMock.mock.calls.length - 1]
    expect(call[1]).toMatchObject({ type: 'line', width: useRuntimeStore.getState().brush.size })
  })

  it('pointer cancel clears the preview without committing', async () => {
    const dev = makeDevice({ id: 'dev-1', type: 'monitor', x: 100, y: 100, width: 100, height: 100, screenImage: 'data:image/png;base64,dev' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [dev] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('blur-ellipse')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: hit('dev-1', 'device'), toolId: 'blur-ellipse' }),
      evt({ clientX: 150, clientY: 150 })
    )
    tool.onPointerMove?.(
      manager.buildContext({ scenePoint: point(200, 200), toolId: 'blur-ellipse' }),
      evt({ clientX: 200, clientY: 200 })
    )
    expect(useRuntimeStore.getState().preview).not.toBeNull()

    tool.onPointerCancel?.(
      manager.buildContext({ scenePoint: point(200, 200), toolId: 'blur-ellipse' }),
      evt({ clientX: 200, clientY: 200 })
    )
    await flushCommits()

    expect(useRuntimeStore.getState().preview).toBeNull()
    expect(blurMock).not.toHaveBeenCalled()
    expect(useStore.getState().undoStack.length).toBe(0)
  })

  it('non-primary buttons do not start a region drag', () => {
    const dev = makeDevice({ id: 'dev-1', type: 'monitor', x: 100, y: 100, width: 100, height: 100, screenImage: 'data:image/png;base64,dev' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [dev] }] })

    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('blur-rect')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(
      manager.buildContext({ scenePoint: point(150, 150), hitResult: hit('dev-1', 'device'), toolId: 'blur-rect' }),
      evt({ button: 2 })
    )

    expect(manager.getOwner(1)).toBeNull()
    expect(useRuntimeStore.getState().preview).toBeNull()
  })
})
