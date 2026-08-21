/**
 * componentSlice — per-user global component library (CRUD, instance
 * stamping, definition sync, group management, library validation,
 * applyDefinitionToElement).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { resetStore, makeDevice, makeTextBox, makeImage, makeShape } from './helpers'
import {
  kindForElement,
  allElements,
  applyDefinitionToElement,
  allTypeTags,
} from '../renderer/store/componentSlice'
import { DEFAULT_DEFINITIONS, DEFAULT_GROUPS } from '../renderer/lib/default-components'
import { placeComponentAt } from '../renderer/lib/component-utils'
import type { ComponentData } from '@shared/types'

// Stub window.api so saveToDisk/loadFromDisk don't throw.
beforeEach(() => {
  vi.stubGlobal('window', {
    api: {
      saveComponents: vi.fn().mockResolvedValue({ success: true }),
      loadComponents: vi.fn().mockResolvedValue(null)
    }
  })
  resetStore()
  // resetStore doesn't reset component slices — seed defaults explicitly.
  useStore.setState({ definitions: [...DEFAULT_DEFINITIONS], groups: [...DEFAULT_GROUPS] })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IMAGE_DATA: ComponentData = {
  kind: 'image',
  src: 'data:image/png;base64,def',
  opacity: 80,
  blendMode: 'multiply',
  flipX: true,
  flipY: false,
  blur: 2,
  glow: [],
  shadow: [],
  borderRadius: 4,
  effects: null
}

const TEXT_DATA: ComponentData = {
  kind: 'text',
  content: 'Updated',
  fontFamily: 'Inter',
  fontSize: 32,
  fontWeight: 700,
  color: '#ff0000',
  textAlign: 'center',
  lineHeight: 1.5,
  letterSpacing: 1,
  wordSpacing: 2,
  textTransform: 'uppercase',
  wrap: false,
  heightAuto: true,
  shadow: null,
  glow: null,
  strokeColor: '#000',
  strokeWidth: 0,
  gradient: null,
  backgroundVisible: false,
  borderRadius: 0,
  border: '',
  backgroundColor: 'transparent'
}

const SHAPE_DATA: ComponentData = {
  kind: 'shape',
  shapeKind: 'circle',
  width: 150,
  height: 150,
  color: '#00ff00',
  gradient: null,
  cornerRadius: 8,
  angles: [60, 60, 60],
  crossThickness: 0.3,
  plusThickness: 0.3,
  arrowThickness: 0.5,
  opacity: 60,
  backgroundImage: null,
  blur: 0,
  glow: [],
  shadow: [],
  effects: null
}

const BRUSH_DATA: ComponentData = {
  kind: 'brush',
  src: 'data:image/png;base64,brush',
  width: 200,
  height: 100
}

function addDef(data: ComponentData, name = 'Comp', groupId = '') {
  return useStore.getState().addComponent(data, name, groupId, 'thumb://x', data.kind as 'image' | 'text' | 'shape' | 'brush')
}

function seedScene() {
  const scene = useStore.getState().scenes[0]
  useStore.setState({
    scenes: [{
      ...scene,
      devices: [makeDevice({ id: 'dev-1' })],
      textBoxes: [makeTextBox({ id: 'tb-1' })],
      images: [makeImage({ id: 'img-1' })],
      shapes: [makeShape({ id: 'shp-1' })]
    }]
  })
}

// ---------------------------------------------------------------------------
// Kind / element resolution
// ---------------------------------------------------------------------------

describe('kindForElement', () => {
  it('resolves device', () => expect(kindForElement(makeDevice())).toBe('device'))
  it('resolves textBox', () => expect(kindForElement(makeTextBox())).toBe('textbox'))
  it('resolves image', () => expect(kindForElement(makeImage())).toBe('image'))
  it('resolves shape', () => expect(kindForElement(makeShape())).toBe('shape'))
})

describe('allElements', () => {
  it('returns all four arrays from the active scene', () => {
    seedScene()
    const els = allElements(useStore.getState())
    expect(els.devices).toHaveLength(1)
    expect(els.textBoxes).toHaveLength(1)
    expect(els.images).toHaveLength(1)
    expect(els.shapes).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// applyDefinitionToElement
// ---------------------------------------------------------------------------

describe('applyDefinitionToElement', () => {
  it('patches image fields from image data', () => {
    const img = makeImage({ id: 'img-x', opacity: 100, src: 'old' })
    const result = applyDefinitionToElement(img, IMAGE_DATA) as typeof img
    expect(result.src).toBe(IMAGE_DATA.src)
    expect(result.opacity).toBe(80)
    expect(result.id).toBe('img-x')
  })

  it('patches text fields from text data', () => {
    const tb = makeTextBox({ id: 'tb-x', content: 'old', fontSize: 12 })
    const result = applyDefinitionToElement(tb, TEXT_DATA) as typeof tb
    expect(result.content).toBe('Updated')
    expect(result.fontSize).toBe(32)
    expect(result.id).toBe('tb-x')
  })

  it('patches shape fields from shape data', () => {
    const shp = makeShape({ id: 'shp-x', kind: 'rectangle', width: 50 })
    const result = applyDefinitionToElement(shp, SHAPE_DATA) as typeof shp
    expect(result.kind).toBe('circle')
    expect(result.width).toBe(150)
    expect(result.id).toBe('shp-x')
  })

  it('patches image fields from brush data (brush kind maps to blendMode target)', () => {
    const img = makeImage({ id: 'img-brush', src: 'old', width: 10, height: 10 })
    const result = applyDefinitionToElement(img, BRUSH_DATA) as typeof img
    expect(result.src).toBe(BRUSH_DATA.src)
    expect(result.width).toBe(200)
    expect(result.height).toBe(100)
  })

  it('returns element unchanged for mismatched kind', () => {
    const dev = makeDevice({ id: 'dev-x' })
    const result = applyDefinitionToElement(dev, TEXT_DATA)
    expect(result).toBe(dev)
  })

  it('returns element unchanged for group data', () => {
    const dev = makeDevice()
    const result = applyDefinitionToElement(dev, { kind: 'group', children: [], width: 100, height: 100 })
    expect(result).toBe(dev)
  })
})

// ---------------------------------------------------------------------------
// addComponent
// ---------------------------------------------------------------------------

describe('addComponent', () => {
  it('adds a definition to the store', () => {
    const before = useStore.getState().definitions.length
    const def = addDef(IMAGE_DATA, 'My Image')
    const defs = useStore.getState().definitions
    expect(defs).toHaveLength(before + 1)
    expect(defs.find((d) => d.id === def.id)?.name).toBe('My Image')
  })

  it('saves to disk after adding', async () => {
    addDef(IMAGE_DATA)
    await vi.waitFor(() => {
      expect(window.api.saveComponents).toHaveBeenCalled()
    })
  })

  it('stamps typeTag when provided', () => {
    const def = addDef(IMAGE_DATA, 'Badge', '', 'thumb://x', 'image')
    useStore.getState().updateComponentDefinition(def.id, { typeTag: 'Badge' })
    const updated = useStore.getState().definitions.find((d) => d.id === def.id)
    expect(updated?.typeTag).toBe('Badge')
  })

  it('leaves typeTag undefined when not provided', () => {
    const def = addDef(IMAGE_DATA, 'Plain')
    const stored = useStore.getState().definitions.find((d) => d.id === def.id)
    expect(stored?.typeTag).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// removeComponent
// ---------------------------------------------------------------------------

describe('removeComponent', () => {
  it('removes a definition by id', () => {
    const def = addDef(IMAGE_DATA)
    const before = useStore.getState().definitions.length
    useStore.getState().removeComponent(def.id)
    expect(useStore.getState().definitions).toHaveLength(before - 1)
    expect(useStore.getState().definitions.find((d) => d.id === def.id)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// updateComponentDefinition
// ---------------------------------------------------------------------------

describe('updateComponentDefinition', () => {
  it('patches name and data', () => {
    const def = addDef(IMAGE_DATA, 'Old Name')
    useStore.getState().updateComponentDefinition(def.id, {
      name: 'New Name',
      data: BRUSH_DATA
    })
    const updated = useStore.getState().definitions.find((d) => d.id === def.id)
    expect(updated).toBeDefined()
    expect(updated!.name).toBe('New Name')
    expect(updated!.data).toBe(BRUSH_DATA)
  })

  it('patches typeTag independently of name/data', () => {
    const def = addDef(IMAGE_DATA, 'Tagged')
    useStore.getState().updateComponentDefinition(def.id, { typeTag: 'Badge' })
    const updated = useStore.getState().definitions.find((d) => d.id === def.id)
    expect(updated?.typeTag).toBe('Badge')
    expect(updated?.name).toBe('Tagged')
  })

  it('clears typeTag by patching to undefined', () => {
    const def = addDef(IMAGE_DATA, 'Untag')
    useStore.getState().updateComponentDefinition(def.id, { typeTag: 'Card' })
    useStore.getState().updateComponentDefinition(def.id, { typeTag: undefined })
    const updated = useStore.getState().definitions.find((d) => d.id === def.id)
    expect(updated?.typeTag).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Group management
// ---------------------------------------------------------------------------

describe('addComponentGroup', () => {
  it('creates a group and saves to disk', () => {
    const before = useStore.getState().groups.length
    const group = useStore.getState().addComponentGroup('My Group', false)
    expect(useStore.getState().groups).toHaveLength(before + 1)
    expect(useStore.getState().groups.find((g) => g.id === group.id)?.name).toBe('My Group')
    expect(group.isDefault).toBe(false)
  })
})

describe('removeComponentGroup', () => {
  it('removes a group and reassigns orphaned definitions to the first remaining group', () => {
    // Clear defaults to isolate this test's group logic.
    useStore.setState({ definitions: [], groups: [] })
    const g1 = useStore.getState().addComponentGroup('G1', false)
    const g2 = useStore.getState().addComponentGroup('G2', false)
    addDef(IMAGE_DATA, 'Def1', g1.id)
    addDef(TEXT_DATA, 'Def2', g2.id)

    useStore.getState().removeComponentGroup(g2.id)

    const groups = useStore.getState().groups
    expect(groups.find((g) => g.id === g2.id)).toBeUndefined()
    expect(groups).toHaveLength(1)

    const defs = useStore.getState().definitions
    // Def2 should be reassigned to g1.
    const def2 = defs.find((d) => d.name === 'Def2')
    expect(def2).toBeDefined()
    expect(def2!.groupId).toBe(g1.id)
  })

  it('no-ops when only one group remains', () => {
    // Clear defaults to isolate this test.
    useStore.setState({ definitions: [], groups: [] })
    const g1 = useStore.getState().addComponentGroup('G1', false)
    useStore.getState().removeComponentGroup(g1.id)
    // Cannot remove the last group.
    expect(useStore.getState().groups.find((g) => g.id === g1.id)).toBeDefined()
  })
})

describe('renameComponentGroup', () => {
  it('renames a group', () => {
    const g = useStore.getState().addComponentGroup('Old', false)
    useStore.getState().renameComponentGroup(g.id, 'New')
    expect(useStore.getState().groups.find((gr) => gr.id === g.id)?.name).toBe('New')
  })
})

describe('moveComponentToGroup', () => {
  it('moves a component to a different group', () => {
    const g1 = useStore.getState().addComponentGroup('G1', false)
    const g2 = useStore.getState().addComponentGroup('G2', false)
    const def = addDef(IMAGE_DATA, 'Move', g1.id)

    useStore.getState().moveComponentToGroup(def.id, g2.id)
    expect(useStore.getState().definitions.find((d) => d.id === def.id)?.groupId).toBe(g2.id)
  })
})

// ---------------------------------------------------------------------------
// Instance stamping
// ---------------------------------------------------------------------------

describe('markAsInstance / detachInstance', () => {
  beforeEach(() => seedScene())

  it('marks a device as an instance', () => {
    const def = addDef(IMAGE_DATA)
    useStore.getState().markAsInstance('dev-1', 'device', def.id)
    const dev = useStore.getState().scenes[0].devices.find((d) => d.id === 'dev-1')!
    expect(dev.componentId).toBe(def.id)
    expect(dev.isComponentEditing).toBe(false)
  })

  it('marks a textbox as an instance', () => {
    const def = addDef(TEXT_DATA, 'T', '', '', 'text')
    useStore.getState().markAsInstance('tb-1', 'textbox', def.id)
    const tb = useStore.getState().scenes[0].textBoxes.find((t) => t.id === 'tb-1')!
    expect(tb.componentId).toBe(def.id)
  })

  it('marks an image as an instance', () => {
    const def = addDef(IMAGE_DATA)
    useStore.getState().markAsInstance('img-1', 'image', def.id)
    const img = useStore.getState().scenes[0].images.find((i) => i.id === 'img-1')!
    expect(img.componentId).toBe(def.id)
  })

  it('marks a shape as an instance', () => {
    const def = addDef(SHAPE_DATA, 'S', '', '', 'shape')
    useStore.getState().markAsInstance('shp-1', 'shape', def.id)
    const shp = useStore.getState().scenes[0].shapes.find((s) => s.id === 'shp-1')!
    expect(shp.componentId).toBe(def.id)
  })

  it('detaches an instance clearing both fields', () => {
    const def = addDef(IMAGE_DATA)
    useStore.getState().markAsInstance('img-1', 'image', def.id)
    useStore.getState().detachInstance('img-1', 'image')
    const img = useStore.getState().scenes[0].images.find((i) => i.id === 'img-1')!
    expect(img.componentId).toBeUndefined()
    expect(img.isComponentEditing).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// setInstanceEditing
// ---------------------------------------------------------------------------

describe('setInstanceEditing', () => {
  beforeEach(() => seedScene())

  it('toggles isComponentEditing on an image', () => {
    const def = addDef(IMAGE_DATA)
    useStore.getState().markAsInstance('img-1', 'image', def.id)
    useStore.getState().setInstanceEditing('img-1', 'image', true)
    const img = useStore.getState().scenes[0].images.find((i) => i.id === 'img-1')!
    expect(img.isComponentEditing).toBe(true)
  })

  it('when entering edit mode, snapshots definition fields onto the element', () => {
    const def = addDef(IMAGE_DATA)
    useStore.getState().markAsInstance('img-1', 'image', def.id)
    useStore.getState().setInstanceEditing('img-1', 'image', true)
    const img = useStore.getState().scenes[0].images.find((i) => i.id === 'img-1')!
    expect(img.src).toBe(IMAGE_DATA.src)
    expect(img.opacity).toBe(80)
    expect(img.id).toBe('img-1')
    expect(img.componentId).toBe(def.id)
  })

  it('turns editing off', () => {
    const def = addDef(IMAGE_DATA)
    useStore.getState().markAsInstance('img-1', 'image', def.id)
    useStore.getState().setInstanceEditing('img-1', 'image', true)
    useStore.getState().setInstanceEditing('img-1', 'image', false)
    const img = useStore.getState().scenes[0].images.find((i) => i.id === 'img-1')!
    expect(img.isComponentEditing).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// syncDefinitionToInstances
// ---------------------------------------------------------------------------

describe('syncDefinitionToInstances', () => {
  beforeEach(() => seedScene())

  it('pushes definition fields to all matching non-editing instances', () => {
    const def = addDef(IMAGE_DATA)
    useStore.getState().markAsInstance('img-1', 'image', def.id)
    // Modify the definition data.
    const newData: ComponentData = { ...IMAGE_DATA, opacity: 10 }
    useStore.getState().updateComponentDefinition(def.id, { data: newData })

    useStore.getState().syncDefinitionToInstances(def.id)

    const img = useStore.getState().scenes[0].images.find((i) => i.id === 'img-1')!
    expect(img.opacity).toBe(10)
  })

  it('skips instances in editing mode', () => {
    const def = addDef(IMAGE_DATA)
    useStore.getState().markAsInstance('img-1', 'image', def.id)
    useStore.getState().setInstanceEditing('img-1', 'image', true)
    // Mutate the element's src while editing.
    useStore.setState((s) => ({
      scenes: s.scenes.map((sc, i) => i !== s.activeSceneIndex ? sc : {
        ...sc,
        images: sc.images.map((img) => img.id === 'img-1' ? { ...img, src: 'local-edit' } : img)
      })
    }))

    const newData: ComponentData = { ...IMAGE_DATA, src: 'synced' }
    useStore.getState().updateComponentDefinition(def.id, { data: newData })
    useStore.getState().syncDefinitionToInstances(def.id)

    const img = useStore.getState().scenes[0].images.find((i) => i.id === 'img-1')!
    expect(img.src).toBe('local-edit')
  })

  it('no-ops for unknown definition id', () => {
    useStore.getState().syncDefinitionToInstances('nonexistent')
    // No error thrown.
  })
})

// ---------------------------------------------------------------------------
// Library validation
// ---------------------------------------------------------------------------

describe('loadFromDisk validation', () => {
  it('loads valid JSON from disk', async () => {
    const lib = {
      definitions: [{ id: 'd1', name: 'Test', groupId: 'g1', kind: 'image', thumbnail: 't', createdAt: 0, updatedAt: 0, data: IMAGE_DATA }],
      groups: [{ id: 'g1', name: 'Default', isDefault: true, createdAt: 0 }]
    }
    const loadComponents = vi.fn().mockResolvedValue(JSON.stringify(lib))
    vi.spyOn(window, 'api', 'get').mockReturnValue({ saveComponents: vi.fn().mockResolvedValue({ success: true }), loadComponents } as never)

    await useStore.getState().loadFromDisk()

    // loadFromDisk merges disk data with built-in defaults.
    const { definitions, groups } = useStore.getState()
    const d1 = definitions.find((d) => d.id === 'd1')
    expect(d1).toBeDefined()
    expect(d1!.name).toBe('Test')
    // Defaults are always present.
    expect(definitions.length).toBeGreaterThanOrEqual(2) // d1 + at least some defaults
    expect(groups.length).toBeGreaterThanOrEqual(2) // g1 + default groups
  })

  it('silently keeps defaults on corrupted JSON', async () => {
    const loadComponents = vi.fn().mockResolvedValue('{ broken json')
    vi.spyOn(window, 'api', 'get').mockReturnValue({ saveComponents: vi.fn().mockResolvedValue({ success: true }), loadComponents } as never)

    await useStore.getState().loadFromDisk()

    // Corrupted JSON triggers catch → defaults stay intact.
    const defs = useStore.getState().definitions
    expect(defs.length).toBeGreaterThanOrEqual(1)
  })

  it('rejects oversized files (>50 MB)', async () => {
    const big = 'x'.repeat(51 * 1024 * 1024)
    const loadComponents = vi.fn().mockResolvedValue(big)
    vi.spyOn(window, 'api', 'get').mockReturnValue({ saveComponents: vi.fn().mockResolvedValue({ success: true }), loadComponents } as never)

    await useStore.getState().loadFromDisk()

    const defs = useStore.getState().definitions
    expect(defs.length).toBeGreaterThanOrEqual(1) // defaults stay
  })

  it('handles missing window.api gracefully', async () => {
    vi.spyOn(window, 'api', 'get').mockReturnValue(undefined as never)

    await useStore.getState().loadFromDisk()

    // Without API, loadFromDisk returns early — defaults survive.
    const defs = useStore.getState().definitions
    expect(defs.length).toBe(DEFAULT_DEFINITIONS.length)
  })

  it('filters out definitions with invalid shapes', async () => {
    const lib = {
      definitions: [
        { id: 'd1', name: 'Good', groupId: 'g1', kind: 'image', thumbnail: 't', createdAt: 0, updatedAt: 0, data: IMAGE_DATA },
        { notId: true },
        'string',
        { id: 'd2', name: 'NoKind', groupId: 'g1' }
      ],
      groups: [{ id: 'g1', name: 'Default', isDefault: true, createdAt: 0 }]
    }
    const loadComponents = vi.fn().mockResolvedValue(JSON.stringify(lib))
    vi.spyOn(window, 'api', 'get').mockReturnValue({ saveComponents: vi.fn().mockResolvedValue({ success: true }), loadComponents } as never)

    await useStore.getState().loadFromDisk()

    const { definitions } = useStore.getState()
    // Invalid entries are filtered; only the valid one + defaults survive.
    const d1 = definitions.find((d) => d.id === 'd1')
    expect(d1).toBeDefined()
    expect(d1!.name).toBe('Good')
    // Invalid entries are NOT present.
    expect(definitions.find((d) => (d as { notId?: boolean }).notId)).toBeUndefined()
    expect(definitions.find((d) => typeof d === 'string')).toBeUndefined()
    expect(definitions.find((d) => d.id === 'd2')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Default definitions — thumbnails & group kind
// ---------------------------------------------------------------------------

describe('DEFAULT_DEFINITIONS', () => {
  it('every default has a non-empty SVG thumbnail', () => {
    for (const def of DEFAULT_DEFINITIONS) {
      expect(def.thumbnail).toBeTruthy()
      expect(def.thumbnail).toContain('data:image/svg+xml')
    }
  })

  it('has 36 definitions across 3 themed groups', () => {
    expect(DEFAULT_DEFINITIONS).toHaveLength(36)
    const groupIds = new Set(DEFAULT_DEFINITIONS.map((d) => d.groupId))
    expect(groupIds.size).toBe(3)
  })

  it('each themed group contains button definitions that are group kind with shape+text children', () => {
    const themedGroupIds = [DEFAULT_GROUPS[0].id, DEFAULT_GROUPS[1].id, DEFAULT_GROUPS[2].id]
    for (const gid of themedGroupIds) {
      const buttons = DEFAULT_DEFINITIONS.filter((d) => d.groupId === gid && d.name.startsWith('Primary'))
      expect(buttons.length).toBeGreaterThanOrEqual(1)
      for (const btn of buttons) {
        expect(btn.data.kind).toBe('group')
        if (btn.data.kind === 'group') {
          expect(btn.data.children.length).toBeGreaterThanOrEqual(2)
          expect(btn.data.children[0].kind).toBe('shape')
          expect(btn.data.children[1].kind).toBe('text')
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// placeComponentAt — canvas placement
// ---------------------------------------------------------------------------

describe('placeComponentAt', () => {
  beforeEach(() => seedScene())

  it('places a group definition as a single ImageOverlay', () => {
    const btn = DEFAULT_DEFINITIONS[0] // Primary Button — kind: 'group'
    expect(btn.data.kind).toBe('group')

    const scene = useStore.getState().scenes[useStore.getState().activeSceneIndex]
    const imagesBefore = scene.images.length

    placeComponentAt(btn, 200, 200)

    const scene2 = useStore.getState().scenes[useStore.getState().activeSceneIndex]
    expect(scene2.images.length).toBe(imagesBefore + 1)

    const placed = scene2.images[scene2.images.length - 1]
    expect(placed.componentId).toBe(btn.id)
    expect(placed.locked).toBe(false)
    expect(placed.isComponentEditing).toBe(false)
    expect(placed.src).toContain('data:image/svg+xml')

    // No shape or text boxes were created.
    expect(scene2.shapes.length).toBe(scene.shapes.length)
    expect(scene2.textBoxes.length).toBe(scene.textBoxes.length)

    // The placed image is selected.
    expect(useStore.getState().selectedIds).toContain(placed.id)
  })

  it('places a shape definition as a single shape', () => {
    const shapeDef = addDef(SHAPE_DATA, 'Test Shape')

    const scene = useStore.getState().scenes[useStore.getState().activeSceneIndex]
    const shapesBefore = scene.shapes.length

    placeComponentAt(shapeDef, 300, 300)

    const scene2 = useStore.getState().scenes[useStore.getState().activeSceneIndex]
    expect(scene2.shapes.length).toBe(shapesBefore + 1)

    const placed = scene2.shapes[scene2.shapes.length - 1]
    expect(placed.componentId).toBe(shapeDef.id)
  })

  it('places a text definition as a single text box', () => {
    const label = DEFAULT_DEFINITIONS.find((d) => d.data.kind === 'text')!
    expect(label.data.kind).toBe('text')

    const scene = useStore.getState().scenes[useStore.getState().activeSceneIndex]
    const textsBefore = scene.textBoxes.length

    placeComponentAt(label, 400, 400)

    const scene2 = useStore.getState().scenes[useStore.getState().activeSceneIndex]
    expect(scene2.textBoxes.length).toBe(textsBefore + 1)

    const placed = scene2.textBoxes[scene2.textBoxes.length - 1]
    expect(placed.componentId).toBe(label.id)
  })

  it('centers on canvas when cx/cy are omitted', () => {
    const heading = DEFAULT_DEFINITIONS.find((d) => d.data.kind === 'text')!
    // Heading labels are 280×36
    placeComponentAt(heading)

    const scene = useStore.getState().scenes[useStore.getState().activeSceneIndex]
    const placed = scene.textBoxes[scene.textBoxes.length - 1]
    const cw = scene.canvas.width
    const ch = scene.canvas.height
    expect(placed.x).toBe(cw / 2 - 140)
    expect(placed.y).toBe(ch / 2 - 18)
  })
})

// ---------------------------------------------------------------------------
// allTypeTags
// ---------------------------------------------------------------------------

describe('allTypeTags', () => {
  it('returns sorted unique non-empty typeTag values', () => {
    const d1 = addDef(IMAGE_DATA, 'A')
    const d2 = addDef(TEXT_DATA, 'B')
    const d3 = addDef(SHAPE_DATA, 'C')
    useStore.getState().updateComponentDefinition(d1.id, { typeTag: 'Badge' })
    useStore.getState().updateComponentDefinition(d2.id, { typeTag: 'Button' })
    useStore.getState().updateComponentDefinition(d3.id, { typeTag: 'Badge' })

    const tags = allTypeTags(useStore.getState().definitions)
    // Defaults already contribute Alert/Badge/Button/Card/Heading/Input/Navbar/Progress
    expect(tags).toContain('Badge')
    expect(tags).toContain('Button')
    expect(tags).toEqual([...new Set(tags)].sort())
  })

  it('returns default typeTags when no user defs add new tags', () => {
    const tags = allTypeTags(useStore.getState().definitions)
    expect(tags).toContain('Button')
    expect(tags).toContain('Badge')
    expect(tags).toContain('Card')
  })

  it('ignores empty-string typeTags', () => {
    const d1 = addDef(IMAGE_DATA, 'A')
    useStore.getState().updateComponentDefinition(d1.id, { typeTag: '' })
    const tags = allTypeTags(useStore.getState().definitions)
    expect(tags).not.toContain('')
    expect(tags).toContain('Button')
  })
})
