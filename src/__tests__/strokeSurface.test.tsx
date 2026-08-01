import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import StrokeSurface from '../renderer/components/canvas/StrokeSurface'
import { registerFastOverlayHost, getFastOverlayHost } from '../renderer/services/stroke-host'
import { useStore } from '../renderer/store'
import { safeScene } from '../renderer/store/sceneSlice'
import { resetStore } from './helpers'

describe('StrokeSurface', () => {
  beforeEach(() => {
    resetStore()
  })

  afterEach(() => {
    registerFastOverlayHost(null)
  })

  it('renders a canvas sized to the scene in CSS units', () => {
    render(<StrokeSurface />)
    const canvas = document.querySelector('[data-stroke-surface]') as HTMLCanvasElement
    const scene = safeScene(useStore.getState())
    expect(canvas).not.toBeNull()
    expect(canvas.style.width).toBe(`${scene.canvas.width}px`)
    expect(canvas.style.height).toBe(`${scene.canvas.height}px`)
  })

  it('sizes the bitmap to scene size at zoom 1', () => {
    render(<StrokeSurface />)
    const canvas = document.querySelector('[data-stroke-surface]') as HTMLCanvasElement
    const scene = safeScene(useStore.getState())
    expect(canvas.width).toBe(Math.round(scene.canvas.width))
    expect(canvas.height).toBe(Math.round(scene.canvas.height))
  })

  it('re-sizes the bitmap when zoom changes', () => {
    useStore.setState({ zoom: 2 })
    render(<StrokeSurface />)
    const canvas = document.querySelector('[data-stroke-surface]') as HTMLCanvasElement
    const scene = safeScene(useStore.getState())
    expect(canvas.width).toBe(Math.round(scene.canvas.width * 2))
    expect(canvas.height).toBe(Math.round(scene.canvas.height * 2))
  })

  it('registers the fast-lane host on mount and deregisters on unmount', () => {
    expect(getFastOverlayHost()).toBeNull()
    const { unmount } = render(<StrokeSurface />)
    expect(getFastOverlayHost()).not.toBeNull()
    unmount()
    expect(getFastOverlayHost()).toBeNull()
  })

  it('the registered host drives the canvas without throwing', () => {
    render(<StrokeSurface />)
    const host = getFastOverlayHost()
    expect(host).not.toBeNull()
    const state = { color: '#ff0000', width: 8, hardness: 0.8, pressure: 1 }
    expect(() => {
      host!.beginStroke(state)
      host!.strokeLine({ x: 0, y: 0 }, { x: 100, y: 50 }, { ...state, pressure: 0.5 })
      host!.clear()
    }).not.toThrow()
  })

  it('keeps the host registered across zoom re-renders', () => {
    const { rerender } = render(<StrokeSurface />)
    useStore.setState({ zoom: 1.5 })
    rerender(<StrokeSurface />)
    const canvas = document.querySelector('[data-stroke-surface]') as HTMLCanvasElement
    const scene = safeScene(useStore.getState())
    expect(canvas.width).toBe(Math.round(scene.canvas.width * 1.5))
    expect(getFastOverlayHost()).not.toBeNull()
  })
})
