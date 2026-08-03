/**
 * Mask layer redesign — clip-path builders, mask slice CRUD, serialization and
 * the Mask tool driven through the real tool manager + document/runtime stores
 * (no rasterization involved, so no mocks needed).
 *
 * Masks are first-class SCENE layers: scene-space geometry, no element
 * targeting, and their own `name`/`zIndex`/`visible`/`locked` layer fields.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { createToolManager, toolRegistry } from '../renderer/tools'
import { buildFocusDimPunch, buildMaskClipPath, buildSceneDimPunch, collectMaskVisuals, unionDimBoxes } from '../renderer/services/mask-visualization'
import { pointInRegion, regionArea } from '../renderer/services/polygon-clip'
import { nextMaskZIndex } from '../renderer/store/maskSlice'
import { serializeProject, deserializeProject } from '../renderer/lib/project-serialization'
import { resetStore, makeDevice } from './helpers'
import type { Mask, Scene } from '@shared/types'

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

/** A well-formed scene-layer rectangle mask fixture. */
function rectMask(id: string, overrides: Partial<Mask> = {}): Mask {
  return {
    id,
    name: `Mask ${id}`,
    shape: 'rectangle',
    x: 20,
    y: 30,
    width: 100,
    height: 50,
    points: [],
    inverted: false,
    zIndex: 0,
    visible: true,
    locked: false,
    ...overrides
  }
}

describe('buildMaskClipPath', () => {
  it('builds an inset() clip for a rectangle mask', () => {
    const clip = buildMaskClipPath(rectMask('m', { x: 20, y: 30, width: 100, height: 50 }), 200, 100)
    expect(clip).toBe('inset(30px 80px 20px 20px)')
  })

  it('punches a rectangle via an opposite-wound path()', () => {
    const clip = buildMaskClipPath(rectMask('m', { x: 20, y: 30, width: 100, height: 50, inverted: true }), 200, 100)
    expect(clip).toBe("path('M 0 0 L 200 0 L 200 100 L 0 100 Z M 20 80 L 120 80 L 120 30 L 20 30 Z')")
  })

  it('builds an ellipse() clip centered on the mask box', () => {
    const clip = buildMaskClipPath(rectMask('m', { shape: 'ellipse', x: 0, y: 0, width: 200, height: 100 }), 200, 100)
    expect(clip).toBe('ellipse(100px 50px at 100px 50px)')
  })

  it('approximates an inverted ellipse hole with a 32-point polygon', () => {
    const clip = buildMaskClipPath(rectMask('m', { shape: 'ellipse', x: 0, y: 0, width: 200, height: 100, inverted: true }), 200, 100)
    const coords = clip.match(/-?\d+(?:\.\d+)? -?\d+(?:\.\d+)?/g) ?? []
    expect(coords).toHaveLength(4 + 32)
  })

  it('builds a polygon() clip from brush points', () => {
    const clip = buildMaskClipPath(
      rectMask('m', { shape: 'brush', x: 0, y: 0, width: 0, height: 0, points: [{ x: 5, y: 5 }, { x: 50, y: 5 }, { x: 25, y: 40 }] }),
      200,
      100
    )
    expect(clip).toBe('polygon(5px 5px, 50px 5px, 25px 40px)')
  })

  it('punches a brush mask via an opposite-wound path()', () => {
    const clip = buildMaskClipPath(
      rectMask('m', { shape: 'brush', x: 0, y: 0, width: 0, height: 0, points: [{ x: 5, y: 5 }, { x: 50, y: 5 }], inverted: true }),
      200,
      100
    )
    expect(clip).toBe("path('M 0 0 L 200 0 L 200 100 L 0 100 Z M 50 5 L 5 5 Z')")
  })
})

describe('buildSceneDimPunch', () => {
  it('builds a full-canvas nonzero scrim punched out by the target box', () => {
    const clip = buildSceneDimPunch(1280, 720, 100, 100, 200, 80, 0)
    expect(clip).toBe(
      "path('M 0 0 L 1280 0 L 1280 720 L 0 720 Z M 100 180 L 300 180 L 300 100 L 100 100 Z')"
    )
  })

  it('returns null for a degenerate canvas', () => {
    expect(buildSceneDimPunch(0, 720, 0, 0, 10, 10, 0)).toBeNull()
    expect(buildSceneDimPunch(1280, 0, 0, 0, 10, 10, 0)).toBeNull()
  })
})

