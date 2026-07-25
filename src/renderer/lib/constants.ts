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
