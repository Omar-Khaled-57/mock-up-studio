import { describe, it, expect } from 'vitest'
import {
  BRUSH_PRESETS,
  BRUSH_PRESET_IDS,
  getBrushPreset
} from '../renderer/lib/brush-presets'

describe('brush-presets', () => {
  describe('BRUSH_PRESETS registry', () => {
    it('contains 6 presets', () => {
      expect(Object.keys(BRUSH_PRESETS)).toHaveLength(6)
    })

    it('has expected preset ids', () => {
      expect(BRUSH_PRESET_IDS).toEqual([
        'paint', 'pencil', 'airbrush', 'marker', 'calligraphy', 'pixel'
      ])
    })

    it('each preset has id, label, icon, description, defaults, controls', () => {
      for (const preset of Object.values(BRUSH_PRESETS)) {
        expect(preset.id).toBeTruthy()
        expect(preset.label).toBeTruthy()
        expect(preset.icon).toBeTruthy()
        expect(preset.description).toBeTruthy()
        expect(preset.defaults).toBeDefined()
        expect(preset.defaults.size).toBeGreaterThan(0)
        expect(preset.defaults.hardness).toBeGreaterThanOrEqual(0)
        expect(preset.defaults.hardness).toBeLessThanOrEqual(1)
        expect(['round', 'square']).toContain(preset.defaults.shape)
        expect(preset.defaults.opacity).toBeGreaterThan(0)
        expect(preset.defaults.opacity).toBeLessThanOrEqual(1)
        expect(preset.controls.length).toBeGreaterThan(0)
      }
    })

    it('paint preset is the soft all-purpose default', () => {
      const paint = BRUSH_PRESETS.paint
      expect(paint.defaults.size).toBe(24)
      expect(paint.defaults.hardness).toBe(0.6)
      expect(paint.defaults.shape).toBe('round')
      expect(paint.controls).toContain('color')
      expect(paint.controls).toContain('hardness')
    })

    it('pencil preset has small hard round brush', () => {
      const pencil = BRUSH_PRESETS.pencil
      expect(pencil.defaults.size).toBe(3)
      expect(pencil.defaults.hardness).toBe(1)
      expect(pencil.defaults.shape).toBe('round')
      expect(pencil.controls).not.toContain('hardness')
    })

    it('airbrush preset has large soft brush with low opacity', () => {
      const airbrush = BRUSH_PRESETS.airbrush
      expect(airbrush.defaults.size).toBe(60)
      expect(airbrush.defaults.hardness).toBeLessThan(0.1)
      expect(airbrush.defaults.opacity).toBeLessThan(0.5)
    })

    it('marker preset uses square shape', () => {
      expect(BRUSH_PRESETS.marker.defaults.shape).toBe('square')
    })

    it('calligraphy preset has optionsLabel for toolbar strip', () => {
      expect(BRUSH_PRESETS.calligraphy.label).toBe('Pen')
      expect(BRUSH_PRESETS.calligraphy.optionsLabel).toBe('Calligraphy')
    })

    it('pixel preset is small hard square', () => {
      const pixel = BRUSH_PRESETS.pixel
      expect(pixel.defaults.size).toBe(8)
      expect(pixel.defaults.hardness).toBe(1)
      expect(pixel.defaults.shape).toBe('square')
      expect(pixel.controls).toEqual(['color', 'size'])
    })
  })

  describe('getBrushPreset', () => {
    it('returns the matching preset for a known id', () => {
      expect(getBrushPreset('paint')).toBe(BRUSH_PRESETS.paint)
      expect(getBrushPreset('pencil')).toBe(BRUSH_PRESETS.pencil)
    })

    it('falls back to paint preset for unknown id', () => {
      expect(getBrushPreset('nonexistent')).toBe(BRUSH_PRESETS.paint)
    })

    it('falls back to paint preset for empty string', () => {
      expect(getBrushPreset('')).toBe(BRUSH_PRESETS.paint)
    })
  })
})