describe('buildFocusDimPunch', () => {
  it('punches every member box as its own contour (no union ribbon)', () => {
    const clip = buildFocusDimPunch(500, 300, [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 300, y: 200, width: 50, height: 50 }
    ])
    expect(clip).toBe(
      "path('M 0 0 L 500 0 L 500 300 L 0 300 Z " +
        'M 0 100 L 100 100 L 100 0 L 0 0 Z ' +
        'M 300 250 L 350 250 L 350 200 L 300 200 Z\')'
    )
  })

  it('punches rotated member boxes at their rotated corners', () => {
    const clip = buildFocusDimPunch(200, 200, [{ x: 0, y: 0, width: 200, height: 100, rotation: 90 }])
    expect(clip).toBe(
      "path('M 0 0 L 200 0 L 200 200 L 0 200 Z M 50 -50 L 50 150 L 150 150 L 150 -50 Z')"
    )
  })

  it('returns null without boxes or on a degenerate canvas', () => {
    expect(buildFocusDimPunch(200, 200, [])).toBeNull()
    expect(buildFocusDimPunch(0, 200, [{ x: 0, y: 0, width: 10, height: 10 }])).toBeNull()
  })
})

describe('unionDimBoxes', () => {
  const p = (x: number, y: number) => ({ x, y })
  const area = (regions: { outer: { x: number; y: number }[]; holes: { x: number; y: number }[][] }[]) =>
    regions.reduce((sum, r) => sum + regionArea(r), 0)

  it('unions overlapping boxes into interior-disjoint regions (no evenodd XOR)', () => {
    const regions = unionDimBoxes([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 50, width: 100, height: 100 }
    ])
    expect(area(regions)).toBeCloseTo(17500, 0)
    const inCount = (pt: { x: number; y: number }) => regions.filter((r) => pointInRegion(pt, [r.outer])).length
    expect(inCount(p(10, 10))).toBe(1) // box1-only lobe
    expect(inCount(p(75, 75))).toBe(1) // overlap region
    expect(inCount(p(125, 125))).toBe(1) // box2-only lobe
    expect(inCount(p(75, 140))).toBe(1) // box2 bottom strip
    expect(inCount(p(200, 200))).toBe(0) // outside
  })

  it('drops a member box fully contained by an earlier one (container + child)', () => {
    const regions = unionDimBoxes([
      { x: 0, y: 0, width: 200, height: 150 },
      { x: 40, y: 30, width: 80, height: 60 }
    ])
    expect(regions).toHaveLength(1)
    expect(area(regions)).toBeCloseTo(30000, 0)
  })

  it('emits a single-box contour when children are fully inside their container', () => {
    const clip = buildFocusDimPunch(400, 400, [
      { x: 0, y: 0, width: 200, height: 150 },
      { x: 40, y: 30, width: 80, height: 60 }
    ])
    expect(clip).toBe(
      "path('M 0 0 L 400 0 L 400 400 L 0 400 Z M 0 150 L 200 150 L 200 0 L 0 0 Z')"
    )
  })
})

