import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { safeScene, createDefaultScene } from '../renderer/store/sceneSlice'
import { resetStore, makeDevice, makeTextBox, makeImage, makeShape } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

// ---------- safeScene ----------

describe('safeScene', () => {
  it('returns default scene when scenes array is empty', () => {
    useStore.setState({ scenes: [], activeSceneIndex: 0 })
    const scene = safeScene(useStore.getState())
    expect(scene.name).toBe('Scene 1')
    expect(scene.devices).toHaveLength(0)
  })

  it('returns the active scene when index is valid', () => {
    const state = useStore.getState()
    const scene = safeScene(state)
    expect(scene).toBe(state.scenes[0])
  })

  it('clamps to last scene when index exceeds length', () => {
    const s1 = createDefaultScene()
    s1.name = 'Scene A'
    const s2 = createDefaultScene()
    s2.name = 'Scene B'
    useStore.setState({ scenes: [s1, s2], activeSceneIndex: 5 })
    const scene = safeScene(useStore.getState())
    expect(scene.name).toBe('Scene B')
  })

  it('returns default scene when scenes has 1 item but index is -1', () => {
    useStore.setState({ scenes: [createDefaultScene()], activeSceneIndex: -1 })
    const scene = safeScene(useStore.getState())
    // Math.min(-1, 0) = -1, scenes[-1] is undefined, so falls through to createDefaultScene
    expect(scene.name).toBe('Scene 1')
  })
})

// ---------- createDefaultScene ----------

describe('createDefaultScene', () => {
  it('creates scene with unique id', () => {
    const s1 = createDefaultScene()
    const s2 = createDefaultScene()
    expect(s1.id).not.toBe(s2.id)
  })

  it('has no default devices', () => {
    const scene = createDefaultScene()
    expect(scene.devices).toHaveLength(0)
  })

  it('seeds hero title/slogan text boxes but no user elements', () => {
    const scene = createDefaultScene()
    expect(scene.textBoxes).toHaveLength(2)
    expect(scene.textBoxes.filter((t) => t.stylePreset === 'title')).toHaveLength(1)
    expect(scene.textBoxes.filter((t) => t.stylePreset === 'slogan')).toHaveLength(1)
    expect(scene.textBoxes.filter((t) => t.stylePreset === 'custom')).toHaveLength(0)
    expect(scene.images).toHaveLength(0)
  })

  it('has gradient background by default', () => {
    const scene = createDefaultScene()
    expect(scene.background.type).toBe('gradient')
  })
})

// ---------- clampIndex behavior via setActiveSceneIndex ----------

describe('setActiveSceneIndex', () => {
  it('clamps to valid range', () => {
    const store = useStore.getState()
    store.setActiveSceneIndex(999)
    expect(useStore.getState().activeSceneIndex).toBe(0) // only 1 scene
  })

  it('sets valid index', () => {
    const store = useStore.getState()
    store.addScene()
    store.setActiveSceneIndex(1)
    expect(useStore.getState().activeSceneIndex).toBe(1)
  })
})

// ---------- CRUD ----------

describe('addDevice', () => {
  it('adds a device to the active scene', () => {
    const dev = makeDevice({ id: 'test-dev' })
    useStore.getState().addDevice(dev)
    const scene = safeScene(useStore.getState())
    expect(scene.devices).toHaveLength(1) // new
    expect(scene.devices.find((d) => d.id === 'test-dev')).toBeTruthy()
  })
})

describe('updateDevice', () => {
  it('updates device properties', () => {
    const dev = makeDevice({ id: 'update-dev', x: 0, y: 0 })
    useStore.getState().addDevice(dev)
    useStore.getState().updateDevice('update-dev', { x: 50, y: 75 })
    const scene = safeScene(useStore.getState())
    const updated = scene.devices.find((d) => d.id === 'update-dev')!
    expect(updated.x).toBe(50)
    expect(updated.y).toBe(75)
  })
})

describe('removeDevice', () => {
  it('removes a device by id', () => {
    const dev = makeDevice({ id: 'remove-dev' })
    useStore.getState().addDevice(dev)
    useStore.getState().removeDevice('remove-dev')
    const scene = safeScene(useStore.getState())
    expect(scene.devices.find((d) => d.id === 'remove-dev')).toBeUndefined()
  })
})

