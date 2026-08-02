/**
 * Phase 5b — Canvas empty state (IA §7): first-run overlay over an empty
 * scene, quick-add actions, and session-scoped dismissal.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { resetStore, makeDevice } from './helpers'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { resetRuntime } from '../renderer/runtime/store'
import Canvas from '../renderer/components/canvas/Canvas'
import CanvasEmptyState from '../renderer/components/canvas/CanvasEmptyState'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('CanvasEmptyState (unit)', () => {
  beforeEach(() => resetStore())

  it('routes quick actions to the matching sidebar tab and dismisses', () => {
    render(<CanvasEmptyState />)
    fireEvent.click(screen.getByRole('button', { name: 'Add device' }))
    expect(useStore.getState().sidebarTab).toBe('devices')
    expect(useRuntimeStore.getState().canvasEmptyStateDismissed).toBe(true)
  })

  it('text / image / presets routes land on their tabs', () => {
    render(<CanvasEmptyState />)
    fireEvent.click(screen.getByRole('button', { name: 'Add text' }))
    expect(useStore.getState().sidebarTab).toBe('text')

    useRuntimeStore.setState({ canvasEmptyStateDismissed: false })
    fireEvent.click(screen.getByRole('button', { name: 'Import image' }))
    expect(useStore.getState().sidebarTab).toBe('images')

    useRuntimeStore.setState({ canvasEmptyStateDismissed: false })
    fireEvent.click(screen.getByRole('button', { name: 'Browse template presets' }))
    expect(useStore.getState().sidebarTab).toBe('canvas')
  })
})

describe('Canvas empty-state integration', () => {
  beforeEach(() => {
    resetStore()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    useStore.setState({ showRulers: false })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows the empty state on a fresh scene', () => {
    render(<Canvas />)
    expect(screen.getByText('Build your first mockup')).toBeInTheDocument()
  })

  it('adding an element hides the state and persists the dismissal', () => {
    render(<Canvas />)
    act(() => useStore.getState().addDevice(makeDevice()))
    expect(screen.queryByText('Build your first mockup')).not.toBeInTheDocument()
    expect(useRuntimeStore.getState().canvasEmptyStateDismissed).toBe(true)
  })

  it('transient reset keeps the dismissal, full reset clears it', () => {
    render(<Canvas />)
    act(() => useStore.getState().addDevice(makeDevice()))
    expect(useRuntimeStore.getState().canvasEmptyStateDismissed).toBe(true)
    act(() => resetRuntime('transient'))
    expect(useRuntimeStore.getState().canvasEmptyStateDismissed).toBe(true)
    act(() => resetRuntime('all'))
    expect(useRuntimeStore.getState().canvasEmptyStateDismissed).toBe(false)
  })

  it('a canvas pointer-down outside the overlay dismisses the state', () => {
    render(<Canvas />)
    const viewport = document.querySelector('[data-canvas-viewport]') as HTMLElement
    fireEvent.pointerDown(viewport)
    expect(useRuntimeStore.getState().canvasEmptyStateDismissed).toBe(true)
  })

  it('action clicks route to tabs without an extra dismiss cycle', () => {
    render(<Canvas />)
    fireEvent.click(screen.getByRole('button', { name: 'Add device' }))
    expect(useStore.getState().sidebarTab).toBe('devices')
    expect(useRuntimeStore.getState().canvasEmptyStateDismissed).toBe(true)
  })
})
