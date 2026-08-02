import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { safeScene } from '../renderer/store/sceneSlice'
import { resetStore, makeDevice, makeShape, makeTextBox } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

describe('copySelected', () => {
  it('copies selected elements to clipboard', () => {
    const dev = makeDevice({ id: 'copy-dev', name: 'My Monitor' })
    useStore.getState().addDevice(dev)
    useStore.getState().select('copy-dev')
    useStore.getState().copySelected()
    expect(useStore.getState().clipboard).toHaveLength(1)
    expect(useStore.getState().clipboard[0].kind).toBe('device')
    expect(useStore.getState().clipboardMode).toBe('copy')
  })

  it('does not remove originals', () => {
    const dev = makeDevice({ id: 'copy-keep' })
    useStore.getState().addDevice(dev)
    useStore.getState().select('copy-keep')
    useStore.getState().copySelected()
    const scene = safeScene(useStore.getState())
    expect(scene.devices.find((d) => d.id === 'copy-keep')).toBeTruthy()
  })
})

describe('cutSelected', () => {
  it('copies and removes selected elements', () => {
    const dev = makeDevice({ id: 'cut-dev' })
    useStore.getState().addDevice(dev)
    useStore.getState().select('cut-dev')
    useStore.getState().cutSelected()
    const scene = safeScene(useStore.getState())
    expect(scene.devices.find((d) => d.id === 'cut-dev')).toBeUndefined()
    expect(useStore.getState().clipboard).toHaveLength(1)
    expect(useStore.getState().clipboardMode).toBe('cut')
  })
})

describe('shape clipboard operations', () => {
  it('copies and pastes shapes', () => {
    useStore.getState().addShape(makeShape({ id: 's1' }))
    useStore.getState().select('s1')
    useStore.getState().copySelected()
    const newIds = useStore.getState().pasteClipboard()
    expect(newIds).toHaveLength(1)
    expect(newIds[0]).not.toBe('s1')
    const scene = safeScene(useStore.getState())
    expect(scene.shapes).toHaveLength(2)
  })

  it('cuts and pastes shapes (move semantics)', () => {
    useStore.getState().addShape(makeShape({ id: 's1' }))
    useStore.getState().select('s1')
    useStore.getState().cutSelected()
    const scene = safeScene(useStore.getState())
    expect(scene.shapes).toHaveLength(0)
    const newIds = useStore.getState().pasteClipboard()
    expect(newIds).toHaveLength(1)
    const scene2 = safeScene(useStore.getState())
    expect(scene2.shapes).toHaveLength(1)
  })

  it('copies shapes with backgroundImage', () => {
    useStore.getState().addShape(makeShape({ id: 's1', backgroundImage: 'data:img/png;base64,abc' }))
    useStore.getState().select('s1')
    useStore.getState().copySelected()
    useStore.getState().pasteClipboard()
    const scene = safeScene(useStore.getState())
    const pasted = scene.shapes.find((s) => s.id !== 's1')!
    expect(pasted.backgroundImage).toBe('data:img/png;base64,abc')
  })
})