describe('collectMaskVisuals', () => {
  beforeEach(() => {
    resetStore()
  })

  it('resolves every visible mask to a full-canvas scene-space visual sorted by zIndex', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        masks: [
          rectMask('m1', { x: 40, y: 40, width: 200, height: 120, zIndex: 2 }),
          rectMask('m2', { x: 10, y: 10, width: 50, height: 50, inverted: true, zIndex: 0 })
        ]
      }]
    })

    const visuals = collectMaskVisuals(useStore.getState().scenes[0])
    expect(visuals.map((v) => v.maskId)).toEqual(['m2', 'm1'])
    expect(visuals[0]).toMatchObject({
      maskId: 'm2',
      origin: { x: 0, y: 0 },
      width: scene.canvas.width,
      height: scene.canvas.height,
      rotation: 0,
      zIndex: 0
    })
    expect(visuals[0].items[0]).toMatchObject({
      maskId: 'm2',
      shape: 'rectangle',
      inverted: true,
      rect: { x: 10, y: 10, width: 50, height: 50 }
    })
    expect(visuals[0].items[0].hiddenClipPath).toBe('inset(10px 1220px 660px 10px)')
    expect(visuals[0].items[0].visibleClipPath).toBe("path('M 0 0 L 1280 0 L 1280 720 L 0 720 Z M 10 60 L 60 60 L 60 10 L 10 10 Z')")
  })

  it('carries brush points through the visual items', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        masks: [
          rectMask('mb', { shape: 'brush', x: 0, y: 0, width: 0, height: 0, points: [{ x: 5, y: 5 }, { x: 50, y: 5 }, { x: 25, y: 40 }] })
        ]
      }]
    })

    const visual = collectMaskVisuals(useStore.getState().scenes[0])[0]
    expect(visual.items[0].points).toEqual([{ x: 5, y: 5 }, { x: 50, y: 5 }, { x: 25, y: 40 }])
    expect(visual.items[0].visibleClipPath).toBe('polygon(5px 5px, 50px 5px, 25px 40px)')
  })

  it('skips invisible masks', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        masks: [rectMask('m1'), rectMask('m2', { visible: false })]
      }]
    })

    const visuals = collectMaskVisuals(useStore.getState().scenes[0])
    expect(visuals.map((v) => v.maskId)).toEqual(['m1'])
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
        masks: [rectMask('mfrozen', { inverted: true, snapshot }), rectMask('mlive')]
      }]
    })

    const visuals = collectMaskVisuals(useStore.getState().scenes[0])
    expect(visuals.map((v) => v.maskId)).toEqual(['mlive'])
  })

  it('filters by ids via options while still skipping invisible masks', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        masks: [rectMask('m1'), rectMask('m2'), rectMask('m3', { visible: false })]
      }]
    })

    const visuals = collectMaskVisuals(useStore.getState().scenes[0], { targets: 'ids', ids: ['m1', 'm2', 'm3'] })
    expect(visuals.map((v) => v.maskId)).toEqual(['m1', 'm2'])
  })
})

