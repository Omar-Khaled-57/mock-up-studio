import { StateCreator } from 'zustand'
import { Scene, Device, CanvasSettings, Background, TextBox, ImageOverlay, TitleText } from '@shared/types'
import { StoreState } from './index'
import { DEFAULT_CANVAS } from '../lib/constants'
import { generateId } from '../lib/id'

function defaultTitleText(): TitleText {
  return {
    content: 'Your Title',
    fontSize: 64,
    fontFamily: 'Inter',
    fontWeight: 800,
    textAlign: 'left',
    color: '#ffffff',
    gradient: null,
    glow: null,
    shadow: null
  }
}

function defaultSloganText(): TitleText {
  return {
    content: 'Your slogan goes here',
    fontSize: 24,
    fontFamily: 'Inter',
    fontWeight: 400,
    textAlign: 'left',
    color: '#a1a1aa',
    gradient: null,
    glow: null,
    shadow: null
  }
}

function createDefaultScene(): Scene {
  return {
    id: generateId(),
    name: 'Scene 1',
    canvas: { ...DEFAULT_CANVAS },
    background: {
      type: 'gradient',
      gradient: {
        colors: ['#1e1b4b', '#312e81', '#4338ca'],
        angle: 135
      }
    },
    devices: [
      {
        id: generateId(),
        type: 'monitor',
        name: 'Monitor 1',
        visible: true,
        locked: false,
        x: 340,
        y: 110,
        width: 600,
        height: 375,
        rotation: 0,
        zIndex: 0,
        colorTheme: 'dark',
        screenImage: null,
        objectFit: 'contain'
      }
    ],
    textBoxes: [],
    images: [],
    titleText: defaultTitleText(),
    sloganText: defaultSloganText(),
    guides: [],
    grid: { enabled: false, size: 20, color: '#ffffff20', snapEnabled: false }
  }
}

type ElementKind = 'device' | 'textbox' | 'image'

function findAllElements(scene: Scene): { id: string; kind: ElementKind; zIndex: number }[] {
  const all = [
    ...scene.devices.map((d) => ({ id: d.id, kind: 'device' as const, zIndex: d.zIndex })),
    ...scene.textBoxes.map((t) => ({ id: t.id, kind: 'textbox' as const, zIndex: t.zIndex })),
    ...scene.images.map((i) => ({ id: i.id, kind: 'image' as const, zIndex: i.zIndex }))
  ]
  return all.sort((a, b) => a.zIndex - b.zIndex)
}

function patchZIndex(
  scene: Scene,
  kind: ElementKind,
  id: string,
  newZ: number
): Scene {
  if (kind === 'device') {
    return { ...scene, devices: scene.devices.map((d) => (d.id === id ? { ...d, zIndex: newZ } : d)) }
  }
  if (kind === 'textbox') {
    return { ...scene, textBoxes: scene.textBoxes.map((t) => (t.id === id ? { ...t, zIndex: newZ } : t)) }
  }
  return { ...scene, images: scene.images.map((i) => (i.id === id ? { ...i, zIndex: newZ } : i)) }
}

function removeById(scene: Scene, kind: ElementKind, id: string): Scene {
  if (kind === 'device') return { ...scene, devices: scene.devices.filter((d) => d.id !== id) }
  if (kind === 'textbox') return { ...scene, textBoxes: scene.textBoxes.filter((t) => t.id !== id) }
  return { ...scene, images: scene.images.filter((i) => i.id !== id) }
}

export interface SceneSlice {
  scenes: Scene[]
  activeSceneIndex: number
  getActiveScene: () => Scene
  setScenes: (scenes: Scene[]) => void
  setActiveSceneIndex: (index: number) => void
  updateCanvas: (settings: Partial<CanvasSettings>) => void
  updateBackground: (bg: Partial<Background>) => void
  updateTitleText: (patch: Partial<TitleText>) => void
  updateSloganText: (patch: Partial<TitleText>) => void
  addDevice: (device: Device) => void
  updateDevice: (deviceId: string, patch: Partial<Device>) => void
  removeDevice: (deviceId: string) => void
  addTextBox: (textBox: TextBox) => void
  updateTextBox: (textBoxId: string, patch: Partial<TextBox>) => void
  removeTextBox: (textBoxId: string) => void
  addImage: (image: ImageOverlay) => void
  updateImage: (imageId: string, patch: Partial<ImageOverlay>) => void
  removeImage: (imageId: string) => void
  deleteSelected: (ids: string[]) => void
  duplicateSelected: (ids: string[]) => string[]
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  bringForward: (id: string) => void
  sendBackward: (id: string) => void
  reorderLayer: (id: string, kind: ElementKind, targetZIndex: number) => void
  findElementKind: (id: string) => ElementKind | null
}

