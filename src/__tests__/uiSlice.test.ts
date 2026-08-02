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
    useStore.getState().setSidebarTab('background')
    expect(useStore.getState().sidebarTab).toBe('background')
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

  it('theme defaults to dark', () => {
    expect(useStore.getState().theme).toBe('dark')
  })

  it('setTheme changes theme', () => {
    useStore.getState().setTheme('light')
    expect(useStore.getState().theme).toBe('light')
  })

  it('toggleTheme switches between dark and light', () => {
    expect(useStore.getState().theme).toBe('dark')
    useStore.getState().toggleTheme()
    expect(useStore.getState().theme).toBe('light')
    useStore.getState().toggleTheme()
    expect(useStore.getState().theme).toBe('dark')
  })

  it('defaults sidebarPanelWidth to 224', () => {
    expect(useStore.getState().sidebarPanelWidth).toBe(224)
  })

  it('setSidebarPanelWidth changes width', () => {
    useStore.getState().setSidebarPanelWidth(260)
    expect(useStore.getState().sidebarPanelWidth).toBe(260)
  })

  it('defaults propertiesPanelWidth to 208', () => {
    expect(useStore.getState().propertiesPanelWidth).toBe(208)
  })

  it('setPropertiesPanelWidth changes width', () => {
    useStore.getState().setPropertiesPanelWidth(240)
    expect(useStore.getState().propertiesPanelWidth).toBe(240)
  })

  it('showRulers defaults to false', () => {
    expect(useStore.getState().showRulers).toBe(false)
  })

  it('toggleRulers toggles rulers', () => {
    expect(useStore.getState().showRulers).toBe(false)
    useStore.getState().toggleRulers()
    expect(useStore.getState().showRulers).toBe(true)
    useStore.getState().toggleRulers()
    expect(useStore.getState().showRulers).toBe(false)
  })

  it('setShowRulers changes value', () => {
    useStore.getState().setShowRulers(true)
    expect(useStore.getState().showRulers).toBe(true)
  })

  it('propertiesPanelOpen defaults to false', () => {
    expect(useStore.getState().propertiesPanelOpen).toBe(false)
  })

  it('setPropertiesPanelOpen changes value', () => {
    useStore.getState().setPropertiesPanelOpen(true)
    expect(useStore.getState().propertiesPanelOpen).toBe(true)
  })
})
