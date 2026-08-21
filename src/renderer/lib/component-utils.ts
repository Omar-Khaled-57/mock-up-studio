import { useMemo } from 'react'
import type { Device, TextBox, ImageOverlay, Shape, ShapeKind, ComponentDefinition } from '@shared/types'
import { useStore } from '../store'
import { applyDefinitionToElement } from '../store/componentSlice'
import { generateId } from './id'
import { renderGroupToSvg } from './default-components'

/**
 * Place a component instance on the canvas at (cx, cy).
 * When cx/cy are omitted the instance is centered on the canvas.
 * Calls pushHistory + addImage/addTextBox/addShape + select.
 */
export function placeComponentAt(def: ComponentDefinition, cx?: number, cy?: number): void {
  const store = useStore.getState()
  const scene = store.scenes[store.activeSceneIndex]
  if (!scene) return

  const x = cx ?? scene.canvas.width / 2
  const y = cy ?? scene.canvas.height / 2

  store.pushHistory('Place unit')

  const zIndex = Math.max(
    ...scene.devices.map((d) => d.zIndex),
    ...scene.textBoxes.map((t) => t.zIndex),
    ...scene.images.map((i) => i.zIndex),
    ...scene.shapes.map((s) => s.zIndex),
    -1
  ) + 1

  switch (def.kind) {
    case 'image':
    case 'brush': {
      const img = def.data.kind === 'image' ? def.data : def.data.kind === 'brush' ? def.data : null
      const w = img?.width ?? 200
      const h = img?.height ?? 200
      const id = generateId()
      store.addImage({
        id,
        name: def.name,
        x: x - w / 2,
        y: y - h / 2,
        width: w,
        height: h,
        rotation: 0,
        src: img?.src ?? '',
        opacity: 1,
        blendMode: 'normal',
        flipX: false,
        flipY: false,
        blur: 0,
        glow: [],
        shadow: [],
        borderRadius: 0,
        zIndex,
        visible: true,
        locked: false,
        groupId: null,
        containerId: null,
        componentId: def.id,
        isComponentEditing: false,
        lockAspectRatio: true
      })
      store.select(id)
      break
    }
    case 'text': {
      const td = def.data.kind === 'text' ? def.data : null
      const w = td?.width ?? 200
      const h = td?.height ?? 60
      const id = generateId()
      store.addTextBox({
        id,
        name: def.name,
        x: x - w / 2,
        y: y - h / 2,
        width: w,
        height: h,
        content: td?.content ?? 'Text',
        fontFamily: td?.fontFamily ?? 'Inter',
        fontSize: td?.fontSize ?? 16,
        fontWeight: td?.fontWeight ?? 400,
        color: td?.color ?? '#ffffff',
        textAlign: td?.textAlign ?? 'left',
        lineHeight: td?.lineHeight ?? 1.5,
        letterSpacing: td?.letterSpacing ?? 0,
        wordSpacing: td?.wordSpacing ?? 0,
        textTransform: td?.textTransform ?? 'none',
        wrap: td?.wrap ?? true,
        heightAuto: td?.heightAuto ?? true,
        zIndex,
        visible: true,
        locked: false,
        groupId: null,
        containerId: null,
        gradient: null,
        shadow: null,
        glow: null,
        strokeColor: '',
        strokeWidth: 0,
        borderVisible: false,
        borderColor: '',
        backgroundVisible: false,
        backgroundColor: '',
        borderRadius: 0,
        stylePreset: 'custom',
        componentId: def.id,
        isComponentEditing: false
      })
      store.select(id)
      break
    }
    case 'shape': {
      const sd = def.data.kind === 'shape' ? def.data : null
      const w = sd?.width ?? 120
      const h = sd?.height ?? 120
      const id = generateId()
      store.addShape({
        id,
        name: def.name,
        x: x - w / 2,
        y: y - h / 2,
        width: w,
        height: h,
        rotation: 0,
        kind: (sd?.shapeKind ?? 'rectangle') as ShapeKind,
        color: sd?.color ?? '#6366f1',
        gradient: sd?.gradient ?? null,
        zIndex,
        visible: true,
        locked: false,
        cornerRadius: sd?.cornerRadius ?? 0,
        angles: (sd?.angles ?? [0, 0, 0]) as [number, number, number],
        crossThickness: sd?.crossThickness ?? 0.3,
        plusThickness: sd?.plusThickness ?? 0.3,
        arrowThickness: sd?.arrowThickness ?? 0.3,
        opacity: sd?.opacity ?? 1,
        backgroundImage: sd?.backgroundImage ?? null,
        blur: sd?.blur ?? 0,
        glow: sd?.glow ?? [],
        shadow: sd?.shadow ?? [],
        groupId: null,
        containerId: null,
        effects: sd?.effects,
        componentId: def.id,
        isComponentEditing: false,
        lockAspectRatio: true
      })
      store.select(id)
      break
    }
    case 'group': {
      const gd = def.data.kind === 'group' ? def.data : null
      const children = gd?.children ?? []
      const w = gd?.width ?? 400
      const h = gd?.height ?? 500
      const id = generateId()
      const ix = x - w / 2
      const iy = y - h / 2
      const src = renderGroupToSvg(children, w, h)
      store.addImage({
        id,
        name: def.name,
        src,
        x: ix,
        y: iy,
        width: w,
        height: h,
        rotation: 0,
        opacity: 100,
        blendMode: 'normal',
        flipX: false,
        flipY: false,
        blur: 0,
        glow: [],
        shadow: [],
        borderRadius: 0,
        zIndex,
        visible: true,
        locked: false,
        groupId: null,
        containerId: null,
        componentId: def.id,
        isComponentEditing: false,
        lockAspectRatio: true
      })
      store.select(id)
      break
    }
    default:
      break
  }
}

/**
 * Returns the element with visual properties overridden from the component
 * definition when the element is a locked instance (`componentId` set and
 * `isComponentEditing` false).  When the element is not an instance or is in
 * override mode, returns the element unchanged.
 *
 * Each facade calls this hook once at the top of its render to resolve the
 * effective data it should display.
 */
export function useInstanceMirror<T extends Device | TextBox | ImageOverlay | Shape>(
  element: T
): T {
  const definitions = useStore((s) => s.definitions)

  return useMemo(() => {
    const cid = (element as unknown as Record<string, unknown>).componentId as string | undefined
    const editing = (element as unknown as Record<string, unknown>).isComponentEditing as boolean | undefined
    if (!cid || editing) return element

    const def = definitions.find((d) => d.id === cid)
    if (!def) return element

    // applyDefinitionToElement is a pure merge — no store write.
    return applyDefinitionToElement(element, def.data) as T
  }, [element, definitions])
}
