/**
 * M13 mask system — clip-path builders, mask slice CRUD, serialization and
 * the Mask tool driven through the real tool manager + document/runtime
 * stores (no rasterization involved, so no mocks needed).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { createToolManager, toolRegistry } from '../renderer/tools'
import { buildMaskClipPath, collectMaskVisuals, BACKGROUND_MASK_TARGET_ID } from '../renderer/services/mask-visualization'
import { serializeProject, deserializeProject } from '../renderer/lib/project-serialization'
import { resetStore, makeDevice, makeTextBox } from './helpers'

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

describe('buildMaskClipPath', () => {
  it('builds an inset() clip for a rectangle mask', () => {
    const clip = buildMaskClipPath(
      { id: 'm', targetId: 'x', shape: 'rectangle', x: 20, y: 30, width: 100, height: 50, points: [], inverted: false },
      200,
      100
    )
    expect(clip).toBe('inset(30px 80px 20px 20px)')
  })

  it('punches a rectangle via evenodd compositing', () => {
    const clip = buildMaskClipPath(
      { id: 'm', targetId: 'x', shape: 'rectangle', x: 20, y: 30, width: 100, height: 50, points: [], inverted: true },
      200,
      100
    )
    expect(clip).toContain('evenodd')
    expect(clip).toContain('0px 0px, 200px 0px, 200px 100px, 0px 100px')
    expect(clip).toContain('20px 30px, 120px 30px, 120px 80px, 20px 80px')
  })

  it('builds an ellipse() clip centered on the mask box', () => {
    const clip = buildMaskClipPath(
      { id: 'm', targetId: 'x', shape: 'ellipse', x: 0, y: 0, width: 200, height: 100, points: [], inverted: false },
      200,
      100
    )
    expect(clip).toBe('ellipse(100px 50px at 100px 50px)')
  })

  it('approximates an inverted ellipse hole with a 32-point polygon', () => {
    const clip = buildMaskClipPath(
      { id: 'm', targetId: 'x', shape: 'ellipse', x: 0, y: 0, width: 200, height: 100, points: [], inverted: true },
      200,
      100
    )
    const inner = clip.replace(/^polygon\(/, '').split(', evenodd)')[0]
    const pairs = inner.split(', ').filter(Boolean)
    expect(pairs).toHaveLength(4 + 32)
  })

  it('builds a polygon() clip from brush points', () => {
    const clip = buildMaskClipPath(
      { id: 'm', targetId: 'x', shape: 'brush', x: 0, y: 0, width: 0, height: 0, points: [{ x: 5, y: 5 }, { x: 50, y: 5 }, { x: 25, y: 40 }], inverted: false },
      200,
      100
    )
    expect(clip).toBe('polygon(5px 5px, 50px 5px, 25px 40px)')
  })

  it('punches a brush mask via evenodd compositing', () => {
    const clip = buildMaskClipPath(
      { id: 'm', targetId: 'x', shape: 'brush', x: 0, y: 0, width: 0, height: 0, points: [{ x: 5, y: 5 }, { x: 50, y: 5 }], inverted: true },
      200,
      100
    )
    expect(clip).toContain('evenodd')
    expect(clip).toContain('0px 0px, 200px 0px, 200px 100px, 0px 100px')
  })
})

describe('collectMaskVisuals', () => {
  beforeEach(() => {
    resetStore()
  })

  it('resolves masks to scene-space visuals for every element kind', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        devices: [makeDevice({ id: 'dev-1', x: 10, y: 20, width: 100, height: 50, rotation: 45 }), makeDevice({ id: 'dev-2', visible: false })],
        textBoxes: [makeTextBox({ id: 'tb-1', x: 5, y: 5 })],
        masks: [
          { id: 'm1', targetId: 'dev-1', shape: 'rectangle', x: 2, y: 3, width: 40, height: 20, points: [], inverted: false },
          { id: 'm2', targetId: 'tb-1', shape: 'ellipse', x: 1, y: 1, width: 20, height: 10, points: [], inverted: true },
          { id: 'm3', targetId: 'ghost', shape: 'rectangle', x: 0, y: 0, width: 1, height: 1, points: [], inverted: false },
          { id: 'm4', targetId: 'dev-2', shape: 'rectangle', x: 0, y: 0, width: 1, height: 1, points: [], inverted: false }
        ]
      }]
    })

    const visuals = collectMaskVisuals(useStore.getState().scenes[0])
    expect(visuals).toHaveLength(2)
    const dev = visuals.find((v) => v.elementId === 'dev-1')!
    const tb = visuals.find((v) => v.elementId === 'tb-1')!
    expect(dev).toMatchObject({
      rotation: 45,
      origin: { x: 10, y: 20 },
      width: 100,
      height: 50
    })
    expect(dev.items[0]).toMatchObject({
      maskId: 'm1',
      shape: 'rectangle',
      inverted: false,
      rect: { x: 2, y: 3, width: 40, height: 20 },
      points: null,
      visibleClipPath: 'inset(3px 58px 27px 2px)'
    })
    expect(dev.items[0].hiddenClipPath).toContain('evenodd')
    expect(tb).toMatchObject({ rotation: 0 })
    expect(tb.items[0]).toMatchObject({ maskId: 'm2', shape: 'ellipse', inverted: true, hiddenClipPath: 'ellipse(10px 5px at 11px 6px)' })
    expect(tb.items[0].visibleClipPath).toContain('evenodd')
  })

  it('resolves a background/canvas mask to a full-canvas scene-space visual', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        devices: [],
        textBoxes: [],
        masks: [
          { id: 'mbg', targetId: BACKGROUND_MASK_TARGET_ID, shape: 'rectangle', x: 40, y: 40, width: 200, height: 120, points: [], inverted: false }
        ]
      }]
    })

    const visuals = collectMaskVisuals(useStore.getState().scenes[0])
    expect(visuals).toHaveLength(1)
    const bg = visuals[0]
    expect(bg.elementId).toBe(BACKGROUND_MASK_TARGET_ID)
    expect(bg).toMatchObject({
      origin: { x: 0, y: 0 },
      width: scene.canvas.width,
      height: scene.canvas.height,
      rotation: 0,
      zIndex: -1
    })
    expect(bg.items[0]).toMatchObject({ maskId: 'mbg', shape: 'rectangle', inverted: false, rect: { x: 40, y: 40, width: 200, height: 120 } })
  })

  it('skips frozen masks (with a snapshot) so the checkerboard never overlays the frozen content', () => {
    const snapshot = {
      dataUrl: 'data:image/png;base64,AA==',
      width: 100,
      height: 100,
      sourceBounds: { x: 0, y: 0, width: 100, height: 100 },
      capturedAt: 0
    }
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        devices: [makeDevice({ id: 'dev-1', x: 0, y: 0, width: 100, height: 100 })],
        textBoxes: [],
        masks: [
          { id: 'mfrozen', targetId: 'dev-1', shape: 'rectangle', x: 10, y: 10, width: 40, height: 40, points: [], inverted: true, snapshot },
          { id: 'mlive', targetId: 'dev-1', shape: 'ellipse', x: 5, y: 5, width: 20, height: 10, points: [], inverted: false }
        ]
      }]
    })

    const visuals = collectMaskVisuals(useStore.getState().scenes[0])
    expect(visuals).toHaveLength(1)
    expect(visuals[0].items.map((i) => i.maskId)).toEqual(['mlive'])
  })
})

describe('maskSlice', () => {
  beforeEach(() => {
    resetStore()
  })

  it('addMask appends to the active scene', () => {
    const m = { id: 'm1', targetId: 'dev-1', shape: 'rectangle' as const, x: 0, y: 0, width: 50, height: 50, points: [], inverted: false }
    useStore.getState().addMask(m)
    expect(maskOf()).toEqual([m])
  })

  it('updateMask merges a partial patch', () => {
    const state = useStore.getState()
    state.addMask({ id: 'm1', targetId: 'dev-1', shape: 'rectangle', x: 0, y: 0, width: 50, height: 50, points: [], inverted: false })
    state.updateMask('m1', { width: 80, inverted: true })
    expect(maskOf()[0]).toMatchObject({ width: 80, inverted: true, targetId: 'dev-1' })
  })

  it('removeMask deletes by id', () => {
    const state = useStore.getState()
    state.addMask({ id: 'm1', targetId: 'dev-1', shape: 'rectangle', x: 0, y: 0, width: 50, height: 50, points: [], inverted: false })
    state.addMask({ id: 'm2', targetId: 'dev-1', shape: 'ellipse', x: 0, y: 0, width: 50, height: 50, points: [], inverted: false })
    state.removeMask('m1')
    expect(maskOf().map((m) => m.id)).toEqual(['m2'])
  })

  it('maskElement creates a full-bounds rectangle mask', () => {
    useStore.getState().maskElement('dev-1', { width: 300, height: 200 })
    const mask = maskOf()[0]
    expect(mask).toMatchObject({ targetId: 'dev-1', shape: 'rectangle', x: 0, y: 0, width: 300, height: 200, inverted: false })
    expect(mask.id).toBeTruthy()
  })

  it('removeMaskFromElement clears every mask on the target', () => {
    const state = useStore.getState()
    state.addMask({ id: 'm1', targetId: 'dev-1', shape: 'rectangle', x: 0, y: 0, width: 50, height: 50, points: [], inverted: false })
    state.addMask({ id: 'm2', targetId: 'dev-1', shape: 'ellipse', x: 0, y: 0, width: 50, height: 50, points: [], inverted: false })
    state.addMask({ id: 'm3', targetId: 'other', shape: 'rectangle', x: 0, y: 0, width: 50, height: 50, points: [], inverted: false })
    state.removeMaskFromElement('dev-1')
    expect(maskOf().map((m) => m.id)).toEqual(['m3'])
  })

  it('reverseMask toggles the inverted flag', () => {
    const state = useStore.getState()
    state.addMask({ id: 'm1', targetId: 'dev-1', shape: 'rectangle', x: 0, y: 0, width: 50, height: 50, points: [], inverted: false })
    state.reverseMask('m1')
    expect(maskOf()[0].inverted).toBe(true)
    state.reverseMask('m1')
    expect(maskOf()[0].inverted).toBe(false)
  })

  it('clearAllMasks removes every mask in the active scene, including the background sentinel', () => {
    const state = useStore.getState()
    state.addMask({ id: 'm1', targetId: 'dev-1', shape: 'rectangle', x: 0, y: 0, width: 50, height: 50, points: [], inverted: false })
    state.addMask({ id: 'm2', targetId: BACKGROUND_MASK_TARGET_ID, shape: 'rectangle', x: 0, y: 0, width: 50, height: 50, points: [], inverted: true })
    state.addMask({ id: 'm3', targetId: 'dev-1', shape: 'ellipse', x: 0, y: 0, width: 50, height: 50, points: [], inverted: false })
    state.clearAllMasks()
    expect(maskOf()).toEqual([])
  })

  it('refreshMaskSnapshot is a no-op without a scene DOM (no snapshot, no history)', async () => {
    const state = useStore.getState()
    state.addMask({ id: 'm1', targetId: 'dev-1', shape: 'rectangle', x: 0, y: 0, width: 50, height: 50, points: [], inverted: true })
    await state.refreshMaskSnapshot('m1')
    expect(maskOf()[0].snapshot).toBeUndefined()
    expect(useStore.getState().undoStack.length).toBe(0)
  })

  it('refreshMaskSnapshot no-ops for an unknown mask id', async () => {
    const state = useStore.getState()
    await state.refreshMaskSnapshot('ghost')
    expect(useStore.getState().undoStack.length).toBe(0)
  })
})

describe('mask serialization', () => {
  beforeEach(() => {
    resetStore()
  })

  it('round-trips masks through serialize/deserialize', () => {
    const state = useStore.getState()
    state.addMask({ id: 'm1', targetId: 'dev-1', shape: 'ellipse', x: 10, y: 20, width: 90, height: 40, points: [], inverted: true })
    state.addMask({ id: 'm2', targetId: 'dev-2', shape: 'brush', x: 0, y: 0, width: 0, height: 0, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], inverted: false })

    const stateAfter = useStore.getState()
    const { manifest, assets } = serializeProject(
      { id: 'p1', name: 'P', createdAt: 0, updatedAt: 0 },
      stateAfter.scenes,
      stateAfter.activeSceneIndex
    )
    const parsed = JSON.parse(manifest) as { scenes: Array<{ masks?: unknown[] }> }
    expect(parsed.scenes[0].masks).toHaveLength(2)

    const { scenes } = deserializeProject(manifest, assets)
    const restored = scenes[0] as { masks?: unknown[] }
    expect(restored.masks).toHaveLength(2)
  })

  it('round-trips a frozen-mask snapshot through the asset walk', () => {
    const dataUrl = 'data:image/png;base64,AA=='
    const state = useStore.getState()
    state.addMask({
      id: 'm1',
      targetId: 'dev-1',
      shape: 'rectangle',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      points: [],
      inverted: true,
      snapshot: {
        dataUrl,
        width: 50,
        height: 50,
        sourceBounds: { x: 10, y: 20, width: 50, height: 50 },
        capturedAt: 99
      }
    })

    const stateAfter = useStore.getState()
    const { manifest, assets } = serializeProject(
      { id: 'p1', name: 'P', createdAt: 0, updatedAt: 0 },
      stateAfter.scenes,
      stateAfter.activeSceneIndex
    )

    // The snapshot data URL is extracted into the assets map and referenced.
    const parsed = JSON.parse(manifest) as { scenes: Array<{ masks: Array<{ snapshot: { dataUrl: string } }> }> }
    expect(parsed.scenes[0].masks[0].snapshot.dataUrl).toMatch(/^asset:\/\/img-\d+\.png$/)
    expect(assets.size).toBe(1)

    const { scenes } = deserializeProject(manifest, assets)
    const restored = scenes[0] as { masks?: Array<{ snapshot?: { dataUrl?: string; capturedAt?: number } }> }
    expect(restored.masks![0].snapshot?.dataUrl).toBe(dataUrl)
    expect(restored.masks![0].snapshot?.capturedAt).toBe(99)
  })

  it('defaults to an empty masks array when the file predates masks', () => {
    const { scenes } = deserializeProject(
      JSON.stringify({
        version: 1,
        project: { id: 'p', name: 'P', createdAt: 0, updatedAt: 0 },
        scenes: [{
          id: 's1', name: 'S', canvas: { width: 1440, height: 900, aspectRatio: '16:10' },
          background: {}, devices: [], textBoxes: [], images: [], titleText: {}, sloganText: {}, guides: [], grid: {}
        }],
        activeSceneIndex: 0
      }),
      new Map()
    )
    expect((scenes[0] as { masks?: unknown[] }).masks).toEqual([])
  })
})

describe('mask tool', () => {
  beforeEach(() => {
    resetStore()
  })

  it('is reachable, options-enabled and bound to G', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()
    expect(tool.id).toBe('mask')
    expect(tool.options).toBe(true)
    expect(tool.shortcut).toBe('g')
  })

  it('draws a rectangle mask in element-local coords with a live preview', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(300, 300), toolId: 'mask' }), evt({ clientX: 300, clientY: 300 }))
    expect(useRuntimeStore.getState().maskPreview).toMatchObject({ targetId: 'dev-1', shape: 'rectangle' })
    expect(useRuntimeStore.getState().activeInteraction?.toolId).toBe('mask')

    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(400, 350), toolId: 'mask' }), evt({ clientX: 400, clientY: 350 }))
    expect(useRuntimeStore.getState().maskPreview?.points).toEqual([point(300, 300), point(400, 350)])

    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(400, 350), toolId: 'mask' }), evt({ clientX: 400, clientY: 350 }))

    expect(useRuntimeStore.getState().maskPreview).toBeNull()
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
    expect(maskOf()).toHaveLength(1)
    expect(maskOf()[0]).toMatchObject({ targetId: 'dev-1', shape: 'rectangle', x: 200, y: 200, width: 100, height: 50, inverted: true })
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('re-drawing over the same element adds a second mask, keeping the first', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    const draw = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      tool.onPointerDown?.(manager.buildContext({ scenePoint: point(from.x, from.y), toolId: 'mask' }), evt({ clientX: from.x, clientY: from.y }))
      tool.onPointerMove?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
      tool.onPointerUp?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
    }

    draw(point(300, 300), point(400, 350))
    const firstId = maskOf()[0].id
    draw(point(500, 400), point(550, 450))

    expect(maskOf()).toHaveLength(2)
    expect(maskOf()[0].id).toBe(firstId)
    expect(maskOf()[0]).toMatchObject({ x: 200, y: 200, width: 100, height: 50 })
    expect(maskOf()[1].id).not.toBe(firstId)
    expect(maskOf()[1]).toMatchObject({ x: 400, y: 300, width: 50, height: 50 })
    expect(useStore.getState().undoStack.length).toBe(2)
  })

  it('draws an ellipse mask when the ellipse mode is active', () => {
    useRuntimeStore.getState().setMaskShape('ellipse')
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [], devices: [makeDevice({ id: 'dev-1', x: 0, y: 0, width: 600, height: 400 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(300, 200), toolId: 'mask' }), evt({ clientX: 300, clientY: 200 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(300, 200), toolId: 'mask' }), evt({ clientX: 300, clientY: 200 }))

    expect(maskOf()[0]).toMatchObject({ shape: 'ellipse', x: 100, y: 100, width: 200, height: 100 })
  })

  it('draws a brush mask from the recorded point cloud', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [], devices: [makeDevice({ id: 'dev-1', x: 0, y: 0, width: 600, height: 400 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()
    useRuntimeStore.getState().setMaskShape('brush')

    const pts = [point(100, 100), point(120, 100), point(140, 120), point(100, 140)]
    tool.onPointerDown?.(manager.buildContext({ scenePoint: pts[0], toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))
    for (const p of pts.slice(1)) {
      tool.onPointerMove?.(manager.buildContext({ scenePoint: p, toolId: 'mask' }), evt({ clientX: p.x, clientY: p.y }))
    }
    tool.onPointerUp?.(manager.buildContext({ scenePoint: pts[pts.length - 1], toolId: 'mask' }), evt({ clientX: 140, clientY: 140 }))

    const mask = maskOf()[0]
    expect(mask.shape).toBe('brush')
    expect(mask.points.length).toBeGreaterThanOrEqual(4)
    expect(mask).toMatchObject({ x: 88, y: 88 })
    expect(mask.x + mask.width).toBeLessThanOrEqual(152)
    expect(mask.y + mask.height).toBeLessThanOrEqual(152)
  })

  it('unmask mode on a target with no masks is a no-op (no mask, no history)', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })] }] })
    useRuntimeStore.getState().setMaskMode('unmask')
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(300, 300), toolId: 'mask' }), evt({ clientX: 300, clientY: 300 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(400, 350), toolId: 'mask' }), evt({ clientX: 400, clientY: 350 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(400, 350), toolId: 'mask' }), evt({ clientX: 400, clientY: 350 }))

    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(0)
  })

  it('unmask erases a partial stroke from an existing punch, leaving a brush mask with a hole', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    const draw = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      tool.onPointerDown?.(manager.buildContext({ scenePoint: point(from.x, from.y), toolId: 'mask' }), evt({ clientX: from.x, clientY: from.y }))
      tool.onPointerMove?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
      tool.onPointerUp?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
    }

    draw(point(300, 300), point(400, 350))
    const punchId = maskOf()[0].id
    expect(maskOf()[0]).toMatchObject({ shape: 'rectangle', inverted: true, x: 200, y: 200, width: 100, height: 50 })

    useRuntimeStore.getState().setMaskMode('unmask')
    draw(point(320, 310), point(350, 330))

    expect(maskOf()).toHaveLength(1)
    const mask = maskOf()[0]
    expect(mask.id).not.toBe(punchId)
    expect(mask).toMatchObject({ shape: 'brush', inverted: true, x: 200, y: 200, width: 100, height: 50 })
    expect(mask.holes).toHaveLength(1)
    expect(useStore.getState().undoStack.length).toBe(2)
  })

  it('unmask fully covering the punch removes the mask', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    const draw = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      tool.onPointerDown?.(manager.buildContext({ scenePoint: point(from.x, from.y), toolId: 'mask' }), evt({ clientX: from.x, clientY: from.y }))
      tool.onPointerMove?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
      tool.onPointerUp?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
    }

    draw(point(300, 300), point(400, 350))
    expect(maskOf()).toHaveLength(1)

    useRuntimeStore.getState().setMaskMode('unmask')
    draw(point(250, 250), point(450, 400))

    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(2)
  })

  it('unmask over a reveal mask kept shape removes the reveal entirely (recovery path)', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 100, y: 300, width: 600, height: 400 })] }] })
    useStore.getState().addMask({
      id: 'reveal',
      targetId: 'dev-1',
      shape: 'rectangle',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      points: [],
      inverted: false
    })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    useRuntimeStore.getState().setMaskMode('unmask')
    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(120, 320), toolId: 'mask' }), evt({ clientX: 120, clientY: 320 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(180, 360), toolId: 'mask' }), evt({ clientX: 180, clientY: 360 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(180, 360), toolId: 'mask' }), evt({ clientX: 180, clientY: 360 }))

    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('unmask over a reveal mask hidden frame also removes the reveal entirely', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 100, y: 300, width: 600, height: 400 })] }] })
    useStore.getState().addMask({
      id: 'reveal',
      targetId: 'dev-1',
      shape: 'rectangle',
      x: 10,
      y: 10,
      width: 50,
      height: 40,
      points: [],
      inverted: false
    })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    useRuntimeStore.getState().setMaskMode('unmask')
    // A stroke over the reveal's hidden frame (local ~460..520 x 30..60).
    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(560, 330), toolId: 'mask' }), evt({ clientX: 560, clientY: 330 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(620, 360), toolId: 'mask' }), evt({ clientX: 620, clientY: 360 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(620, 360), toolId: 'mask' }), evt({ clientX: 620, clientY: 360 }))

    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('unmask clears a whole-bounds punch instead of leaving a box-covering residual', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })] }] })
    // A full-box inverted mask (PropertiesPanel Add Mask + Reverse) hides the
    // entire element — the degenerate whole-canvas checkerboard state.
    useStore.getState().addMask({
      id: 'fullbox',
      targetId: 'dev-1',
      shape: 'rectangle',
      x: 0,
      y: 0,
      width: 600,
      height: 400,
      points: [],
      inverted: true
    })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    useRuntimeStore.getState().setMaskMode('unmask')
    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(300, 300), toolId: 'mask' }), evt({ clientX: 300, clientY: 300 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(350, 330), toolId: 'mask' }), evt({ clientX: 350, clientY: 330 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(350, 330), toolId: 'mask' }), evt({ clientX: 350, clientY: 330 }))

    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('brush unmask erases an interior carve, leaving a hole in the punch', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(300, 300), toolId: 'mask' }), evt({ clientX: 300, clientY: 300 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(400, 350), toolId: 'mask' }), evt({ clientX: 400, clientY: 350 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(400, 350), toolId: 'mask' }), evt({ clientX: 400, clientY: 350 }))

    useRuntimeStore.getState().setMaskShape('brush')
    useRuntimeStore.getState().setMaskMode('unmask')
    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(350, 325), toolId: 'mask' }), evt({ clientX: 350, clientY: 325 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(350, 325), toolId: 'mask' }), evt({ clientX: 350, clientY: 325 }))

    expect(maskOf()).toHaveLength(1)
    const mask = maskOf()[0]
    expect(mask.shape).toBe('brush')
    expect(mask.inverted).toBe(true)
    expect(mask.holes).toHaveLength(1)
    expect(useStore.getState().undoStack.length).toBe(2)
  })

  it('undo restores the exact pre-unmask scene', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    const draw = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      tool.onPointerDown?.(manager.buildContext({ scenePoint: point(from.x, from.y), toolId: 'mask' }), evt({ clientX: from.x, clientY: from.y }))
      tool.onPointerMove?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
      tool.onPointerUp?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
    }

    draw(point(300, 300), point(400, 350))
    useRuntimeStore.getState().setMaskMode('unmask')
    draw(point(320, 310), point(350, 330))
    expect(maskOf()[0].shape).toBe('brush')

    useStore.getState().undo()
    expect(maskOf()).toHaveLength(1)
    expect(maskOf()[0]).toMatchObject({ shape: 'rectangle', inverted: true, x: 200, y: 200, width: 100, height: 50 })

    useStore.getState().undo()
    expect(maskOf()).toHaveLength(0)

    useStore.getState().redo()
    useStore.getState().redo()
    expect(maskOf()[0].shape).toBe('brush')
  })

  it('ignores a click with no drag (sub-3px threshold)', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 0, y: 0, width: 600, height: 400 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(101, 101), toolId: 'mask' }), evt({ clientX: 101, clientY: 101 }))

    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(0)
  })

  it('rejects locked elements', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [], devices: [makeDevice({ id: 'dev-1', x: 0, y: 0, width: 600, height: 400, locked: true })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))

    expect(manager.getOwner(1)).toBeNull()
    expect(maskOf()).toHaveLength(0)
  })

  it('masks text boxes too', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [makeTextBox({ id: 'tb-1', x: 50, y: 50 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(150, 130), toolId: 'mask' }), evt({ clientX: 150, clientY: 130 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(150, 130), toolId: 'mask' }), evt({ clientX: 150, clientY: 130 }))

    expect(maskOf()).toHaveLength(1)
    expect(maskOf()[0]).toMatchObject({ targetId: 'tb-1', x: 50, y: 50, width: 50, height: 30 })
  })

  it('rejects masking an out-of-scope element while focused and clears selection', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [makeDevice({ id: 'dev-1', groupId: 'g-1' }), makeDevice({ id: 'dev-2' })],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-1'], parentGroupId: null }]
      }]
    })
    useRuntimeStore.getState().enterFocus('g-1')
    useStore.getState().select('dev-1')
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(400, 300), toolId: 'mask' }), evt({ clientX: 400, clientY: 300 }))

    expect(manager.getOwner(1)).toBeNull()
    expect(useStore.getState().selectedIds).toEqual([])
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
  })

  it('allows masking an in-scope element while focused', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [makeDevice({ id: 'dev-1', groupId: 'g-1', x: 100, y: 100, width: 600, height: 400 })],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-1'], parentGroupId: null }]
      }]
    })
    useRuntimeStore.getState().enterFocus('g-1')
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(300, 300), toolId: 'mask' }), evt({ clientX: 300, clientY: 300 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(400, 350), toolId: 'mask' }), evt({ clientX: 400, clientY: 400 }))

    expect(maskOf()).toHaveLength(1)
  })

  it('ignores non-primary buttons', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1' })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(300, 300), toolId: 'mask' }), evt({ button: 2 }))

    expect(manager.getOwner(1)).toBeNull()
    expect(maskOf()).toHaveLength(0)
  })

  it('pointer cancel clears preview with no commit', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 0, y: 0, width: 600, height: 400 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(200, 200), toolId: 'mask' }), evt({ clientX: 200, clientY: 200 }))
    tool.onPointerCancel?.(manager.buildContext({ scenePoint: point(200, 200), toolId: 'mask' }), evt({ clientX: 200, clientY: 200 }))

    expect(useRuntimeStore.getState().maskPreview).toBeNull()
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(0)
  })

  it('undo restores the exact pre-mask scene', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 0, y: 0, width: 600, height: 400 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(200, 150), toolId: 'mask' }), evt({ clientX: 200, clientY: 150 }))
    expect(maskOf()).toHaveLength(1)

    useStore.getState().undo()
    expect(maskOf()).toHaveLength(0)

    useStore.getState().redo()
    expect(maskOf()).toHaveLength(1)
  })

  it('stores local coords through inverse rotation', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400, rotation: 90 })] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(400, 300), toolId: 'mask' }), evt({ clientX: 400, clientY: 300 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(500, 400), toolId: 'mask' }), evt({ clientX: 500, clientY: 400 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(500, 400), toolId: 'mask' }), evt({ clientX: 500, clientY: 400 }))

    expect(maskOf()[0]).toMatchObject({ x: 300, y: 100, width: 100, height: 100 })
  })

  it('preview carries element geometry, mode and brush radius for the live checkerboard', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [], devices: [makeDevice({ id: 'dev-1', x: 100, y: 100, width: 600, height: 400, rotation: 30 })] }] })
    useRuntimeStore.getState().setMaskShape('brush')
    useRuntimeStore.getState().setMaskMode('mask')
    useRuntimeStore.getState().setBrush({ size: 40 })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(200, 200), toolId: 'mask' }), evt({ clientX: 200, clientY: 200 }))

    expect(useRuntimeStore.getState().maskPreview).toMatchObject({
      targetId: 'dev-1',
      shape: 'brush',
      inverted: true,
      radius: 20,
      element: { id: 'dev-1', x: 100, y: 100, width: 600, height: 400, rotation: 30 }
    })

    tool.onPointerCancel?.(manager.buildContext({ scenePoint: point(200, 200), toolId: 'mask' }), evt({ clientX: 200, clientY: 200 }))
    expect(useRuntimeStore.getState().maskPreview).toBeNull()
  })

  it('a single brush click commits a circular dot', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [], devices: [makeDevice({ id: 'dev-1', x: 0, y: 0, width: 600, height: 400 })] }] })
    useRuntimeStore.getState().setMaskShape('brush')
    useRuntimeStore.getState().setBrush({ size: 24 })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))

    const mask = maskOf()[0]
    expect(mask).toBeTruthy()
    expect(mask.shape).toBe('brush')
    expect(mask.points).toHaveLength(24)
    expect(mask).toMatchObject({ x: 88, y: 88, width: 24, height: 24 })
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('brush-paints a background mask on empty canvas like the normal brush', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [], devices: [] }] })
    useRuntimeStore.getState().setMaskShape('brush')
    useRuntimeStore.getState().setBrush({ size: 24 })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))
    expect(useRuntimeStore.getState().maskPreview).toMatchObject({
      targetId: BACKGROUND_MASK_TARGET_ID,
      shape: 'brush',
      element: { id: BACKGROUND_MASK_TARGET_ID, x: 0, y: 0, width: 1280, height: 720, rotation: 0 }
    })
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))

    const mask = maskOf()[0]
    expect(mask).toBeTruthy()
    expect(mask.targetId).toBe(BACKGROUND_MASK_TARGET_ID)
    expect(mask.shape).toBe('brush')
    expect(mask.points).toHaveLength(24)
    expect(mask).toMatchObject({ x: 88, y: 88, width: 24, height: 24 })
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('draws a rectangle background mask on empty canvas', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [], devices: [] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(300, 200), toolId: 'mask' }), evt({ clientX: 300, clientY: 200 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(300, 200), toolId: 'mask' }), evt({ clientX: 300, clientY: 200 }))

    expect(maskOf()[0]).toMatchObject({ targetId: BACKGROUND_MASK_TARGET_ID, shape: 'rectangle', x: 100, y: 100, width: 200, height: 100, inverted: true })
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('unmask mode erases an existing background mask', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [], devices: [] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    const draw = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      tool.onPointerDown?.(manager.buildContext({ scenePoint: point(from.x, from.y), toolId: 'mask' }), evt({ clientX: from.x, clientY: from.y }))
      tool.onPointerMove?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
      tool.onPointerUp?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
    }

    draw(point(100, 100), point(300, 200))
    expect(maskOf()[0]).toMatchObject({ targetId: BACKGROUND_MASK_TARGET_ID, inverted: true, x: 100, y: 100, width: 200, height: 100 })

    useRuntimeStore.getState().setMaskMode('unmask')
    draw(point(150, 150), point(200, 180))

    expect(maskOf()).toHaveLength(1)
    const mask = maskOf()[0]
    expect(mask.targetId).toBe(BACKGROUND_MASK_TARGET_ID)
    expect(mask).toMatchObject({ shape: 'brush', inverted: true, x: 100, y: 100, width: 200, height: 100 })
    expect(mask.holes).toHaveLength(1)
    expect(useStore.getState().undoStack.length).toBe(2)
  })

  it('unmask mode on an unmasked background is a no-op', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [], devices: [] }] })
    useRuntimeStore.getState().setMaskMode('unmask')
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(300, 200), toolId: 'mask' }), evt({ clientX: 300, clientY: 200 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(300, 200), toolId: 'mask' }), evt({ clientX: 300, clientY: 200 }))

    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(0)
  })

  it('re-painting the background adds a second background mask, keeping the first', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [], devices: [] }] })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    const draw = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      tool.onPointerDown?.(manager.buildContext({ scenePoint: point(from.x, from.y), toolId: 'mask' }), evt({ clientX: from.x, clientY: from.y }))
      tool.onPointerMove?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
      tool.onPointerUp?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
    }

    draw(point(100, 100), point(300, 200))
    const firstId = maskOf()[0].id
    draw(point(400, 400), point(500, 450))

    expect(maskOf()).toHaveLength(2)
    expect(maskOf()[0].id).toBe(firstId)
    expect(maskOf()[0]).toMatchObject({ x: 100, y: 100, width: 200, height: 100 })
    expect(maskOf()[1].id).not.toBe(firstId)
    expect(maskOf()[1]).toMatchObject({ x: 400, y: 400, width: 100, height: 50 })
  })

  it('blocks background painting on empty canvas while focused', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        textBoxes: [],
        devices: [makeDevice({ id: 'dev-1', groupId: 'g-1' })],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-1'], parentGroupId: null }]
      }]
    })
    useRuntimeStore.getState().enterFocus('g-1')
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(800, 600), toolId: 'mask' }), evt({ clientX: 800, clientY: 600 }))

    expect(manager.getOwner(1)).toBeNull()
    expect(maskOf()).toHaveLength(0)
  })
})
