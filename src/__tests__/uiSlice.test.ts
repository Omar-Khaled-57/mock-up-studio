import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { resetStore } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

describe('uiSlice', () => {
  it('defaults to devices tab', () => {
    expect(useStore.getState().sidebarTab).toBe('devices')
  })

  it('setSidebarTab changes tab', () => {
    useStore.getState().setSidebarTab('export')
    expect(useStore.getState().sidebarTab).toBe('export')
  })

  it('toggleSidebar toggles collapsed state', () => {
    expect(useStore.getState().sidebarCollapsed).toBe(false)
    useStore.getState().toggleSidebar()
    expect(useStore.getState().sidebarCollapsed).toBe(true)
    useStore.getState().toggleSidebar()
    expect(useStore.getState().sidebarCollapsed).toBe(false)
  })

  it('showSplash defaults to true', () => {
    expect(useStore.getState().showSplash).toBe(true)
  })

  it('setShowSplash changes value', () => {
    useStore.getState().setShowSplash(false)
    expect(useStore.getState().showSplash).toBe(false)
  })
})
