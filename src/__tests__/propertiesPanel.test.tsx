/**
 * Phase 5d — Properties Panel contextual redesign (IA §4):
 * empty state with quick actions, multi-selection tools (Align/Distribute/
 * Arrange + Copy/Paste Style), and the single-selection sectioned layout
 * (Transform/Content/Appearance/Effects/Mask/Advanced) with per-session
 * open/closed state driven by the runtime store.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { resetStore, makeDevice, makeImage, makeShape, makeTextBox } from './helpers'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import PropertiesPanel from '../renderer/components/sidebar/PropertiesPanel'
import DevicesPanel from '../renderer/components/sidebar/DevicesPanel'
import { DEFAULT_EFFECTS } from '../renderer/lib/effects'

function addAndSelect(el: ReturnType<typeof makeDevice> | ReturnType<typeof makeTextBox> | ReturnType<typeof makeImage> | ReturnType<typeof makeShape>): string {
  act(() => {
    const state = useStore.getState()
    if ('type' in el) state.addDevice(el as never)
    else if ('content' in el) state.addTextBox(el as never)
    else if ('src' in el) state.addImage(el as never)
    else state.addShape(el as never)
    state.select(el.id)
  })
  return el.id
}

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('empty state', () => {
  it('renders guidance and quick actions when nothing is selected', () => {
    render(<PropertiesPanel />)
    expect(screen.getByText('Nothing selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add device/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Select a device/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add text/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add image/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open Layers/ })).toBeInTheDocument()
  })

  it('Add device routes to the devices tab and focuses the primary button', () => {
    vi.useFakeTimers()
    render(
      <>
        <PropertiesPanel />
        <DevicesPanel />
      </>
    )
    fireEvent.click(screen.getByRole('button', { name: /Add device/ }))
    expect(useStore.getState().sidebarTab).toBe('devices')
    act(() => vi.advanceTimersByTime(16))
    const primary = document.querySelector<HTMLElement>('[data-device-primary]')
    expect(primary).not.toBeNull()
    expect(document.activeElement).toBe(primary)
  })

  it('Add text / Add image / Open Layers route to their tabs', () => {
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Add text/ }))
    expect(useStore.getState().sidebarTab).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: /Add image/ }))
    expect(useStore.getState().sidebarTab).toBe('images')
    fireEvent.click(screen.getByRole('button', { name: /Open Layers/ }))
    expect(useStore.getState().sidebarTab).toBe('layers')
  })

  it('Select a device selects the first device when one exists', () => {
    const dev = makeDevice()
    addAndSelect(dev)
    useStore.getState().clearSelection()
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Select a device/ }))
    expect(useStore.getState().selectedIds).toEqual([dev.id])
    expect(screen.getByText('Transform')).toBeInTheDocument()
  })

  it('Select a device routes to the devices tab when the scene is empty', () => {
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Select a device/ }))
    expect(useStore.getState().sidebarTab).toBe('devices')
  })
})

describe('single selection — header & rename', () => {
  it('shows the element name and visibility/lock toggles', () => {
    addAndSelect(makeDevice({ name: 'Hero Monitor' }))
    render(<PropertiesPanel />)
    expect(screen.getByText('Hero Monitor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Hide element/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lock element/ })).toBeInTheDocument()
  })

  it('double-click rename commits on Enter and pushes history', () => {
    const dev = makeDevice({ name: 'Old Name' })
    addAndSelect(dev)
    render(<PropertiesPanel />)

    fireEvent.doubleClick(screen.getByText('Old Name'))
    const input = screen.getByLabelText('Element name')
    fireEvent.change(input, { target: { value: 'New Name' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(useStore.getState().scenes[0].devices[0].name).toBe('New Name')
    expect(useStore.getState().undoStack.length).toBeGreaterThan(0)
  })

  it('Escape cancels the rename without committing', () => {
    addAndSelect(makeDevice({ name: 'Keep Me' }))
    render(<PropertiesPanel />)

    fireEvent.doubleClick(screen.getByText('Keep Me'))
    const input = screen.getByLabelText('Element name')
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(useStore.getState().scenes[0].devices[0].name).toBe('Keep Me')
  })

  it('lock and visibility toggles update the element', () => {
    const dev = makeDevice()
    addAndSelect(dev)
    render(<PropertiesPanel />)

    fireEvent.click(screen.getByRole('button', { name: /Lock element/ }))
    expect(useStore.getState().scenes[0].devices[0].locked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Hide element/ }))
    expect(useStore.getState().scenes[0].devices[0].visible).toBe(false)
  })
})

describe('single selection — transform', () => {
  it('renders X/Y/W/H inputs for a device', () => {
    addAndSelect(makeDevice())
    render(<PropertiesPanel />)
    expect(screen.getByLabelText('X position')).toBeInTheDocument()
    expect(screen.getByLabelText('Y position')).toBeInTheDocument()
    expect(screen.getByLabelText('Width')).toBeInTheDocument()
    expect(screen.getByLabelText('Height')).toBeInTheDocument()
  })

  it('hides the rotation control for a textbox', () => {
    addAndSelect(makeTextBox({ rotation: 0 }))
    render(<PropertiesPanel />)
    expect(screen.getByLabelText('X position')).toBeInTheDocument()
    expect(screen.queryByLabelText('Rotation')).not.toBeInTheDocument()
  })

  it('shows the rotation control for a device', () => {
    addAndSelect(makeDevice({ rotation: 0 }))
    const { container } = render(<PropertiesPanel />)
    const transform = container.querySelector('[data-section="transform"]')
    expect(transform).not.toBeNull()
    expect(transform!.querySelector('input[type="range"]')).not.toBeNull()
  })

  it('persists the transform section open state per session', () => {
    addAndSelect(makeDevice())
    render(<PropertiesPanel />)

    const header = screen.getByRole('button', { name: /Transform/ })
    expect(header).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(useRuntimeStore.getState().propertiesSections['device:transform']).toBe(false)
  })
})

describe('single selection — effects & mask sections', () => {
  it('collapses the Effects section by default when effects are neutral', () => {
    addAndSelect(makeImage())
    render(<PropertiesPanel />)
    const header = screen.getByRole('button', { name: 'Effects' })
    expect(header).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens the Effects section by default when effects are non-neutral', () => {
    addAndSelect(makeImage({ effects: { ...DEFAULT_EFFECTS, brightness: 130 } }))
    render(<PropertiesPanel />)
    const header = screen.getByRole('button', { name: 'Effects' })
    expect(header).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens the Mask section by default when a mask exists and shows actions', () => {
    const shape = makeShape()
    addAndSelect(shape)
    useStore.getState().maskElement(shape.id, { width: shape.width, height: shape.height })
    render(<PropertiesPanel />)

    const header = screen.getByRole('button', { name: /Mask/ })
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Reverse/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Remove/ })).toBeInTheDocument()
  })

  it('Add Mask creates a full-bounds mask and switches the section to edit mode', () => {
    const shape = makeShape()
    addAndSelect(shape)
    render(<PropertiesPanel />)

    fireEvent.click(screen.getByRole('button', { name: /Mask/ }))
    fireEvent.click(screen.getByRole('button', { name: /Add Mask/ }))

    const mask = useStore.getState().scenes[0].masks.find((m) => m.targetId === shape.id)
    expect(mask).toBeTruthy()
    expect(mask!.width).toBe(shape.width)
    expect(screen.getByRole('button', { name: /Reverse/ })).toBeInTheDocument()
  })

  it('lists every mask with per-mask Reverse/Remove (additive masks never collapse)', () => {
    const shape = makeShape()
    addAndSelect(shape)
    act(() => {
      const state = useStore.getState()
      state.addMask({ id: 'm-a', targetId: shape.id, shape: 'rectangle', x: 0, y: 0, width: 100, height: 50, points: [], inverted: true })
      state.addMask({ id: 'm-b', targetId: shape.id, shape: 'ellipse', x: 10, y: 10, width: 40, height: 30, points: [], inverted: false })
    })
    render(<PropertiesPanel />)

    expect(screen.getAllByRole('button', { name: /Reverse/ })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /Remove/ })).toHaveLength(2)

    act(() => {
      fireEvent.click(screen.getAllByRole('button', { name: /Remove/ })[0])
    })
    expect(useStore.getState().scenes[0].masks.map((m) => m.id)).toEqual(['m-b'])

    act(() => {
      fireEvent.click(screen.getAllByRole('button', { name: /Reverse/ })[0])
    })
    expect(useStore.getState().scenes[0].masks[0].inverted).toBe(true)
  })

  it('Clear all masks removes every mask on the selected element with one history entry', () => {
    const shape = makeShape()
    addAndSelect(shape)
    act(() => {
      const state = useStore.getState()
      state.addMask({ id: 'm-a', targetId: shape.id, shape: 'rectangle', x: 0, y: 0, width: 100, height: 50, points: [], inverted: true })
      state.addMask({ id: 'm-b', targetId: shape.id, shape: 'ellipse', x: 10, y: 10, width: 40, height: 30, points: [], inverted: false })
    })
    render(<PropertiesPanel />)

    fireEvent.click(screen.getByRole('button', { name: /Clear all masks/ }))

    expect(useStore.getState().scenes[0].masks.filter((m) => m.targetId === shape.id)).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(1)

    act(() => {
      useStore.getState().undo()
    })
    expect(useStore.getState().scenes[0].masks.filter((m) => m.targetId === shape.id)).toHaveLength(2)
  })
})

describe('multi selection', () => {
  it('renders kind chips and the Align/Distribute/Arrange sections', () => {
    addAndSelect(makeDevice({ id: 'm-dev' }))
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{ ...scene, shapes: [makeShape({ id: 'm-shp' })] }],
      selectedIds: ['m-dev', 'm-shp'],
      selectionMode: 'multi'
    })
    render(<PropertiesPanel />)
    expect(screen.getByText('2 elements selected')).toBeInTheDocument()
    expect(screen.getByText(/device/i)).toBeInTheDocument()
    expect(screen.getByText(/shape/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Align Left/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Distribute horizontal space/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Group/ })).toBeInTheDocument()
  })

  it('Align buttons reposition the selected elements', () => {
    addAndSelect(makeDevice({ id: 'a1', x: 0, y: 0, width: 100, height: 100 }))
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...scene,
        devices: [...scene.devices, makeDevice({ id: 'a2', x: 200, y: 0, width: 100, height: 100 })]
      }],
      selectedIds: ['a1', 'a2'],
      selectionMode: 'multi'
    })
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Align Left/ }))
    const a2 = useStore.getState().scenes[0].devices.find((d) => d.id === 'a2')!
    expect(a2.x).toBe(0)
  })

  it('Copy Style snapshots the first selected element and enables Paste Style', () => {
    addAndSelect(makeShape({ id: 's1', color: '#ff0000' }))
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{ ...scene, shapes: [...scene.shapes, makeShape({ id: 's2', color: '#0000ff' })] }],
      selectedIds: ['s1', 's2'],
      selectionMode: 'multi'
    })
    render(<PropertiesPanel />)

    const paste = screen.getByRole('button', { name: /Paste Style/ })
    expect(paste).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /Copy Style/ }))
    const copied = useStore.getState().copiedStyle
    expect(copied).not.toBeNull()
    expect(copied!.kind).toBe('shape')
    expect(copied!.patch.color).toBe('#ff0000')
    expect(screen.getByRole('button', { name: /Paste Style/ })).toBeEnabled()
  })

  it('Paste Style applies the copied appearance to same-kind targets', () => {
    addAndSelect(makeShape({ id: 's1', color: '#ff0000' }))
    const scene = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{ ...scene, shapes: [...scene.shapes, makeShape({ id: 's2', color: '#0000ff' })] }],
      selectedIds: ['s1', 's2'],
      selectionMode: 'multi'
    })
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Copy Style/ }))
    fireEvent.click(screen.getByRole('button', { name: /Paste Style/ }))
    const s2 = useStore.getState().scenes[0].shapes.find((s) => s.id === 's2')!
    expect(s2.color).toBe('#ff0000')
  })
})
