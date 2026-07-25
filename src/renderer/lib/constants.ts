// Canvas presets (width x height in px)
export const CANVAS_PRESETS = [
  { label: 'YouTube Thumbnail', width: 1280, height: 720 },
  { label: 'YouTube Banner', width: 2560, height: 1440 },
  { label: 'Instagram Post', width: 1080, height: 1080 },
  { label: 'Instagram Story', width: 1080, height: 1920 },
  { label: 'LinkedIn Banner', width: 1584, height: 396 },
  { label: 'Twitter Header', width: 1500, height: 500 }
] as const

// Device aspect ratios (width:height)
export const DEVICE_ASPECT_RATIOS: Record<string, number> = {
  monitor: 16 / 10,
  laptop: 16 / 10,
  ipad: 4 / 3,
  phone: 9 / 19.5,
  watch: 1,
  browser: 16 / 9,
  terminal: 16 / 9
}

// Default canvas (YouTube Thumbnail)
export const DEFAULT_CANVAS = {
  width: 1280,
  height: 720,
  aspectRatio: '16:9'
}

// Snap threshold in px
export const SNAP_THRESHOLD = 5

// Background presets
export type AnimatedPreset = 'aurora' | 'neon-grid' | 'blue-cyber'
export type StaticPreset = 'q-preset' | 'qless' | 'storybox3' | 'dark-solid'
export type BackgroundPresetName = AnimatedPreset | StaticPreset

export interface BackgroundPresetMeta {
  name: BackgroundPresetName
  label: string
  category: 'animated' | 'static'
  thumbnail: string
}

export const BACKGROUND_PRESETS: BackgroundPresetMeta[] = [
  { name: 'aurora', label: 'Aurora', category: 'animated', thumbnail: 'linear-gradient(135deg, #0b1628, #1a0533, #0f3460, #16213e)' },
  { name: 'neon-grid', label: 'Neon Grid', category: 'animated', thumbnail: 'linear-gradient(180deg, #0a0a0a 0%, #0f0f23 50%, #0a0a0a 100%)' },
  { name: 'blue-cyber', label: 'Blue Cyber', category: 'animated', thumbnail: 'linear-gradient(160deg, #000428, #004e92)' },
  { name: 'q-preset', label: 'Q-Preset', category: 'static', thumbnail: 'linear-gradient(135deg, #1a3a5c, #2563eb)' },
  { name: 'qless', label: 'Qless', category: 'static', thumbnail: 'linear-gradient(135deg, #2d1b69, #7c3aed)' },
  { name: 'storybox3', label: 'Storybox3', category: 'static', thumbnail: 'linear-gradient(135deg, #1a0533, #4c1d95)' },
  { name: 'dark-solid', label: 'Dark Solid', category: 'static', thumbnail: '#0a0a0a' }
]
