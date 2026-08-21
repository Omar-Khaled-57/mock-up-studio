/**
 * sceneSlice — Central source of truth for all scene data.
 *
 * Architecture:
 *   - `scenes[]` is an array of independent Scene objects (multi-scene support).
 *   - `activeSceneIndex` selects which scene is currently displayed/edited.
 *   - Every mutation clones the scenes array (immutable update) so Zustand
 *     selectors see the new reference and React re-renders correctly.
 *
 * Safety invariants:
 *   - `safeScene()` must be used instead of raw `scenes[activeSceneIndex]`
 *     because the index can go stale after undo/redo or scene deletion.
 *   - `clampIndex()` guards all index writes so the active scene is never out of bounds.
 *
 * History contract:
 *   - Callers MUST call `pushHistory()` BEFORE mutating (not after) so that
 *     undo restores the pre-mutation state. This is critical for SceneTabs
 *     and clipboard operations.
 */

import { StateCreator } from 'zustand'
import { Scene, Device, CanvasSettings, Background, TextBox, ImageOverlay, GridSettings, ElementGroup } from '@shared/types'
import { StoreState } from './index'
import { DEFAULT_CANVAS } from '../lib/constants'
import { generateId } from '../lib/id'
import { resetRuntime, useRuntimeStore } from '../runtime/store'
import { createDeviceElement, createTextBoxElement, buildImageOverlay, readImageFile } from '../lib/element-factories'
import { isPaintLayer } from '../services/paint-layers'
import { rescaleChildGeometry, sceneToLocal } from '../services/parent-transform'
import { ElementLike } from '../services/geometry'

