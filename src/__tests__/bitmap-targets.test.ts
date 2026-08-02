import { describe, it, expect } from 'vitest'
import {
  resolveBitmapTarget,
  resolveElementGeometry,
  resolveScreenRegion,
  toLocalPoint
} from '../renderer/services/bitmap-targets'
import { createDefaultScene } from '../renderer/store/sceneSlice'
import { makeDevice, makeImage, makeShape, makeTextBox } from './helpers'

function hit(id: string, kind: 'device' | 'image' | 'shape' | 'textBox') {
  return { id, kind, zIndex: 0, locked: false }
}

describe('bitmap-targets', () => {
  it('resolveScreenRegion uses per-device bezel insets', () => {
    const monitor = makeDevice({ id: 'd', type: 'monitor', x: 0, y: 0, width: 100, height: 100 })
    const region = resolveScreenRegion(monitor)
    // top: max(4%, 12px) = 12; bottom: max(3%, 8px) + 9px stand = 17
    expect(region).toEqual({ x: 0, y: 12, width: 100, height: 71 })

    const laptop = makeDevice({ id: 'd', type: 'laptop', x: 0, y: 0, width: 1000, height: 1000 })
    const laptopRegion = resolveScreenRegion(laptop)
    // top/bottom 2.76%/0.92% of height, left/right 1.84% of width
    expect(laptopRegion.y).toBeCloseTo(27.6)
    expect(laptopRegion.height).toBeCloseTo(1000 - 27.6 - 9.2)
    expect(laptopRegion.x).toBeCloseTo(18.4)
    expect(laptopRegion.width).toBeCloseTo(1000 - 18.4 * 2)
  })

  it('resolveScreenRegion honors a custom frame screen region', () => {
    const custom = makeDevice({
      id: 'd',
      type: 'custom',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      customFrame: { svgData: '<svg/>', screenRegion: { x: 40, y: 30, w: 320, h: 240 } }
    })
    expect(resolveScreenRegion(custom)).toEqual({ x: 40, y: 30, width: 320, height: 240 })
  })

  it('resolveBitmapTarget resolves an image overlay with a src', () => {
    const scene = createDefaultScene()
    const img = makeImage({ id: 'img-1', x: 100, y: 50, width: 300, height: 200 })
    scene.images.push(img)
    expect(resolveBitmapTarget(scene, hit('img-1', 'image'))).toEqual({
      elementId: 'img-1',
      kind: 'image',
      src: img.src,
      originX: 0,
      originY: 0,
      width: 300,
      height: 200,
      srcKey: 'src'
    })
  })

  it('resolveBitmapTarget returns null for an image without a src', () => {
    const scene = createDefaultScene()
    scene.images.push(makeImage({ id: 'img-1', src: '' }))
    expect(resolveBitmapTarget(scene, hit('img-1', 'image'))).toBeNull()
  })

  it('resolveBitmapTarget resolves a shape background image', () => {
    const scene = createDefaultScene()
    const shape = makeShape({ id: 'shp-1', x: 0, y: 0, width: 120, height: 80, backgroundImage: 'data:image/png;base64,shp' })
    scene.shapes.push(shape)
    const target = resolveBitmapTarget(scene, hit('shp-1', 'shape'))
    expect(target).toMatchObject({ kind: 'shape', src: 'data:image/png;base64,shp', width: 120, height: 80 })
  })

  it('resolveBitmapTarget resolves a shape without a background image (rasterized on-demand)', () => {
    const scene = createDefaultScene()
    scene.shapes.push(makeShape({ id: 'shp-1', width: 120, height: 80 }))
    const target = resolveBitmapTarget(scene, hit('shp-1', 'shape'))
    expect(target).toMatchObject({
      kind: 'shape',
      src: null,
      originX: 0,
      originY: 0,
      width: 120,
      height: 80,
      srcKey: 'backgroundImage'
    })
  })

  it('resolveBitmapTarget resolves a device screenshot into its screen region', () => {
    const scene = createDefaultScene()
    const dev = makeDevice({ id: 'dev-1', type: 'monitor', x: 100, y: 100, width: 100, height: 100, screenImage: 'data:image/png;base64,dev' })
    scene.devices.push(dev)
    const target = resolveBitmapTarget(scene, hit('dev-1', 'device'))
    expect(target).toMatchObject({
      kind: 'device',
      src: 'data:image/png;base64,dev',
      originX: 0,
      originY: 12,
      width: 100,
      height: 71
    })
  })

  it('resolveBitmapTarget returns null for a device without a screenshot', () => {
    const scene = createDefaultScene()
    scene.devices.push(makeDevice({ id: 'dev-1' }))
    expect(resolveBitmapTarget(scene, hit('dev-1', 'device'))).toBeNull()
  })

  it('resolveBitmapTarget returns null for text boxes and unknown ids', () => {
    const scene = createDefaultScene()
    scene.textBoxes.push(makeTextBox({ id: 'tb-1' }))
    expect(resolveBitmapTarget(scene, hit('tb-1', 'textBox'))).toBeNull()
    expect(resolveBitmapTarget(scene, hit('missing', 'image'))).toBeNull()
  })

  it('resolveElementGeometry resolves per-kind geometry', () => {
    const scene = createDefaultScene()
    scene.devices.push(makeDevice({ id: 'dev-1', x: 1, y: 2, width: 30, height: 40, rotation: 45 }))
    scene.images.push(makeImage({ id: 'img-1', x: 5, y: 6, width: 70, height: 80, rotation: 90 }))
    scene.shapes.push(makeShape({ id: 'shp-1', x: 9, y: 10, width: 11, height: 12, rotation: 15 }))

    expect(resolveElementGeometry(scene, hit('dev-1', 'device'))).toEqual({ id: 'dev-1', x: 1, y: 2, width: 30, height: 40, rotation: 45 })
    expect(resolveElementGeometry(scene, hit('img-1', 'image'))).toEqual({ id: 'img-1', x: 5, y: 6, width: 70, height: 80, rotation: 90 })
    expect(resolveElementGeometry(scene, hit('shp-1', 'shape'))).toEqual({ id: 'shp-1', x: 9, y: 10, width: 11, height: 12, rotation: 15 })
    expect(resolveElementGeometry(scene, hit('tb-1', 'textBox'))).toBeNull()
  })

  it('toLocalPoint translates scene points into bitmap-local coordinates', () => {
    const element = { id: 'img-1', x: 100, y: 50, width: 300, height: 200, rotation: 0 }
    const target = { originX: 0, originY: 0 }
    expect(toLocalPoint(element, target, { x: 250, y: 150 })).toEqual({ x: 150, y: 100 })
  })

  it('toLocalPoint accounts for a device screen region offset', () => {
    const element = { id: 'dev-1', x: 100, y: 100, width: 100, height: 100, rotation: 0 }
    const target = { originX: 0, originY: 12 }
    expect(toLocalPoint(element, target, { x: 150, y: 150 })).toEqual({ x: 50, y: 38 })
  })

  it('toLocalPoint inverse-rotates around the element center', () => {
    const element = { id: 'img-1', x: 0, y: 0, width: 100, height: 100, rotation: 90 }
    const target = { originX: 0, originY: 0 }
    // scene (100, 50) relative to center (50, 50) is (50, 0); rotating -90° gives (0, -50) → local (50, 0)
    const local = toLocalPoint(element, target, { x: 100, y: 50 })
    expect(local.x).toBeCloseTo(50)
    expect(local.y).toBeCloseTo(0)
  })
})
