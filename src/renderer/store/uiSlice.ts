import { StateCreator } from 'zustand'
import { StoreState } from './index'

export type SidebarTab = 'themes' | 'devices' | 'images' | 'text' | 'layers' | 'export' | 'presets'

export interface UiSlice {
  sidebarTab: SidebarTab
  sidebarCollapsed: boolean
  propertiesPanelOpen: boolean
  setSidebarTab: (tab: SidebarTab) => void
  toggleSidebar: () => void
  setPropertiesPanelOpen: (open: boolean) => void
}

export const createUiSlice: StateCreator<StoreState, [], [], UiSlice> = (set) => ({
  sidebarTab: 'devices',
  sidebarCollapsed: false,
  propertiesPanelOpen: false,

  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setPropertiesPanelOpen: (open) => set({ propertiesPanelOpen: open })
})
