/**
 * Phase 3 — render-time container clipping. Unit tests for the
 * `buildContainerClip` service and Scene.tsx integration tests asserting the
 * clip wrappers, the clip-lift while element-focused, nesting, and
 * no-double-render guarantees.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { resetStore, makeDevice, makeTextBox, makeShape, makeImage } from './helpers'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { createDefaultScene } from '../renderer/store/sceneSlice'
import Scene from '../renderer/components/canvas/Scene'
import { buildContainerClip } from '../renderer/services/container-clip'
import type { Scene as SceneType } from '@shared/types'

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
  it('rect containers get no shape clip (overflow handles it)', () => {
    const clip = buildContainerClip({ kind: 'device', width: 600, height: 400 })
    expect(clip.shapeClip).toBeNull()
  })

  it('shape containers clip to the exact SVG outline', () => {
    const clip = buildContainerClip({ kind: 'shape', width: 120, height: 80, shapeKind: 'rectangle', cornerRadius: 0 })
    expect(clip.shapeClip).toMatch(/^path\('M 0 0 L 120 0 L 120 80 L 0 80 Z'\)$/)
  })

  it('shape clip uses the same path source as ShapeRenderer (circle)', () => {
    const clip = buildContainerClip({ kind: 'shape', width: 100, height: 100, shapeKind: 'circle' })
    expect(clip.shapeClip).toMatch(/^path\('M 0 50 A 50 50 0 1 1 100 50 A 50 50 0 1 1 0 50 Z'\)$/)
  })

  it('cross shapes clip to their exact ✕ union outline (no box fallback)', () => {
    const clip = buildContainerClip({ kind: 'shape', width: 100, height: 100, shapeKind: 'cross', crossThickness: 0.3 })
    expect(clip.shapeClip).toMatch(/^path\('M .* Z'\)$/)
    expect(clip.shapeClip).not.toMatch(/^path\('M 0 0 L 100 0 L 100 100 L 0 100 Z'\)$/)
    expect(clip.shapeClip!.match(/-?\d+\.?\d* -?\d+\.?\d*/g)).toHaveLength(12)
  })

  it('plus/arrow/cross thickness feed the outline', () => {
    const plus = buildContainerClip({ kind: 'shape', width: 100, height: 100, shapeKind: 'plus', plusThickness: 0.5 })
    expect(plus.shapeClip).not.toBeNull()
    const arrow = buildContainerClip({ kind: 'shape', width: 100, height: 100, shapeKind: 'arrow-right', arrowThickness: 0.7 })
    expect(arrow.shapeClip).not.toBeNull()
    const crossThin = buildContainerClip({ kind: 'shape', width: 100, height: 100, shapeKind: 'cross', crossThickness: 0.2 })
    const crossThick = buildContainerClip({ kind: 'shape', width: 100, height: 100, shapeKind: 'cross', crossThickness: 0.5 })
    expect(crossThin.shapeClip).not.toBeNull()
    expect(crossThick.shapeClip).not.toBeNull()
    expect(crossThin.shapeClip).not.toBe(crossThick.shapeClip)
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

  it('a cross container clips its children to the ✕ outline path (not the box)', () => {
    const scene = emptyScene()
    const container = makeShape({ id: 'shp-x', kind: 'cross', name: 'Cross Container', x: 200, y: 200, width: 120, height: 120, crossThickness: 0.3, zIndex: 5 })
    scene.shapes = [container]
    scene.images = [makeImage({ id: 'img-child', x: 250, y: 250, zIndex: 1, containerId: 'shp-x' })]
    setScene(scene)

    render(<Scene />)
    const wrapper = wrapperFor('shp-x')
    expect(wrapper).not.toBeNull()
    expect(wrapper!.style.clipPath).toMatch(/^path\('M /)
    expect(wrapper!.style.clipPath).toMatch(/ Z'\)$/)
    expect(wrapper!.style.clipPath).not.toMatch(/^path\('M 0 0 L 120 0 L 120 120 L 0 120 Z'\)$/)
    expect(wrapper!.querySelector('[data-element-id="img-child"]')).not.toBeNull()
  })

  it('element focus lifts the container clip so children are fully visible; exiting reapplies it', () => {
    const scene = emptyScene()
    const container = makeDevice({ id: 'dev-c', name: 'Container', x: 100, y: 100, width: 600, height: 400, zIndex: 5 })
    scene.devices = [container]
    scene.textBoxes = [makeTextBox({ id: 'tb-child', content: 'Child', x: 120, y: 120, zIndex: 1, containerId: 'dev-c' })]
    setScene(scene)
    act(() => useRuntimeStore.getState().enterElementFocus('dev-c'))

    const { container: root, rerender } = render(<Scene />)
    const wrapper = wrapperFor('dev-c')
    expect(wrapper).not.toBeNull()
    expect(wrapper!.style.overflow).toBe('visible')
    const child = root.querySelector('[data-element-id="tb-child"]')
    expect(child).not.toBeNull()
    expect(wrapper!.contains(child)).toBe(true)
    expect(root.querySelectorAll('[data-element-id="tb-child"]')).toHaveLength(1)

    act(() => useRuntimeStore.getState().exitFocus())
    rerender(<Scene />)
    expect(wrapperFor('dev-c')!.style.overflow).toBe('hidden')
  })

  it('element focus lifts a shape container outline clip too', () => {
    const scene = emptyScene()
    const container = makeShape({ id: 'shp-c', kind: 'circle', name: 'Circle Container', x: 200, y: 200, width: 120, height: 120, zIndex: 5 })
    scene.shapes = [container]
    scene.images = [makeImage({ id: 'img-child', x: 210, y: 210, zIndex: 1, containerId: 'shp-c' })]
    setScene(scene)
    act(() => useRuntimeStore.getState().enterElementFocus('shp-c'))

    render(<Scene />)
    const wrapper = wrapperFor('shp-c')
    expect(wrapper).not.toBeNull()
    expect(wrapper!.style.clipPath).toBe('')
    expect(wrapper!.style.overflow).toBe('visible')
    expect(wrapper!.querySelector('[data-element-id="img-child"]')).not.toBeNull()
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
