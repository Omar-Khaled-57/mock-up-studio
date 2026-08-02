/**
 * MaskOverlay — the checkerboard transparency visualization for masks.
 *
 * Renders as a sibling overlay (never inside `[data-scene-export]`), in scene
 * coordinates: one dark/blue checkerboard layer per mask clipped to the masked
 * region, plus a live stroke preview + focus scrim + mode badge while editing.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useStore } from '../renderer/store'
import { resetStore, makeDevice, makeShape } from './helpers'
import { collectMaskVisuals, buildMaskClipPath, BACKGROUND_MASK_TARGET_ID } from '../renderer/services/mask-visualization'
import { MaskOverlay, CHECKER_DARK, CHECKER_BLUE, CHECKER_SIZE } from '../renderer/components/masks/MaskRenderer'
import { MaskPreviewState } from '../renderer/runtime/runtimeSlice'
import { createToolManager, toolRegistry } from '../renderer/tools'
import Scene from '../renderer/components/canvas/Scene'

function preview(overrides?: Partial<MaskPreviewState>): MaskPreviewState {
  return {
    targetId: 'dev-1',
    shape: 'rectangle',
    points: [
      { x: 60, y: 60 },
      { x: 160, y: 110 }
    ],
    element: { id: 'dev-1', x: 20, y: 30, width: 200, height: 120, rotation: 0 },
    inverted: false,
    ...overrides
  }
}

describe('MaskOverlay checkerboard', () => {
  beforeEach(() => {
    resetStore()
  })

  it('exports the checkerboard color contract (black + blue, 64x64 cells)', () => {
    expect(CHECKER_DARK).toBe('#000000')
    expect(CHECKER_BLUE).toBe('#2563eb')
    expect(CHECKER_DARK).not.toBe(CHECKER_BLUE)
    expect(CHECKER_SIZE).toBe(64)
  })

  it('renders one checkerboard layer per committed mask, clipped to the masked region', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [makeDevice({ id: 'dev-1', x: 20, y: 30, width: 200, height: 120 }), makeDevice({ id: 'dev-2', visible: false })],
        masks: [
          { id: 'm1', targetId: 'dev-1', shape: 'rectangle', x: 10, y: 10, width: 60, height: 40, points: [], inverted: false },
          { id: 'm2', targetId: 'ghost', shape: 'rectangle', x: 0, y: 0, width: 1, height: 1, points: [], inverted: false }
        ]
      }]
    })

    const visuals = collectMaskVisuals(useStore.getState().scenes[0])
    const { container } = render(<MaskOverlay width={400} height={300} visuals={visuals} preview={null} />)

    expect(container.querySelector('[data-mask-overlay]')).not.toBeNull()
    const visual = container.querySelector('[data-mask-visual]') as HTMLElement | null
    expect(visual).not.toBeNull()
    expect(visual!.getAttribute('data-mask-element-id')).toBe('dev-1')
    expect(visual!.style.left).toBe('20px')
    expect(visual!.style.top).toBe('30px')

    const checkers = Array.from(container.querySelectorAll('[data-mask-checkerboard]')) as HTMLElement[]
    expect(checkers).toHaveLength(1)
    expect(checkers[0].getAttribute('data-mask-checker-for')).toBe('m1')
    expect(checkers[0].getAttribute('style')).toContain('repeating-conic-gradient')
    expect(checkers[0].style.backgroundSize).toBe(`${CHECKER_SIZE * 2}px ${CHECKER_SIZE * 2}px`)

    expect(container.querySelector('[data-mask-edit-dim]')).toBeNull()
    expect(container.querySelector('[data-mask-edit-badge]')).toBeNull()
    expect(container.querySelector('[data-mask-preview]')).toBeNull()
  })

  it('rotates the checkerboard with a rotated target and positions from the scene origin', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [makeDevice({ id: 'dev-1', x: 40, y: 50, width: 200, height: 120, rotation: 45 })],
        masks: [
          { id: 'm1', targetId: 'dev-1', shape: 'ellipse', x: 5, y: 10, width: 80, height: 40, points: [], inverted: false }
        ]
      }]
    })

    const visuals = collectMaskVisuals(useStore.getState().scenes[0])
    const { container } = render(<MaskOverlay width={400} height={300} visuals={visuals} preview={null} />)

    const visual = container.querySelector('[data-mask-visual]') as HTMLElement | null
    expect(visual).not.toBeNull()
    expect(visual!.getAttribute('data-mask-element-id')).toBe('dev-1')
    expect(visual!.style.left).toBe('40px')
    expect(visual!.style.top).toBe('50px')
    expect(visual!.style.transform).toContain('rotate(45deg)')
  })

  it('renders the focus scrim, badge and live restore preview while unmasking (no checkerboard)', () => {
    const { container } = render(<MaskOverlay width={400} height={300} visuals={[]} preview={preview()} />)

    const dim = container.querySelector('[data-mask-edit-dim]') as HTMLElement | null
    expect(dim).not.toBeNull()
    expect(dim!.getAttribute('data-mask-edit-target')).toBe('dev-1')

    const badge = container.querySelector('[data-mask-edit-badge]') as HTMLElement | null
    expect(badge).not.toBeNull()
    expect(badge!.textContent).toContain('Unmask')

    const pv = container.querySelector('[data-mask-preview]') as HTMLElement | null
    expect(pv).not.toBeNull()
    expect(pv!.getAttribute('data-mask-preview-target')).toBe('dev-1')
    expect(container.querySelector('[data-mask-preview-checkerboard]')).toBeNull()
    expect(container.querySelector('[data-mask-preview-highlight]')).not.toBeNull()
    expect(container.querySelector('[data-mask-preview] svg rect')).not.toBeNull()
  })

  it('renders a checkerboard preview while masking (inverted)', () => {
    const { container } = render(<MaskOverlay width={400} height={300} visuals={[]} preview={preview({ inverted: true })} />)
    expect(container.querySelector('[data-mask-preview-checkerboard]')).not.toBeNull()
    expect(container.querySelector('[data-mask-preview-highlight]')).not.toBeNull()
  })

  it('labels the badge by mode', () => {
    const { container } = render(<MaskOverlay width={400} height={300} visuals={[]} preview={preview({ inverted: true })} />)
    expect((container.querySelector('[data-mask-edit-badge]') as HTMLElement).textContent).toContain('Hide mask')
  })

  it('emits nested evenodd contours for a brush mask with holes', () => {
    const clip = buildMaskClipPath(
      {
        id: 'm',
        targetId: 'x',
        shape: 'brush',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        inverted: true,
        holes: [[
          { x: 25, y: 25 },
          { x: 75, y: 25 },
          { x: 75, y: 75 },
          { x: 25, y: 75 }
        ]]
      },
      100,
      100
    )
    expect(clip).toContain('evenodd')
    expect(clip).toContain('0px 0px, 100px 0px, 100px 100px, 0px 100px')
    expect(clip).toContain('25px 25px, 75px 25px, 75px 75px, 25px 75px')
  })

  it('renders one checkerboard layer for a mask with holes, clipped to the mask', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [makeDevice({ id: 'dev-1', x: 20, y: 30, width: 200, height: 120 })],
        masks: [
          {
            id: 'm1',
            targetId: 'dev-1',
            shape: 'brush',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 }
            ],
            inverted: true,
            holes: [[
              { x: 25, y: 25 },
              { x: 75, y: 25 },
              { x: 75, y: 75 },
              { x: 25, y: 75 }
            ]]
          }
        ]
      }]
    })

    const visuals = collectMaskVisuals(useStore.getState().scenes[0])
    const { container } = render(<MaskOverlay width={400} height={300} visuals={visuals} preview={null} />)

    const checkers = Array.from(container.querySelectorAll('[data-mask-checkerboard]')) as HTMLElement[]
    expect(checkers).toHaveLength(1)
    expect(checkers[0].getAttribute('data-mask-checker-for')).toBe('m1')
    // The clip-path that restricts the checkerboard to the masked region is
    // covered by buildMaskClipPath (jsdom strips evenodd polygon values from
    // inline styles); here we assert the checkerboard styling applied.
    expect(checkers[0].getAttribute('style')).toContain('background-image')
  })

  it('renders a checkerboard for a background/canvas mask at canvas size', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        masks: [
          { id: 'mbg', targetId: '__background__', shape: 'rectangle', x: 40, y: 40, width: 200, height: 120, points: [], inverted: false }
        ]
      }]
    })

    const scene = useStore.getState().scenes[0]
    const visuals = collectMaskVisuals(scene)
    expect(visuals).toHaveLength(1)
    const bg = visuals[0]
    expect(bg.elementId).toBe('__background__')
    expect(bg.origin).toEqual({ x: 0, y: 0 })
    expect(bg.width).toBe(scene.canvas.width)
    expect(bg.height).toBe(scene.canvas.height)
    expect(bg.rotation).toBe(0)

    const { container } = render(<MaskOverlay width={scene.canvas.width} height={scene.canvas.height} visuals={visuals} preview={null} />)

    const visual = container.querySelector('[data-mask-visual]') as HTMLElement | null
    expect(visual).not.toBeNull()
    expect(visual!.getAttribute('data-mask-element-id')).toBe('__background__')
    expect(visual!.style.left).toBe('0px')
    expect(visual!.style.top).toBe('0px')
    expect(container.querySelectorAll('[data-mask-checkerboard]')).toHaveLength(1)
  })

  it('clips the whole scene (background + elements) by background masks inside the export node', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [makeDevice({ id: 'dev-1', x: 60, y: 50, width: 200, height: 120 })],
        masks: [
          { id: 'mbg', targetId: '__background__', shape: 'rectangle', x: 40, y: 40, width: 200, height: 120, points: [], inverted: false }
        ]
      }]
    })

    const { container } = render(<Scene />)
    const exportNode = container.querySelector('[data-scene-export]')!
    const clip = exportNode.querySelector('[data-scene-mask-clip]') as HTMLElement | null
    expect(clip).not.toBeNull()
    expect(clip!.getAttribute('data-scene-mask-for')).toBe('mbg')
    expect(clip!.style.clipPath).toBe(buildMaskClipPath(
      { id: 'mbg', targetId: '__background__', shape: 'rectangle', x: 40, y: 40, width: 200, height: 120, points: [], inverted: false },
      useStore.getState().scenes[0].canvas.width,
      useStore.getState().scenes[0].canvas.height
    ))
    // The background layer and every element live inside the scene mask clip,
    // so content added AFTER the mask (devices, shapes, images) is clipped too
    // and can never render over the masked region — the reported export leak.
    expect(clip!.querySelector('[data-scene-background]')).not.toBeNull()
    expect(clip!.querySelector('[data-element-id="dev-1"]')).not.toBeNull()
    expect(exportNode.querySelector('[data-mask-checkerboard]')).toBeNull()
  })

  it('end-to-end: a mask drawn on empty canvas clips a shape added later', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()
    const evt = { pointerId: 1, button: 0, clientX: 300, clientY: 300 } as unknown as PointerEvent
    const point = (x: number, y: number) => ({ x, y })

    // Draw a rectangle mask on an empty part of the DEFAULT scene (below the
    // hero text boxes) — it must target the background sentinel.
    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(300, 300), toolId: 'mask' }), evt)
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(500, 400), toolId: 'mask' }), evt)
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(500, 400), toolId: 'mask' }), evt)

    const scene = useStore.getState().scenes[0]
    const mask = scene.masks[0]
    expect(mask).toBeTruthy()
    expect(mask.targetId).toBe(BACKGROUND_MASK_TARGET_ID)
    expect(mask).toMatchObject({ shape: 'rectangle', x: 300, y: 300, width: 200, height: 100, inverted: true })

    // Now add a shape that overlaps the masked region.
    useStore.getState().addShape(makeShape({ id: 'shp-1', x: 250, y: 250, width: 300, height: 200, zIndex: 10 }))

    const { container } = render(<Scene />)
    const exportNode = container.querySelector('[data-scene-export]')!
    const clip = exportNode.querySelector('[data-scene-mask-clip]') as HTMLElement | null
    expect(clip).not.toBeNull()
    // The later-added shape renders INSIDE the scene-level mask clip, so the
    // masked region stays empty no matter what is added after the mask.
    expect(clip!.querySelector('[data-element-id="shp-1"]')).not.toBeNull()
    // The clip is the inverted punch (box minus the drawn rect), which in real
    // Chromium hides the shape inside the masked region. (jsdom's cssstyle
    // drops evenodd polygon values from inline styles, so the value is asserted
    // through the pure builder used to generate the clipPath attribute.)
    const clipPath = buildMaskClipPath(mask, 1280, 720)
    expect(clipPath).toContain('evenodd')
    expect(clipPath).toContain('0px 0px, 1280px 0px, 1280px 720px, 0px 720px')
    expect(clipPath).toContain('300px 300px, 500px 300px, 500px 400px, 300px 400px')
  })

  it('end-to-end: a mask drawn over the default hero text box targets that element, not the background', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()
    const evt = { pointerId: 1, button: 0, clientX: 100, clientY: 100 } as unknown as PointerEvent
    const point = (x: number, y: number) => ({ x, y })

    // (100,100) lands inside the default "Title" hero text box (x60 y60 640x72).
    const heroId = useStore.getState().scenes[0].textBoxes.find((t) => t.stylePreset === 'title')!.id
    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt)
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(150, 140), toolId: 'mask' }), evt)
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(150, 140), toolId: 'mask' }), evt)

    const mask = useStore.getState().scenes[0].masks[0]
    expect(mask).toBeTruthy()
    expect(mask.targetId).toBe(heroId)
    expect(mask).toMatchObject({ x: 40, y: 40, width: 50, height: 40 })
  })

  it('never leaks the checkerboard into the export node', () => {    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [makeDevice({ id: 'dev-1', x: 20, y: 30, width: 200, height: 120 })],
        masks: [
          { id: 'm1', targetId: 'dev-1', shape: 'rectangle', x: 10, y: 10, width: 60, height: 40, points: [], inverted: false }
        ]
      }]
    })
    const visuals = collectMaskVisuals(useStore.getState().scenes[0])

    const { container } = render(
      <div>
        <Scene />
        <MaskOverlay width={400} height={300} visuals={visuals} preview={preview()} />
      </div>
    )

    const exportNode = container.querySelector('[data-scene-export]')!
    expect(exportNode.querySelector('[data-mask-overlay]')).toBeNull()
    expect(exportNode.querySelector('[data-mask-checkerboard]')).toBeNull()
    expect(exportNode.querySelector('[data-mask-edit-dim]')).toBeNull()
    expect(exportNode.querySelector('[data-mask-preview]')).toBeNull()
  })
})
