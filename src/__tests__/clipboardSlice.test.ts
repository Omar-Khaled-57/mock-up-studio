import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { safeScene } from '../renderer/store/sceneSlice'
import { resetStore, makeDevice, makeShape } from './helpers'

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
})
