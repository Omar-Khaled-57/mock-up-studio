/**
 * Element factories + store creation actions — the single-source creation
 * pipeline shared by the sidebar panels and the PropertiesPanel quick actions.
 * Covers the builders (pure) and the store actions that wire them into the
 * history/selection contract.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetStore } from './helpers'
import { useStore } from '../renderer/store'
import {
  DEVICE_TYPES,
  DEVICE_NAMES,
  QUICK_ADD_DEVICE_TYPES,
  deviceDefaultWidth,
  deviceDefaultHeight,
  DEFAULT_TEXT_SIZE,
  DEFAULT_IMAGE_SIZE,
  createDeviceElement,
  createTextBoxElement,
  buildImageOverlay,
  readImageFile
} from '../renderer/lib/element-factories'

vi.mock('../renderer/lib/element-factories', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../renderer/lib/element-factories')>()
  return {
    ...actual,
    readImageFile: vi.fn()
  }
})

beforeEach(() => {
  resetStore()
})

describe('device factory metadata', () => {
  it('exports the full device type catalog with names and aspect-driven sizes', () => {
    expect(DEVICE_TYPES.map((d) => d.type)).toEqual(
      expect.arrayContaining(['monitor', 'laptop', 'ipad', 'phone', 'watch', 'browser', 'terminal'])
    )
    expect(DEVICE_NAMES.monitor).toBe('Monitor')
    expect(deviceDefaultWidth('phone')).toBe(160)
    expect(deviceDefaultHeight('phone')).toBeGreaterThan(0)
    expect(deviceDefaultWidth('custom')).toBe(300)
    expect(deviceDefaultHeight('custom')).toBeGreaterThan(0)
  })

  it('QUICK_ADD_DEVICE_TYPES is a strict subset of the device catalog', () => {
    const catalog = DEVICE_TYPES.map((d) => d.type)
    expect(QUICK_ADD_DEVICE_TYPES).toHaveLength(4)
    for (const t of QUICK_ADD_DEVICE_TYPES) expect(catalog).toContain(t)
  })
})

describe('createDeviceElement', () => {
  it('builds a complete device stamped above the scene z-top', () => {
    const scene = useStore.getState().scenes[0]
    const device = createDeviceElement('monitor', scene)
    expect(device.type).toBe('monitor')
    expect(device.visible).toBe(true)
    expect(device.locked).toBe(false)
    expect(device.rotation).toBe(0)
    expect(device.colorTheme).toBe('dark')
    expect(device.screenImage).toBeNull()
    expect(device.objectFit).toBe('contain')
    expect(device.groupId).toBeNull()
    expect(device.containerId).toBeNull()
    expect(device.id).toBeTruthy()
    expect(device.width).toBe(deviceDefaultWidth('monitor'))
    expect(device.height).toBe(deviceDefaultHeight('monitor'))
    // Hero text boxes seed z0/z1, so the first device lands at z2.
    expect(device.zIndex).toBe(2)
  })

  it('names devices sequentially per type and stacks on the cross-kind z-top', () => {
    const scene = useStore.getState().scenes[0]
    const first = createDeviceElement('phone', scene)
    const second = createDeviceElement('phone', { ...scene, devices: [first] })
    expect(first.name).toBe('Phone 1')
    expect(second.name).toBe('Phone 2')
    // A shape at a high zIndex is respected by the cross-kind max.
    const third = createDeviceElement('monitor', {
      ...scene,
      devices: [first, second],
      shapes: [{ id: 's', zIndex: 10 }] as never
    })
    expect(third.zIndex).toBe(11)
  })
})

describe('createTextBoxElement', () => {
  it('centers the default box and stamps content-editable defaults', () => {
    const scene = useStore.getState().scenes[0]
    const tb = createTextBoxElement(scene.canvas.width, scene.canvas.height, 5, 0)
    expect(tb.name).toBe('Text 1')
    expect(tb.content).toBe('Double-click to edit')
    expect(tb.x).toBe(Math.round((scene.canvas.width - DEFAULT_TEXT_SIZE) / 2))
    expect(tb.y).toBe(Math.round((scene.canvas.height - DEFAULT_TEXT_SIZE) / 2))
    expect(tb.width).toBe(DEFAULT_TEXT_SIZE)
    expect(tb.heightAuto).toBe(true)
    expect(tb.wrap).toBe(true)
    expect(tb.stylePreset).toBe('custom')
    expect(tb.zIndex).toBe(5)
    expect(tb.visible).toBe(true)
    expect(tb.locked).toBe(false)
  })

  it('names sequentially by index', () => {
    expect(createTextBoxElement(800, 600, 0, 2).name).toBe('Text 3')
  })
})

describe('buildImageOverlay', () => {
  it('sizes to the canvas half cap, preserves aspect, and centers', () => {
    const scene = useStore.getState().scenes[0]
    const image = buildImageOverlay('data:image/png;base64,abc', 200, 100, scene, 'Image 1')
    expect(image.src).toBe('data:image/png;base64,abc')
    expect(image.name).toBe('Image 1')
    expect(image.width).toBe(Math.min(DEFAULT_IMAGE_SIZE, scene.canvas.width * 0.5))
    expect(image.height).toBe(Math.round(image.width / 2))
    expect(image.x).toBe(Math.round((scene.canvas.width - image.width) / 2))
    expect(image.y).toBe(Math.round((scene.canvas.height - image.height) / 2))
    expect(image.blendMode).toBe('normal')
    expect(image.opacity).toBe(100)
    expect(image.visible).toBe(true)
    expect(image.locked).toBe(false)
    // Heroes at z0/z1 → first image lands at z2.
    expect(image.zIndex).toBe(2)
  })

  it('shrinks very wide sources to the default cap', () => {
    const scene = useStore.getState().scenes[0]
    const image = buildImageOverlay('data:', 5000, 100, scene, 'Image 1')
    expect(image.width).toBe(DEFAULT_IMAGE_SIZE)
    expect(image.height).toBe(Math.round(DEFAULT_IMAGE_SIZE / 50))
  })
})

describe('store creation actions', () => {
  it('addDeviceOfType creates, selects, and returns the id with one undo entry', () => {
    const id = useStore.getState().addDeviceOfType('terminal')
    const state = useStore.getState()
    const device = state.scenes[0].devices.find((d) => d.id === id)
    expect(device).toBeDefined()
    expect(device?.type).toBe('terminal')
    expect(state.selectedIds).toEqual([id])
    expect(state.canUndo()).toBe(true)
    state.undo()
    expect(useStore.getState().scenes[0].devices.find((d) => d.id === id)).toBeUndefined()
  })

  it('addDefaultTextBox creates a custom box above the hero boxes and selects it', () => {
    const id = useStore.getState().addDefaultTextBox()
    const state = useStore.getState()
    const tb = state.scenes[0].textBoxes.find((t) => t.id === id)
    expect(tb).toBeDefined()
    expect(tb?.stylePreset).toBe('custom')
    expect(state.scenes[0].textBoxes.length).toBe(3)
    expect(tb?.zIndex).toBe(2)
    expect(state.selectedIds).toEqual([id])
    state.undo()
    expect(useStore.getState().scenes[0].textBoxes.length).toBe(2)
  })

  it('importImageFromFile resolves null and stays no-op when the file cannot be decoded', async () => {
    vi.mocked(readImageFile).mockResolvedValue(null)
    const result = await useStore.getState().importImageFromFile(new File([], 'x.png'))
    expect(result).toBeNull()
    expect(useStore.getState().scenes[0].images.length).toBe(0)
    expect(useStore.getState().selectedIds).toEqual([])
  })
})
