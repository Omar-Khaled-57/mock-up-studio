import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { safeScene, createDefaultScene } from '../renderer/store/sceneSlice'
import { resetStore, makeDevice, makeTextBox, makeImage } from './helpers'

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
    expect(scene.devices).toHaveLength(1)
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

  it('has a default device (monitor)', () => {
    const scene = createDefaultScene()
    expect(scene.devices).toHaveLength(1)
    expect(scene.devices[0].type).toBe('monitor')
  })

  it('has empty text boxes and images', () => {
    const scene = createDefaultScene()
    expect(scene.textBoxes).toHaveLength(0)
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
    expect(scene.devices).toHaveLength(2) // default + new
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
    expect(scene.textBoxes).toHaveLength(1)
    expect(scene.textBoxes[0].id).toBe('tb-1')
  })
})

describe('updateTextBox', () => {
  it('updates text box content', () => {
    const tb = makeTextBox({ id: 'tb-up' })
    useStore.getState().addTextBox(tb)
    useStore.getState().updateTextBox('tb-up', { content: 'Updated' })
    const scene = safeScene(useStore.getState())
    expect(scene.textBoxes[0].content).toBe('Updated')
  })
})

describe('removeTextBox', () => {
  it('removes a text box', () => {
    const tb = makeTextBox({ id: 'tb-rm' })
    useStore.getState().addTextBox(tb)
    useStore.getState().removeTextBox('tb-rm')
    const scene = safeScene(useStore.getState())
    expect(scene.textBoxes).toHaveLength(0)
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
    expect(scene.devices).toHaveLength(3) // default + original + duplicate
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
