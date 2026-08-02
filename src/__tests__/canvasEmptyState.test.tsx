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
import { safeScene } from '../renderer/store/sceneSlice'
import Canvas from '../renderer/components/canvas/Canvas'
import CanvasEmptyState from '../renderer/components/canvas/CanvasEmptyState'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('CanvasEmptyState (unit)', () => {
  beforeEach(() => resetStore())

  it('add device directly creates a monitor element and dismisses', () => {
    render(<CanvasEmptyState />)
    fireEvent.click(screen.getByRole('button', { name: 'Add device' }))
    const scene = safeScene(useStore.getState())
    expect(scene.devices.length).toBe(1)
    expect(scene.devices[0].type).toBe('monitor')
    expect(useRuntimeStore.getState().canvasEmptyStateDismissed).toBe(true)
  })

  it('add text directly creates a text box and dismisses', () => {
    render(<CanvasEmptyState />)
    fireEvent.click(screen.getByRole('button', { name: 'Add text' }))
    const scene = safeScene(useStore.getState())
    // hero boxes (2) + 1 new = 3
    expect(scene.textBoxes.length).toBe(3)
    expect(useRuntimeStore.getState().canvasEmptyStateDismissed).toBe(true)
  })

  it('import image opens the file dialog without tab navigation', () => {
    const { container } = render(<CanvasEmptyState />)
    fireEvent.click(screen.getByRole('button', { name: 'Import image' }))
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()
    expect(fileInput).toHaveAttribute('accept', 'image/*')
    // does not switch to the images tab (old behavior)
    expect(useStore.getState().sidebarTab).toBe('devices')
  })

  it('Choose your Canvas still routes to the canvas tab', () => {
    render(<CanvasEmptyState />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose your Canvas' }))
    expect(useStore.getState().sidebarTab).toBe('canvas')
    expect(useRuntimeStore.getState().canvasEmptyStateDismissed).toBe(true)
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

  it('add device button directly creates an element', () => {
    render(<Canvas />)
    fireEvent.click(screen.getByRole('button', { name: 'Add device' }))
    const scene = safeScene(useStore.getState())
    expect(scene.devices.length).toBe(1)
    expect(useRuntimeStore.getState().canvasEmptyStateDismissed).toBe(true)
  })
})
