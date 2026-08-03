import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { DEFAULT_WATERMARK } from '../renderer/store/watermarkSlice'
import { resetStore } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

describe('watermarkSlice', () => {
  it('defaults to enabled with 70%-of-max size (34px) and 60% opacity', () => {
    expect(DEFAULT_WATERMARK.enabled).toBe(true)
    expect(DEFAULT_WATERMARK.fontSize).toBe(34)
    expect(DEFAULT_WATERMARK.opacity).toBe(60)
  })

  it('setWatermark patches watermark settings', () => {
    useStore.getState().setWatermark({ enabled: true, text: 'My Watermark' })
    expect(useStore.getState().watermark.enabled).toBe(true)
    expect(useStore.getState().watermark.text).toBe('My Watermark')
  })

  it('setWatermark preserves unpatched fields', () => {
    const origFontSize = useStore.getState().watermark.fontSize
    useStore.getState().setWatermark({ enabled: true })
    expect(useStore.getState().watermark.fontSize).toBe(origFontSize)
  })
})
