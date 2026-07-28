import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { resetStore } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

describe('zoom', () => {
  it('defaults to 1', () => {
    expect(useStore.getState().zoom).toBe(1)
  })

  it('setZoom clamps to [0.1, 5]', () => {
    useStore.getState().setZoom(10)
    expect(useStore.getState().zoom).toBe(5)
    useStore.getState().setZoom(0.01)
    expect(useStore.getState().zoom).toBe(0.1)
  })

  it('zoomIn increases by 0.1', () => {
    useStore.getState().zoomIn()
    expect(useStore.getState().zoom).toBeCloseTo(1.1)
  })

  it('zoomOut decreases by 0.1', () => {
    useStore.getState().zoomOut()
    expect(useStore.getState().zoom).toBeCloseTo(0.9)
  })

  it('zoomIn clamps at max 5', () => {
    useStore.getState().setZoom(5)
    useStore.getState().zoomIn()
    expect(useStore.getState().zoom).toBe(5)
  })

  it('zoomOut clamps at min 0.1', () => {
    useStore.getState().setZoom(0.1)
    useStore.getState().zoomOut()
    expect(useStore.getState().zoom).toBe(0.1)
  })
})

describe('pan', () => {
  it('defaults to 0,0', () => {
    expect(useStore.getState().panX).toBe(0)
    expect(useStore.getState().panY).toBe(0)
  })

  it('setPan updates both axes', () => {
    useStore.getState().setPan(100, 200)
    expect(useStore.getState().panX).toBe(100)
    expect(useStore.getState().panY).toBe(200)
  })
})

describe('fitToWindow', () => {
  it('centers canvas in viewport', () => {
    useStore.getState().fitToWindow(1280, 720, 1920, 1080)
    const { zoom, panX, panY } = useStore.getState()
    expect(zoom).toBeGreaterThan(0)
    expect(zoom).toBeLessThanOrEqual(1)
    // Pan should center the canvas
    expect(panX).toBeGreaterThan(0)
    expect(panY).toBeGreaterThan(0)
  })

  it('never exceeds zoom 1', () => {
    useStore.getState().fitToWindow(100, 100, 1920, 1080)
    expect(useStore.getState().zoom).toBeLessThanOrEqual(1)
  })
})

describe('resetZoom', () => {
  it('resets zoom and pan to defaults', () => {
    useStore.getState().setZoom(2)
    useStore.getState().setPan(100, 200)
    useStore.getState().resetZoom()
    expect(useStore.getState().zoom).toBe(1)
    expect(useStore.getState().panX).toBe(0)
    expect(useStore.getState().panY).toBe(0)
  })
})

describe('isPanning', () => {
  it('toggles isPanning', () => {
    expect(useStore.getState().isPanning).toBe(false)
    useStore.getState().setIsPanning(true)
    expect(useStore.getState().isPanning).toBe(true)
  })
})
