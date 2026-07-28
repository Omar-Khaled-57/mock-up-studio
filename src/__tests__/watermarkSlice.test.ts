import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { resetStore } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

describe('watermarkSlice', () => {
  it('defaults to disabled', () => {
    expect(useStore.getState().watermark.enabled).toBe(false)
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
