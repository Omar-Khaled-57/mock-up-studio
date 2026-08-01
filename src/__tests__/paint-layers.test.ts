import { describe, it, expect, vi } from 'vitest'
import {
  PAINT_LAYER_NAME,
  createPaintLayer,
  findActivePaintLayer,
  isPaintLayer,
  nextPaintLayerZIndex,
  resolvePaintCommit
} from '../renderer/services/paint-layers'
import { compositeStrokeToDataUrl } from '../renderer/services/rasterizer'
import { makeDevice, makeImage, makeShape, makeTextBox } from './helpers'
import { createDefaultScene } from '../renderer/store/sceneSlice'

vi.mock('../renderer/services/rasterizer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../renderer/services/rasterizer')>()
  return {
    ...mod,
    compositeStrokeToDataUrl: vi.fn(async () => 'data:image/png;base64,stroke')
  }
})

const compositeMock = compositeStrokeToDataUrl as unknown as ReturnType<typeof vi.fn>

describe('paint layers — registry', () => {
  it('isPaintLayer distinguishes paint layers by name marker', () => {
    const layer = makeImage({ name: PAINT_LAYER_NAME })
    const photo = makeImage({ name: 'Photo' })
    expect(isPaintLayer(layer)).toBe(true)
    expect(isPaintLayer(photo)).toBe(false)
  })

  it('findActivePaintLayer returns null when the scene has no paint content', () => {
    const scene = {
      ...createDefaultScene(),
      images: [makeImage(), makeImage()]
    }
    expect(findActivePaintLayer(scene)).toBeNull()
  })

  it('findActivePaintLayer returns the topmost paint layer, ignoring plain images', () => {
    const low = makeImage({ id: 'pl-1', name: PAINT_LAYER_NAME, zIndex: 5 })
    const high = makeImage({ id: 'pl-2', name: PAINT_LAYER_NAME, zIndex: 9 })
    const photo = makeImage({ id: 'photo-1', zIndex: 99 })
    const scene = { ...createDefaultScene(), images: [photo, low, high] }
    expect(findActivePaintLayer(scene)?.id).toBe('pl-2')
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
    expect(nextPaintLayerZIndex(createDefaultScene())).toBe(0)
  })

  it('createPaintLayer is a full-canvas, unlocked, topmost image', () => {
    const scene = {
      ...createDefaultScene(),
      devices: [makeDevice({ zIndex: 7 })]
    }
    const layer = createPaintLayer(scene, 'data:image/png;base64,abc', null)
    expect(layer.name).toBe(PAINT_LAYER_NAME)
    expect(layer.src).toBe('data:image/png;base64,abc')
    expect(layer.x).toBe(0)
    expect(layer.y).toBe(0)
    expect(layer.width).toBe(scene.canvas.width)
    expect(layer.height).toBe(scene.canvas.height)
    expect(layer.zIndex).toBe(8)
    expect(layer.locked).toBe(false)
    expect(layer.visible).toBe(true)
    expect(layer.rotation).toBe(0)
    expect(layer.opacity).toBe(100)
    expect(layer.groupId).toBeNull()
  })

  it('createPaintLayer propagates the focused group id', () => {
    const layer = createPaintLayer(createDefaultScene(), 'data:image/png;base64,abc', 'g-1')
    expect(layer.groupId).toBe('g-1')
  })

  it('resolvePaintCommit composites over the layer src at canvas size', async () => {
    compositeMock.mockClear()
    const scene = createDefaultScene()
    const layer = makeImage({ name: PAINT_LAYER_NAME, src: 'data:image/png;base64,old' })
    const points = [
      { x: 10, y: 10, pressure: 1 },
      { x: 20, y: 20, pressure: 1 }
    ]
    const brush = { size: 12, hardness: 0.4, color: '#ff0000' }
    const url = await resolvePaintCommit(scene, layer, points, brush)
    expect(url).toBe('data:image/png;base64,stroke')
    expect(compositeMock).toHaveBeenCalledWith(
      'data:image/png;base64,old',
      points,
      brush,
      scene.canvas.width,
      scene.canvas.height
    )
  })

  it('resolvePaintCommit starts from a fresh canvas when no layer exists', async () => {
    compositeMock.mockClear()
    const scene = createDefaultScene()
    await resolvePaintCommit(scene, null, [{ x: 1, y: 1, pressure: 1 }], { size: 8, hardness: 1, color: '#00ff00' })
    expect(compositeMock).toHaveBeenCalledWith(null, [{ x: 1, y: 1, pressure: 1 }], { size: 8, hardness: 1, color: '#00ff00' }, scene.canvas.width, scene.canvas.height)
  })
})
