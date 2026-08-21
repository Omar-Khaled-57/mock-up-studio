/**
 * componentSlice — Per-user global component library.
 *
 * Components are saved snapshots of scene elements (image, text, shape,
 * brush, group) stored in a per-user `components.json` file. Instances on
 * the scene carry a `componentId` reference and render from the definition.
 *
 * Architecture:
 *   - `definitions[]` holds every component in the global library.
 *   - `groups[]` holds the folder/tag structure.
 *   - Scene elements reference definitions via `componentId`.
 *   - `syncDefinitionToInstances` patches scene element fields from the
 *     definition so instances always mirror the latest definition state.
 *
 * History contract:
 *   - Every mutating action must be preceded by `pushHistory()` at the
 *     call site. The slice itself does NOT call pushHistory.
 *
 * Runtime-only store note:
 *   - The component library is document-level state (serialized), so it
 *     lives in the document store, not the runtime store.
 */

import { StateCreator } from 'zustand'
import {
  ComponentDefinition,
  ComponentData,
  ComponentGroup,
  Device,
  TextBox,
  ImageOverlay,
  Shape
} from '@shared/types'
import { StoreState } from './index'
import { generateId } from '../lib/id'
import { DEFAULT_DEFINITIONS, DEFAULT_GROUPS } from '../lib/default-components'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a safe snapshot of all 4 element arrays from the active scene. */
function allElements(state: StoreState) {
  const scene = state.scenes[Math.min(state.activeSceneIndex, state.scenes.length - 1)]
  if (!scene) return { devices: [], textBoxes: [], images: [], shapes: [] }
  return { devices: scene.devices, textBoxes: scene.textBoxes, images: scene.images, shapes: scene.shapes }
}

type ElementKind = 'device' | 'textbox' | 'image' | 'shape'

