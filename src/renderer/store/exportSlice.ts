import { StateCreator } from 'zustand'
import { StoreState } from './index'

export type ExportFormat = 'png' | 'jpeg' | 'webp'
export type ExportScale = 1 | 2 | 3 | 4

export interface ExportSlice {
  exportFormat: ExportFormat
  exportScale: ExportScale
  exportQuality: number
  exportBackground: 'scene' | 'solid' | 'transparent'
  exportBackgroundColor: string
  setExportFormat: (format: ExportFormat) => void
  setExportScale: (scale: ExportScale) => void
  setExportQuality: (quality: number) => void
  setExportBackground: (bg: 'scene' | 'solid' | 'transparent') => void
  setExportBackgroundColor: (color: string) => void
}

export const createExportSlice: StateCreator<StoreState, [], [], ExportSlice> = (set) => ({
  exportFormat: 'png',
  exportScale: 2,
  exportQuality: 90,
  exportBackground: 'scene',
  exportBackgroundColor: '#ffffff',

  setExportFormat: (format) => set({ exportFormat: format }),
  setExportScale: (scale) => set({ exportScale: scale }),
  setExportQuality: (quality) => set({ exportQuality: quality }),
  setExportBackground: (bg) => set({ exportBackground: bg }),
  setExportBackgroundColor: (color) => set({ exportBackgroundColor: color })
})
