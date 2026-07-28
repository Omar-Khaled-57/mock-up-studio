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

const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: false,
  text: 'Mockup Studio',
  fontSize: 14,
  color: '#ffffff',
  opacity: 30,
  position: 'bottom-right'
}

export const createWatermarkSlice: StateCreator<StoreState, [], [], WatermarkSlice> = (set) => ({
  watermark: { ...DEFAULT_WATERMARK },

  setWatermark: (patch) =>
    set((state) => ({
      watermark: { ...state.watermark, ...patch }
    }))
})
