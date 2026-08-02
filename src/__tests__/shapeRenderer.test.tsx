/**
 * ShapeRenderer — the rendered SVG must track the shared live transform during
 * a select-tool gesture (true WYSIWYG). Regression: the shape rendered at its
 * START aspect ratio while resizing because the SVG content read the store
 * geometry (which only commits on pointer-up) and the viewBox scaled uniformly
 * under `preserveAspectRatio: meet`; it snapped to the live size only on
 * release. The facade now renders from the same ghost source the overlay chrome
 * consumes, so shape, chrome and ghost can never drift apart.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useRuntimeStore } from '../renderer/runtime/store'
import { resetStore, makeShape } from './helpers'
import ShapeRenderer from '../renderer/components/shapes/ShapeRenderer'
import { buildGhostPreview } from '../renderer/services/preview'

function renderShape(shape = makeShape({ id: 'shp-1', kind: 'rectangle', x: 200, y: 200, width: 120, height: 80 })) {
  const { container } = render(<ShapeRenderer shape={shape} />)
  return container
}

describe('ShapeRenderer live-resize WYSIWYG', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders the store geometry by default', () => {
    const container = renderShape()
    const facade = container.querySelector('[data-element-id="shp-1"]') as HTMLElement
    const svg = container.querySelector('svg') as SVGElement
    expect(facade.style.left).toBe('200px')
    expect(facade.style.top).toBe('200px')
    expect(facade.style.width).toBe('120px')
    expect(facade.style.height).toBe('80px')
    expect(svg.getAttribute('width')).toBe('120')
    expect(svg.getAttribute('height')).toBe('80')
    expect(svg.getAttribute('viewBox')).toBe('0 0 120 80')
    expect(svg.querySelector('path')?.getAttribute('d')).toContain('L 120 0 L 120 80 L 0 80')
  })

  it('renders the SVG content at the live bounds while a ghost targets the shape', () => {
    const container = renderShape()
    act(() => {
      useRuntimeStore.getState().setPreview(buildGhostPreview({ id: 'shp-1', x: 240, y: 260, width: 300, height: 200 }))
    })

    const facade = container.querySelector('[data-element-id="shp-1"]') as HTMLElement
    const svg = container.querySelector('svg') as SVGElement
    expect(facade.style.left).toBe('240px')
    expect(facade.style.top).toBe('260px')
    expect(facade.style.width).toBe('300px')
    expect(facade.style.height).toBe('200px')
    expect(svg.getAttribute('width')).toBe('300')
    expect(svg.getAttribute('height')).toBe('200')
    expect(svg.getAttribute('viewBox')).toBe('0 0 300 200')
    expect(svg.querySelector('path')?.getAttribute('d')).toContain('L 300 0 L 300 200 L 0 200')
  })

  it('reverts to the store geometry when the ghost clears', () => {
    const container = renderShape()
    act(() => {
      useRuntimeStore.getState().setPreview(buildGhostPreview({ id: 'shp-1', x: 240, y: 260, width: 300, height: 200 }))
    })
    act(() => {
      useRuntimeStore.getState().setPreview(null)
    })

    const facade = container.querySelector('[data-element-id="shp-1"]') as HTMLElement
    const svg = container.querySelector('svg') as SVGElement
    expect(facade.style.width).toBe('120px')
    expect(facade.style.height).toBe('80px')
    expect(svg.getAttribute('viewBox')).toBe('0 0 120 80')
  })

  it('ignores ghosts targeting a different element or non-ghost previews', () => {
    const container = renderShape()
    act(() => {
      useRuntimeStore.getState().setPreview(buildGhostPreview({ id: 'shp-other', x: 240, y: 260, width: 300, height: 200 }))
    })
    act(() => {
      // A blur-region rect carries no source id.
      useRuntimeStore.getState().setPreview({ visuals: [{ kind: 'rect', x: 0, y: 0, width: 500, height: 500 }] })
    })

    const facade = container.querySelector('[data-element-id="shp-1"]') as HTMLElement
    const svg = container.querySelector('svg') as SVGElement
    expect(facade.style.width).toBe('120px')
    expect(facade.style.height).toBe('80px')
    expect(svg.getAttribute('viewBox')).toBe('0 0 120 80')
  })
})
