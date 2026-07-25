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
    })
})