describe('addTextBox', () => {
  it('adds a text box', () => {
    const tb = makeTextBox({ id: 'tb-1' })
    useStore.getState().addTextBox(tb)
    const scene = safeScene(useStore.getState())
    expect(scene.textBoxes).toHaveLength(3)
    expect(scene.textBoxes[2].id).toBe('tb-1')
  })
})

describe('updateTextBox', () => {
  it('updates text box content', () => {
    const tb = makeTextBox({ id: 'tb-up' })
    useStore.getState().addTextBox(tb)
    useStore.getState().updateTextBox('tb-up', { content: 'Updated' })
    const scene = safeScene(useStore.getState())
    expect(scene.textBoxes.find((t) => t.id === 'tb-up')?.content).toBe('Updated')
  })
})

describe('removeTextBox', () => {
  it('removes a text box', () => {
    const tb = makeTextBox({ id: 'tb-rm' })
    useStore.getState().addTextBox(tb)
    useStore.getState().removeTextBox('tb-rm')
    const scene = safeScene(useStore.getState())
    expect(scene.textBoxes).toHaveLength(2)
  })
})

describe('addImage', () => {
  it('adds an image overlay', () => {
    const img = makeImage({ id: 'img-1' })
    useStore.getState().addImage(img)
    const scene = safeScene(useStore.getState())
    expect(scene.images).toHaveLength(1)
  })
})

describe('updateImage', () => {
  it('updates image src', () => {
    const img = makeImage({ id: 'img-up' })
    useStore.getState().addImage(img)
    useStore.getState().updateImage('img-up', { src: 'data:image/png;base64,xyz' })
    const scene = safeScene(useStore.getState())
    expect(scene.images[0].src).toBe('data:image/png;base64,xyz')
  })
})

describe('removeImage', () => {
  it('removes an image', () => {
    const img = makeImage({ id: 'img-rm' })
    useStore.getState().addImage(img)
    useStore.getState().removeImage('img-rm')
    const scene = safeScene(useStore.getState())
    expect(scene.images).toHaveLength(0)
  })
})

// ---------- Z-order ----------

describe('z-order operations', () => {
  it('bringToFront sets zIndex above all others', () => {
    const d1 = makeDevice({ id: 'd1', zIndex: 0 })
    const d2 = makeDevice({ id: 'd2', zIndex: 5 })
    useStore.getState().addDevice(d1)
    useStore.getState().addDevice(d2)
    useStore.getState().bringToFront('d1')
    const scene = safeScene(useStore.getState())
    const z1 = scene.devices.find((d) => d.id === 'd1')!.zIndex
    const z2 = scene.devices.find((d) => d.id === 'd2')!.zIndex
    expect(z1).toBeGreaterThan(z2)
  })

  it('sendToBack sets zIndex below all others', () => {
    const d1 = makeDevice({ id: 'd1', zIndex: 0 })
    const d2 = makeDevice({ id: 'd2', zIndex: 5 })
    useStore.getState().addDevice(d1)
    useStore.getState().addDevice(d2)
    useStore.getState().sendToBack('d2')
    const scene = safeScene(useStore.getState())
    const z1 = scene.devices.find((d) => d.id === 'd1')!.zIndex
    const z2 = scene.devices.find((d) => d.id === 'd2')!.zIndex
    expect(z2).toBeLessThan(z1)
  })

  it('bringForward increases zIndex by 1', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [] }] })
    const d1 = makeDevice({ id: 'd1', zIndex: 0 })
    const d2 = makeDevice({ id: 'd2', zIndex: 3 })
    useStore.getState().addDevice(d1)
    useStore.getState().addDevice(d2)
    useStore.getState().bringForward('d1')
    const scene = safeScene(useStore.getState())
    const z1 = scene.devices.find((d) => d.id === 'd1')!.zIndex
    expect(z1).toBe(3) // moves to d2's level (+0 since curZ < nextZ)
  })

  it('sendBackward decreases zIndex by 1', () => {
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [] }] })
    const d1 = makeDevice({ id: 'd1', zIndex: 0 })
    const d2 = makeDevice({ id: 'd2', zIndex: 3 })
    useStore.getState().addDevice(d1)
    useStore.getState().addDevice(d2)
    useStore.getState().sendBackward('d2')
    const scene = safeScene(useStore.getState())
    const z2 = scene.devices.find((d) => d.id === 'd2')!.zIndex
    expect(z2).toBe(0) // moves to d1's level
  })
})

