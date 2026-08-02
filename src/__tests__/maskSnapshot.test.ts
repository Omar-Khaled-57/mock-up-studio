/**
 * mask-snapshot — frozen-mask capture service contract.
 *
 * The real capture service reads `[data-scene-export]` and renders it offscreen
 * (jsdom cannot render), so the module is mocked here to exercise the store and
 * refresh paths that branch on capture availability:
 *   - The mask tool commits LIVE (geometry-only, no snapshot) so a freshly
 *     drawn mask stays visible as a checkerboard — a snapshot captured at
 *     creation time is pixel-identical to the live canvas and invisible.
 *   - `refreshMaskSnapshot` is the only path that captures: it re-captures into
 *     an existing mask with one history entry, and no-ops when the capture
 *     fails.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { createToolManager, toolRegistry } from '../renderer/tools'
import { resetStore, makeDevice } from './helpers'

vi.mock('../renderer/services/mask-snapshot', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../renderer/services/mask-snapshot')>()
  return {
    ...mod,
    canCaptureMaskSnapshot: vi.fn(() => false),
    captureMaskSnapshot: vi.fn(async () => null)
  }
})

import { canCaptureMaskSnapshot, captureMaskSnapshot } from '../renderer/services/mask-snapshot'

const SNAPSHOT = {
  dataUrl: 'data:image/png;base64,AA==',
  width: 100,
  height: 100,
  sourceBounds: { x: 0, y: 0, width: 100, height: 100 },
  capturedAt: 42
}

function evt(partial: Partial<{ pointerId: number; button: number; clientX: number; clientY: number }>): PointerEvent {
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

function maskOf() {
  return useStore.getState().scenes[0].masks
}

describe('mask tool frozen-mask commit', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    vi.mocked(canCaptureMaskSnapshot).mockReturnValue(false)
    vi.mocked(captureMaskSnapshot).mockResolvedValue(null)
  })

  it('commits a live geometry-only mask (no snapshot) so the mask stays visible', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [], devices: [makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(300, 300), toolId: 'mask' }), evt({ clientX: 300, clientY: 300 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(400, 350), toolId: 'mask' }), evt({ clientX: 400, clientY: 350 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(400, 350), toolId: 'mask' }), evt({ clientX: 400, clientY: 350 }))

    expect(maskOf()).toHaveLength(1)
    expect(maskOf()[0].snapshot).toBeUndefined()
    expect(captureMaskSnapshot).not.toHaveBeenCalled()
    expect(useStore.getState().undoStack.length).toBe(1)
  })
})

describe('refreshMaskSnapshot', () => {
  beforeEach(() => {
    resetStore()
    vi.mocked(canCaptureMaskSnapshot).mockReturnValue(true)
    vi.mocked(captureMaskSnapshot).mockResolvedValue(SNAPSHOT)
  })

  it('re-captures into an existing mask with one history entry; undo restores', async () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 0, y: 0, width: 100, height: 100 })] }] })
    const state = useStore.getState()
    state.addMask({ id: 'm1', targetId: 'dev-1', shape: 'rectangle', x: 0, y: 0, width: 50, height: 50, points: [], inverted: true })
    expect(useStore.getState().undoStack.length).toBe(0)

    await useStore.getState().refreshMaskSnapshot('m1')
    expect(captureMaskSnapshot).toHaveBeenCalledWith({ x: 0, y: 0, width: 100, height: 100 })
    expect(maskOf()[0].snapshot).toEqual(SNAPSHOT)
    expect(useStore.getState().undoStack.length).toBe(1)

    useStore.getState().undo()
    expect(maskOf()[0].snapshot).toBeUndefined()
  })

  it('no-ops (no history) when the capture fails', async () => {
    vi.mocked(captureMaskSnapshot).mockResolvedValue(null)
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 0, y: 0, width: 100, height: 100 })] }] })
    const state = useStore.getState()
    state.addMask({ id: 'm1', targetId: 'dev-1', shape: 'rectangle', x: 0, y: 0, width: 50, height: 50, points: [], inverted: true })

    await useStore.getState().refreshMaskSnapshot('m1')
    expect(maskOf()[0].snapshot).toBeUndefined()
    expect(useStore.getState().undoStack.length).toBe(0)
  })

  it('no-ops for an unknown mask id or an unresolvable target', async () => {
    await useStore.getState().refreshMaskSnapshot('ghost')
    expect(useStore.getState().undoStack.length).toBe(0)
  })

  it('refreshing the background sentinel captures the canvas box', async () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [], textBoxes: [] }] })
    const state = useStore.getState()
    state.addMask({ id: 'mbg', targetId: '__background__', shape: 'rectangle', x: 0, y: 0, width: 50, height: 50, points: [], inverted: true })
    const canvas = useStore.getState().scenes[0].canvas

    await useStore.getState().refreshMaskSnapshot('mbg')
    expect(captureMaskSnapshot).toHaveBeenCalledWith({ x: 0, y: 0, width: canvas.width, height: canvas.height })
    expect(maskOf()[0].snapshot).toEqual(SNAPSHOT)
  })
})
