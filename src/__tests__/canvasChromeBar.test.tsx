/**
 * Phase 5b — Canvas chrome bar (IA §5): scene tabs (chrome variant), zoom
 * controls, and the View menu (rulers / grid / snap-to-grid / smart guides).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { resetStore } from './helpers'
import { useStore } from '../renderer/store'
import CanvasChromeBar from '../renderer/components/canvas/CanvasChromeBar'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('CanvasChromeBar', () => {
  let viewportEl: HTMLDivElement

  beforeEach(() => {
    resetStore()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    viewportEl = document.createElement('div')
    Object.defineProperty(viewportEl, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(viewportEl, 'clientHeight', { value: 600, configurable: true })
    viewportEl.setAttribute('data-canvas-viewport', '')
    document.body.appendChild(viewportEl)
  })

  afterEach(() => {
    viewportEl.remove()
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders scene tabs, the zoom readout, and the View trigger', () => {
    render(<CanvasChromeBar />)
    expect(screen.getByText('Scene 1')).toBeInTheDocument()
    expect(screen.getByTitle('Add scene')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View options' })).toBeInTheDocument()
  })

  it('zoom out / zoom in step the store zoom', () => {
    render(<CanvasChromeBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(useStore.getState().zoom).toBeCloseTo(0.9)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(useStore.getState().zoom).toBeCloseTo(1)
  })

  it('readout click resets zoom and pan', () => {
    useStore.setState({ zoom: 1.8, panX: 120, panY: -40 })
    render(<CanvasChromeBar />)
    fireEvent.click(screen.getByText('180%'))
    expect(useStore.getState().zoom).toBe(1)
    expect(useStore.getState().panX).toBe(0)
    expect(useStore.getState().panY).toBe(0)
  })

  it('Fit computes a fitted zoom from the viewport element', () => {
    useStore.setState({ zoom: 2, panX: 0, panY: 0 })
    render(<CanvasChromeBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }))
    const zoom = useStore.getState().zoom
    expect(zoom).toBeGreaterThan(0)
    expect(zoom).toBeLessThan(1)
  })

  it('Fit is a no-op without a viewport element', () => {
    viewportEl.remove()
    render(<CanvasChromeBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }))
    expect(useStore.getState().zoom).toBe(1)
  })

  it('View menu toggles smart guides and grid', () => {
    render(<CanvasChromeBar />)
    fireEvent.click(screen.getByRole('button', { name: 'View options' }))

    expect(screen.getByRole('menuitemcheckbox', { name: 'Smart guides' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Smart guides' }))
    expect(useStore.getState().showSmartGuides).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'View options' }))
    expect(screen.getByRole('menuitemcheckbox', { name: 'Show grid' })).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Show grid' }))
    expect(useStore.getState().scenes[0].grid.enabled).toBe(true)
  })

  it('View menu reports and toggles snap-to-grid', () => {
    render(<CanvasChromeBar />)
    fireEvent.click(screen.getByRole('button', { name: 'View options' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Snap to grid' }))
    expect(useStore.getState().scenes[0].grid.snapEnabled).toBe(true)
  })

  it('View menu reset zoom restores defaults', () => {
    useStore.setState({ zoom: 2, panX: 100, panY: 50 })
    render(<CanvasChromeBar />)
    fireEvent.click(screen.getByRole('button', { name: 'View options' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Reset zoom' }))
    expect(useStore.getState().zoom).toBe(1)
    expect(useStore.getState().panX).toBe(0)
    expect(useStore.getState().panY).toBe(0)
  })
})
