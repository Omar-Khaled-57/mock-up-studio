/**
 * MaskOverlay — the checkerboard transparency visualization for masks.
 *
 * Masks are independent SCENE layers: each visible mask renders as a
 * full-canvas visual (origin 0,0, canvas dims, rotation 0) clipped to the
 * masked region, stacked by its own zIndex. The overlay renders as a sibling
 * overlay (never inside `[data-scene-export]`) plus the live stroke preview.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useStore } from '../renderer/store'
import { resetStore, makeDevice, makeShape } from './helpers'
import { collectMaskVisuals, buildMaskClipPath } from '../renderer/services/mask-visualization'
import { MaskOverlay, CHECKER_DARK, CHECKER_BLUE, CHECKER_SIZE } from '../renderer/components/masks/MaskRenderer'
import { MaskPreviewState } from '../renderer/runtime/runtimeSlice'
import { createToolManager, toolRegistry } from '../renderer/tools'
import Scene from '../renderer/components/canvas/Scene'
import { nextMaskZIndex } from '../renderer/store/maskSlice'

function preview(overrides?: Partial<MaskPreviewState>): MaskPreviewState {
  return {
    shape: 'rectangle',
    points: [
      { x: 60, y: 60 },
      { x: 160, y: 110 }
    ],
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

  it('renders one outline visual per committed mask at the canvas origin', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [makeDevice({ id: 'dev-1', x: 20, y: 30, width: 200, height: 120 })],
        masks: [
          { id: 'm1', name: 'Mask 1', shape: 'rectangle', x: 40, y: 40, width: 60, height: 40, points: [], inverted: false, zIndex: 2, visible: true, locked: false },
          { id: 'm2', name: 'Mask 2', shape: 'rectangle', x: 0, y: 0, width: 1, height: 1, points: [], inverted: false, zIndex: 1, visible: false, locked: false },
          { id: 'm3', name: 'Mask 3', shape: 'rectangle', x: 10, y: 10, width: 30, height: 30, points: [], inverted: false, zIndex: 3, visible: true, locked: false }
        ]
      }]
    })

    const visuals = collectMaskVisuals(useStore.getState().scenes[0])
    expect(visuals.map((v) => v.maskId)).toEqual(['m1', 'm3'])
    const { container } = render(<MaskOverlay width={400} height={300} visuals={visuals} preview={null} />)

    expect(container.querySelector('[data-mask-overlay]')).not.toBeNull()
    const visualEls = Array.from(container.querySelectorAll('[data-mask-visual]')) as HTMLElement[]
    expect(visualEls).toHaveLength(2)
    expect(visualEls[0].getAttribute('data-mask-for')).toBe('m1')
    expect(visualEls[0].style.left).toBe('0px')
    expect(visualEls[0].style.top).toBe('0px')
    // Full-canvas masks resolve to the scene canvas box, not the overlay props.
    expect(visualEls[0].style.width).toBe('1280px')
    expect(visualEls[0].style.height).toBe('720px')

    // Committed masks render a dashed outline plus a faint 50%-opacity
    // checkerboard over the masked-out region (visual only, never exported) —
    // the preserved content shows through it.
    const svg = visualEls[0].querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.querySelector('rect')).not.toBeNull()
    const checker = visualEls[0].querySelector('[data-mask-checkerboard]')
    expect(checker).not.toBeNull()
    expect((checker as HTMLElement).style.opacity).toBe('0.5')
    expect(container.querySelector('[data-mask-edit-dim]')).toBeNull()
    expect(container.querySelector('[data-mask-edit-badge]')).toBeNull()
    expect(container.querySelector('[data-mask-preview]')).toBeNull()
  })

  it('renders the live restore preview while unmasking (no checkerboard)', () => {
    const { container } = render(<MaskOverlay width={400} height={300} visuals={[]} preview={preview()} />)

    const pv = container.querySelector('[data-mask-preview]') as HTMLElement | null
    expect(pv).not.toBeNull()
    expect(container.querySelector('[data-mask-preview-checkerboard]')).toBeNull()
    expect(container.querySelector('[data-mask-preview-highlight]')).not.toBeNull()
    expect(container.querySelector('[data-mask-preview] svg rect')).not.toBeNull()
  })

  it('renders a checkerboard preview while masking (inverted)', () => {
    const { container } = render(<MaskOverlay width={400} height={300} visuals={[]} preview={preview({ inverted: true })} />)
    expect(container.querySelector('[data-mask-preview-checkerboard]')).not.toBeNull()
    expect(container.querySelector('[data-mask-preview-highlight]')).not.toBeNull()
  })

  it('emits opposite-wound path() contours for a brush mask with holes', () => {
    const clip = buildMaskClipPath(
      {
        id: 'm',
        name: 'Mask',
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
        zIndex: 0,
        visible: true,
        locked: false,
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
    expect(clip).toBe("path('M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 75 L 75 75 L 75 25 L 25 25 Z')")
  })

  it('renders the brush outline plus one ring per hole for a mask with holes', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        masks: [
          {
            id: 'm1',
            name: 'Mask 1',
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
            zIndex: 1,
            visible: true,
            locked: false,
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

    const visualEl = container.querySelector('[data-mask-visual]') as HTMLElement | null
    expect(visualEl).not.toBeNull()
    // The committed outline draws the brush polygon plus one ring per hole.
    // (jsdom strips evenodd polygon values, so the contour geometry itself is
    // covered by the buildMaskClipPath unit tests.)
    expect(visualEl!.querySelectorAll('polygon')).toHaveLength(2)
    // A committed brush mask carries its outline plus a faint 50%-opacity
    // checkerboard over the masked-out region (visual only).
    expect(container.querySelector('[data-mask-checkerboard]')).not.toBeNull()
  })

  it('skips frozen masks (their hidden region shows the captured canvas, not checkerboard)', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        masks: [
          {
            id: 'mf',
            name: 'Frozen',
            shape: 'rectangle',
            x: 40,
            y: 40,
            width: 200,
            height: 120,
            points: [],
            inverted: true,
            zIndex: 1,
            visible: true,
            locked: false,
            snapshot: {
              dataUrl: 'data:image/png;base64,AA==',
              width: 400,
              height: 300,
              sourceBounds: { x: 0, y: 0, width: 400, height: 300 },
              capturedAt: 1
            }
          }
        ]
      }]
    })

    const visuals = collectMaskVisuals(useStore.getState().scenes[0])
    expect(visuals).toHaveLength(0)
    const { container } = render(<MaskOverlay width={400} height={300} visuals={visuals} preview={null} />)
    expect(container.querySelectorAll('[data-mask-checkerboard]')).toHaveLength(0)
  })

  it('preserves content strictly below the mask z in an unclipped band and clips content at or above it', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [makeDevice({ id: 'dev-1', x: 60, y: 50, width: 200, height: 120 })],
        masks: [
          { id: 'mbg', name: 'Mask 1', shape: 'rectangle', x: 40, y: 40, width: 200, height: 120, points: [], inverted: false, zIndex: 2, visible: true, locked: false }
        ]
      }]
    })

    const { container } = render(<Scene />)
    const exportNode = container.querySelector('[data-scene-export]')!
    // Band 0 holds everything strictly below the mask's z-index (the background
    // layer and the device) and is NOT clipped — the mask PRESERVES it.
    const band0 = exportNode.querySelector('[data-scene-band="0"]') as HTMLElement | null
    expect(band0).not.toBeNull()
    expect(band0!.querySelector('[data-scene-background]')).not.toBeNull()
    expect(band0!.querySelector('[data-element-id="dev-1"]')).not.toBeNull()
    // The mask clip wrapper exists and wraps only the band ABOVE the mask.
    const clip = exportNode.querySelector('[data-scene-mask-clip]') as HTMLElement | null
    expect(clip).not.toBeNull()
    expect(clip!.getAttribute('data-scene-mask-for')).toBe('mbg')
    expect(clip!.style.zIndex).toBe('2')
    expect(clip!.style.clipPath).toBe(buildMaskClipPath(
      { id: 'mbg', name: 'Mask 1', shape: 'rectangle', x: 40, y: 40, width: 200, height: 120, points: [], inverted: false, zIndex: 2, visible: true, locked: false },
      useStore.getState().scenes[0].canvas.width,
      useStore.getState().scenes[0].canvas.height
    ))
    expect(clip!.querySelector('[data-scene-band="1"]')).not.toBeNull()
    // Content below the mask is never re-rendered under the clip wrapper.
    expect(clip!.querySelector('[data-scene-background]')).toBeNull()
    expect(clip!.querySelector('[data-element-id="dev-1"]')).toBeNull()
    // No checkerboard: the masked region shows the preserved background.
    expect(exportNode.querySelector('[data-mask-checkerboard]')).toBeNull()
  })

  it('clips content at the SAME z as a mask (added after it), while strictly-lower content is preserved', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [
          makeDevice({ id: 'dev-1', x: 60, y: 50, width: 200, height: 120, zIndex: 2 }),
          makeDevice({ id: 'dev-2', x: 300, y: 50, width: 200, height: 120, zIndex: 1 })
        ],
        masks: [
          { id: 'mbg', name: 'Mask 1', shape: 'rectangle', x: 40, y: 40, width: 200, height: 120, points: [], inverted: false, zIndex: 2, visible: true, locked: false }
        ]
      }]
    })

    const { container } = render(<Scene />)
    const exportNode = container.querySelector('[data-scene-export]')!
    const band0 = exportNode.querySelector('[data-scene-band="0"]')!
    // Strictly below (z 1 < mask 2): preserved in the unclipped band.
    expect(band0.querySelector('[data-element-id="dev-2"]')).not.toBeNull()
    expect(band0.querySelector('[data-element-id="dev-1"]')).toBeNull()
    // Equal z counts as ABOVE: the collided element renders in the mask's clip band.
    const clip = exportNode.querySelector('[data-scene-mask-clip]')!
    const band1 = clip.querySelector('[data-scene-band="1"]')!
    expect(band1.querySelector('[data-element-id="dev-1"]')).not.toBeNull()
    expect(band1.querySelector('[data-element-id="dev-2"]')).toBeNull()
  })

  it('regression: an element added AFTER a mask lands at the mask z and is clipped, not preserved', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], masks: [] }] })
    // The mask commits at max element/mask z + 1 (heroes z0/z1 → z2).
    const maskZ = nextMaskZIndex(useStore.getState().scenes[0])
    useStore.getState().addMask({
      id: 'm1', name: 'Mask 1', shape: 'rectangle', x: 40, y: 40, width: 200, height: 120,
      points: [], inverted: false, zIndex: maskZ, visible: true, locked: false
    })
    // The device created AFTER the mask lands at the SAME z (element-add paths
    // compute max over the four element kinds only, never masks).
    const id = useStore.getState().addDeviceOfType('monitor')
    const scene = useStore.getState().scenes[0]
    const device = scene.devices.find((d) => d.id === id)!
    const mask = scene.masks.find((m) => m.id === 'm1')!
    expect(device.zIndex).toBe(mask.zIndex)

    const { container } = render(<Scene />)
    const exportNode = container.querySelector('[data-scene-export]')!
    // The collided device renders INSIDE the mask clip (band above the mask),
    // so it is clipped in the masked region — the pre-fix behavior preserved it.
    const clip = exportNode.querySelector('[data-scene-mask-clip]')!
    expect(clip.querySelector(`[data-element-id="${id}"]`)).not.toBeNull()
    const band0 = exportNode.querySelector('[data-scene-band="0"]')!
    expect(band0.querySelector(`[data-element-id="${id}"]`)).toBeNull()
  })

  it('folds multiple visible masks by z-order (lowest outermost, highest innermost)', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [makeDevice({ id: 'dev-1', x: 60, y: 50, width: 200, height: 120 })],
        masks: [
          { id: 'm1', name: 'Low', shape: 'rectangle', x: 0, y: 0, width: 300, height: 400, points: [], inverted: false, zIndex: 1, visible: true, locked: false },
          { id: 'm2', name: 'High', shape: 'rectangle', x: 150, y: 100, width: 200, height: 200, points: [], inverted: false, zIndex: 5, visible: true, locked: false }
        ]
      }]
    })

    const { container } = render(<Scene />)
    const exportNode = container.querySelector('[data-scene-export]')!
    const layers = Array.from(exportNode.querySelectorAll('[data-scene-mask-clip]')) as HTMLElement[]
    expect(layers).toHaveLength(2)
    // Outermost wrapper is the LOWEST zIndex mask: it clips band 1 (everything
    // above it) plus the higher mask's wrapper.
    expect(layers[0].getAttribute('data-scene-mask-for')).toBe('m1')
    expect(layers[0].style.zIndex).toBe('1')
    // The innermost wrapper is the HIGHEST zIndex mask, wrapping only the top band.
    const inner = layers[0].querySelector('[data-scene-mask-clip]') as HTMLElement | null
    expect(inner).not.toBeNull()
    expect(inner!.getAttribute('data-scene-mask-for')).toBe('m2')
    expect(inner!.style.zIndex).toBe('5')
    // Band membership: the low mask clips bands 1 and 2; the high mask only band 2.
    expect(layers[0].querySelector('[data-scene-band="1"]')).not.toBeNull()
    expect(layers[0].querySelector('[data-scene-band="2"]')).not.toBeNull()
    expect(inner!.querySelector('[data-scene-band="2"]')).not.toBeNull()
    expect(inner!.querySelector('[data-scene-band="1"]')).toBeNull()
  })

  it('end-to-end: a mask drawn on empty canvas commits a full-canvas scene mask', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()
    const evt = { pointerId: 1, button: 0, clientX: 300, clientY: 300 } as unknown as PointerEvent
    const point = (x: number, y: number) => ({ x, y })

    // Draw a rectangle mask on an empty part of the DEFAULT scene (below the
    // hero text boxes) — masks are scene layers, so any stroke creates one.
    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(300, 300), toolId: 'mask' }), evt)
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(500, 400), toolId: 'mask' }), evt)
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(500, 400), toolId: 'mask' }), evt)

    const scene = useStore.getState().scenes[0]
    const mask = scene.masks[0]
    expect(mask).toBeTruthy()
    expect(mask).toMatchObject({
      shape: 'rectangle',
      x: 300,
      y: 300,
      width: 200,
      height: 100,
      inverted: true,
      visible: true,
      locked: false,
      name: 'Mask 1'
    })
    expect(mask.zIndex).toBeGreaterThanOrEqual(0)

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
    // strips some clip-path values from inline styles, so the value is asserted
    // through the pure builder used to generate the clipPath attribute.)
    const clipPath = buildMaskClipPath(mask, 1280, 720)
    expect(clipPath).toBe("path('M 0 0 L 1280 0 L 1280 720 L 0 720 Z M 300 400 L 500 400 L 500 300 L 300 300 Z')")
  })

  it('end-to-end: a mask drawn over the default hero text box still commits a full-canvas scene mask', () => {
    const manager = createToolManager(toolRegistry)
    manager.setActiveTool('mask')
    const tool = manager.getActiveTool()
    const evt = { pointerId: 1, button: 0, clientX: 100, clientY: 100 } as unknown as PointerEvent
    const point = (x: number, y: number) => ({ x, y })

    // (100,100) lands inside the default "Title" hero text box (x60 y60 640x72),
    // but masks are never element-targeted — the stroke is a full-canvas layer.
    tool.onPointerDown?.(manager.buildContext({ scenePoint: point(100, 100), toolId: 'mask' }), evt)
    tool.onPointerMove?.(manager.buildContext({ scenePoint: point(150, 140), toolId: 'mask' }), evt)
    tool.onPointerUp?.(manager.buildContext({ scenePoint: point(150, 140), toolId: 'mask' }), evt)

    const mask = useStore.getState().scenes[0].masks[0]
    expect(mask).toBeTruthy()
    expect(mask).toMatchObject({ shape: 'rectangle', x: 100, y: 100, width: 50, height: 40, inverted: true })
  })

  it('never leaks the checkerboard into the export node', () => {
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [makeDevice({ id: 'dev-1', x: 20, y: 30, width: 200, height: 120 })],
        masks: [
          { id: 'm1', name: 'Mask 1', shape: 'rectangle', x: 10, y: 10, width: 60, height: 40, points: [], inverted: false, zIndex: 1, visible: true, locked: false }
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
