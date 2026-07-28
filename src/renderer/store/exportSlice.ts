import { StateCreator } from 'zustand'
import { StoreState } from './index'
import type { ExportFormat, ExportScale, ExportBackground } from '../lib/export-engine'

export type { ExportFormat, ExportScale, ExportBackground }

export interface ExportSlice {
  exportFormat: ExportFormat
  exportScale: ExportScale
  exportQuality: number
  exportBackground: ExportBackground
  exportBackgroundColor: string
  setExportFormat: (format: ExportFormat) => void
  setExportScale: (scale: ExportScale) => void
  setExportQuality: (quality: number) => void
  setExportBackground: (bg: ExportBackground) => void
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