/** Minimal element shape shared by the four kinds so focus parenting stays generic. */
export interface FocusParentable {
  containerId: string | null
  x: number
  y: number
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Element-focus auto-parenting.
 *
 * When element focus is active on a container in the ACTIVE scene and an
 * incoming element is parentless, it is nested into the focused container: its
 * scene-space `x/y` is converted into the container's parent-local frame
 * (offsets in its unrotated frame), so the child travels with the container and
 * composes through the transform chain. Returns the element unchanged when
 * there is no element focus, the focused container is missing from the active
 * scene, or the element already carries a `containerId`.
 */
export function applyFocusParent<T extends FocusParentable>(scene: Scene, el: T): T {
  if (el.containerId) return el
  const focusElementId = useRuntimeStore.getState().focusElementId
  if (!focusElementId) return el
  const containerExists =
    scene.devices.some((d) => d.id === focusElementId) ||
    scene.textBoxes.some((t) => t.id === focusElementId) ||
    scene.images.some((i) => i.id === focusElementId) ||
    scene.shapes.some((s) => s.id === focusElementId)
  if (!containerExists) return el
  const local = sceneToLocal(scene, focusElementId, { x: el.x, y: el.y })
  return { ...el, containerId: focusElementId, x: round2(local.x), y: round2(local.y) }
}

/**
 * Returns the current active scene, or a fresh default if the scenes array
 * is empty or the index is out of bounds. This is the ONLY safe way to
 * access the active scene — raw `scenes[activeSceneIndex]` can crash after
 * undo/redo, scene deletion, or during async operations.
 */
export function safeScene(state: StoreState): Scene {
  const { scenes, activeSceneIndex } = state
  if (scenes.length === 0) return createDefaultScene()
  return scenes[Math.min(activeSceneIndex, scenes.length - 1)] ?? createDefaultScene()
}

/** Clamps an index to valid range [0, scenes.length - 1]. Returns 0 for empty arrays. */
function clampIndex(scenes: Scene[], index: number): number {
  if (scenes.length === 0) return 0
  return Math.min(index, scenes.length - 1)
}

/** Shared defaults for every seeded/user text box (style + chrome fields). */
function textBoxBase(zIndex: number): Omit<TextBox, 'id' | 'name' | 'content' | 'x' | 'y' | 'width' | 'height'> {
  return {
    heightAuto: true,
    wrap: true,
    fontSize: 24,
    fontFamily: 'Inter',
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: 1.3,
    letterSpacing: 0,
    wordSpacing: 0,
    textTransform: 'none',
    strokeColor: '#ffffff',
    strokeWidth: 0,
    color: '#ffffff',
    gradient: null,
    glow: null,
    shadow: null,
    visible: true,
    backgroundVisible: false,
    backgroundColor: '#00000040',
    borderVisible: false,
    borderColor: '#ffffff40',
    borderRadius: 4,
    stylePreset: 'custom',
    zIndex,
    locked: false,
    groupId: null,
    containerId: null
  }
}

/**
 * The hero title/slogan are real, first-class text boxes (they live in
 * `scene.textBoxes` and share selection/drag/resize/layer/clipboard/z-order
 * machinery). `stylePreset` marks them so theme presets can recolor the hero
 * copy distinctly from user text boxes.
 */
function defaultTitleTextBox(canvasW: number): TextBox {
  return {
    ...textBoxBase(1),
    id: generateId(),
    name: 'Title',
    content: 'Your Title',
    x: 60,
    y: 60,
    width: Math.max(320, Math.round(canvasW * 0.5)),
    height: 72,
    fontSize: 64,
    fontWeight: 800,
    textAlign: 'left',
    lineHeight: 1.1,
    color: '#ffffff',
    stylePreset: 'title'
  }
}

function defaultSloganTextBox(canvasW: number): TextBox {
  return {
    ...textBoxBase(0),
    id: generateId(),
    name: 'Slogan',
    content: 'Your slogan goes here',
    x: 60,
    y: 152,
    width: Math.max(320, Math.round(canvasW * 0.5)),
    height: 36,
    fontSize: 24,
    fontWeight: 400,
    textAlign: 'left',
    lineHeight: 1.3,
    color: '#a1a1aa',
    stylePreset: 'slogan'
  }
}

export function createDefaultScene(): Scene {
  const canvas = { ...DEFAULT_CANVAS }
  return {
    id: generateId(),
    name: 'Scene 1',
    pinned: false,
    canvas,
    background: {
      type: 'gradient',
      gradient: {
        type: 'linear' as const,
        colors: ['#1e1b4b', '#312e81', '#4338ca'],
        angle: 135,
        radialShape: 'circle' as const
      }
    },
    devices: [],
    textBoxes: [defaultSloganTextBox(canvas.width), defaultTitleTextBox(canvas.width)],
    images: [],
    shapes: [],
    guides: [],
    grid: { enabled: false, size: 20, color: '#ffffff20', opacity: 1, snapEnabled: false, style: 'dotted' },
    groups: [],
    masks: []
  }
}

export type ElementKind = 'device' | 'textbox' | 'image' | 'shape' | 'group'

/**
 * Flattens all element types (devices, textboxes, images) into a single
 * array sorted by z-index. Used by z-order operations (bringToFront,
 * sendToBack, etc.) to compute relative positions across types.
 */
function findAllElements(scene: Scene): { id: string; kind: ElementKind; zIndex: number }[] {
  const all = [
    ...scene.devices.map((d) => ({ id: d.id, kind: 'device' as const, zIndex: d.zIndex })),
    ...scene.textBoxes.map((t) => ({ id: t.id, kind: 'textbox' as const, zIndex: t.zIndex })),
    ...scene.images.map((i) => ({ id: i.id, kind: 'image' as const, zIndex: i.zIndex })),
    ...scene.shapes.map((s) => ({ id: s.id, kind: 'shape' as const, zIndex: s.zIndex }))
  ]
  return all.sort((a, b) => a.zIndex - b.zIndex)
}

/**
 * Updates a single element's zIndex without mutating the rest of the scene.
 * Returns a new scene object with shallow copies of the affected array.
 */
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
  if (kind === 'shape') {
    return { ...scene, shapes: scene.shapes.map((s) => (s.id === id ? { ...s, zIndex: newZ } : s)) }
  }
  return { ...scene, images: scene.images.map((i) => (i.id === id ? { ...i, zIndex: newZ } : i)) }
}