function kindForElement(
  el: Device | TextBox | ImageOverlay | Shape
): ElementKind {
  if ('screenImage' in el) return 'device'
  if ('content' in el && 'fontSize' in el) return 'textbox'
  if ('blendMode' in el) return 'image'
  return 'shape'
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Validates deserialized ComponentLibrary; returns defaults on any corruption. */
function validateLibrary(raw: unknown): { definitions: ComponentDefinition[]; groups: ComponentGroup[] } {
  if (!isRecord(raw)) return { definitions: [], groups: [] }
  const defs = Array.isArray(raw.definitions) ? raw.definitions : []
  const grps = Array.isArray(raw.groups) ? raw.groups : []
  const validDefs: ComponentDefinition[] = []
  const validGrps: ComponentGroup[] = []
  for (const d of defs) {
    if (!isRecord(d) || typeof d.id !== 'string' || typeof d.name !== 'string') continue
    if (!isRecord(d.data) || typeof d.data.kind !== 'string') continue
    validDefs.push(d as unknown as ComponentDefinition)
  }
  for (const g of grps) {
    if (!isRecord(g) || typeof g.id !== 'string' || typeof g.name !== 'string') continue
    validGrps.push(g as unknown as ComponentGroup)
  }
  return { definitions: validDefs, groups: validGrps }
}

/** Patches the visual fields of a scene element from a component data snapshot. */
function applyDefinitionToElement(
  el: Device | TextBox | ImageOverlay | Shape,
  data: ComponentData
): Device | TextBox | ImageOverlay | Shape {
  switch (data.kind) {
    case 'image':
      if ('screenImage' in el) {
        return { ...el, screenImage: data.src, width: el.width, height: el.height }
      }
      if ('blendMode' in el) {
        return {
          ...el,
          src: data.src,
          opacity: data.opacity,
          blendMode: data.blendMode,
          flipX: data.flipX,
          flipY: data.flipY,
          blur: data.blur,
          glow: data.glow,
          shadow: data.shadow,
          borderRadius: data.borderRadius,
          effects: data.effects
        }
      }
      break
    case 'text':
      if ('content' in el && 'fontSize' in el) {
        return {
          ...el,
          content: data.content,
          fontFamily: data.fontFamily,
          fontSize: data.fontSize,
          fontWeight: data.fontWeight,
          color: data.color,
          textAlign: data.textAlign,
          lineHeight: data.lineHeight,
          letterSpacing: data.letterSpacing,
          wordSpacing: data.wordSpacing,
          textTransform: data.textTransform,
          wrap: data.wrap,
          heightAuto: data.heightAuto,
          shadow: data.shadow,
          glow: data.glow,
          strokeColor: data.strokeColor,
          strokeWidth: data.strokeWidth,
          gradient: data.gradient,
          backgroundVisible: data.backgroundVisible,
          borderRadius: data.borderRadius,
          borderVisible: data.border !== '',
          borderColor: data.border,
          backgroundColor: data.backgroundColor
        }
      }
      break
    case 'shape':
      if ('kind' in el && 'cornerRadius' in el && 'gradient' in el) {
        return {
          ...el,
          kind: data.shapeKind,
          width: data.width,
          height: data.height,
          color: data.color,
          gradient: data.gradient,
          cornerRadius: data.cornerRadius,
          angles: data.angles,
          crossThickness: data.crossThickness,
          plusThickness: data.plusThickness,
          arrowThickness: data.arrowThickness,
          opacity: data.opacity,
          backgroundImage: data.backgroundImage,
          blur: data.blur,
          glow: data.glow,
          shadow: data.shadow,
          effects: data.effects
        }
      }
      break
    case 'brush':
      if ('blendMode' in el) {
        return { ...el, src: data.src, width: data.width, height: data.height }
      }
      break
    case 'group':
      break
  }
  return el
}

// Module-level debounce for saveToDisk — coalesces rapid mutations into one write.
let savePending: Promise<void> = Promise.resolve()

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export interface ComponentSlice {
  definitions: ComponentDefinition[]
  groups: ComponentGroup[]

  /** Create a component from element data. Returns the new definition. */
  addComponent: (
    data: ComponentData,
    name: string,
    groupId: string,
    thumbnail: string,
    kind: ComponentDefinition['kind'],
    typeTag?: string
  ) => ComponentDefinition

  /** Remove a component definition. Does NOT touch scene elements. */
  removeComponent: (id: string) => void

  /** Update a component definition's metadata. */
  updateComponentDefinition: (id: string, patch: Partial<Pick<ComponentDefinition, 'name' | 'data' | 'groupId' | 'typeTag'>>) => void

  /** Stamp `componentId` on a scene element. */
  markAsInstance: (elementId: string, kind: ElementKind, componentId: string) => void

  /** Clear `componentId` + `isComponentEditing` on a scene element. */
  detachInstance: (elementId: string, kind: ElementKind) => void

  /** Toggle `isComponentEditing` on a scene element. */
  setInstanceEditing: (elementId: string, kind: ElementKind, editing: boolean) => void

  /** Push definition visual properties to all matching scene instances. */
  syncDefinitionToInstances: (definitionId: string) => void

  /** Create a new component group (folder). */
  addComponentGroup: (name: string, isDefault: boolean) => ComponentGroup

  /** Remove a component group. Its components are reassigned to the first remaining group. */
  removeComponentGroup: (id: string) => void

  /** Rename a component group. */
  renameComponentGroup: (id: string, name: string) => void

  /** Move a component to a different group. */
  moveComponentToGroup: (componentId: string, newGroupId: string) => void

  /** Load library from disk (IPC). */
  loadFromDisk: () => Promise<void>

  /** Save library to disk (IPC). */
  saveToDisk: () => Promise<void>
}

export const createComponentSlice: StateCreator<StoreState, [], [], ComponentSlice> = (set, get) => ({
  definitions: [...DEFAULT_DEFINITIONS],
  groups: [...DEFAULT_GROUPS],

  addComponent: (data, name, groupId, thumbnail, kind, typeTag) => {
    const now = Date.now()
    const def: ComponentDefinition = {
      id: generateId(),
      name,
      groupId,
      kind,
      typeTag: typeTag || undefined,
      thumbnail,
      createdAt: now,
      updatedAt: now,
      data
    }
    set((state) => ({
      definitions: [...state.definitions, def]
    }))
    void get().saveToDisk()
    return def
  },

  removeComponent: (id) => {
    set((state) => ({
      definitions: state.definitions.filter((d) => d.id !== id)
    }))
    void get().saveToDisk()
  },

  updateComponentDefinition: (id, patch) => {
    set((state) => ({
      definitions: state.definitions.map((d) =>
        d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d
      )
    }))
    void get().saveToDisk()
  },

  markAsInstance: (elementId, kind, componentId) => {
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      if (!scene) return {}
      const patch = { componentId, isComponentEditing: false }

      switch (kind) {
        case 'device':
          scenes[state.activeSceneIndex] = {
            ...scene,
            devices: scene.devices.map((d) => d.id === elementId ? { ...d, ...patch } : d)
          }
          break
        case 'textbox':
          scenes[state.activeSceneIndex] = {
            ...scene,
            textBoxes: scene.textBoxes.map((t) => t.id === elementId ? { ...t, ...patch } : t)
          }
          break
        case 'image':
          scenes[state.activeSceneIndex] = {
            ...scene,
            images: scene.images.map((i) => i.id === elementId ? { ...i, ...patch } : i)
          }
          break
        case 'shape':
          scenes[state.activeSceneIndex] = {
            ...scene,
            shapes: scene.shapes.map((s) => s.id === elementId ? { ...s, ...patch } : s)
          }
          break
      }
      return { scenes }
    })
  },

  detachInstance: (elementId, kind) => {
    set((state) => {
      const scenes = [...state.scenes]
      const scene = scenes[state.activeSceneIndex]
      if (!scene) return {}

      switch (kind) {
        case 'device':
          scenes[state.activeSceneIndex] = {
            ...scene,
            devices: scene.devices.map((d) => d.id === elementId ? { ...d, componentId: undefined, isComponentEditing: undefined } : d)
          }
          break
        case 'textbox':
          scenes[state.activeSceneIndex] = {
            ...scene,
            textBoxes: scene.textBoxes.map((t) => t.id === elementId ? { ...t, componentId: undefined, isComponentEditing: undefined } : t)
          }
          break
        case 'image':
          scenes[state.activeSceneIndex] = {
            ...scene,
            images: scene.images.map((i) => i.id === elementId ? { ...i, componentId: undefined, isComponentEditing: undefined } : i)
          }
          break
        case 'shape':
          scenes[state.activeSceneIndex] = {
            ...scene,
            shapes: scene.shapes.map((s) => s.id === elementId ? { ...s, componentId: undefined, isComponentEditing: undefined } : s)
          }
          break
      }
      return { scenes }
    })
  },

  setInstanceEditing: (elementId, kind, editing) => {
    const state = get()

    // When entering edit mode, snapshot the current definition properties onto
    // the element so the user edits a full copy (not stale placement-time data).
    // We extract a per-kind patch to avoid spreading a union type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {}
    if (editing) {
      const scene = state.scenes[state.activeSceneIndex]
      if (scene) {
        let el: Device | TextBox | ImageOverlay | Shape | undefined
        if (kind === 'device') el = scene.devices.find((d) => d.id === elementId)
        else if (kind === 'textbox') el = scene.textBoxes.find((t) => t.id === elementId)
        else if (kind === 'image') el = scene.images.find((i) => i.id === elementId)
        else if (kind === 'shape') el = scene.shapes.find((s) => s.id === elementId)

        const cid = el && 'componentId' in el ? el.componentId as string | undefined : undefined
        if (cid) {
          const def = state.definitions.find((d) => d.id === cid)
          if (def) {
            const merged = applyDefinitionToElement(
              el as Device | TextBox | ImageOverlay | Shape,
              def.data
            )
            // Copy only visual fields — never overwrite id/componentId/isComponentEditing.
            for (const [k, v] of Object.entries(merged)) {
              if (k !== 'id' && k !== 'componentId' && k !== 'isComponentEditing') patch[k] = v
            }
          }
        }
      }
    }

    set((s) => {
      const scenes = [...s.scenes]
      const scene = scenes[s.activeSceneIndex]
      if (!scene) return {}

      switch (kind) {
        case 'device':
          scenes[s.activeSceneIndex] = {
            ...scene,
            devices: scene.devices.map((d) =>
              d.id === elementId ? { ...d, ...patch, isComponentEditing: editing } : d
            )
          }
          break
        case 'textbox':
          scenes[s.activeSceneIndex] = {
            ...scene,
            textBoxes: scene.textBoxes.map((t) =>
              t.id === elementId ? { ...t, ...patch, isComponentEditing: editing } : t
            )
          }
          break
        case 'image':
          scenes[s.activeSceneIndex] = {
            ...scene,
            images: scene.images.map((i) =>
              i.id === elementId ? { ...i, ...patch, isComponentEditing: editing } : i
            )
          }
          break
        case 'shape':
          scenes[s.activeSceneIndex] = {
            ...scene,
            shapes: scene.shapes.map((s) =>
              s.id === elementId ? { ...s, ...patch, isComponentEditing: editing } : s
            )
          }
          break
      }
      return { scenes }
    })
  },

  syncDefinitionToInstances: (definitionId) => {
    const state = get()
    const def = state.definitions.find((d) => d.id === definitionId)
    if (!def) return

    set((s) => {
      const scenes = [...s.scenes]
      const scene = scenes[s.activeSceneIndex]
      if (!scene) return {}

      const patchElement = <T extends Device | TextBox | ImageOverlay | Shape>(el: T): T => {
        if (el.componentId !== definitionId) return el
        if (el.isComponentEditing) return el
        return applyDefinitionToElement(el, def.data) as T
      }

      scenes[s.activeSceneIndex] = {
        ...scene,
        devices: scene.devices.map(patchElement),
        textBoxes: scene.textBoxes.map(patchElement),
        images: scene.images.map(patchElement),
        shapes: scene.shapes.map(patchElement)
      }
      return { scenes }
    })
  },

  addComponentGroup: (name, isDefault) => {
    const group: ComponentGroup = {
      id: generateId(),
      name,
      isDefault,
      createdAt: Date.now()
    }
    set((state) => ({
      groups: [...state.groups, group]
    }))
    void get().saveToDisk()
    return group
  },

  removeComponentGroup: (id) => {
    if (get().groups.length <= 1) return
    set((state) => {
      const remaining = state.groups.filter((g) => g.id !== id)
      const fallbackGroupId = remaining[0]?.id ?? ''
      return {
        groups: remaining,
        definitions: state.definitions.map((d) =>
          d.groupId === id ? { ...d, groupId: fallbackGroupId } : d
        )
      }
    })
    void get().saveToDisk()
  },

  renameComponentGroup: (id, name) => {
    set((state) => ({
      groups: state.groups.map((g) => (g.id === id ? { ...g, name } : g))
    }))
    void get().saveToDisk()
  },

  moveComponentToGroup: (componentId, newGroupId) => {
    set((state) => ({
      definitions: state.definitions.map((d) =>
        d.id === componentId ? { ...d, groupId: newGroupId } : d
      )
    }))
    void get().saveToDisk()
  },

  loadFromDisk: async () => {
    try {
      if (!window.api?.loadComponents) return
      const json = await window.api.loadComponents()
      if (!json) return
      // Guard against oversized or corrupted files that could OOM the renderer.
      const MAX_COMPONENT_LIBRARY_BYTES = 50 * 1024 * 1024 // 50 MB
      if (json.length > MAX_COMPONENT_LIBRARY_BYTES) {
        console.warn('[componentSlice] loadFromDisk: file too large, keeping defaults')
        return
      }
      const lib = validateLibrary(JSON.parse(json))

      // Always keep default groups — merge any that are missing from disk.
      const mergedGroups = [
        ...DEFAULT_GROUPS.filter((g) => !lib.groups.some((lg) => lg.id === g.id)),
        ...lib.groups
      ]

      // Always keep default definitions — updated defaults override disk
      // versions for matching IDs (newer definition wins), while user-created
      // definitions (no matching default ID) are preserved from disk.
      const defaultIds = new Set(DEFAULT_DEFINITIONS.map((d) => d.id))
      const userDefs = lib.definitions.filter((ld) => !defaultIds.has(ld.id))
      const mergedDefs = [...DEFAULT_DEFINITIONS, ...userDefs]

      set({ definitions: mergedDefs, groups: mergedGroups })
    } catch {
      // Silently keep defaults on failure.
    }
  },

  saveToDisk: async () => {
    // Chain onto the pending save — only the latest snapshot is written.
    savePending = savePending.then(async () => {
      try {
        if (!window.api?.saveComponents) return
        const { definitions, groups } = get()
        const result = await window.api.saveComponents(JSON.stringify({ definitions, groups }))
        if (result && !result.success) {
          console.warn('[componentSlice] saveComponents failed:', result.error)
        }
      } catch (err) {
        console.warn('[componentSlice] saveComponents error:', err)
      }
    })
    return savePending
  }
})

export { kindForElement, allElements, applyDefinitionToElement }

/** Returns all unique non-empty typeTag values across definitions, sorted. */
export function allTypeTags(definitions: ComponentDefinition[]): string[] {
  const tags = new Set<string>()
  for (const d of definitions) {
    if (d.typeTag) tags.add(d.typeTag)
  }
  return [...tags].sort()
}
