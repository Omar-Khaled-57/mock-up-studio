/**
 * Phase 3 — render-time container clipping. Unit tests for the
 * `buildContainerClip` service and Scene.tsx integration tests asserting the
 * clip wrappers, focus skip, nesting, and no-double-render guarantees.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { resetStore, makeDevice, makeTextBox, makeShape, makeImage } from './helpers'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { createDefaultScene } from '../renderer/store/sceneSlice'
import Scene from '../renderer/components/canvas/Scene'
import ElementFacade from '../renderer/elements/ElementFacade'
import { buildContainerClip } from '../renderer/services/container-clip'
import { buildMaskClipPath } from '../renderer/services/mask-visualization'
import type { Mask, Scene as SceneType } from '@shared/types'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function emptyScene(): SceneType {
  const base = createDefaultScene()
  return { ...base, devices: [], textBoxes: [], images: [], shapes: [] }
}

function setScene(scene: SceneType) {
  act(() => useStore.setState({ scenes: [scene], activeSceneIndex: 0 }))
}

function wrapperFor(id: string): HTMLElement | null {
  return document.querySelector(`[data-container-clip="${id}"]`)
}

describe('buildContainerClip', () => {
  it('rect containers get no shape clip (overflow handles it) and pass masks through', () => {
    const mask: Mask = { id: 'm1', targetId: 'dev-1', shape: 'rectangle', x: 10, y: 20, width: 100, height: 50, points: [], inverted: false }
    const clip = buildContainerClip({ kind: 'device', width: 600, height: 400, masks: [mask] })
    expect(clip.shapeClip).toBeNull()
    expect(clip.masks).toEqual([mask])
  })

  it('shape containers clip to the exact SVG outline', () => {
    const clip = buildContainerClip({ kind: 'shape', width: 120, height: 80, shapeKind: 'rectangle', cornerRadius: 0, masks: [] })
    expect(clip.shapeClip).toMatch(/^path\('M 0 0 L 120 0 L 120 80 L 0 80 Z'\)$/)
  })

  it('shape clip uses the same path source as ShapeRenderer (circle)', () => {
    const clip = buildContainerClip({ kind: 'shape', width: 100, height: 100, shapeKind: 'circle', masks: [] })
    expect(clip.shapeClip).toMatch(/^path\('M 0 50 A 50 50 0 1 1 100 50 A 50 50 0 1 1 0 50 Z'\)$/)
  })

  it('cross shapes fall back to the box clip (no path emitted)', () => {
    const clip = buildContainerClip({ kind: 'shape', width: 100, height: 100, shapeKind: 'cross', masks: [] })
    expect(clip.shapeClip).toBeNull()
  })

  it('plus/arrow thickness feeds the outline', () => {
    const plus = buildContainerClip({ kind: 'shape', width: 100, height: 100, shapeKind: 'plus', plusThickness: 0.5, masks: [] })
    expect(plus.shapeClip).not.toBeNull()
    const arrow = buildContainerClip({ kind: 'shape', width: 100, height: 100, shapeKind: 'arrow-right', arrowThickness: 0.7, masks: [] })
    expect(arrow.shapeClip).not.toBeNull()
  })
})

describe('ElementFacade multi-mask', () => {
  beforeEach(() => {
    resetStore()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('a single mask clips the element box with no nested layer (unchanged path)', () => {
    const scene = emptyScene()
    scene.devices = [makeDevice({ id: 'dev-c', x: 100, y: 100, width: 600, height: 400 })]
    const mask: Mask = { id: 'm1', targetId: 'dev-c', shape: 'rectangle', x: 10, y: 20, width: 100, height: 50, points: [], inverted: false }
    scene.masks = [mask]
    setScene(scene)

    render(
      <ElementFacade id="dev-c" kind="device" locked={false} style={{ position: 'absolute', left: 100, top: 100, width: 600, height: 400 }}>
        <div>content</div>
      </ElementFacade>
    )
    const box = document.querySelector('[data-element-id="dev-c"]') as HTMLElement
    expect(box.style.clipPath).toBe(buildMaskClipPath(mask, 600, 400))
    expect(document.querySelectorAll('[data-element-mask-clip]')).toHaveLength(0)
  })

  it('multiple masks intersect via nested clip layers', () => {
    const scene = emptyScene()
    scene.devices = [makeDevice({ id: 'dev-c', x: 100, y: 100, width: 600, height: 400 })]
    const m1: Mask = { id: 'm1', targetId: 'dev-c', shape: 'rectangle', x: 0, y: 0, width: 300, height: 400, points: [], inverted: false }
    const m2: Mask = { id: 'm2', targetId: 'dev-c', shape: 'ellipse', x: 150, y: 100, width: 300, height: 200, points: [], inverted: false }
    const m3: Mask = { id: 'm3', targetId: 'dev-c', shape: 'rectangle', x: 100, y: 100, width: 100, height: 100, points: [], inverted: false }
    scene.masks = [m1, m2, m3]
    setScene(scene)

    render(
      <ElementFacade id="dev-c" kind="device" locked={false} style={{ position: 'absolute', left: 100, top: 100, width: 600, height: 400 }}>
        <div>content</div>
      </ElementFacade>
    )
    const box = document.querySelector('[data-element-id="dev-c"]') as HTMLElement
    expect(box.style.clipPath).toBe(buildMaskClipPath(m1, 600, 400))
    const layers = Array.from(document.querySelectorAll('[data-element-mask-clip]')) as HTMLElement[]
    expect(layers).toHaveLength(2)
    expect(layers[0].style.clipPath).toBe(buildMaskClipPath(m2, 600, 400))
    expect(layers[1].style.clipPath).toBe(buildMaskClipPath(m3, 600, 400))
    expect(box.textContent).toContain('content')
  })

  it('a frozen masks[0] leaves the root unclipped and paints the snapshot sibling', () => {
    const scene = emptyScene()
    scene.devices = [makeDevice({ id: 'dev-c', x: 100, y: 100, width: 600, height: 400 })]
    const frozen: Mask = {
      id: 'm1',
      targetId: 'dev-c',
      shape: 'rectangle',
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      points: [],
      inverted: true,
      snapshot: {
        dataUrl: 'data:image/png;base64,AA==',
        width: 600,
        height: 400,
        sourceBounds: { x: 100, y: 100, width: 600, height: 400 },
        capturedAt: 1
      }
    }
    scene.masks = [frozen]
    setScene(scene)

    render(
      <ElementFacade id="dev-c" kind="device" locked={false} style={{ position: 'absolute', left: 100, top: 100, width: 600, height: 400 }}>
        <div>content</div>
      </ElementFacade>
    )
    const box = document.querySelector('[data-element-id="dev-c"]') as HTMLElement
    expect(box.style.clipPath).toBe('')
    const snapshot = document.querySelector('[data-mask-snapshot]') as HTMLElement
    expect(snapshot).not.toBeNull()
    expect(snapshot.closest('[data-element-id="dev-c"]')).toBe(box)
    const img = document.querySelector('[data-mask-snapshot-img]') as HTMLElement
    expect(img.style.left).toBe('0px')
    expect(img.style.top).toBe('0px')
    expect(img.style.width).toBe('600px')
    expect(img.style.height).toBe('400px')
    expect(box.textContent).toContain('content')
  })

  it('a frozen extra mask clips live content to its visible region and paints the snapshot over its hidden region', () => {
    const scene = emptyScene()
    scene.devices = [makeDevice({ id: 'dev-c', x: 100, y: 100, width: 600, height: 400 })]
    const m1: Mask = { id: 'm1', targetId: 'dev-c', shape: 'rectangle', x: 0, y: 0, width: 300, height: 400, points: [], inverted: false }
    const frozen: Mask = {
      id: 'm2',
      targetId: 'dev-c',
      shape: 'ellipse',
      x: 150,
      y: 100,
      width: 300,
      height: 200,
      points: [],
      inverted: false,
      snapshot: {
        dataUrl: 'data:image/png;base64,AA==',
        width: 300,
        height: 200,
        sourceBounds: { x: 100, y: 100, width: 300, height: 200 },
        capturedAt: 2
      }
    }
    scene.masks = [m1, frozen]
    setScene(scene)

    render(
      <ElementFacade id="dev-c" kind="device" locked={false} style={{ position: 'absolute', left: 100, top: 100, width: 600, height: 400 }}>
        <div>content</div>
      </ElementFacade>
    )
    const box = document.querySelector('[data-element-id="dev-c"]') as HTMLElement
    expect(box.style.clipPath).toBe(buildMaskClipPath(m1, 600, 400))
    const layers = Array.from(document.querySelectorAll('[data-element-mask-clip]:not([data-mask-snapshot])')) as HTMLElement[]
    expect(layers).toHaveLength(1)
    expect(layers[0].style.clipPath).toBe(buildMaskClipPath(frozen, 600, 400))
    expect(document.querySelectorAll('[data-mask-snapshot]')).toHaveLength(1)
  })
})

describe('Scene container clipping', () => {
  beforeEach(() => {
    resetStore()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders children through a clip wrapper positioned at the container box', () => {
    const scene = emptyScene()
    const container = makeDevice({ id: 'dev-c', name: 'Container', x: 100, y: 100, width: 600, height: 400, zIndex: 5 })
    scene.devices = [container]
    scene.textBoxes = [makeTextBox({ id: 'tb-child', content: 'Child', x: 120, y: 120, zIndex: 1, containerId: 'dev-c' })]
    setScene(scene)

    const { container: root } = render(<Scene />)
    const wrapper = wrapperFor('dev-c')
    expect(wrapper).not.toBeNull()
    expect(wrapper!.style.overflow).toBe('hidden')
    expect(wrapper!.style.clipPath).toBe('')
    expect(wrapper!.style.left).toBe('100px')
    expect(wrapper!.style.top).toBe('100px')
    expect(wrapper!.style.width).toBe('600px')
    expect(wrapper!.style.height).toBe('400px')
    const child = root.querySelector('[data-element-id="tb-child"]')
    expect(child).not.toBeNull()
    expect(wrapper!.contains(child)).toBe(true)
    expect(root.querySelectorAll('[data-element-id="tb-child"]')).toHaveLength(1)
  })

  it('a shape container clips its children to the exact shape outline', () => {
    const scene = emptyScene()
    const container = makeShape({ id: 'shp-c', kind: 'circle', name: 'Circle Container', x: 200, y: 200, width: 120, height: 120, zIndex: 5 })
    scene.shapes = [container]
    scene.images = [makeImage({ id: 'img-child', x: 210, y: 210, zIndex: 1, containerId: 'shp-c' })]
    setScene(scene)

    render(<Scene />)
    const wrapper = wrapperFor('shp-c')
    expect(wrapper).not.toBeNull()
    expect(wrapper!.style.clipPath).toMatch(/^path\('/)
  })

  it('container masks are intersected as a nested clip layer', () => {
    const scene = emptyScene()
    const container = makeDevice({ id: 'dev-c', name: 'Container', x: 100, y: 100, width: 600, height: 400, zIndex: 5 })
    scene.devices = [container]
    scene.textBoxes = [makeTextBox({ id: 'tb-child', content: 'Child', x: 120, y: 120, zIndex: 1, containerId: 'dev-c' })]
    const mask: Mask = { id: 'm1', targetId: 'dev-c', shape: 'rectangle', x: 10, y: 20, width: 100, height: 50, points: [], inverted: false }
    scene.masks = [mask]
    setScene(scene)

    const { container: root } = render(<Scene />)
    const wrapper = wrapperFor('dev-c')
    expect(wrapper).not.toBeNull()
    const maskLayer = wrapper!.querySelector('[data-container-mask-clip]') as HTMLElement | null
    expect(maskLayer).not.toBeNull()
    expect(maskLayer!.style.clipPath).toBe(buildMaskClipPath(mask, 600, 400))
    expect(maskLayer!.contains(root.querySelector('[data-element-id="tb-child"]'))).toBe(true)
  })

  it('container masks intersect through every nested layer', () => {
    const scene = emptyScene()
    const container = makeDevice({ id: 'dev-c', name: 'Container', x: 100, y: 100, width: 600, height: 400, zIndex: 5 })
    scene.devices = [container]
    scene.textBoxes = [makeTextBox({ id: 'tb-child', content: 'Child', x: 120, y: 120, zIndex: 1, containerId: 'dev-c' })]
    const m1: Mask = { id: 'm1', targetId: 'dev-c', shape: 'rectangle', x: 0, y: 0, width: 300, height: 400, points: [], inverted: false }
    const m2: Mask = { id: 'm2', targetId: 'dev-c', shape: 'rectangle', x: 150, y: 100, width: 200, height: 200, points: [], inverted: false }
    scene.masks = [m1, m2]
    setScene(scene)

    const { container: root } = render(<Scene />)
    const wrapper = wrapperFor('dev-c')
    expect(wrapper).not.toBeNull()
    const layers = Array.from(wrapper!.querySelectorAll('[data-container-mask-clip]')) as HTMLElement[]
    expect(layers).toHaveLength(2)
    expect(layers[0].style.clipPath).toBe(buildMaskClipPath(m1, 600, 400))
    expect(layers[1].style.clipPath).toBe(buildMaskClipPath(m2, 600, 400))
    expect(layers[1].contains(root.querySelector('[data-element-id="tb-child"]'))).toBe(true)
  })

  it('focusing the container skips its clip so children render fully editable', () => {
    const scene = emptyScene()
    const container = makeDevice({ id: 'dev-c', name: 'Container', x: 100, y: 100, width: 600, height: 400, zIndex: 5 })
    scene.devices = [container]
    scene.textBoxes = [makeTextBox({ id: 'tb-child', content: 'Child', x: 120, y: 120, zIndex: 1, containerId: 'dev-c' })]
    setScene(scene)
    act(() => useRuntimeStore.getState().enterElementFocus('dev-c'))

    const { container: root } = render(<Scene />)
    expect(wrapperFor('dev-c')).toBeNull()
    const child = root.querySelector('[data-element-id="tb-child"]')
    expect(child).not.toBeNull()
    expect(root.querySelectorAll('[data-element-id="tb-child"]')).toHaveLength(1)
  })

  it('nested containers clip through every unfocused ancestor', () => {
    const scene = emptyScene()
    const outer = makeDevice({ id: 'dev-a', name: 'Outer', x: 0, y: 0, width: 800, height: 600, zIndex: 4 })
    const inner = makeShape({ id: 'shp-b', kind: 'rectangle', name: 'Inner', x: 100, y: 100, width: 300, height: 200, zIndex: 2, containerId: 'dev-a' })
    scene.devices = [outer]
    scene.shapes = [inner]
    scene.textBoxes = [makeTextBox({ id: 'tb-c', content: 'Deep', x: 120, y: 120, zIndex: 1, containerId: 'shp-b' })]
    setScene(scene)

    const { container: root } = render(<Scene />)
    const outerWrapper = wrapperFor('dev-a')
    const innerWrapper = wrapperFor('shp-b')
    expect(outerWrapper).not.toBeNull()
    expect(innerWrapper).not.toBeNull()
    expect(outerWrapper!.contains(innerWrapper)).toBe(true)
    const deep = root.querySelector('[data-element-id="tb-c"]')
    expect(innerWrapper!.contains(deep)).toBe(true)
    expect(root.querySelectorAll('[data-element-id="tb-c"]')).toHaveLength(1)
  })

  it('a child rendered before its container in z-order is still not doubled', () => {
    const scene = emptyScene()
    const container = makeDevice({ id: 'dev-c', name: 'Container', x: 100, y: 100, width: 600, height: 400, zIndex: 10 })
    scene.devices = [container]
    scene.textBoxes = [makeTextBox({ id: 'tb-low', content: 'Low', x: 120, y: 120, zIndex: 0, containerId: 'dev-c' })]
    setScene(scene)

    const { container: root } = render(<Scene />)
    const wrapper = wrapperFor('dev-c')
    expect(wrapper).not.toBeNull()
    expect(wrapper!.contains(root.querySelector('[data-element-id="tb-low"]'))).toBe(true)
    expect(root.querySelectorAll('[data-element-id="tb-low"]')).toHaveLength(1)
  })

  it('unrelated elements and non-containers render without wrappers', () => {
    const scene = emptyScene()
    scene.devices = [makeDevice({ id: 'dev-plain', name: 'Plain', x: 0, y: 0, zIndex: 3 })]
    scene.textBoxes = [makeTextBox({ id: 'tb-plain', name: 'Plain TB', content: 'Hi', x: 300, y: 300, zIndex: 2 })]
    setScene(scene)

    const { container: root } = render(<Scene />)
    expect(document.querySelectorAll('[data-container-clip]')).toHaveLength(0)
    expect(root.querySelector('[data-element-id="dev-plain"]')).not.toBeNull()
    expect(root.querySelector('[data-element-id="tb-plain"]')).not.toBeNull()
  })
})