describe('maskSlice', () => {
  beforeEach(() => {
    resetStore()
  })

  it('addMask appends to the active scene', () => {
    const m = rectMask('m1')
    useStore.getState().addMask(m)
    expect(maskOf()).toEqual([m])
  })

  it('updateMask merges a partial patch', () => {
    const state = useStore.getState()
    state.addMask(rectMask('m1'))
    state.updateMask('m1', { width: 80, inverted: true })
    expect(maskOf()[0]).toMatchObject({ width: 80, inverted: true, name: 'Mask m1', zIndex: 0 })
  })

  it('removeMask deletes by id', () => {
    const state = useStore.getState()
    state.addMask(rectMask('m1'))
    state.addMask(rectMask('m2', { shape: 'ellipse' }))
    state.removeMask('m1')
    expect(maskOf().map((m) => m.id)).toEqual(['m2'])
  })

  it('reverseMask toggles the inverted flag', () => {
    const state = useStore.getState()
    state.addMask(rectMask('m1'))
    state.reverseMask('m1')
    expect(maskOf()[0].inverted).toBe(true)
    state.reverseMask('m1')
    expect(maskOf()[0].inverted).toBe(false)
  })

  it('replaceMasks swaps the whole active scene mask list', () => {
    const state = useStore.getState()
    state.addMask(rectMask('m1'))
    state.replaceMasks([rectMask('m2'), rectMask('m3')])
    expect(maskOf().map((m) => m.id)).toEqual(['m2', 'm3'])
  })

  it('clearAllMasks removes every mask in the active scene', () => {
    const state = useStore.getState()
    state.addMask(rectMask('m1'))
    state.addMask(rectMask('m2', { inverted: true }))
    state.addMask(rectMask('m3', { shape: 'ellipse' }))
    state.clearAllMasks()
    expect(maskOf()).toEqual([])
  })

  it('nextMaskZIndex is the max element/mask z plus one', () => {
    const scene = useStore.getState().scenes[0]
    const busy: Scene = {
      ...scene,
      devices: [makeDevice({ id: 'd', zIndex: 3 })],
      textBoxes: [],
      images: [],
      shapes: [],
      masks: [rectMask('m1', { zIndex: 5 })]
    }
    expect(nextMaskZIndex(busy)).toBe(6)
  })

  it('nextMaskZIndex is 0 for an empty scene', () => {
    const scene = useStore.getState().scenes[0]
    const empty: Scene = { ...scene, devices: [], textBoxes: [], images: [], shapes: [], masks: [] }
    expect(nextMaskZIndex(empty)).toBe(0)
  })

  it('refreshMaskSnapshot is a no-op without a scene DOM (no snapshot, no history)', async () => {
    const state = useStore.getState()
    state.addMask(rectMask('m1', { inverted: true }))
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
    state.addMask(rectMask('m1', { shape: 'ellipse', x: 10, y: 20, width: 90, height: 40, inverted: true, zIndex: 2 }))
    state.addMask(rectMask('m2', { shape: 'brush', x: 0, y: 0, width: 0, height: 0, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], name: 'Doodle', zIndex: 3 }))

    const stateAfter = useStore.getState()
    const { manifest, assets } = serializeProject(
      { id: 'p1', name: 'P', createdAt: 0, updatedAt: 0 },
      stateAfter.scenes,
      stateAfter.activeSceneIndex
    )
    const parsed = JSON.parse(manifest) as { scenes: Array<{ masks?: unknown[] }> }
    expect(parsed.scenes[0].masks).toHaveLength(2)

    const { scenes } = deserializeProject(manifest, assets)
    const restored = scenes[0] as { masks: Mask[] }
    expect(restored.masks).toHaveLength(2)
    expect(restored.masks[0]).toMatchObject({ shape: 'ellipse', x: 10, y: 20, inverted: true, zIndex: 2, name: 'Mask m1' })
    expect(restored.masks[1]).toMatchObject({ shape: 'brush', name: 'Doodle', zIndex: 3, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] })
  })

  it('round-trips a frozen-mask snapshot through the asset walk', () => {
    const dataUrl = 'data:image/png;base64,AA=='
    const state = useStore.getState()
    state.addMask(
      rectMask('m1', {
        inverted: true,
        snapshot: {
          dataUrl,
          width: 50,
          height: 50,
          sourceBounds: { x: 10, y: 20, width: 50, height: 50 },
          capturedAt: 99
        }
      })
    )

    const stateAfter = useStore.getState()
    const { manifest, assets } = serializeProject(
      { id: 'p1', name: 'P', createdAt: 0, updatedAt: 0 },
      stateAfter.scenes,
      stateAfter.activeSceneIndex
    )

    const parsed = JSON.parse(manifest) as { scenes: Array<{ masks: Array<{ snapshot: { dataUrl: string } }> }> }
    expect(parsed.scenes[0].masks[0].snapshot.dataUrl).toMatch(/^asset:\/\/img-\d+\.png$/)
    expect(assets.size).toBe(1)

    const { scenes } = deserializeProject(manifest, assets)
    const restored = scenes[0] as { masks: Array<{ snapshot?: { dataUrl?: string; capturedAt?: number } }> }
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

  /** Clears the hero text boxes so mask z-indexes are deterministic (0, 1, …). */
  function blankScene() {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [], devices: [] }] })
  }

  function draw(manager: ReturnType<typeof createToolManager>, tool: NonNullable<ReturnType<typeof createToolManager>['getActiveTool']>, from: { x: number; y: number }, to: { x: number; y: number }) {
    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(from.x, from.y), toolId: 'mask' }), evt({ clientX: from.x, clientY: from.y }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(to.x, to.y), toolId: 'mask' }), evt({ clientX: to.x, clientY: to.y }))
  }

  it('is reachable, options-enabled and bound to G', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()
    expect(tool.id).toBe('mask')
    expect(tool.options).toBe(true)
    expect(tool.shortcut).toBe('g')
  })

  it('draws a rectangle mask in scene coords with a live preview', () => {
    blankScene()
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(300, 300), toolId: 'mask' }), evt({ clientX: 300, clientY: 300 }))
    expect(useRuntimeStore.getState().maskPreview).toMatchObject({ shape: 'rectangle', inverted: true })
    expect(useRuntimeStore.getState().maskPreview?.points).toEqual([point(300, 300), point(300, 300)])
    expect(useRuntimeStore.getState().activeInteraction?.toolId).toBe('mask')

    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(400, 350), toolId: 'mask' }), evt({ clientX: 400, clientY: 350 }))
    expect(useRuntimeStore.getState().maskPreview?.points).toEqual([point(300, 300), point(400, 350)])

    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(400, 350), toolId: 'mask' }), evt({ clientX: 400, clientY: 350 }))

    expect(useRuntimeStore.getState().maskPreview).toBeNull()
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
    expect(maskOf()).toHaveLength(1)
    expect(maskOf()[0]).toMatchObject({
      name: 'Mask 1',
      shape: 'rectangle',
      x: 300,
      y: 300,
      width: 100,
      height: 50,
      inverted: true,
      zIndex: 0,
      visible: true,
      locked: false
    })
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('re-drawing adds a second mask, keeping the first', () => {
    blankScene()
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    draw(manager, tool, point(300, 300), point(400, 350))
    const firstId = maskOf()[0].id
    draw(manager, tool, point(500, 400), point(550, 450))

    expect(maskOf()).toHaveLength(2)
    expect(maskOf()[0].id).toBe(firstId)
    expect(maskOf()[0]).toMatchObject({ name: 'Mask 1', x: 300, y: 300, width: 100, height: 50, zIndex: 0 })
    expect(maskOf()[1]).toMatchObject({ name: 'Mask 2', x: 500, y: 400, width: 50, height: 50, zIndex: 1 })
    expect(useStore.getState().undoStack.length).toBe(2)
  })

  it('draws an ellipse mask when the ellipse mode is active', () => {
    blankScene()
    useRuntimeStore.getState().setMaskShape('ellipse')
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(300, 200), toolId: 'mask' }), evt({ clientX: 300, clientY: 200 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(300, 200), toolId: 'mask' }), evt({ clientX: 300, clientY: 200 }))

    expect(maskOf()[0]).toMatchObject({ shape: 'ellipse', x: 100, y: 100, width: 200, height: 100, inverted: true })
  })

  it('draws a brush mask from the recorded point cloud', () => {
    blankScene()
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

  it('unmask mode with no masks is a no-op (no mask, no history)', () => {
    blankScene()
    useRuntimeStore.getState().setMaskMode('unmask')
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    draw(manager, tool, point(300, 300), point(400, 350))

    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(0)
  })

  it('unmask erases a partial stroke from an existing punch, leaving a brush mask with a hole', () => {
    blankScene()
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    draw(manager, tool, point(300, 300), point(400, 350))
    const punchId = maskOf()[0].id
    expect(maskOf()[0]).toMatchObject({ shape: 'rectangle', inverted: true, x: 300, y: 300, width: 100, height: 50 })

    useRuntimeStore.getState().setMaskMode('unmask')
    draw(manager, tool, point(320, 310), point(350, 330))

    expect(maskOf()).toHaveLength(1)
    const mask = maskOf()[0]
    expect(mask.id).not.toBe(punchId)
    expect(mask).toMatchObject({ name: 'Mask 1', shape: 'brush', inverted: true, x: 300, y: 300, width: 100, height: 50, zIndex: 0 })
    expect(mask.holes).toHaveLength(1)
    expect(useStore.getState().undoStack.length).toBe(2)
  })

  it('unmask fully covering the punch removes the mask', () => {
    blankScene()
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    draw(manager, tool, point(300, 300), point(400, 350))
    expect(maskOf()).toHaveLength(1)

    useRuntimeStore.getState().setMaskMode('unmask')
    draw(manager, tool, point(250, 250), point(450, 400))

    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(2)
  })

  it('unmask over a reveal mask kept shape removes the reveal entirely (recovery path)', () => {
    blankScene()
    useStore.getState().addMask(rectMask('reveal', { x: 300, y: 300, width: 100, height: 50 }))
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    useRuntimeStore.getState().setMaskMode('unmask')
    draw(manager, tool, point(320, 310), point(350, 330))

    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('unmask over a reveal mask hidden frame also removes the reveal entirely', () => {
    blankScene()
    useStore.getState().addMask(rectMask('reveal', { x: 300, y: 300, width: 100, height: 50 }))
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    useRuntimeStore.getState().setMaskMode('unmask')
    // A stroke far from the kept shape lands on the reveal's hidden frame
    // (the whole-canvas checkerboard) — still a clear "remove it" gesture.
    draw(manager, tool, point(600, 600), point(650, 650))

    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('unmask clears a whole-canvas punch instead of leaving a box-covering residual', () => {
    blankScene()
    // A full-canvas inverted mask (PropertiesPanel Add Mask + Reverse) hides the
    // entire canvas — the degenerate whole-canvas checkerboard state.
    useStore.getState().addMask(rectMask('fullbox', { x: 0, y: 0, width: 1280, height: 720, inverted: true }))
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    useRuntimeStore.getState().setMaskMode('unmask')
    draw(manager, tool, point(300, 300), point(350, 330))

    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('brush unmask erases an interior carve, leaving a hole in the punch', () => {
    blankScene()
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    draw(manager, tool, point(300, 300), point(400, 350))

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

  it('unmask leaves locked and invisible masks untouched', () => {
    blankScene()
    useStore.getState().addMask(rectMask('locked', { x: 300, y: 300, width: 100, height: 50, inverted: true, locked: true }))
    useStore.getState().addMask(rectMask('hidden', { x: 500, y: 500, width: 100, height: 50, inverted: true, visible: false }))
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    useRuntimeStore.getState().setMaskMode('unmask')
    draw(manager, tool, point(250, 250), point(650, 600))

    expect(maskOf().map((m) => m.id)).toEqual(['locked', 'hidden'])
    expect(useStore.getState().undoStack.length).toBe(0)
  })

  it('undo restores the exact pre-unmask scene', () => {
    blankScene()
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    draw(manager, tool, point(300, 300), point(400, 350))
    useRuntimeStore.getState().setMaskMode('unmask')
    draw(manager, tool, point(320, 310), point(350, 330))
    expect(maskOf()[0].shape).toBe('brush')

    useStore.getState().undo()
    expect(maskOf()).toHaveLength(1)
    expect(maskOf()[0]).toMatchObject({ shape: 'rectangle', inverted: true, x: 300, y: 300, width: 100, height: 50 })

    useStore.getState().undo()
    expect(maskOf()).toHaveLength(0)

    useStore.getState().redo()
    useStore.getState().redo()
    expect(maskOf()[0].shape).toBe('brush')
  })

  it('ignores a click with no drag (sub-3px threshold)', () => {
    blankScene()
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt({ clientX: 100, clientY: 100 }))
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(101, 101), toolId: 'mask' }), evt({ clientX: 101, clientY: 101 }))

    expect(maskOf()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(0)
  })

  it('ignores non-primary buttons', () => {
    blankScene()
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(300, 300), toolId: 'mask' }), evt({ button: 2 }))

    expect(manager.getOwner(1)).toBeNull()
    expect(maskOf()).toHaveLength(0)
  })

  it('pointer cancel clears preview with no commit', () => {
    blankScene()
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
    blankScene()
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

  it('preview carries shape, mode and brush radius for the live checkerboard', () => {
    blankScene()
    useRuntimeStore.getState().setMaskShape('brush')
    useRuntimeStore.getState().setMaskMode('mask')
    useRuntimeStore.getState().setBrush({ size: 40 })
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()

    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(200, 200), toolId: 'mask' }), evt({ clientX: 200, clientY: 200 }))

    expect(useRuntimeStore.getState().maskPreview).toMatchObject({
      shape: 'brush',
      inverted: true,
      radius: 20
    })
    expect(useRuntimeStore.getState().maskPreview?.points?.[0]).toEqual(point(200, 200))

    tool.onPointerCancel?.(manager.buildContext({ scenePoint: point(200, 200), toolId: 'mask' }), evt({ clientX: 200, clientY: 200 }))
    expect(useRuntimeStore.getState().maskPreview).toBeNull()
  })

  it('a single brush click commits a circular dot', () => {
    blankScene()
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
    expect(mask).toMatchObject({ name: 'Mask 1', x: 88, y: 88, width: 24, height: 24 })
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('drawing is not gated by focus scope (masks are scene layers, not element-scoped)', () => {
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

    draw(manager, tool, point(300, 300), point(400, 350))

    expect(maskOf()).toHaveLength(1)
    expect(useStore.getState().undoStack.length).toBe(1)
  })
})
