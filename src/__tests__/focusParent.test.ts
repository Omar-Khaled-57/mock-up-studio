/**
 * Element-focus auto-parenting (sceneSlice.applyFocusParent).
 *
 * While element focus is active on a container, any NEW parentless element
 * created through the store's single-write creator actions is nested into the
 * focused container: its scene-space x/y is converted to the container's
 * parent-local frame, so the child travels with the container and composes
 * through the transform chain. Creators with an existing `containerId` are
 * left untouched, and the rule never fires without element focus or when the
 * focused element is missing from the active scene.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { localToScene, sceneToLocal } from '../renderer/services/parent-transform'
import { resetStore, makeDevice, makeTextBox, makeImage, makeShape } from './helpers'

function focusContainer(overrides: Partial<import('@shared/types').Device> = {}) {
  const scene = useStore.getState().scenes[0]
  useStore.setState({
    scenes: [{ ...scene, devices: [makeDevice({ id: 'cont', x: 100, y: 100, width: 600, height: 400, ...overrides })] }]
  })
  useRuntimeStore.getState().enterElementFocus('cont')
}

describe('element-focus auto-parenting', () => {
  beforeEach(() => {
    resetStore()
  })

  it('addDevice auto-parents into the focused container with local coords', () => {
    focusContainer()

    useStore.getState().addDevice(makeDevice({ id: 'kid', x: 250, y: 170, width: 100, height: 80 }))

    const dev = useStore.getState().scenes[0].devices.find((d) => d.id === 'kid')!
    expect(dev.containerId).toBe('cont')
    expect(dev.x).toBe(150)
    expect(dev.y).toBe(70)
  })

  it('addTextBox auto-parents into the focused container', () => {
    focusContainer()

    useStore.getState().addTextBox(makeTextBox({ id: 'kid', x: 160, y: 140 }))

    const tb = useStore.getState().scenes[0].textBoxes.find((t) => t.id === 'kid')!
    expect(tb.containerId).toBe('cont')
    expect(tb.x).toBe(60)
    expect(tb.y).toBe(40)
  })

  it('addImage auto-parents into the focused container', () => {
    focusContainer()

    useStore.getState().addImage(makeImage({ id: 'kid', x: 300, y: 200 }))

    const img = useStore.getState().scenes[0].images.find((i) => i.id === 'kid')!
    expect(img.containerId).toBe('cont')
    expect(img.x).toBe(200)
    expect(img.y).toBe(100)
  })

  it('addShape auto-parents into the focused container', () => {
    focusContainer()

    useStore.getState().addShape(makeShape({ id: 'kid', x: 100, y: 100, width: 80, height: 60 }))

    const shape = useStore.getState().scenes[0].shapes.find((s) => s.id === 'kid')!
    expect(shape.containerId).toBe('cont')
    expect(shape.x).toBe(0)
    expect(shape.y).toBe(0)
  })

  it('leaves an already-containerized element untouched', () => {
    focusContainer()
    const scene = useStore.getState().scenes[0]
    useStore.setState({ scenes: [{ ...scene, textBoxes: [makeTextBox({ id: 'pre', x: 30, y: 40, containerId: 'outer' })] }] })

    useStore.getState().addTextBox(makeTextBox({ id: 'kid2', x: 30, y: 40, containerId: 'outer' }))

    const tb = useStore.getState().scenes[0].textBoxes.find((t) => t.id === 'kid2')!
    expect(tb.containerId).toBe('outer')
    expect(tb.x).toBe(30)
    expect(tb.y).toBe(40)
  })

  it('does not parent when the focused element is missing from the active scene', () => {
    useRuntimeStore.getState().enterElementFocus('ghost')

    useStore.getState().addDevice(makeDevice({ id: 'kid', x: 250, y: 170 }))

    const dev = useStore.getState().scenes[0].devices.find((d) => d.id === 'kid')!
    expect(dev.containerId).toBeNull()
    expect(dev.x).toBe(250)
    expect(dev.y).toBe(170)
  })

  it('does not parent without element focus', () => {
    useStore.getState().addDevice(makeDevice({ id: 'kid', x: 250, y: 170 }))
    expect(useStore.getState().scenes[0].devices.find((d) => d.id === 'kid')!.containerId).toBeNull()
  })

  it('converts coordinates through a rotated container frame (round-trip)', () => {
    focusContainer({ rotation: 90 })

    useStore.getState().addDevice(makeDevice({ id: 'kid', x: 250, y: 170, width: 100, height: 80 }))

    const dev = useStore.getState().scenes[0].devices.find((d) => d.id === 'kid')!
    expect(dev.containerId).toBe('cont')
    const roundTrip = localToScene(useStore.getState().scenes[0], 'cont', { x: dev.x, y: dev.y })
    expect(roundTrip.x).toBeCloseTo(250, 5)
    expect(roundTrip.y).toBeCloseTo(170, 5)
    // The converted local point is the inverse of the stored scene point.
    const back = sceneToLocal(useStore.getState().scenes[0], 'cont', { x: 250, y: 170 })
    expect(dev.x).toBeCloseTo(back.x, 5)
    expect(dev.y).toBeCloseTo(back.y, 5)
  })

  it('paste auto-parents a top-level element into the focused container', () => {
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        devices: [
          makeDevice({ id: 'cont', x: 100, y: 100, width: 600, height: 400 }),
          makeDevice({ id: 'src', x: 500, y: 300 })
        ]
      }],
      selectedIds: ['src'],
      selectionMode: 'single'
    })
    useStore.getState().copySelected()
    useRuntimeStore.getState().enterElementFocus('cont')

    useStore.getState().pasteClipboard()

    const pasted = useStore.getState().scenes[0].devices.find((d) => d.id !== 'src' && d.id !== 'cont')!
    expect(pasted.containerId).toBe('cont')
    expect(pasted.name).toBe('Test Monitor copy')
  })
})