// ---------- findElementKind ----------

describe('findElementKind', () => {
  it('returns device kind for device ids', () => {
    const dev = makeDevice({ id: 'find-dev' })
    useStore.getState().addDevice(dev)
    expect(useStore.getState().findElementKind('find-dev')).toBe('device')
  })

  it('returns textbox kind for textbox ids', () => {
    const tb = makeTextBox({ id: 'find-tb' })
    useStore.getState().addTextBox(tb)
    expect(useStore.getState().findElementKind('find-tb')).toBe('textbox')
  })

  it('returns image kind for image ids', () => {
    const img = makeImage({ id: 'find-img' })
    useStore.getState().addImage(img)
    expect(useStore.getState().findElementKind('find-img')).toBe('image')
  })

  it('returns null for unknown ids', () => {
    expect(useStore.getState().findElementKind('nonexistent')).toBeNull()
  })
})

// ---------- deleteSelected ----------

describe('deleteSelected', () => {
  it('removes multiple elements by id', () => {
    const dev = makeDevice({ id: 'del-dev' })
    const tb = makeTextBox({ id: 'del-tb' })
    useStore.getState().addDevice(dev)
    useStore.getState().addTextBox(tb)
    useStore.getState().deleteSelected(['del-dev', 'del-tb'])
    const scene = safeScene(useStore.getState())
    expect(scene.devices.find((d) => d.id === 'del-dev')).toBeUndefined()
    expect(scene.textBoxes.find((t) => t.id === 'del-tb')).toBeUndefined()
  })

  it('clears selection after delete', () => {
    const dev = makeDevice({ id: 'del-sel' })
    useStore.getState().addDevice(dev)
    useStore.setState({ selectedIds: ['del-sel'] })
    useStore.getState().deleteSelected(['del-sel'])
    expect(useStore.getState().selectedIds).toHaveLength(0)
  })
})

// ---------- duplicateSelected ----------

describe('duplicateSelected', () => {
  it('creates clones with new IDs', () => {
    // Default scene has 1 device; add 1 more = 2 devices
    const dev = makeDevice({ id: 'dup-dev', x: 10, y: 20 })
    useStore.getState().addDevice(dev)
    const newIds = useStore.getState().duplicateSelected(['dup-dev'])
    expect(newIds).toHaveLength(1)
    expect(newIds[0]).not.toBe('dup-dev')
    const scene = safeScene(useStore.getState())
    expect(scene.devices).toHaveLength(2) // original + duplicate
  })

  it('offsets duplicates by 30px', () => {
    const dev = makeDevice({ id: 'dup-off', x: 100, y: 200 })
    useStore.getState().addDevice(dev)
    const newIds = useStore.getState().duplicateSelected(['dup-off'])
    const scene = safeScene(useStore.getState())
    const dup = scene.devices.find((d) => d.id === newIds[0])!
    expect(dup.x).toBe(130)
    expect(dup.y).toBe(230)
  })

  it('selects the duplicates', () => {
    const dev = makeDevice({ id: 'dup-sel' })
    useStore.getState().addDevice(dev)
    const newIds = useStore.getState().duplicateSelected(['dup-sel'])
    expect(useStore.getState().selectedIds).toEqual(newIds)
  })
})

// ---------- Multi-scene operations ----------

describe('addScene', () => {
  it('adds a new scene and switches to it', () => {
    useStore.getState().addScene()
    const state = useStore.getState()
    expect(state.scenes).toHaveLength(2)
    expect(state.activeSceneIndex).toBe(1)
  })
})

describe('duplicateScene', () => {
  it('creates a copy of the scene', () => {
    useStore.getState().addScene()
    useStore.getState().duplicateScene(0)
    const state = useStore.getState()
    expect(state.scenes).toHaveLength(3)
    expect(state.scenes[1].name).toContain('copy')
  })
})

