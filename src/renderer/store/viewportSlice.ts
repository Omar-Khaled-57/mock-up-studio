import { StateCreator } from 'zustand'
import { StoreState } from './index'

export interface ViewportSlice {
  zoom: number
  panX: number
  panY: number
  isPanning: boolean
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  setPan: (x: number, y: number) => void
  setIsPanning: (v: boolean) => void
  fitToWindow: (canvasWidth: number, canvasHeight: number, viewportWidth: number, viewportHeight: number) => void
  resetZoom: () => void
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const ZOOM_STEP = 0.1

export const createViewportSlice: StateCreator<StoreState, [], [], ViewportSlice> = (set) => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,

  setZoom: (zoom) => set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }),

  zoomIn: () =>
    set((state) => ({
      zoom: Math.min(MAX_ZOOM, state.zoom + ZOOM_STEP)
    })),

  zoomOut: () =>
    set((state) => ({
      zoom: Math.max(MIN_ZOOM, state.zoom - ZOOM_STEP)
    })),

  setPan: (x, y) => set({ panX: x, panY: y }),

  setIsPanning: (v) => set({ isPanning: v }),

  fitToWindow: (canvasWidth, canvasHeight, viewportWidth, viewportHeight) => {
    const padding = 60
    const scaleX = (viewportWidth - padding * 2) / canvasWidth
    const scaleY = (viewportHeight - padding * 2) / canvasHeight
    const zoom = Math.min(scaleX, scaleY, 1)
    const panX = (viewportWidth - canvasWidth * zoom) / 2
    const panY = (viewportHeight - canvasHeight * zoom) / 2
    set({ zoom, panX, panY })
  },

  resetZoom: () => set({ zoom: 1, panX: 0, panY: 0 })
})
