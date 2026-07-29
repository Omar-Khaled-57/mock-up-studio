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

// Theme presets — complete scene color schemes
export interface ThemePreset {
  id: string
  name: string
  description: string
  background: { type: 'solid' | 'gradient' | 'preset'; color?: string; colors?: string[]; angle?: number; presetName?: string }
  titleColor: string
  sloganColor: string
  accentColor: string
  deviceTheme: 'dark' | 'light' | 'space-gray' | 'midnight' | 'custom'
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'midnight-aurora', name: 'Midnight Aurora', description: 'Deep blues and purples with aurora background', background: { type: 'preset', presetName: 'aurora' }, titleColor: '#ffffff', sloganColor: '#a78bfa', accentColor: '#818cf8', deviceTheme: 'dark' },
  { id: 'neon-nights', name: 'Neon Nights', description: 'Cyberpunk-inspired neon on dark grid', background: { type: 'preset', presetName: 'neon-grid' }, titleColor: '#22d3ee', sloganColor: '#f472b6', accentColor: '#2dd4bf', deviceTheme: 'midnight' },
  { id: 'ocean-deep', name: 'Ocean Deep', description: 'Deep blue ocean gradient with pearl accents', background: { type: 'gradient', colors: ['#0f2027', '#203a43', '#2c5364'], angle: 160 }, titleColor: '#ffffff', sloganColor: '#67e8f9', accentColor: '#06b6d4', deviceTheme: 'dark' },
  { id: 'sunset-coral', name: 'Sunset Coral', description: 'Warm sunset colors with coral accents', background: { type: 'gradient', colors: ['#ff7e5f', '#feb47b'], angle: 135 }, titleColor: '#1a1a2e', sloganColor: '#16213e', accentColor: '#e85d04', deviceTheme: 'light' },
  { id: 'forest-canopy', name: 'Forest Canopy', description: 'Earthy greens and natural tones', background: { type: 'gradient', colors: ['#134e5e', '#71b280'], angle: 180 }, titleColor: '#ffffff', sloganColor: '#86efac', accentColor: '#22c55e', deviceTheme: 'dark' },
  { id: 'royal-purple', name: 'Royal Purple', description: 'Rich purples with gold accents', background: { type: 'gradient', colors: ['#1a0533', '#4c1d95'], angle: 135 }, titleColor: '#ffffff', sloganColor: '#fbbf24', accentColor: '#a78bfa', deviceTheme: 'midnight' },
  { id: 'frost-white', name: 'Frost White', description: 'Clean white minimal with ice blue accents', background: { type: 'gradient', colors: ['#e0e7ff', '#f0f4ff'], angle: 90 }, titleColor: '#1e1b4b', sloganColor: '#6366f1', accentColor: '#4f46e5', deviceTheme: 'light' },
  { id: 'cyber-blue', name: 'Cyber Blue', description: 'Electric blues on dark cyber backdrop', background: { type: 'preset', presetName: 'blue-cyber' }, titleColor: '#ffffff', sloganColor: '#38bdf8', accentColor: '#0ea5e9', deviceTheme: 'dark' },
  { id: 'warm-ember', name: 'Warm Ember', description: 'Cozy ambers and oranges', background: { type: 'gradient', colors: ['#f12711', '#f5af19'], angle: 45 }, titleColor: '#ffffff', sloganColor: '#fde68a', accentColor: '#f59e0b', deviceTheme: 'dark' },
  { id: 'monochrome', name: 'Monochrome', description: 'Sleek black and white palette', background: { type: 'solid', color: '#0a0a0a' }, titleColor: '#ffffff', sloganColor: '#a1a1aa', accentColor: '#ffffff', deviceTheme: 'space-gray' },
  { id: 'lavender-dream', name: 'Lavender Dream', description: 'Soft lavenders with mint accents', background: { type: 'gradient', colors: ['#c084fc', '#a78bfa', '#818cf8'], angle: 120 }, titleColor: '#ffffff', sloganColor: '#6ee7b7', accentColor: '#34d399', deviceTheme: 'light' },
  { id: 'desert-sand', name: 'Desert Sand', description: 'Warm desert tones with terracotta', background: { type: 'gradient', colors: ['#f97316', '#fb923c'], angle: 180 }, titleColor: '#7c2d12', sloganColor: '#431407', accentColor: '#ea580c', deviceTheme: 'light' },
  { id: 'arctic-chill', name: 'Arctic Chill', description: 'Icy blues and cool whites', background: { type: 'gradient', colors: ['#1e3a5f', '#2d6da8', '#5fa8d3'], angle: 160 }, titleColor: '#ffffff', sloganColor: '#93c5fd', accentColor: '#60a5fa', deviceTheme: 'dark' },
  { id: 'cherry-blossom', name: 'Cherry Blossom', description: 'Soft pinks and sage greens', background: { type: 'gradient', colors: ['#fce4ec', '#f8bbd0', '#e8f5e9'], angle: 135 }, titleColor: '#4a1c2e', sloganColor: '#7b1fa2', accentColor: '#c2185b', deviceTheme: 'light' },
  { id: 'midnight-sapphire', name: 'Midnight Sapphire', description: 'Deep navy with sapphire sparkle', background: { type: 'solid', color: '#0c1445' }, titleColor: '#ffffff', sloganColor: '#60a5fa', accentColor: '#3b82f6', deviceTheme: 'midnight' },
  { id: 'toxic-green', name: 'Toxic Green', description: 'Neon green on dark cyber background', background: { type: 'preset', presetName: 'neon-grid' }, titleColor: '#4ade80', sloganColor: '#22d3ee', accentColor: '#10b981', deviceTheme: 'midnight' },
  { id: 'rose-gold', name: 'Rose Gold', description: 'Elegant rose gold palette', background: { type: 'gradient', colors: ['#b76e79', '#e8a598'], angle: 145 }, titleColor: '#ffffff', sloganColor: '#fce4ec', accentColor: '#e91e63', deviceTheme: 'light' }
]
