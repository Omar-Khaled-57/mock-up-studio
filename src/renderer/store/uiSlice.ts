import { StateCreator } from 'zustand'
import { StoreState } from './index'

export type Theme = 'dark' | 'light'
export type SidebarTab = 'themes' | 'devices' | 'images' | 'text' | 'layers' | 'export' | 'presets' | 'grid' | 'history'

export interface UiSlice {
  sidebarTab: SidebarTab
  sidebarCollapsed: boolean
  propertiesPanelOpen: boolean
  showSplash: boolean
  theme: Theme
  setSidebarTab: (tab: SidebarTab) => void
  toggleSidebar: () => void
  setPropertiesPanelOpen: (open: boolean) => void
  setShowSplash: (show: boolean) => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const createUiSlice: StateCreator<StoreState, [], [], UiSlice> = (set) => ({
  sidebarTab: 'devices',
  sidebarCollapsed: false,
  propertiesPanelOpen: false,
  showSplash: true,
  theme: 'dark',

  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setPropertiesPanelOpen: (open) => set({ propertiesPanelOpen: open }),

  setShowSplash: (show) => set({ showSplash: show }),

  setTheme: (theme) => set({ theme }),

  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }))
})