describe('pasteClipboard', () => {
  it('pastes clipboard elements with new IDs', () => {
    const dev = makeDevice({ id: 'paste-dev', x: 0, y: 0 })
    useStore.getState().addDevice(dev)
    useStore.getState().select('paste-dev')
    useStore.getState().copySelected()
    const newIds = useStore.getState().pasteClipboard()
    expect(newIds).toHaveLength(1)
    expect(newIds[0]).not.toBe('paste-dev')
    const scene = safeScene(useStore.getState())
    expect(scene.devices).toHaveLength(2) // original + pasted
  })

  it('offsets pasted elements by 30px', () => {
    const dev = makeDevice({ id: 'offset-dev', x: 100, y: 200 })
    useStore.getState().addDevice(dev)
    useStore.getState().select('offset-dev')
    useStore.getState().copySelected()
    const newIds = useStore.getState().pasteClipboard()
    const scene = safeScene(useStore.getState())
    const pasted = scene.devices.find((d) => d.id === newIds[0])!
    expect(pasted.x).toBe(130)
    expect(pasted.y).toBe(230)
  })

  it('selects pasted elements', () => {
    const dev = makeDevice({ id: 'sel-paste' })
    useStore.getState().addDevice(dev)
    useStore.getState().select('sel-paste')
    useStore.getState().copySelected()
    const newIds = useStore.getState().pasteClipboard()
    expect(useStore.getState().selectedIds).toEqual(newIds)
  })

  it('clears clipboard after cut-paste (move semantics)', () => {
    const dev = makeDevice({ id: 'cut-paste' })
    useStore.getState().addDevice(dev)
    useStore.getState().select('cut-paste')
    useStore.getState().cutSelected()
    useStore.getState().pasteClipboard()
    expect(useStore.getState().clipboard).toHaveLength(0)
    expect(useStore.getState().clipboardMode).toBeNull()
  })

  it('retains clipboard after copy-paste (duplicate semantics)', () => {
    const dev = makeDevice({ id: 'copy-paste' })
    useStore.getState().addDevice(dev)
    useStore.getState().select('copy-paste')
    useStore.getState().copySelected()
    useStore.getState().pasteClipboard()
    expect(useStore.getState().clipboard).toHaveLength(1)
    expect(useStore.getState().clipboardMode).toBe('copy')
  })

  it('returns empty array when clipboard is empty', () => {
    expect(useStore.getState().pasteClipboard()).toEqual([])
  })

  it('remaps a pasted child to its pasted container', () => {
    const container = makeDevice({ id: 'paste-container' })
    const child = makeTextBox({ id: 'paste-child', containerId: 'paste-container' })
    useStore.getState().addDevice(container)
    useStore.getState().addTextBox(child)
    useStore.getState().select('paste-container')
    useStore.getState().select('paste-child', true)
    useStore.getState().copySelected()
    const newIds = useStore.getState().pasteClipboard()
    const scene = safeScene(useStore.getState())
    const pastedContainer = scene.devices.find((d) => d.id === newIds[0])!
    const pastedChild = scene.textBoxes.find((t) => t.id === newIds[1])!
    expect(pastedChild.containerId).toBe(pastedContainer.id)
    expect(pastedChild.containerId).not.toBe('paste-container')
  })

  it('keeps the container reference when the container was not pasted', () => {
    const container = makeDevice({ id: 'paste-external-container' })
    const child = makeTextBox({ id: 'paste-kept-child', containerId: 'paste-external-container' })
    useStore.getState().addDevice(container)
    useStore.getState().addTextBox(child)
    useStore.getState().select('paste-kept-child')
    useStore.getState().copySelected()
    const newIds = useStore.getState().pasteClipboard()
    const scene = safeScene(useStore.getState())
    const pasted = scene.textBoxes.find((t) => t.id === newIds[0])!
    expect(pasted.containerId).toBe('paste-external-container')
  })

  it('pastes a top-level element with a null containerId', () => {
    const dev = makeDevice({ id: 'paste-flat', containerId: null })
    useStore.getState().addDevice(dev)
    useStore.getState().select('paste-flat')
    useStore.getState().copySelected()
    const newIds = useStore.getState().pasteClipboard()
    const scene = safeScene(useStore.getState())
    expect(scene.devices.find((d) => d.id === newIds[0])!.containerId).toBeNull()
  })
})

