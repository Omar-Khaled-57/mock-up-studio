/**
 * M14 effects pipeline — registry-driven CSS filter builder, effects slice,
 * serialization and renderer integration (no rasterization involved).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useStore } from '../renderer/store'
import { resetStore, makeImage, makeShape } from './helpers'
import { buildEffectsFilter, DEFAULT_EFFECTS, EFFECTS_REGISTRY } from '../renderer/lib/effects'
import { serializeProject, deserializeProject } from '../renderer/lib/project-serialization'
import ImageOverlay from '../renderer/components/images/ImageOverlay'
import ShapeRenderer from '../renderer/components/shapes/ShapeRenderer'

describe('buildEffectsFilter', () => {
  it('returns empty for null/undefined', () => {
    expect(buildEffectsFilter(null)).toBe('')
    expect(buildEffectsFilter(undefined)).toBe('')
  })

  it('returns empty for fully-neutral defaults', () => {
    expect(buildEffectsFilter(DEFAULT_EFFECTS)).toBe('')
  })

  it('emits a brightness() term scaled to 100 = neutral', () => {
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, brightness: 150 })).toBe('brightness(1.500)')
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, brightness: 50 })).toBe('brightness(0.500)')
  })

  it('emits a contrast() term scaled to 100 = neutral', () => {
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, contrast: 80 })).toBe('contrast(0.800)')
  })

  it('emits exposure as its own additive brightness() term', () => {
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, exposure: 125 })).toBe('brightness(1.250)')
  })

  it('emits a saturate() term scaled to 100 = neutral', () => {
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, saturation: 50 })).toBe('saturate(0.500)')
  })

  it('emits a hue-rotate() term in degrees around 0 neutral', () => {
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, hue: 45 })).toBe('hue-rotate(45deg)')
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, hue: -30 })).toBe('hue-rotate(-30deg)')
  })

  it('approximates gamma via a brightness/contrast decomposition', () => {
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, gamma: 150 })).toBe('brightness(1.500) contrast(0.500)')
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, gamma: 80 })).toBe('brightness(0.800) contrast(1.200)')
  })

  it('approximates temperature via sepia + hue-rotate', () => {
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, temperature: 50 })).toBe('sepia(0.175) hue-rotate(-5deg) saturate(1.250)')
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, temperature: -50 })).toBe('sepia(0.100) hue-rotate(5deg) saturate(1.100)')
  })

  it('approximates tint via sepia + hue-rotate toward green/magenta', () => {
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, tint: 100 })).toBe('sepia(0.150) hue-rotate(40deg)')
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, tint: -100 })).toBe('sepia(0.150) hue-rotate(-40deg) saturate(1.100)')
  })

  it('emits a blur() term in px around 0 neutral', () => {
    expect(buildEffectsFilter({ ...DEFAULT_EFFECTS, blur: 8 })).toBe('blur(8px)')
  })

  it('composes every non-neutral term in registry order, space-separated', () => {
    const filter = buildEffectsFilter({ ...DEFAULT_EFFECTS, brightness: 120, hue: 15, blur: 4 })
    expect(filter).toBe('brightness(1.200) hue-rotate(15deg) blur(4px)')
  })

  it('treats a partial object as defaults with the present field emitted', () => {
    expect(buildEffectsFilter({ brightness: 150 } as never)).toBe('brightness(1.500)')
  })
})

describe('effects registry contract', () => {
  it('defines every effect with a 100- or 0-neutral default', () => {
    expect(EFFECTS_REGISTRY).toHaveLength(9)
    for (const def of EFFECTS_REGISTRY) {
      expect(DEFAULT_EFFECTS[def.id]).toBe(def.defaultValue)
      expect(buildEffectsFilter({ ...DEFAULT_EFFECTS })).toBe('')
    }
  })

  it('skips a field at its default value', () => {
    for (const def of EFFECTS_REGISTRY) {
      const effect: Record<string, number> = { ...DEFAULT_EFFECTS }
      effect[def.id] = def.defaultValue
      expect(buildEffectsFilter(effect as never)).toBe('')
    }
  })
})

describe('effectsSlice', () => {
  beforeEach(() => {
    resetStore()
  })

  it('creates effects merged onto neutral defaults for an image', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({ scenes: [{ ...scene, images: [makeImage({ id: 'img-1' })] }] })
    useStore.getState().updateEffects('img-1', { brightness: 120 })
    const img = useStore.getState().scenes[0].images[0]
    expect(img.effects).toEqual({ ...DEFAULT_EFFECTS, brightness: 120 })
  })

  it('merges subsequent patches onto existing effects', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({ scenes: [{ ...scene, images: [makeImage({ id: 'img-1' })] }] })
    const state = useStore.getState()
    state.updateEffects('img-1', { brightness: 120 })
    state.updateEffects('img-1', { blur: 6 })
    expect(useStore.getState().scenes[0].images[0].effects).toEqual({ ...DEFAULT_EFFECTS, brightness: 120, blur: 6 })
  })

  it('applies effects to a shape', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({ scenes: [{ ...scene, shapes: [makeShape({ id: 'shp-1' })] }] })
    useStore.getState().updateEffects('shp-1', { saturation: 140 })
    expect(useStore.getState().scenes[0].shapes[0].effects?.saturation).toBe(140)
  })

  it('is a no-op for an unknown element id', () => {
    const before = useStore.getState().scenes
    useStore.getState().updateEffects('nope', { brightness: 120 })
    expect(useStore.getState().scenes).toBe(before)
  })

  it('resets effects back to neutral (removes the field) for an image', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({ scenes: [{ ...scene, images: [makeImage({ id: 'img-1', effects: { ...DEFAULT_EFFECTS, hue: 30 } })] }] })
    useStore.getState().resetEffects('img-1')
    expect(useStore.getState().scenes[0].images[0].effects).toBeUndefined()
  })

  it('resets effects for a shape', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({ scenes: [{ ...scene, shapes: [makeShape({ id: 'shp-1', effects: { ...DEFAULT_EFFECTS, temperature: -60 } })] }] })
    useStore.getState().resetEffects('shp-1')
    expect(useStore.getState().scenes[0].shapes[0].effects).toBeUndefined()
  })
})

describe('effects serialization', () => {
  beforeEach(() => {
    resetStore()
  })

  it('round-trips effects through serialize/deserialize', () => {
    const scene = useStore.getState().scenes[0]
    const effects = { ...DEFAULT_EFFECTS, brightness: 130, tint: -40, blur: 5 }
    useStore.setState({
      scenes: [{
        ...scene,
        images: [makeImage({ id: 'img-1', effects })],
        shapes: [makeShape({ id: 'shp-1', effects })]
      }]
    })

    const state = useStore.getState()
    const { manifest, assets } = serializeProject(
      { id: 'p1', name: 'P', createdAt: 0, updatedAt: 0 },
      state.scenes,
      state.activeSceneIndex
    )
    const parsed = JSON.parse(manifest) as { scenes: Array<{ images: Array<{ effects?: unknown }>; shapes: Array<{ effects?: unknown }> }> }
    expect(parsed.scenes[0].images[0].effects).toEqual(effects)
    expect(parsed.scenes[0].shapes[0].effects).toEqual(effects)

    const { scenes } = deserializeProject(manifest, assets)
    const restored = scenes[0] as { images: Array<{ effects?: unknown }>; shapes: Array<{ effects?: unknown }> }
    expect(restored.images[0].effects).toEqual(effects)
    expect(restored.shapes[0].effects).toEqual(effects)
  })

  it('leaves effects absent in files that predate effects', () => {
    const { scenes } = deserializeProject(
      JSON.stringify({
        version: 1,
        project: { id: 'p', name: 'P', createdAt: 0, updatedAt: 0 },
        scenes: [{
          id: 's1', name: 'S', canvas: { width: 1440, height: 900, aspectRatio: '16:10' },
          background: {},
          devices: [],
          textBoxes: [],
          images: [makeImage({ id: 'img-1' })],
          shapes: [makeShape({ id: 'shp-1' })],
          titleText: {}, sloganText: {}, guides: [], grid: {}
        }],
        activeSceneIndex: 0
      }),
      new Map()
    )
    const restored = scenes[0] as { images: Array<{ effects?: unknown }>; shapes: Array<{ effects?: unknown }> }
    expect(restored.images[0].effects).toBeUndefined()
    expect(restored.shapes[0].effects).toBeUndefined()
  })
})

describe('effects rendering', () => {
  beforeEach(() => {
    resetStore()
  })

  it('ImageOverlay appends the effects filter alongside existing blur', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        images: [makeImage({ id: 'img-1', blur: 2, effects: { ...DEFAULT_EFFECTS, brightness: 120, hue: 15, blur: 4 } })]
      }]
    })
    const { container } = render(<ImageOverlay image={useStore.getState().scenes[0].images[0]} />)
    const facade = container.querySelector('[data-element-id="img-1"]') as HTMLElement
    expect(facade.style.filter).toContain('blur(2px)')
    expect(facade.style.filter).toContain('brightness(1.200)')
    expect(facade.style.filter).toContain('hue-rotate(15deg)')
    expect(facade.style.filter).toContain('blur(4px)')
  })

  it('ImageOverlay keeps a neutral filter when effects are absent', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({ scenes: [{ ...scene, images: [makeImage({ id: 'img-1' })] }] })
    const { container } = render(<ImageOverlay image={useStore.getState().scenes[0].images[0]} />)
    const facade = container.querySelector('[data-element-id="img-1"]') as HTMLElement
    expect(facade.style.filter).toBe('')
  })

  it('ShapeRenderer composes effects with the shape blur filter', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        shapes: [makeShape({ id: 'shp-1', blur: 3, effects: { ...DEFAULT_EFFECTS, contrast: 80 } })]
      }]
    })
    const { container } = render(<ShapeRenderer shape={useStore.getState().scenes[0].shapes[0]} />)
    const facade = container.querySelector('[data-element-id="shp-1"]') as HTMLElement
    expect(facade.style.filter).toContain('blur(3px)')
    expect(facade.style.filter).toContain('contrast(0.800)')
  })

  it('ShapeRenderer keeps a neutral filter when effects are absent', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({ scenes: [{ ...scene, shapes: [makeShape({ id: 'shp-1' })] }] })
    const { container } = render(<ShapeRenderer shape={useStore.getState().scenes[0].shapes[0]} />)
    const facade = container.querySelector('[data-element-id="shp-1"]') as HTMLElement
    expect(facade.style.filter).toBe('')
  })
})