/**
 * Removes an element by id from the appropriate typed array. Masks are
 * independent scene layers (never tied to an element), so deleting an element
 * does not touch `Scene.masks`.
 */
function removeById(scene: Scene, kind: ElementKind, id: string): Scene {
  if (kind === 'device') return { ...scene, devices: scene.devices.filter((d) => d.id !== id) }
  if (kind === 'textbox') return { ...scene, textBoxes: scene.textBoxes.filter((t) => t.id !== id) }
  if (kind === 'shape') return { ...scene, shapes: scene.shapes.filter((s) => s.id !== id) }
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
  addDevice: (device: Device) => void
  updateDevice: (deviceId: string, patch: Partial<Device>) => void
  removeDevice: (deviceId: string) => void
  addDeviceOfType: (type: Device['type']) => string
  addTextBox: (textBox: TextBox) => void
  updateTextBox: (textBoxId: string, patch: Partial<TextBox>) => void
  removeTextBox: (textBoxId: string) => void
  addDefaultTextBox: () => string
  addImage: (image: ImageOverlay) => void
  updateImage: (imageId: string, patch: Partial<ImageOverlay>) => void
  removeImage: (imageId: string) => void
  importImageFromFile: (file: File) => Promise<string | null>
  deleteSelected: (ids: string[]) => void
  duplicateSelected: (ids: string[]) => string[]
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  bringForward: (id: string) => void
  sendBackward: (id: string) => void
  reorderLayer: (id: string, kind: ElementKind, targetZIndex: number) => void
  findElementKind: (id: string) => ElementKind | null
  updateGrid: (patch: Partial<GridSettings>) => void
  addGuide: (orientation: 'horizontal' | 'vertical', position: number) => void
  removeGuide: (guideId: string) => void
  updateGuide: (guideId: string, position: number) => void
  clearGuides: () => void
  applyThemePreset: (preset: import('../lib/constants').ThemePreset) => void
  groupSelected: () => string | null
  ungroup: (groupId: string) => void
  renameGroup: (groupId: string, name: string) => void
  duplicateGroup: (groupId: string) => void
  nestGroup: (parentGroupId: string, childGroupId: string) => void
  combineGroups: (groupIds: string[]) => void
  makeParentGroup: (groupId: string, targetGroupId: string) => void
  reverseNesting: (groupA: string, groupB: string) => void
  addToGroup: (groupId: string, elementId: string) => void
  /**
   * Scales every direct child of a container by `(newWidth/newHeight) / (oldWidth/oldHeight)`
   * about the container's local origin. Reads the container's CURRENT (pre-resize)
   * box, so it must run BEFORE the container's own `update*` commits new
   * dimensions. Callers own the history entry (resize gestures push before the
   * container commit).
   */
  rescaleChildren: (containerId: string, newWidth: number, newHeight: number) => void
  addScene: () => void
  duplicateScene: (index: number) => void
  deleteScene: (index: number) => void
  renameScene: (index: number, name: string) => void
  togglePinScene: (index: number) => void
  reorderScene: (fromIndex: number, toIndex: number) => void
  deleteScenes: (indices: number[]) => void
}