describe('copyStyleSelected / pasteStyleToSelected', () => {
  it('starts with no copied style', () => {
    expect(useStore.getState().copiedStyle).toBeNull()
  })

  it('snapshots appearance-only fields from the first selected element', () => {
    useStore.getState().addDevice(makeDevice({ id: 'src-dev', colorTheme: 'light', objectFit: 'cover' }))
    useStore.getState().addShape(makeShape({ id: 'shp-1' }))
    useStore.getState().select('src-dev')
    useStore.getState().copyStyleSelected()
    const copied = useStore.getState().copiedStyle
    expect(copied).not.toBeNull()
    expect(copied!.kind).toBe('device')
    expect(copied!.patch.colorTheme).toBe('light')
    expect(copied!.patch.objectFit).toBe('cover')
    expect(copied!.patch).not.toHaveProperty('name')
    expect(copied!.patch).not.toHaveProperty('x')
  })

  it('applies the copied style to same-kind targets', () => {
    useStore.getState().addDevice(makeDevice({ id: 'src-dev', colorTheme: 'light' }))
    useStore.getState().addDevice(makeDevice({ id: 'dst-dev', colorTheme: 'dark' }))
    useStore.getState().select('src-dev')
    useStore.getState().copyStyleSelected()
    useStore.getState().clearSelection()
    useStore.getState().select('dst-dev')
    useStore.getState().pasteStyleToSelected()
    const dst = useStore.getState().scenes[0].devices.find((d) => d.id === 'dst-dev')!
    expect(dst.colorTheme).toBe('light')
  })

  it('ignores targets of a different kind', () => {
    useStore.getState().addShape(makeShape({ id: 'src-shp', color: '#ff0000' }))
    useStore.getState().addShape(makeShape({ id: 'dst-shp', color: '#0000ff' }))
    useStore.getState().addDevice(makeDevice({ id: 'dst-dev', colorTheme: 'dark' }))
    useStore.getState().select('src-shp')
    useStore.getState().copyStyleSelected()
    useStore.getState().clearSelection()
    useStore.getState().select('dst-shp', true)
    useStore.getState().select('dst-dev', true)
    useStore.getState().pasteStyleToSelected()
    const shp = useStore.getState().scenes[0].shapes.find((s) => s.id === 'dst-shp')!
    const dev = useStore.getState().scenes[0].devices.find((d) => d.id === 'dst-dev')!
    expect(shp.color).toBe('#ff0000')
    expect(dev.colorTheme).toBe('dark')
  })

  it('is a no-op when no style has been copied', () => {
    useStore.getState().addDevice(makeDevice({ id: 'dst-dev', colorTheme: 'dark' }))
    useStore.getState().select('dst-dev')
    useStore.getState().pasteStyleToSelected()
    expect(useStore.getState().scenes[0].devices.find((d) => d.id === 'dst-dev')!.colorTheme).toBe('dark')
  })

  it('is a no-op when the copied kind has no matching targets', () => {
    useStore.getState().addShape(makeShape({ id: 'src-shp' }))
    useStore.getState().select('src-shp')
    useStore.getState().copyStyleSelected()
    useStore.getState().clearSelection()
    useStore.getState().addDevice(makeDevice({ id: 'dst-dev' }))
    useStore.getState().select('dst-dev')
    useStore.getState().pasteStyleToSelected()
    expect(useStore.getState().undoStack).toHaveLength(0)
  })

  it('pushes history before applying so undo restores the target', () => {
    useStore.getState().addDevice(makeDevice({ id: 'src-dev', colorTheme: 'light' }))
    useStore.getState().addDevice(makeDevice({ id: 'dst-dev', colorTheme: 'dark' }))
    useStore.getState().select('src-dev')
    useStore.getState().copyStyleSelected()
    useStore.getState().clearSelection()
    useStore.getState().select('dst-dev')
    useStore.getState().pasteStyleToSelected()
    useStore.getState().undo()
    const dst = useStore.getState().scenes[0].devices.find((d) => d.id === 'dst-dev')!
    expect(dst.colorTheme).toBe('dark')
  })

  it('copies text style fields like font size and family', () => {
    useStore.getState().addTextBox(makeTextBox({ id: 'src-tb', fontSize: 48, fontFamily: 'Georgia' }))
    useStore.getState().addTextBox(makeTextBox({ id: 'dst-tb', fontSize: 24, fontFamily: 'Inter' }))
    useStore.getState().select('src-tb')
    useStore.getState().copyStyleSelected()
    useStore.getState().clearSelection()
    useStore.getState().select('dst-tb')
    useStore.getState().pasteStyleToSelected()
    const dst = useStore.getState().scenes[0].textBoxes.find((t) => t.id === 'dst-tb')!
    expect(dst.fontSize).toBe(48)
    expect(dst.fontFamily).toBe('Georgia')
  })
})
