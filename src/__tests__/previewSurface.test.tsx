import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import PreviewSurface from '../renderer/components/canvas/PreviewSurface'
import { useStore } from '../renderer/store'
import { safeScene } from '../renderer/store/sceneSlice'
import { useRuntimeStore } from '../renderer/runtime/store'
import { buildGhostPreview } from '../renderer/services/preview'
import { resetStore } from './helpers'

function spyContext(canvas: HTMLCanvasElement): { calls: string[] } {
  const calls: string[] = []
  const fn = (name: string) => () => {
    calls.push(name)
  }
  const fake = {
    save: fn('save'),
    restore: fn('restore'),
    setTransform: fn('setTransform'),
    clearRect: fn('clearRect'),
    setLineDash: fn('setLineDash'),
    beginPath: fn('beginPath'),
    fill: fn('fill'),
    stroke: fn('stroke'),
    moveTo: fn('moveTo'),
    lineTo: fn('lineTo'),
    rect: fn('rect'),
    ellipse: fn('ellipse')
  } as unknown as CanvasRenderingContext2D
  canvas.getContext = (() => fake) as typeof canvas.getContext
  return { calls }
}

describe('PreviewSurface', () => {
  beforeEach(() => {
    resetStore()
  })

  afterEach(() => {
    useRuntimeStore.getState().setPreview(null)
  })

  it('renders a canvas sized to the scene in CSS units', () => {
    render(<PreviewSurface />)
    const canvas = document.querySelector('[data-preview-surface]') as HTMLCanvasElement
    const scene = safeScene(useStore.getState())
    expect(canvas).not.toBeNull()
    expect(canvas.style.width).toBe(`${scene.canvas.width}px`)
    expect(canvas.style.height).toBe(`${scene.canvas.height}px`)
  })

  it('sizes the bitmap to scene size at zoom 1', () => {
    render(<PreviewSurface />)
    const canvas = document.querySelector('[data-preview-surface]') as HTMLCanvasElement
    const scene = safeScene(useStore.getState())
    expect(canvas.width).toBe(Math.round(scene.canvas.width))
    expect(canvas.height).toBe(Math.round(scene.canvas.height))
  })

  it('re-sizes the bitmap when zoom changes', () => {
    useStore.setState({ zoom: 2 })
    render(<PreviewSurface />)
    const canvas = document.querySelector('[data-preview-surface]') as HTMLCanvasElement
    const scene = safeScene(useStore.getState())
    expect(canvas.width).toBe(Math.round(scene.canvas.width * 2))
    expect(canvas.height).toBe(Math.round(scene.canvas.height * 2))
  })

  it('draws a ghost preview when the runtime preview changes (no re-render)', () => {
    render(<PreviewSurface />)
    const canvas = document.querySelector('[data-preview-surface]') as HTMLCanvasElement
    const { calls } = spyContext(canvas)
    calls.length = 0

    act(() => {
      useRuntimeStore.getState().setPreview(buildGhostPreview({ id: 'el-1', x: 10, y: 20, width: 100, height: 50 }))
    })
    expect(calls).toContain('clearRect')
    expect(calls).toContain('fill')
    expect(calls).toContain('stroke')
    expect(calls).toContain('setLineDash')
  })

  it('clears the canvas when the preview becomes null', () => {
    render(<PreviewSurface />)
    const canvas = document.querySelector('[data-preview-surface]') as HTMLCanvasElement
    const { calls } = spyContext(canvas)
    calls.length = 0

    act(() => {
      useRuntimeStore.getState().setPreview(buildGhostPreview({ id: 'el-1', x: 0, y: 0, width: 10, height: 10 }))
    })
    act(() => {
      useRuntimeStore.getState().setPreview(null)
    })
    const clears = calls.filter((c) => c === 'clearRect').length
    expect(clears).toBeGreaterThanOrEqual(2)
    // No fill/stroke after the final clear for the null state.
    const fillAfterLastClear = calls.lastIndexOf('fill') > calls.lastIndexOf('clearRect')
    expect(fillAfterLastClear).toBe(false)
  })
})
