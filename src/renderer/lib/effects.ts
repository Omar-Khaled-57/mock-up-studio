/**
 * effects — Extensible non-destructive image-effects registry + builder.
 *
 * Mirrors `buildTextStyle` in device-utils.ts: effects are registered as
 * named units and the builder composes a single CSS `filter` string by
 * iterating the registry. Adding a new effect is a registry entry, not a
 * rewrite of the builder or the Properties panel (architecture §11.2).
 *
 * Scale conventions (architecture §11.1):
 *   - Linear adjustments (brightness/contrast/exposure/saturation/gamma):
 *     100 = neutral, range 0–200 (gamma 50–200).
 *   - Bipolar axes (hue/temperature/tint): 0 = neutral.
 *   - blur: 0 = neutral (px).
 *
 * Approximations (documented, isolated here for future precision upgrades):
 *   - gamma  -> `brightness(g) contrast(2-g)` decomposition.
 *   - temperature/tint -> `sepia()` + `hue-rotate()` composition.
 */

import { ImageEffects } from '@shared/types'

export interface EffectDefinition {
  id: keyof ImageEffects
  label: string
  defaultValue: number
  min: number
  max: number
  step?: number
  unit: string
  toCss: (value: number, fullContext: ImageEffects) => string | null
}

export const DEFAULT_EFFECTS: ImageEffects = {
  brightness: 100,
  contrast: 100,
  exposure: 100,
  saturation: 100,
  hue: 0,
  gamma: 100,
  temperature: 0,
  tint: 0,
  blur: 0
}

function linear(value: number, fn: 'brightness' | 'contrast' | 'saturate'): string {
  return `${fn}(${(value / 100).toFixed(3)})`
}

function gammaCss(value: number): string | null {
  if (value === 100) return null
  const g = value / 100
  return `brightness(${g.toFixed(3)}) contrast(${(2 - g).toFixed(3)})`
}

function temperatureCss(value: number): string | null {
  if (value === 0) return null
  const m = Math.abs(value) / 100
  if (value > 0) {
    return `sepia(${(0.35 * m).toFixed(3)}) hue-rotate(${Math.round(-10 * m)}deg) saturate(${(1 + 0.5 * m).toFixed(3)})`
  }
  return `sepia(${(0.2 * m).toFixed(3)}) hue-rotate(${Math.round(10 * m)}deg) saturate(${(1 + 0.2 * m).toFixed(3)})`
}

function tintCss(value: number): string | null {
  if (value === 0) return null
  const m = Math.abs(value) / 100
  if (value > 0) {
    return `sepia(${(0.15 * m).toFixed(3)}) hue-rotate(${Math.round(40 * m)}deg)`
  }
  return `sepia(${(0.15 * m).toFixed(3)}) hue-rotate(${Math.round(-40 * m)}deg) saturate(${(1 + 0.1 * m).toFixed(3)})`
}

export const EFFECTS_REGISTRY: EffectDefinition[] = [
  { id: 'brightness', label: 'Brightness', defaultValue: 100, min: 0, max: 200, unit: '', toCss: (v) => (v === 100 ? null : linear(v, 'brightness')) },
  { id: 'contrast', label: 'Contrast', defaultValue: 100, min: 0, max: 200, unit: '', toCss: (v) => (v === 100 ? null : linear(v, 'contrast')) },
  { id: 'exposure', label: 'Exposure', defaultValue: 100, min: 0, max: 200, unit: '', toCss: (v) => (v === 100 ? null : linear(v, 'brightness')) },
  { id: 'saturation', label: 'Saturation', defaultValue: 100, min: 0, max: 200, unit: '', toCss: (v) => (v === 100 ? null : linear(v, 'saturate')) },
  { id: 'hue', label: 'Hue', defaultValue: 0, min: -180, max: 180, unit: '°', toCss: (v) => (v === 0 ? null : `hue-rotate(${Math.round(v)}deg)`) },
  { id: 'gamma', label: 'Gamma', defaultValue: 100, min: 50, max: 200, unit: '', toCss: (v) => gammaCss(v) },
  { id: 'temperature', label: 'Temperature', defaultValue: 0, min: -100, max: 100, unit: '', toCss: (v) => temperatureCss(v) },
  { id: 'tint', label: 'Tint', defaultValue: 0, min: -100, max: 100, unit: '', toCss: (v) => tintCss(v) },
  { id: 'blur', label: 'Blur', defaultValue: 0, min: 0, max: 30, unit: 'px', toCss: (v) => (v === 0 ? null : `blur(${Math.round(v)}px)`) }
]

/**
 * Composes a single CSS `filter` string for the given effects. Returns ''
 * for null/undefined/neutral effects. Missing fields fall back to their
 * registry defaults (legacy or partial data), so an `effects` object never
 * needs schema normalization.
 */
export function buildEffectsFilter(effects: ImageEffects | null | undefined): string {
  if (!effects) return ''
  const parts: string[] = []
  for (const def of EFFECTS_REGISTRY) {
    const css = def.toCss(effects[def.id] ?? def.defaultValue, effects)
    if (css) parts.push(css)
  }
  return parts.join(' ')
}
