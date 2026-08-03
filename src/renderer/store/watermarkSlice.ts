import { StateCreator } from 'zustand'
import { StoreState } from './index'

export interface WatermarkSettings {
  enabled: boolean
  text: string
  fontSize: number
  color: string
  opacity: number
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
}

export interface WatermarkSlice {
  watermark: WatermarkSettings
  setWatermark: (patch: Partial<WatermarkSettings>) => void
}

export const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: true,
  text: 'Mockup Studio',
  fontSize: 34,
  color: '#ffffff',
  opacity: 60,
  position: 'bottom-right'
}

export const createWatermarkSlice: StateCreator<StoreState, [], [], WatermarkSlice> = (set) => ({
  watermark: { ...DEFAULT_WATERMARK },

  setWatermark: (patch) =>
    set((state) => ({
      watermark: { ...state.watermark, ...patch }
    }))
})
