import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { resetStore } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

describe('exportSlice', () => {
  it('defaults to png at 2x', () => {
    expect(useStore.getState().exportFormat).toBe('png')
    expect(useStore.getState().exportScale).toBe(2)
  })

  it('setExportFormat changes format', () => {
    useStore.getState().setExportFormat('jpeg')
    expect(useStore.getState().exportFormat).toBe('jpeg')
  })

  it('setExportScale changes scale', () => {
    useStore.getState().setExportScale(3)
    expect(useStore.getState().exportScale).toBe(3)
  })

  it('setExportQuality changes quality', () => {
    useStore.getState().setExportQuality(80)
    expect(useStore.getState().exportQuality).toBe(80)
  })

  it('setExportBackground changes background', () => {
    useStore.getState().setExportBackground('transparent')
    expect(useStore.getState().exportBackground).toBe('transparent')
  })

  it('setExportBackgroundColor changes color', () => {
    useStore.getState().setExportBackgroundColor('#ff0000')
    expect(useStore.getState().exportBackgroundColor).toBe('#ff0000')
  })
})
