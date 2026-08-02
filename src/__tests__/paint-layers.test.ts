import { describe, it, expect, vi } from 'vitest'
import {
  PAINT_LAYER_NAME,
  PAINT_LAYER_PREFIX,
  createPaintLayer,
  isPaintLayer,
  nextPaintLayerName,
  nextPaintLayerZIndex,
  resolvePaintCommit
} from '../renderer/services/paint-layers'
import { compositeStrokeToRegion } from '../renderer/services/rasterizer'
import { makeDevice, makeImage, makeShape, makeTextBox } from './helpers'
import { createDefaultScene } from '../renderer/store/sceneSlice'

vi.mock('../renderer/services/rasterizer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../renderer/services/rasterizer')>()
  return {
    ...mod,
    compositeStrokeToRegion: vi.fn(async () => ({
      src: 'data:image/png;base64,stroke',
      region: { x: 10, y: 20, width: 30, height: 40 }
    }))
  }
})

const compositeMock = compositeStrokeToRegion as unknown as ReturnType<typeof vi.fn>

describe('paint layers — registry', () => {
  it('isPaintLayer recognizes the friendly prefix and the legacy marker', () => {
    const layer = makeImage({ name: `${PAINT_LAYER_PREFIX}1` })
    const legacy = makeImage({ name: PAINT_LAYER_NAME })
    const photo = makeImage({ name: 'Photo' })
    expect(isPaintLayer(layer)).toBe(true)
    expect(isPaintLayer(legacy)).toBe(true)
    expect(isPaintLayer(photo)).toBe(false)
  })

  it('nextPaintLayerName numbers paint layers sequentially', () => {
    const scene = {
      ...createDefaultScene(),
      images: [
        makeImage({ name: `${PAINT_LAYER_PREFIX}1` }),
        makeImage({ name: 'Photo' }),
        makeImage({ name: `${PAINT_LAYER_PREFIX}2` }),
        makeImage({ name: PAINT_LAYER_NAME })
      ]
    }
    expect(nextPaintLayerName(scene)).toBe(`${PAINT_LAYER_PREFIX}4`)
  })

  it('nextPaintLayerName starts at Paint 1 with no paint layers', () => {
    expect(nextPaintLayerName({ ...createDefaultScene(), textBoxes: [] })).toBe(`${PAINT_LAYER_PREFIX}1`)
  })

  it('nextPaintLayerZIndex is max zIndex across every element kind plus one', () => {
    const scene = {
      ...createDefaultScene(),
      devices: [makeDevice({ zIndex: 2 })],
      textBoxes: [makeTextBox({ zIndex: 1 })],
      images: [makeImage({ zIndex: 4 })],
      shapes: [makeShape({ zIndex: 3 })]
    }
    expect(nextPaintLayerZIndex(scene)).toBe(5)
  })

  it('nextPaintLayerZIndex starts at 0 for an empty scene', () => {
    expect(nextPaintLayerZIndex({ ...createDefaultScene(), textBoxes: [] })).toBe(0)
  })

  it('createPaintLayer creates an unlocked, topmost image clipped to the given region', () => {
    const scene = {
      ...createDefaultScene(),
      devices: [makeDevice({ zIndex: 7 })]
    }
    const layer = createPaintLayer(scene, 'data:image/png;base64,abc', null, { x: 10, y: 20, width: 30, height: 40 })
    expect(layer.name).toBe(`${PAINT_LAYER_PREFIX}1`)
    expect(layer.src).toBe('data:image/png;base64,abc')
    expect(layer.x).toBe(10)
    expect(layer.y).toBe(20)
    expect(layer.width).toBe(30)
    expect(layer.height).toBe(40)
    expect(layer.zIndex).toBe(8)
    expect(layer.locked).toBe(false)
    expect(layer.visible).toBe(true)
    expect(layer.rotation).toBe(0)
    expect(layer.opacity).toBe(100)
    expect(layer.groupId).toBeNull()
  })

  it('createPaintLayer names each stroke its own sequential layer', () => {
    const scene = {
      ...createDefaultScene(),
      images: [makeImage({ name: `${PAINT_LAYER_PREFIX}1` })]
    }
    const layer = createPaintLayer(scene, 'data:image/png;base64,abc', null, { x: 0, y: 0, width: 10, height: 10 })
    expect(layer.name).toBe(`${PAINT_LAYER_PREFIX}2`)
  })

  it('createPaintLayer propagates the focused group id', () => {
    const layer = createPaintLayer(createDefaultScene(), 'data:image/png;base64,abc', 'g-1', { x: 0, y: 0, width: 10, height: 10 })
    expect(layer.groupId).toBe('g-1')
  })

  it('resolvePaintCommit always rasterizes a fresh stroke onto its own cropped canvas', async () => {
    compositeMock.mockClear()
    const scene = createDefaultScene()
    const points = [
      { x: 10, y: 10, pressure: 1 },
      { x: 20, y: 20, pressure: 1 }
    ]
    const brush = { size: 12, hardness: 0.4, color: '#ff0000' }
    const commit = await resolvePaintCommit(scene, points, brush)
    expect(commit).toEqual({
      src: 'data:image/png;base64,stroke',
      region: { x: 10, y: 20, width: 30, height: 40 }
    })
    expect(compositeMock).toHaveBeenCalledWith(
      null,
      null,
      points,
      brush,
      scene.canvas.width,
      scene.canvas.height
    )
  })
})
