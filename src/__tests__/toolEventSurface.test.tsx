/**
 * ToolEventSurface — viewport-level pointer dispatcher feeding the Tool Manager.
 * Exercises event routing end-to-end (surface -> tool -> stores).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { toolManager } from '../renderer/tools'
import { resetStore, makeDevice } from './helpers'
import ToolEventSurface from '../renderer/components/canvas/ToolEventSurface'

describe('ToolEventSurface', () => {
  beforeEach(() => {
    resetStore()
  })

  it('dispatches empty-canvas marquee drags to the marquee tool', () => {
    toolManager.setActiveTool('marquee')
    render(
      <ToolEventSurface onWheel={vi.fn()}>
        <div data-testid="scene" style={{ width: 800, height: 600 }} />
      </ToolEventSurface>
    )
    const scene = screen.getByTestId('scene')

    fireEvent.pointerDown(scene, { pointerId: 1, button: 0, clientX: 50, clientY: 50, bubbles: true })
    expect(useRuntimeStore.getState().activeInteraction?.kind).toBe('marquee')

    fireEvent.pointerMove(scene, { pointerId: 1, button: 0, clientX: 150, clientY: 150, bubbles: true })
    const rect = useRuntimeStore.getState().marqueeRect
    expect(rect).toEqual({ x: 50, y: 50, width: 100, height: 100 })

    fireEvent.pointerUp(scene, { pointerId: 1, button: 0, clientX: 150, clientY: 150, bubbles: true })
    expect(useRuntimeStore.getState().marqueeRect).toBeNull()
    expect(useRuntimeStore.getState().activeInteraction).toBeNull()
    toolManager.setActiveTool('select')
  })

  it('routes middle-button drags to the hand tool for panning', () => {
    render(
      <ToolEventSurface onWheel={vi.fn()}>
        <div data-testid="scene" style={{ width: 800, height: 600 }} />
      </ToolEventSurface>
    )
    const scene = screen.getByTestId('scene')

    fireEvent.pointerDown(scene, { pointerId: 1, button: 1, clientX: 100, clientY: 100, bubbles: true })
    expect(useStore.getState().isPanning).toBe(true)
    expect(useRuntimeStore.getState().activeInteraction?.kind).toBe('pan')

    fireEvent.pointerMove(scene, { pointerId: 1, button: 1, clientX: 140, clientY: 130, bubbles: true })
    fireEvent.pointerUp(scene, { pointerId: 1, button: 1, clientX: 140, clientY: 130, bubbles: true })

    expect(useStore.getState().isPanning).toBe(false)
    expect(useStore.getState().panX).toBe(40)
    expect(useStore.getState().panY).toBe(30)
  })

  it('alt+drag with the left button pans while the hand tool is active', () => {
    toolManager.setActiveTool('hand')
    render(
      <ToolEventSurface onWheel={vi.fn()}>
        <div data-testid="scene" style={{ width: 800, height: 600 }} />
      </ToolEventSurface>
    )
    const scene = screen.getByTestId('scene')

    fireEvent.pointerDown(scene, { pointerId: 1, button: 0, altKey: true, clientX: 10, clientY: 10, bubbles: true })
    expect(useStore.getState().isPanning).toBe(true)

    fireEvent.pointerMove(scene, { pointerId: 1, button: 0, altKey: true, clientX: 40, clientY: 60, bubbles: true })
    fireEvent.pointerUp(scene, { pointerId: 1, button: 0, altKey: true, clientX: 40, clientY: 60, bubbles: true })

    expect(useStore.getState().panX).toBe(30)
    expect(useStore.getState().panY).toBe(50)
    toolManager.setActiveTool('select')
  })

  it('left-drag pans while a temporary Hand (Space) is active', () => {
    toolManager.pushTemporaryTool('hand', 'keyup')
    render(
      <ToolEventSurface onWheel={vi.fn()}>
        <div data-testid="scene" style={{ width: 800, height: 600 }} />
      </ToolEventSurface>
    )
    const scene = screen.getByTestId('scene')

    fireEvent.pointerDown(scene, { pointerId: 1, button: 0, clientX: 100, clientY: 100, bubbles: true })
    expect(useStore.getState().isPanning).toBe(true)
    expect(useRuntimeStore.getState().activeInteraction?.kind).toBe('pan')

    fireEvent.pointerMove(scene, { pointerId: 1, button: 0, clientX: 140, clientY: 130, bubbles: true })
    fireEvent.pointerUp(scene, { pointerId: 1, button: 0, clientX: 140, clientY: 130, bubbles: true })

    expect(useStore.getState().panX).toBe(40)
    expect(useStore.getState().panY).toBe(30)
    toolManager.releaseTemporaryUntil('keyup')
    toolManager.setActiveTool('select')
  })

  it('releases pointer ownership and capture on pointer up', () => {
    toolManager.setActiveTool('marquee')
    render(
      <ToolEventSurface onWheel={vi.fn()}>
        <div data-testid="scene" style={{ width: 800, height: 600 }} />
      </ToolEventSurface>
    )
    const scene = screen.getByTestId('scene')

    fireEvent.pointerDown(scene, { pointerId: 5, button: 0, clientX: 10, clientY: 10, bubbles: true })
    expect(toolManager.getOwner(5)).toBe('marquee')

    fireEvent.pointerUp(scene, { pointerId: 5, button: 0, clientX: 10, clientY: 10, bubbles: true })
    expect(toolManager.getOwner(5)).toBeNull()
    toolManager.setActiveTool('select')
  })

  it('ignores pointer moves not owned by the current owner set', () => {
    render(
      <ToolEventSurface onWheel={vi.fn()}>
        <div data-testid="scene" style={{ width: 800, height: 600 }} />
      </ToolEventSurface>
    )
    const scene = screen.getByTestId('scene')

    fireEvent.pointerMove(scene, { pointerId: 9, clientX: 50, clientY: 50, bubbles: true })
    expect(useStore.getState().panX).toBe(0)
    expect(useStore.getState().panY).toBe(0)
  })

  it('tracks hover over elements through the active tool and clears on leave', () => {
    const device = makeDevice({ id: 'dev-1', x: 100, y: 100, width: 100, height: 100 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [device] }] })
    render(
      <ToolEventSurface onWheel={vi.fn()}>
        <div data-testid="scene" style={{ width: 800, height: 600 }} />
      </ToolEventSurface>
    )
    const scene = screen.getByTestId('scene')

    fireEvent.pointerMove(scene, { pointerId: 1, clientX: 120, clientY: 120, bubbles: true })
    expect(useRuntimeStore.getState().hoveredElement).toEqual({ id: 'dev-1', kind: 'device' })

    fireEvent.pointerLeave(scene)
    expect(useRuntimeStore.getState().hoveredElement).toBeNull()
  })

  it('releases ownership on pointer cancel', () => {
    toolManager.setActiveTool('marquee')
    render(
      <ToolEventSurface onWheel={vi.fn()}>
        <div data-testid="scene" style={{ width: 800, height: 600 }} />
      </ToolEventSurface>
    )
    const scene = screen.getByTestId('scene')

    fireEvent.pointerDown(scene, { pointerId: 3, button: 0, clientX: 10, clientY: 10, bubbles: true })
    expect(toolManager.getOwner(3)).toBe('marquee')

    fireEvent.pointerCancel(scene, { pointerId: 3, bubbles: true })
    expect(toolManager.getOwner(3)).toBeNull()
    toolManager.setActiveTool('select')
  })

  it('binds the effective tool cursor to the viewport container', () => {
    const { container } = render(
      <ToolEventSurface onWheel={vi.fn()}>
        <div data-testid="scene" style={{ width: 800, height: 600 }} />
      </ToolEventSurface>
    )
    const surface = container.firstElementChild as HTMLElement
    expect(surface.style.cursor).toBe('default')

    act(() => toolManager.setActiveTool('hand'))
    expect(surface.style.cursor).toBe('grab')

    act(() => toolManager.setActiveTool('select'))
    expect(surface.style.cursor).toBe('default')
  })

  it('shows a move cursor when hovering a moveable element', () => {
    const device = makeDevice({ id: 'dev-1', x: 100, y: 100, width: 100, height: 100 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [device] }] })
    const { container } = render(
      <ToolEventSurface onWheel={vi.fn()}>
        <div data-testid="scene" style={{ width: 800, height: 600 }} />
      </ToolEventSurface>
    )
    const surface = container.firstElementChild as HTMLElement
    const scene = screen.getByTestId('scene')

    fireEvent.pointerMove(scene, { pointerId: 1, clientX: 120, clientY: 120, bubbles: true })
    expect(surface.style.cursor).toBe('move')

    fireEvent.pointerLeave(scene)
    expect(surface.style.cursor).toBe('default')
  })

  it('shows a dragging cursor while a move interaction is owned', () => {
    const device = makeDevice({ id: 'dev-1', x: 100, y: 100, width: 100, height: 100 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [device] }] })
    const { container } = render(
      <ToolEventSurface onWheel={vi.fn()}>
        <div
          data-testid="scene"
          data-element-id="dev-1"
          data-element-kind="device"
          style={{ position: 'absolute', left: 100, top: 100, width: 100, height: 100 }}
        />
      </ToolEventSurface>
    )
    const surface = container.firstElementChild as HTMLElement
    const scene = screen.getByTestId('scene')

    fireEvent.pointerDown(scene, { pointerId: 1, button: 0, clientX: 110, clientY: 110, bubbles: true })
    expect(surface.style.cursor).toBe('move')
    expect(useRuntimeStore.getState().activeInteraction?.kind).toBe('move')

    fireEvent.pointerUp(scene, { pointerId: 1, button: 0, clientX: 110, clientY: 110, bubbles: true })
    expect(surface.style.cursor).toBe('default')
  })

  it('shows the default cursor over dimmed elements while focused', () => {
    const devIn = makeDevice({ id: 'dev-in', x: 100, y: 100, width: 100, height: 100, groupId: 'g-1' })
    const devOut = makeDevice({ id: 'dev-out', x: 300, y: 300, width: 100, height: 100 })
    const sceneState = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...sceneState,
        devices: [devIn, devOut],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-in'], parentGroupId: null }]
      }]
    })
    useRuntimeStore.getState().enterFocus('g-1')

    const { container } = render(
      <ToolEventSurface onWheel={vi.fn()}>
        <div data-testid="scene" style={{ width: 800, height: 600 }} />
      </ToolEventSurface>
    )
    const surface = container.firstElementChild as HTMLElement
    const scene = screen.getByTestId('scene')

    fireEvent.pointerMove(scene, { pointerId: 1, clientX: 320, clientY: 320, bubbles: true })
    expect(surface.style.cursor).toBe('default')

    fireEvent.pointerMove(scene, { pointerId: 1, clientX: 120, clientY: 120, bubbles: true })
    expect(surface.style.cursor).toBe('move')

    act(() => useRuntimeStore.getState().exitFocus())
    expect(surface.style.cursor).toBe('move')
  })
})