export const createSceneSlice: StateCreator<StoreState, [], [], SceneSlice> = (set, get) => ({
  scenes: [createDefaultScene()],
  activeSceneIndex: 0,

  getActiveScene: () => {
    const { scenes, activeSceneIndex } = get()
    return scenes[activeSceneIndex]
  },

  setScenes: (scenes) => set({ scenes }),

  setActiveSceneIndex: (index) => set({ activeSceneIndex: index }),

  updateCanvas: (settings) =>
    set((state) => {
      const scenes = [...state.scenes]
      scenes[state.activeSceneIndex] = {
        ...scenes[state.activeSceneIndex],
        canvas: { ...scenes[state.activeSceneIndex].canvas, ...settings }
      }
      return { scenes }
    }),

  updateBackground: (bg) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        background: { ...scene.background, ...bg }
      }
      return { scenes }
    }),

  updateTitleText: (patch) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        titleText: { ...scene.titleText, ...patch }
      }
      return { scenes }
    }),

  updateSloganText: (patch) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        sloganText: { ...scene.sloganText, ...patch }
      }
      return { scenes }
    }),

  addDevice: (device) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        devices: [...scene.devices, device]
      }
      return { scenes }
    }),

  updateDevice: (deviceId, patch) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        devices: scene.devices.map((d) => (d.id === deviceId ? { ...d, ...patch } : d))
      }
      return { scenes }
    }),

  removeDevice: (deviceId) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        devices: scene.devices.filter((d) => d.id !== deviceId)
      }
      return { scenes }
    }),

  addTextBox: (textBox) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        textBoxes: [...scene.textBoxes, textBox]
      }
      return { scenes }
    }),

  updateTextBox: (textBoxId, patch) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        textBoxes: scene.textBoxes.map((t) => (t.id === textBoxId ? { ...t, ...patch } : t))
      }
      return { scenes }
    }),

  removeTextBox: (textBoxId) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        textBoxes: scene.textBoxes.filter((t) => t.id !== textBoxId)
      }
      return { scenes }
    }),

  addImage: (image) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        images: [...scene.images, image]
      }
      return { scenes }
    }),

  updateImage: (imageId, patch) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        images: scene.images.map((img) => (img.id === imageId ? { ...img, ...patch } : img))
      }
      return { scenes }
    }),

  removeImage: (imageId) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        images: scene.images.filter((img) => img.id !== imageId)
      }
      return { scenes }
    }),

  findElementKind: (id) => {
    const scene = get().scenes[get().activeSceneIndex]
    if (scene.devices.some((d) => d.id === id)) return 'device'
    if (scene.textBoxes.some((t) => t.id === id)) return 'textbox'
    if (scene.images.some((i) => i.id === id)) return 'image'
    return null
  },

  deleteSelected: (ids) =>
    set((state) => {
      const scenes = [...state.scenes]
      let scene = { ...scenes[state.activeSceneIndex] }
      for (const id of ids) {
        scene = removeById(scene, 'device', id)
        scene = removeById(scene, 'textbox', id)
        scene = removeById(scene, 'image', id)
      }
      scenes[state.activeSceneIndex] = scene
      return { scenes, selectedIds: [] }
    }),

  duplicateSelected: (ids) => {
    const state = get()
    const scene = state.scenes[state.activeSceneIndex]
    const newIds: string[] = []
    let maxZ = findAllElements(scene).reduce((m, e) => Math.max(m, e.zIndex), -1)

    const newDevices = [...scene.devices]
    const newTextBoxes = [...scene.textBoxes]
    const newImages = [...scene.images]

    for (const id of ids) {
      const dev = scene.devices.find((d) => d.id === id)
      if (dev) {
        maxZ++
        const dup = { ...dev, id: generateId(), name: `${dev.name} copy`, x: dev.x + 30, y: dev.y + 30, zIndex: maxZ }
        newDevices.push(dup)
        newIds.push(dup.id)
        continue
      }
      const tb = scene.textBoxes.find((t) => t.id === id)
      if (tb) {
        maxZ++
        const dup = { ...tb, id: generateId(), x: tb.x + 30, y: tb.y + 30, zIndex: maxZ }
        newTextBoxes.push(dup)
        newIds.push(dup.id)
        continue
      }
      const img = scene.images.find((i) => i.id === id)
      if (img) {
        maxZ++
        const dup = { ...img, id: generateId(), x: img.x + 30, y: img.y + 30, zIndex: maxZ }
        newImages.push(dup)
        newIds.push(dup.id)
      }
    }

    const scenes = [...state.scenes]
    scenes[state.activeSceneIndex] = { ...scene, devices: newDevices, textBoxes: newTextBoxes, images: newImages }
    set({ scenes, selectedIds: newIds })
    return newIds
  },

  bringToFront: (id) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      const all = findAllElements(scene)
      const maxZ = all.reduce((m, e) => Math.max(m, e.zIndex), 0)
      const kind = get().findElementKind(id)
      if (!kind) return state
      scenes[state.activeSceneIndex] = patchZIndex(scene, kind, id, maxZ + 1)
      return { scenes }
    }),

  sendToBack: (id) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      const all = findAllElements(scene)
      const minZ = all.reduce((m, e) => Math.min(m, e.zIndex), 0)
      const kind = get().findElementKind(id)
      if (!kind) return state
      scenes[state.activeSceneIndex] = patchZIndex(scene, kind, id, minZ - 1)
      return { scenes }
    }),

  bringForward: (id) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      const kind = get().findElementKind(id)
      if (!kind) return state
      const all = findAllElements(scene)
      const idx = all.findIndex((e) => e.id === id)
      if (idx < 0 || idx >= all.length - 1) return state
      const nextZ = all[idx + 1].zIndex
      const curZ = all[idx].zIndex
      scenes[state.activeSceneIndex] = patchZIndex(scene, kind, id, nextZ + (curZ === nextZ ? 1 : 0))
      return { scenes }
    }),

  sendBackward: (id) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      const kind = get().findElementKind(id)
      if (!kind) return state
      const all = findAllElements(scene)
      const idx = all.findIndex((e) => e.id === id)
      if (idx <= 0) return state
      const prevZ = all[idx - 1].zIndex
      const curZ = all[idx].zIndex
      scenes[state.activeSceneIndex] = patchZIndex(scene, kind, id, prevZ - (curZ === prevZ ? 1 : 0))
      return { scenes }
    }),

  reorderLayer: (id, kind, targetZIndex) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = patchZIndex(scene, kind, id, targetZIndex)
      return { scenes }
    })
})
