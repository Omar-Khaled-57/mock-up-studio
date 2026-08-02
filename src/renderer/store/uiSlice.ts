import { StateCreator } from 'zustand'
import { StoreState } from './index'

export type Theme = 'dark' | 'light'
export type SidebarTab =
  | 'canvas'
  | 'background'
  | 'themes' // legacy — merged into 'background'
  | 'theme-presets' // legacy — merged into 'background'
  | 'presets' // legacy — canvas size is its own 'canvas' tab again (post-5e polish)
  | 'export' // legacy — becomes a modal (Phase 5e); kept for backward-compat of stored UI state
  | 'devices'
  | 'images'
  | 'text'
  | 'shapes'
  | 'layers'
  | 'grid'
  | 'history'

export interface UiSlice {
  sidebarTab: SidebarTab
  sidebarCollapsed: boolean
  propertiesPanelOpen: boolean
  showSplash: boolean
  theme: Theme
  sidebarPanelWidth: number
  propertiesPanelWidth: number
  showRulers: boolean
  showSmartGuides: boolean
  downloadProgress: number | null
  setSidebarTab: (tab: SidebarTab) => void
  toggleSidebar: () => void
  setPropertiesPanelOpen: (open: boolean) => void
  setShowSplash: (show: boolean) => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setSidebarPanelWidth: (width: number) => void
  setPropertiesPanelWidth: (width: number) => void
  toggleRulers: () => void
  setShowRulers: (show: boolean) => void
  toggleSmartGuides: () => void
  setDownloadProgress: (percent: number | null) => void
}

export const createUiSlice: StateCreator<StoreState, [], [], UiSlice> = (set) => ({
  sidebarTab: 'devices',
  sidebarCollapsed: false,
  propertiesPanelOpen: false,
  showSplash: true,
  theme: 'dark',
  sidebarPanelWidth: 224,
  propertiesPanelWidth: 208,
  showRulers: false,
  showSmartGuides: true,
  downloadProgress: null,

  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setPropertiesPanelOpen: (open) => set({ propertiesPanelOpen: open }),

  setShowSplash: (show) => set({ showSplash: show }),

  setTheme: (theme) => set({ theme }),

  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

  setSidebarPanelWidth: (width) => set({ sidebarPanelWidth: width }),

  setPropertiesPanelWidth: (width) => set({ propertiesPanelWidth: width }),

  toggleRulers: () =>
    set((state) => ({ showRulers: !state.showRulers })),

  setShowRulers: (show) => set({ showRulers: show }),

  toggleSmartGuides: () =>
    set((state) => ({ showSmartGuides: !state.showSmartGuides })),

  setDownloadProgress: (percent) => set({ downloadProgress: percent })
})
