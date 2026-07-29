import { describe, it, expect } from 'vitest'
import { CANVAS_PRESETS, DEVICE_ASPECT_RATIOS, DEFAULT_CANVAS, SNAP_THRESHOLD, BACKGROUND_PRESETS } from '../renderer/lib/constants'
import { THEME_COLORS, resolveThemeColors, buildTextStyle } from '../renderer/lib/device-utils'
import { generateId } from '../renderer/lib/id'

// ---------- constants.ts ----------

describe('constants', () => {
  it('CANVAS_PRESETS has 6 presets', () => {
    expect(CANVAS_PRESETS).toHaveLength(6)
  })

  it('each preset has width, height, and label', () => {
    for (const preset of CANVAS_PRESETS) {
      expect(preset.width).toBeGreaterThan(0)
      expect(preset.height).toBeGreaterThan(0)
      expect(typeof preset.label).toBe('string')
    }
  })

  it('DEVICE_ASPECT_RATIOS has all 7 device types', () => {
    const types = ['monitor', 'laptop', 'ipad', 'phone', 'watch', 'browser', 'terminal']
    for (const t of types) {
      expect(DEVICE_ASPECT_RATIOS[t]).toBeGreaterThan(0)
    }
  })

  it('DEFAULT_CANVAS is 1280x720', () => {
    expect(DEFAULT_CANVAS.width).toBe(1280)
    expect(DEFAULT_CANVAS.height).toBe(720)
  })

  it('SNAP_THRESHOLD is 5', () => {
    expect(SNAP_THRESHOLD).toBe(5)
  })

  it('BACKGROUND_PRESETS has 7 presets', () => {
    expect(BACKGROUND_PRESETS).toHaveLength(7)
  })

  it('each preset has name, label, category, thumbnail', () => {
    for (const preset of BACKGROUND_PRESETS) {
      expect(typeof preset.name).toBe('string')
      expect(typeof preset.label).toBe('string')
      expect(['animated', 'static']).toContain(preset.category)
      expect(typeof preset.thumbnail).toBe('string')
    }
  })
})

// ---------- device-utils.ts ----------

describe('resolveThemeColors', () => {
  it('returns dark theme colors by default', () => {
    const colors = resolveThemeColors('dark')
    expect(colors).toEqual(THEME_COLORS.dark)
  })

  it('returns custom colors for custom theme', () => {
    const colors = resolveThemeColors('custom', '#ff0000', '#00ff00')
    expect(colors.bezel).toBe('#ff0000')
    expect(colors.border).toBe('#00ff00')
  })

  it('falls back to dark theme for unknown theme', () => {
    const colors = resolveThemeColors('nonexistent')
    expect(colors).toEqual(THEME_COLORS.dark)
  })
})

describe('buildTextStyle', () => {
  it('returns basic text style', () => {
    const style = buildTextStyle({
      fontSize: 24,
      fontFamily: 'Inter',
      fontWeight: 400,
      color: '#ffffff'
    })
    expect(style.fontSize).toBe(24)
    expect(style.fontFamily).toBe('Inter')
    expect(style.fontWeight).toBe(400)
    expect(style.color).toBe('#ffffff')
  })

  it('applies gradient when enabled', () => {
    const style = buildTextStyle({
      fontSize: 32,
      fontFamily: 'Inter',
      fontWeight: 800,
      color: '#ffffff',
      gradient: { enabled: true, color1: '#ff0000', color2: '#0000ff', angle: 45 }
    })
    expect(style.background).toContain('linear-gradient(45deg')
    expect(style.WebkitTextFillColor).toBe('transparent')
  })

  it('applies glow when enabled', () => {
    const style = buildTextStyle({
      fontSize: 32,
      fontFamily: 'Inter',
      fontWeight: 800,
      color: '#ffffff',
      glow: { enabled: true, color: '#ff00ff', blur: 10 }
    })
    expect(style.textShadow).toContain('0 0 10px')
  })

  it('combines glow and shadow', () => {
    const style = buildTextStyle({
      fontSize: 32,
      fontFamily: 'Inter',
      fontWeight: 800,
      color: '#ffffff',
      glow: { enabled: true, color: '#ff00ff', blur: 10 },
      shadow: { enabled: true, color: '#000000', offsetX: 2, offsetY: 2, blur: 4 }
    })
    // Should contain both glow and shadow (separated by comma)
    expect(style.textShadow).toContain(',')
    expect(style.textShadow).toContain('0 0 10px')
    expect(style.textShadow).toContain('2px 2px 4px')
  })

  it('does not apply effects when disabled', () => {
    const style = buildTextStyle({
      fontSize: 32,
      fontFamily: 'Inter',
      fontWeight: 800,
      color: '#ffffff',
      gradient: { enabled: false, color1: '#ff0000', color2: '#0000ff', angle: 45 },
      glow: { enabled: false, color: '#ff00ff', blur: 10 },
      shadow: { enabled: false, color: '#000000', offsetX: 2, offsetY: 2, blur: 4 }
    })
    expect(style.background).toBeUndefined()
    expect(style.textShadow).toBeUndefined()
    expect(style.color).toBe('#ffffff')
  })
})

// ---------- id.ts ----------

describe('generateId', () => {
  it('generates unique IDs', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
  })

  it('generates valid UUID format', () => {
    const id = generateId()
    // UUID format: 8-4-4-4-12 hex characters
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})
