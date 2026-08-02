import { BrushOptions, BrushShape } from '../runtime/runtimeSlice'

/** Which option controls a brush preset exposes in the toolbar options strip. */
export type BrushControl = 'color' | 'size' | 'hardness' | 'opacity' | 'shape'

export interface BrushPreset {
  id: string
  label: string
  /** Optional display title for the toolbar options strip, independent of the button label. */
  optionsLabel?: string
  icon: string
  description: string
  /** Non-color defaults applied when the preset is activated. Color is global and survives tool switches. */
  defaults: Omit<BrushOptions, 'color'>
  /** The controls this preset exposes in the toolbar options strip. */
  controls: BrushControl[]
}

/**
 * Data-driven paint-brush registry: every paint variant is a preset over a
 * single shared brush engine — only the defaults and the exposed controls
 * differ, so adding a brush is a one-row registry change.
 */
export const BRUSH_PRESETS: Record<string, BrushPreset> = {
  paint: {
    id: 'paint',
    label: 'Paint',
    icon: 'paint',
    description: 'All-purpose soft round brush',
    defaults: { size: 24, hardness: 0.6, shape: 'round', opacity: 1 },
    controls: ['color', 'size', 'hardness', 'opacity', 'shape']
  },
  pencil: {
    id: 'pencil',
    label: 'Pencil',
    icon: 'pencil',
    description: 'Fine hard edge for sketching lines',
    defaults: { size: 3, hardness: 1, shape: 'round', opacity: 0.95 },
    controls: ['color', 'size', 'opacity']
  },
  airbrush: {
    id: 'airbrush',
    label: 'Airbrush',
    icon: 'airbrush',
    description: 'Wide soft spray that builds up gradually',
    defaults: { size: 60, hardness: 0.08, shape: 'round', opacity: 0.35 },
    controls: ['color', 'size', 'opacity']
  },
  marker: {
    id: 'marker',
    label: 'Marker',
    icon: 'marker',
    description: 'Firm square chisel tip',
    defaults: { size: 16, hardness: 0.9, shape: 'square', opacity: 0.8 },
    controls: ['color', 'size', 'opacity']
  },
  calligraphy: {
    id: 'calligraphy',
    label: 'Pen',
    optionsLabel: 'Calligraphy',
    icon: 'calligraphy',
    description: 'Expressive pointed nib',
    defaults: { size: 18, hardness: 0.7, shape: 'round', opacity: 1 },
    controls: ['color', 'size', 'hardness', 'opacity']
  },
  pixel: {
    id: 'pixel',
    label: 'Pixel',
    icon: 'pixel',
    description: 'Sharp square pixel-art brush',
    defaults: { size: 8, hardness: 1, shape: 'square', opacity: 1 },
    controls: ['color', 'size']
  }
}

export const BRUSH_PRESET_IDS = Object.keys(BRUSH_PRESETS)

export function getBrushPreset(id: string): BrushPreset {
  return BRUSH_PRESETS[id] ?? BRUSH_PRESETS.paint
}

export type { BrushShape }