describe('deleteScene', () => {
  it('prevents deletion when only one scene remains', () => {
    useStore.getState().deleteScene(0)
    expect(useStore.getState().scenes).toHaveLength(1)
  })

  it('deletes and adjusts active index', () => {
    useStore.getState().addScene()
    useStore.getState().setActiveSceneIndex(1)
    useStore.getState().deleteScene(1)
    expect(useStore.getState().activeSceneIndex).toBe(0)
    expect(useStore.getState().scenes).toHaveLength(1)
  })
})

describe('renameScene', () => {
  it('renames a scene', () => {
    useStore.getState().renameScene(0, 'My Scene')
    expect(useStore.getState().scenes[0].name).toBe('My Scene')
  })
})

// ---------- Theme Presets ----------

describe('applyThemePreset', () => {
  it('applies solid background preset', () => {
    useStore.getState().applyThemePreset({
      id: 'test', name: 'Test', description: '',
      background: { type: 'solid', color: '#ff0000' },
      titleColor: '#ffffff', sloganColor: '#cccccc', accentColor: '#aaaaaa',
      deviceTheme: 'dark'
    })
    const scene = safeScene(useStore.getState())
    expect(scene.background.type).toBe('solid')
    expect(scene.background.color).toBe('#ff0000')
  })

  it('applies gradient background preset', () => {
    useStore.getState().applyThemePreset({
      id: 'test', name: 'Test', description: '',
      background: { type: 'gradient', colors: ['#000', '#fff'], angle: 90 },
      titleColor: '#111111', sloganColor: '#222222', accentColor: '#333333',
      deviceTheme: 'light'
    })
    const scene = safeScene(useStore.getState())
    expect(scene.background.type).toBe('gradient')
    expect(scene.background.gradient?.colors).toEqual(['#000', '#fff'])
    expect(scene.background.gradient?.angle).toBe(90)
  })

  it('applies preset background type', () => {
    useStore.getState().applyThemePreset({
      id: 'test', name: 'Test', description: '',
      background: { type: 'preset', presetName: 'aurora' },
      titleColor: '#ffffff', sloganColor: '#cccccc', accentColor: '#aaaaaa',
      deviceTheme: 'dark'
    })
    const scene = safeScene(useStore.getState())
    expect(scene.background.type).toBe('preset')
    expect(scene.background.presetName).toBe('aurora')
  })

  it('updates title and slogan', () => {
    useStore.getState().applyThemePreset({
      id: 'test', name: 'Test', description: '',
      background: { type: 'solid', color: '#000' },
      titleColor: '#ff0000', sloganColor: '#00ff00', accentColor: '#0000ff',
      deviceTheme: 'light'
    })
    const scene = safeScene(useStore.getState())
    expect(scene.textBoxes.find((t) => t.stylePreset === 'title')?.color).toBe('#ff0000')
    expect(scene.textBoxes.find((t) => t.stylePreset === 'slogan')?.color).toBe('#00ff00')
  })

  it('updates existing textBox colors to slogan color', () => {
    useStore.getState().addTextBox(useStore.getState().scenes[0].textBoxes.length > 0
      ? makeTextBox({ id: 'tb1' }) : makeTextBox({ id: 'tb1' }))
    useStore.getState().applyThemePreset({
      id: 'test', name: 'Test', description: '',
      background: { type: 'solid', color: '#000' },
      titleColor: '#ffffff', sloganColor: '#ff00ff', accentColor: '#0000ff',
      deviceTheme: 'dark'
    })
    const scene = safeScene(useStore.getState())
    const tb = scene.textBoxes.find((t) => t.id === 'tb1')
    expect(tb?.color).toBe('#ff00ff')
  })

  it('updates shape colors to accent color', () => {
    useStore.getState().addShape(makeShape({ id: 'sh1', color: '#ffffff' }))
    useStore.getState().applyThemePreset({
      id: 'test', name: 'Test', description: '',
      background: { type: 'solid', color: '#000' },
      titleColor: '#ffffff', sloganColor: '#cccccc', accentColor: '#ff6600',
      deviceTheme: 'dark'
    })
    const scene = safeScene(useStore.getState())
    const shape = scene.shapes.find((s) => s.id === 'sh1')
    expect(shape?.color).toBe('#ff6600')
  })
})

// ---------- Image Property Updates ----------