export const createSceneSlice: StateCreator<StoreState, [], [], SceneSlice> = (set, get) => ({
  scenes: [createDefaultScene()],
  activeSceneIndex: 0,

  /**
   * Runtime getter (non-reactive). Prefer the `safeScene()` selector in
   * components/hooks that subscribe to store updates. This is mainly
   * useful inside actions that need the current scene synchronously.
   */
  getActiveScene: () => {
    const { scenes, activeSceneIndex } = get()
    if (scenes.length === 0) return createDefaultScene()
    return scenes[Math.min(activeSceneIndex, scenes.length - 1)]
  },

  setScenes: (scenes) => set((state) => ({ scenes, activeSceneIndex: clampIndex(scenes, state.activeSceneIndex) })),

  setActiveSceneIndex: (index) => {
    set((state) => ({ activeSceneIndex: clampIndex(state.scenes, index) }))
    // Transient state references the previous scene's elements — clear it.
    // Active tool and focus group are preserved.
    resetRuntime()
  },

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

  addDevice: (device: Device) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        devices: [...scene.devices, applyFocusParent(scene, device)]
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
        textBoxes: [...scene.textBoxes, applyFocusParent(scene, textBox)]
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
        images: [...scene.images, applyFocusParent(scene, image)]
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

  /**
   * Creates a device of the given type, pushes one history entry, and
   * selects it. Returns the new device id. Quick-action + DevicesPanel path.
   */
  addDeviceOfType: (type) => {
    const state = get()
    const scene = safeScene(state)
    const device = createDeviceElement(type, scene)
    state.pushHistory(`Add ${type}`)
    state.addDevice(device)
    state.select(device.id)
    return device.id
  },

  /**
   * Creates a default text box (centered, "Double-click to edit"), pushes one
   * history entry, and selects it. Returns the new text box id.
   */
  addDefaultTextBox: () => {
    const state = get()
    const scene = safeScene(state)
    const zIndex = scene.textBoxes.reduce((max, t) => Math.max(max, t.zIndex), -1) + 1
    const tb = createTextBoxElement(scene.canvas.width, scene.canvas.height, zIndex, scene.textBoxes.length)
    state.pushHistory('Add text box')
    state.addTextBox(tb)
    state.select(tb.id)
    return tb.id
  },

  /**
   * Reads an image File (data URL + intrinsic size) and adds it as an image
   * overlay, pushing one history entry and selecting it. Resolves the new
   * image id, or `null` when the file cannot be decoded (caller no-op).
   */
  importImageFromFile: async (file) => {
    const info = await readImageFile(file)
    if (!info) return null
    const state = get()
    const scene = safeScene(state)
    const regularImages = scene.images.filter((i) => !isPaintLayer(i))
    const image = buildImageOverlay(info.dataUrl, info.width, info.height, scene, `Image ${regularImages.length + 1}`)
    state.pushHistory('Add image')
    state.addImage(image)
    state.select(image.id)
    return image.id
  },

  findElementKind: (id) => {
    const scene = safeScene(get())
    if (scene.devices.some((d) => d.id === id)) return 'device'
    if (scene.textBoxes.some((t) => t.id === id)) return 'textbox'
    if (scene.images.some((i) => i.id === id)) return 'image'
    if (scene.shapes.some((s) => s.id === id)) return 'shape'
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
        scene = removeById(scene, 'shape', id)
      }
      scenes[state.activeSceneIndex] = scene
      return { scenes, selectedIds: [] }
    }),

  /**
   * Deep-clones selected elements with offset positions (+30px) and new IDs.
   * Duplicates are placed on top (maxZ + 1) and automatically selected.
   * Masks are independent scene layers, so duplicating an element does not
   * duplicate any masks. Returns the IDs of the newly created clones.
   */
  duplicateSelected: (ids) => {
    const state = get()
    const scene = safeScene(state)
    const newIds: string[] = []
    let maxZ = findAllElements(scene).reduce((m, e) => Math.max(m, e.zIndex), -1)

    const newDevices = [...scene.devices]
    const newTextBoxes = [...scene.textBoxes]
    const newImages = [...scene.images]
    const newShapes = [...scene.shapes]

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
        continue
      }
      const shape = scene.shapes.find((s) => s.id === id)
      if (shape) {
        maxZ++
        const dup = { ...shape, id: generateId(), name: `${shape.name} copy`, x: shape.x + 30, y: shape.y + 30, zIndex: maxZ }
        newShapes.push(dup)
        newIds.push(dup.id)
      }
    }

    const scenes = [...state.scenes]
    const idx = Math.min(state.activeSceneIndex, scenes.length - 1)
    scenes[idx] = {
      ...scene,
      devices: newDevices,
      textBoxes: newTextBoxes,
      images: newImages,
      shapes: newShapes
    }
    set({ scenes, selectedIds: newIds })
    return newIds
  },

  /** Moves element above all others by setting zIndex to max + 1. */
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

  /** Moves element below all others by setting zIndex to min - 1. */
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

  /**
   * Moves element up one layer. If two elements share the same zIndex,
   * increments by 1 to break the tie.
   */
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

  /**
   * Moves element down one layer. If two elements share the same zIndex,
   * decrements by 1 to break the tie.
   */
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

  /** Directly sets an element's zIndex. Used by drag-reorder in LayersPanel. */
  reorderLayer: (id, kind, targetZIndex) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = patchZIndex(scene, kind, id, targetZIndex)
      return { scenes }
    }),

  updateGrid: (patch) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        grid: { ...scene.grid, ...patch }
      }
      return { scenes }
    }),

  addGuide: (orientation, position) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        guides: [...scene.guides, { id: generateId(), orientation, position }]
      }
      return { scenes }
    }),

  removeGuide: (guideId) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        guides: scene.guides.filter((g) => g.id !== guideId)
      }
      return { scenes }
    }),

  updateGuide: (guideId, position) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = {
        ...scene,
        guides: scene.guides.map((g) => (g.id === guideId ? { ...g, position } : g))
      }
      return { scenes }
    }),

  clearGuides: () =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      scenes[state.activeSceneIndex] = { ...scene, guides: [] }
      return { scenes }
    }),

  applyThemePreset: (preset) =>
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      const bg = preset.background
      const background: Background = bg.type === 'solid'
        ? { type: 'solid', color: bg.color ?? '#000000' }
        : bg.type === 'gradient'
          ? { type: 'gradient', gradient: { colors: bg.colors ?? ['#000000', '#ffffff'], angle: bg.angle ?? 135 } }
          : { type: 'preset', presetName: bg.presetName ?? 'aurora' }
      scenes[state.activeSceneIndex] = {
        ...scene,
        background,
        textBoxes: scene.textBoxes.map((t) => ({ ...t, color: t.stylePreset === 'title' ? preset.titleColor : preset.sloganColor })),
        shapes: scene.shapes.map((s) => ({ ...s, color: preset.accentColor })),
        devices: scene.devices.map((d) => ({ ...d, colorTheme: preset.deviceTheme }))
      }
      return { scenes }
    }),

  groupSelected: () => {
    const state = get()
    const ids = state.selectedIds
    if (ids.length < 2) return null
    const scene = safeScene(state)
    const groupId = generateId()
    const group = { id: groupId, name: `Group ${scene.groups.length + 1}`, childIds: [...ids], parentGroupId: null }
    const newDevices = scene.devices.map((d) => ids.includes(d.id) ? { ...d, groupId } : d)
    const newTextBoxes = scene.textBoxes.map((t) => ids.includes(t.id) ? { ...t, groupId } : t)
    const newImages = scene.images.map((i) => ids.includes(i.id) ? { ...i, groupId } : i)
    const newShapes = scene.shapes.map((s) => ids.includes(s.id) ? { ...s, groupId } : s)
    const scenes = [...state.scenes]
    const gIdx = Math.min(state.activeSceneIndex, scenes.length - 1)
    scenes[gIdx] = {
      ...scene,
      devices: newDevices,
      textBoxes: newTextBoxes,
      images: newImages,
      shapes: newShapes,
      groups: [...scene.groups, group]
    }
    set({ scenes })
    return groupId
  },

  ungroup: (groupId) => {
    const state = get()
    const scene = safeScene(state)
    const newDevices = scene.devices.map((d) => d.groupId === groupId ? { ...d, groupId: null } : d)
    const newTextBoxes = scene.textBoxes.map((t) => t.groupId === groupId ? { ...t, groupId: null } : t)
    const newImages = scene.images.map((i) => i.groupId === groupId ? { ...i, groupId: null } : i)
    const newShapes = scene.shapes.map((s) => s.groupId === groupId ? { ...s, groupId: null } : s)
    const scenes = [...state.scenes]
    const uIdx = Math.min(state.activeSceneIndex, scenes.length - 1)
    scenes[uIdx] = {
      ...scene,
      devices: newDevices,
      textBoxes: newTextBoxes,
      images: newImages,
      shapes: newShapes,
      groups: scene.groups.filter((g) => g.id !== groupId)
    }
    set({ scenes })
    // Ungrouping the currently focused group leaves focus pointing at a dead
    // group — exit focus so the scrim does not stay over nothing.
    if (useRuntimeStore.getState().focusGroupId === groupId) {
      useRuntimeStore.getState().exitFocus()
    }
  },

  renameGroup: (groupId, name) =>
    set((state) => {
      const scene = state.scenes[state.activeSceneIndex]
      const scenes = [...state.scenes]
      scenes[state.activeSceneIndex] = {
        ...scene,
        groups: scene.groups.map((g) => g.id === groupId ? { ...g, name } : g)
      }
      return { scenes }
    }),

  duplicateGroup: (groupId) =>
    set((state) => {
      const scene = state.scenes[state.activeSceneIndex]
      const group = scene.groups.find((g) => g.id === groupId)
      if (!group) return {}
      const newGroupId = generateId()
      const idMap = new Map<string, string>()
      for (const cid of group.childIds) {
        const newId = generateId()
        idMap.set(cid, newId)
      }
      const newGroup = { ...group, id: newGroupId, childIds: group.childIds.map((cid) => idMap.get(cid)!) }
      const newDevices = scene.devices.flatMap((d) => {
        const newId = idMap.get(d.id)
        return newId ? [{ ...d, id: newId, groupId: newGroupId, x: d.x + 20, y: d.y + 20 }] : []
      })
      const newTextBoxes = scene.textBoxes.flatMap((t) => {
        const newId = idMap.get(t.id)
        return newId ? [{ ...t, id: newId, groupId: newGroupId, x: t.x + 20, y: t.y + 20 }] : []
      })
      const newImages = scene.images.flatMap((i) => {
        const newId = idMap.get(i.id)
        return newId ? [{ ...i, id: newId, groupId: newGroupId, x: i.x + 20, y: i.y + 20 }] : []
      })
      const newShapes = scene.shapes.flatMap((s) => {
        const newId = idMap.get(s.id)
        return newId ? [{ ...s, id: newId, groupId: newGroupId, x: s.x + 20, y: s.y + 20 }] : []
      })
      const newGroupDevices = [...scene.devices, ...newDevices]
      const newGroupTextBoxes = [...scene.textBoxes, ...newTextBoxes]
      const newGroupImages = [...scene.images, ...newImages]
      const newGroupShapes = [...scene.shapes, ...newShapes]
      const scenes = [...state.scenes]
      scenes[state.activeSceneIndex] = {
        ...scene,
        devices: newGroupDevices,
        textBoxes: newGroupTextBoxes,
        images: newGroupImages,
        shapes: newGroupShapes,
        groups: [...scene.groups, newGroup]
      }
      return { scenes }
    }),

  nestGroup: (parentGroupId, childGroupId) =>
    set((state) => {
      const scene = state.scenes[state.activeSceneIndex]
      const scenes = [...state.scenes]
      scenes[state.activeSceneIndex] = {
        ...scene,
        groups: scene.groups.map((g) => {
          if (g.id === childGroupId) return { ...g, parentGroupId }
          return g
        })
      }
      return { scenes }
    }),

  combineGroups: (groupIds) =>
    set((state) => {
      const scene = state.scenes[state.activeSceneIndex]
      const targetGroups = scene.groups.filter((g) => groupIds.includes(g.id))
      if (targetGroups.length < 2) return {}
      const allChildIds = targetGroups.flatMap((g) => g.childIds)
      const mergedId = targetGroups[0].id
      const merged = { ...targetGroups[0], childIds: allChildIds, parentGroupId: null }
      const keepIds = new Set(groupIds)
      keepIds.delete(mergedId)
      const scenes = [...state.scenes]
      scenes[state.activeSceneIndex] = {
        ...scene,
        groups: scene.groups
          .filter((g) => !keepIds.has(g.id))
          .map((g) => g.id === mergedId ? merged : g)
      }
      return { scenes }
    }),

  makeParentGroup: (groupId, targetGroupId) =>
    set((state) => {
      const scene = state.scenes[state.activeSceneIndex]
      const group = scene.groups.find((g) => g.id === groupId)
      if (!group || group.parentGroupId) return {}
      const childGroup = scene.groups.find((g) => g.id === targetGroupId)
      if (!childGroup) return {}
      const scenes = [...state.scenes]
      scenes[state.activeSceneIndex] = {
        ...scene,
        groups: scene.groups.map((g) => {
          if (g.id === targetGroupId) return { ...g, parentGroupId: groupId }
          return g
        })
      }
      return { scenes }
    }),

  reverseNesting: (groupA, groupB) =>
    set((state) => {
      const scene = state.scenes[state.activeSceneIndex]
      const a = scene.groups.find((g) => g.id === groupA)
      const b = scene.groups.find((g) => g.id === groupB)
      if (!a || !b) return {}
      const aIsParent = a.parentGroupId === null && b.parentGroupId === groupA
      const bIsParent = b.parentGroupId === null && a.parentGroupId === groupB
      if (!aIsParent && !bIsParent) return {}
      let newA: ElementGroup | null = null
      let newB: ElementGroup | null = null
      if (aIsParent) {
        newA = { ...a, parentGroupId: groupB }
        newB = { ...b, parentGroupId: null }
      } else {
        newA = { ...a, parentGroupId: null }
        newB = { ...b, parentGroupId: groupA }
      }
      const scenes = [...state.scenes]
      scenes[state.activeSceneIndex] = {
        ...scene,
        groups: scene.groups.map((g) => {
          if (g.id === groupA) return newA!
          if (g.id === groupB) return newB!
          return g
        })
      }
      return { scenes }
    }),

  /** Adds an element id to a group's member list (no-op if missing or already a member). */
  addToGroup: (groupId, elementId) =>
    set((state) => {
      const scene = state.scenes[state.activeSceneIndex]
      const group = scene.groups.find((g) => g.id === groupId)
      if (!group || group.childIds.includes(elementId)) return state
      const scenes = [...state.scenes]
      scenes[state.activeSceneIndex] = {
        ...scene,
        groups: scene.groups.map((g) =>
          g.id === groupId ? { ...g, childIds: [...g.childIds, elementId] } : g
        )
      }
      return { scenes }
    }),

  /**
   * Rescales every direct child of `containerId` proportionally to the parent's
   * new box. Must run BEFORE the container's own dimension commit so the
   * current (old) width/height are read. No-op when the container or its
   * children are missing. Callers own the history entry.
   */
  rescaleChildren: (containerId, newWidth, newHeight) =>
    set((state) => {
      const scene = state.scenes[state.activeSceneIndex]
      if (!scene) return {}
      const parent =
        scene.devices.find((d) => d.id === containerId) ??
        scene.textBoxes.find((t) => t.id === containerId) ??
        scene.images.find((i) => i.id === containerId) ??
        scene.shapes.find((s) => s.id === containerId)
      if (!parent) return {}
      const hasChildren =
        scene.devices.some((d) => d.containerId === containerId) ||
        scene.textBoxes.some((t) => t.containerId === containerId) ||
        scene.images.some((i) => i.containerId === containerId) ||
        scene.shapes.some((s) => s.containerId === containerId)
      if (!hasChildren) return {}
      const scaled = <T extends ElementLike>(child: T): T =>
        ({ ...child, ...rescaleChildGeometry(child, parent.width, parent.height, newWidth, newHeight) })
      return {
        scenes: state.scenes.map((sc, i) =>
          i !== state.activeSceneIndex
            ? sc
            : {
                ...sc,
                devices: sc.devices.map((d) => (d.containerId === containerId ? scaled(d) : d)),
                textBoxes: sc.textBoxes.map((t) => (t.containerId === containerId ? scaled(t) : t)),
                images: sc.images.map((i) => (i.containerId === containerId ? scaled(i) : i)),
                shapes: sc.shapes.map((s) => (s.containerId === containerId ? scaled(s) : s))
              }
        )
      }
    }),

  addScene: () => {
    set((state) => {
      const newScene = createDefaultScene()
      newScene.name = `Scene ${state.scenes.length + 1}`
      const scenes = [...state.scenes, newScene]
      return { scenes, activeSceneIndex: scenes.length - 1, selectedIds: [] }
    })
    resetRuntime()
  },

  /**
   * Deep-clones a scene via JSON round-trip (fast, no structural sharing).
   * The copy is inserted immediately after the source and becomes active.
   */
  duplicateScene: (index) => {
    set((state) => {
      const source = state.scenes[index]
      if (!source) return state
      const dup = JSON.parse(JSON.stringify(source)) as Scene
      dup.id = generateId()
      dup.name = `${source.name} copy`
      const scenes = [...state.scenes]
      scenes.splice(index + 1, 0, dup)
      return { scenes, activeSceneIndex: index + 1, selectedIds: [] }
    })
    resetRuntime()
  },

  /** Removes a scene. Prevents deletion if only one scene remains. */
  deleteScene: (index) => {
    set((state) => {
      if (state.scenes.length <= 1) return state
      const scenes = state.scenes.filter((_, i) => i !== index)
      const newActive = Math.min(state.activeSceneIndex, scenes.length - 1)
      return { scenes, activeSceneIndex: newActive, selectedIds: [] }
    })
    resetRuntime()
  },

  renameScene: (index, name) =>
    set((state) => {
      if (index < 0 || index >= state.scenes.length) return state
      const scenes = [...state.scenes]
      scenes[index] = { ...scenes[index], name }
      return { scenes }
    }),

  togglePinScene: (index) =>
    set((state) => {
      if (index < 0 || index >= state.scenes.length) return state
      const scenes = [...state.scenes]
      scenes[index] = { ...scenes[index], pinned: !scenes[index].pinned }
      return { scenes }
    }),

  reorderScene: (fromIndex, toIndex) =>
    set((state) => {
      if (fromIndex < 0 || fromIndex >= state.scenes.length) return state
      const scenes = [...state.scenes]
      const [moved] = scenes.splice(fromIndex, 1)
      if (moved === undefined) return state
      scenes.splice(toIndex, 0, moved)
      let newActive = state.activeSceneIndex
      if (fromIndex === state.activeSceneIndex) {
        newActive = toIndex
      } else {
        if (fromIndex < state.activeSceneIndex && toIndex >= state.activeSceneIndex) {
          newActive = state.activeSceneIndex - 1
        } else if (fromIndex > state.activeSceneIndex && toIndex <= state.activeSceneIndex) {
          newActive = state.activeSceneIndex + 1
        }
      }
      return { scenes, activeSceneIndex: newActive }
    }),

  /** Removes multiple scenes by index. Protects against deleting the last scene. */
  deleteScenes: (indices) => {
    set((state) => {
      const indicesSet = new Set(indices)
      const remaining = state.scenes.filter((_, i) => !indicesSet.has(i))
      if (remaining.length === 0) return state
      const newActive = Math.min(state.activeSceneIndex, remaining.length - 1)
      return { scenes: remaining, activeSceneIndex: newActive, selectedIds: [] }
    })
    resetRuntime()
  }
})