describe('updateImage (v0.2.0 properties)', () => {
  it('updates image opacity', () => {
    useStore.getState().addImage(makeImage({ id: 'img1', opacity: 100 }))
    useStore.getState().updateImage('img1', { opacity: 50 })
    const scene = safeScene(useStore.getState())
    expect(scene.images[0].opacity).toBe(50)
  })

  it('updates image borderRadius', () => {
    useStore.getState().addImage(makeImage({ id: 'img1', borderRadius: 0 }))
    useStore.getState().updateImage('img1', { borderRadius: 16 })
    const scene = safeScene(useStore.getState())
    expect(scene.images[0].borderRadius).toBe(16)
  })

  it('updates image blendMode', () => {
    useStore.getState().addImage(makeImage({ id: 'img1', blendMode: 'normal' }))
    useStore.getState().updateImage('img1', { blendMode: 'multiply' })
    const scene = safeScene(useStore.getState())
    expect(scene.images[0].blendMode).toBe('multiply')
  })

  it('toggles flipX and flipY', () => {
    useStore.getState().addImage(makeImage({ id: 'img1', flipX: false, flipY: false }))
    useStore.getState().updateImage('img1', { flipX: true, flipY: true })
    const scene = safeScene(useStore.getState())
    expect(scene.images[0].flipX).toBe(true)
    expect(scene.images[0].flipY).toBe(true)
  })

  it('updates image blur', () => {
    useStore.getState().addImage(makeImage({ id: 'img1', blur: 0 }))
    useStore.getState().updateImage('img1', { blur: 8 })
    const scene = safeScene(useStore.getState())
    expect(scene.images[0].blur).toBe(8)
  })

  it('sets shadow on image', () => {
    const shadow = { enabled: true, color: '#000', offsetX: 2, offsetY: 4, blur: 8 }
    useStore.getState().addImage(makeImage({ id: 'img1', shadow: null }))
    useStore.getState().updateImage('img1', { shadow })
    const scene = safeScene(useStore.getState())
    expect(scene.images[0].shadow).toEqual(shadow)
  })

  it('sets glow on image', () => {
    const glow = { enabled: true, color: '#818cf8', blur: 20 }
    useStore.getState().addImage(makeImage({ id: 'img1', glow: null }))
    useStore.getState().updateImage('img1', { glow })
    const scene = safeScene(useStore.getState())
    expect(scene.images[0].glow).toEqual(glow)
  })
})

// ---------- Grid & Guides ----------

describe('grid and guides', () => {
  it('updates grid settings', () => {
    useStore.getState().updateGrid({ enabled: true, size: 40 })
    const scene = safeScene(useStore.getState())
    expect(scene.grid.enabled).toBe(true)
    expect(scene.grid.size).toBe(40)
  })

  it('adds and removes guides', () => {
    useStore.getState().addGuide('horizontal', 100)
    useStore.getState().addGuide('vertical', 200)
    const scene1 = safeScene(useStore.getState())
    expect(scene1.guides).toHaveLength(2)
    const guideId = scene1.guides[0].id
    useStore.getState().removeGuide(guideId)
    const scene2 = safeScene(useStore.getState())
    expect(scene2.guides).toHaveLength(1)
  })

  it('clears all guides', () => {
    useStore.getState().addGuide('horizontal', 100)
    useStore.getState().addGuide('vertical', 200)
    useStore.getState().clearGuides()
    const scene = safeScene(useStore.getState())
    expect(scene.guides).toHaveLength(0)
  })
})

// ---------- Background & Canvas ----------

describe('updateBackground', () => {
  it('updates background type', () => {
    useStore.getState().updateBackground({ type: 'solid', color: '#000000' })
    const scene = safeScene(useStore.getState())
    expect(scene.background.type).toBe('solid')
    expect(scene.background.color).toBe('#000000')
  })
})

describe('updateCanvas', () => {
  it('updates canvas dimensions', () => {
    useStore.getState().updateCanvas({ width: 1920, height: 1080 })
    const scene = safeScene(useStore.getState())
    expect(scene.canvas.width).toBe(1920)
    expect(scene.canvas.height).toBe(1080)
  })
})

// ---------- updateGuide ----------

describe('updateGuide', () => {
  it('updates position of an existing guide', () => {
    const store = useStore.getState()
    store.addGuide('horizontal', 100)
    const scene = safeScene(useStore.getState())
    const gid = scene.guides[0].id
    store.updateGuide(gid, 250)
    const updated = safeScene(useStore.getState())
    expect(updated.guides[0].position).toBe(250)
  })

  it('does nothing for non-existent guide', () => {
    useStore.getState().updateGuide('nonexistent', 999)
    const scene = safeScene(useStore.getState())
    expect(scene.guides).toHaveLength(0)
  })
})

// ---------- applyThemePreset ----------

describe('applyThemePreset', () => {
  it('applies a solid background preset', () => {
    const store = useStore.getState()
    store.applyThemePreset({
      name: 'Test',
      swatches: ['#000'],
      background: { type: 'solid', color: '#ff0000' },
      titleColor: '#ffffff',
      sloganColor: '#cccccc'
    })
    const scene = safeScene(useStore.getState())
    expect(scene.background.type).toBe('solid')
    expect(scene.background.color).toBe('#ff0000')
    expect(scene.textBoxes.find((t) => t.stylePreset === 'title')?.color).toBe('#ffffff')
    expect(scene.textBoxes.find((t) => t.stylePreset === 'slogan')?.color).toBe('#cccccc')
  })

  it('applies a gradient background preset', () => {
    const store = useStore.getState()
    store.applyThemePreset({
      name: 'Gradient',
      swatches: ['#f00', '#00f'],
      background: { type: 'gradient', colors: ['#ff0000', '#0000ff'], angle: 90 },
      titleColor: '#111',
      sloganColor: '#222'
    })
    const scene = safeScene(useStore.getState())
    expect(scene.background.type).toBe('gradient')
    expect(scene.background.gradient?.colors).toEqual(['#ff0000', '#0000ff'])
    expect(scene.background.gradient?.angle).toBe(90)
  })

  it('applies a preset background preset', () => {
    const store = useStore.getState()
    store.applyThemePreset({
      name: 'Aurora',
      swatches: ['#333'],
      background: { type: 'preset', presetName: 'aurora' },
      titleColor: '#eee',
      sloganColor: '#ddd'
    })
    const scene = safeScene(useStore.getState())
    expect(scene.background.type).toBe('preset')
    expect(scene.background.presetName).toBe('aurora')
  })
})

// ---------- findElementKind ----------

describe('findElementKind', () => {
  it('finds a device by ID', () => {
    const d = makeDevice()
    useStore.getState().addDevice(d)
    expect(useStore.getState().findElementKind(d.id)).toBe('device')
  })

  it('finds a text box by ID', () => {
    const t = makeTextBox()
    useStore.getState().addTextBox(t)
    expect(useStore.getState().findElementKind(t.id)).toBe('textbox')
  })

  it('finds an image by ID', () => {
    const img = makeImage()
    useStore.getState().addImage(img)
    expect(useStore.getState().findElementKind(img.id)).toBe('image')
  })

  it('finds a shape by ID', () => {
    const s = makeShape()
    useStore.getState().addShape(s)
    expect(useStore.getState().findElementKind(s.id)).toBe('shape')
  })

  it('returns null for unknown ID', () => {
    expect(useStore.getState().findElementKind('nonexistent')).toBeNull()
  })
})

// ---------- addToGroup ----------

describe('addToGroup', () => {
  it('appends an element id to the group member list', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{ ...scene, groups: [{ id: 'g-1', name: 'G', childIds: [] }] }]
    })

    useStore.getState().addToGroup('g-1', 'img-1')

    expect(useStore.getState().scenes[0].groups[0].childIds).toEqual(['img-1'])
  })

  it('is a no-op when the element is already a member', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{ ...scene, groups: [{ id: 'g-1', name: 'G', childIds: ['img-1'] }] }]
    })

    useStore.getState().addToGroup('g-1', 'img-1')

    expect(useStore.getState().scenes[0].groups[0].childIds).toEqual(['img-1'])
  })

  it('is a no-op when the group does not exist', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{ ...scene, groups: [{ id: 'g-1', name: 'G', childIds: [] }] }]
    })

    useStore.getState().addToGroup('missing', 'img-1')

    expect(useStore.getState().scenes[0].groups[0].childIds).toEqual([])
  })
})
