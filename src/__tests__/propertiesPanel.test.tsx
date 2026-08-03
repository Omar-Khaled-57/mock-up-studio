/**
 * Phase 5d — Properties Panel contextual redesign (IA §4):
 * empty state with quick actions, multi-selection tools (Align/Distribute/
 * Arrange + Copy/Paste Style), and the single-selection sectioned layout
 * (Transform/Content/Appearance/Effects/Mask/Advanced) with per-session
 * open/closed state driven by the runtime store.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import { resetStore, makeDevice, makeImage, makeShape, makeTextBox } from './helpers'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import PropertiesPanel from '../renderer/components/sidebar/PropertiesPanel'
import { DEFAULT_EFFECTS } from '../renderer/lib/effects'
import { QUICK_ADD_DEVICE_TYPES, readImageFile } from '../renderer/lib/element-factories'
import { pickImageFileObject } from '../renderer/lib/file-upload'

vi.mock('../renderer/lib/file-upload', () => ({
  pickImageFile: vi.fn(),
  pickImageFileObject: vi.fn()
}))

vi.mock('../renderer/lib/element-factories', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../renderer/lib/element-factories')>()
  return {
    ...actual,
    readImageFile: vi.fn()
  }
})

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
    expect(screen.getByRole('button', { name: /Add text/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add image/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Select a device/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open Layers/ })).not.toBeInTheDocument()
  })

  it('Add device creates a random quick-add device, selects it, and records one undo entry', () => {
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Add device/ }))
    const state = useStore.getState()
    const devices = state.scenes[0].devices
    expect(devices.length).toBe(1)
    expect(QUICK_ADD_DEVICE_TYPES).toContain(devices[0].type)
    expect(state.selectedIds).toEqual([devices[0].id])
    act(() => { state.undo() })
    expect(useStore.getState().scenes[0].devices.length).toBe(0)
  })

  it('Add text creates a custom text box, selects it, and records one undo entry', () => {
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Add text/ }))
    const state = useStore.getState()
    const heroCount = 2
    expect(state.scenes[0].textBoxes.length).toBe(heroCount + 1)
    const added = state.scenes[0].textBoxes[state.scenes[0].textBoxes.length - 1]
    expect(added.stylePreset).toBe('custom')
    expect(state.selectedIds).toEqual([added.id])
    act(() => { state.undo() })
    expect(useStore.getState().scenes[0].textBoxes.length).toBe(heroCount)
  })

  it('Add image opens the picker; a chosen file imports and selects the image', async () => {
    let onFile: ((file: File) => void) | null = null
    vi.mocked(pickImageFileObject).mockImplementation((cb) => { onFile = cb })
    vi.mocked(readImageFile).mockResolvedValue({ dataUrl: 'data:image/png;base64,AA==', width: 200, height: 100 })
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Add image/ }))
    expect(pickImageFileObject).toHaveBeenCalled()
    expect(onFile).not.toBeNull()
    act(() => { onFile?.(new File([], 'a.png', { type: 'image/png' })) })
    await waitFor(() => {
      const state = useStore.getState()
      expect(state.scenes[0].images.length).toBe(1)
      expect(state.selectedIds).toEqual([state.scenes[0].images[0].id])
    })
  })

  it('Add image leaves state unchanged when the picker is cancelled', () => {
    vi.mocked(pickImageFileObject).mockImplementation(() => {})
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Add image/ }))
    expect(useStore.getState().scenes[0].images.length).toBe(0)
    expect(useStore.getState().selectedIds).toEqual([])
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

describe('single selection — aspect ratio lock', () => {
  it('toggles the lock and pushes one undo entry', () => {
    const dev = makeDevice()
    addAndSelect(dev)
    render(<PropertiesPanel />)

    const lock = screen.getByRole('button', { name: /Lock aspect ratio/ })
    fireEvent.click(lock)
    expect(useStore.getState().scenes[0].devices[0].lockAspectRatio).toBe(true)
    expect(useStore.getState().undoStack.length).toBe(1)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Unlock aspect ratio/ }))
    })
    expect(useStore.getState().scenes[0].devices[0].lockAspectRatio).toBe(false)

    act(() => {
      useStore.getState().undo()
    })
    expect(useStore.getState().scenes[0].devices[0].lockAspectRatio).toBe(true)
  })

  it('shows the lock toggle for a shape and an image', () => {
    addAndSelect(makeShape())
    render(<PropertiesPanel />)
    expect(screen.getByRole('button', { name: /Lock aspect ratio/ })).toBeInTheDocument()
    cleanup()

    addAndSelect(makeImage())
    render(<PropertiesPanel />)
    expect(screen.getByRole('button', { name: /Lock aspect ratio/ })).toBeInTheDocument()
  })

  it('hides the lock toggle for a textbox', () => {
    addAndSelect(makeTextBox())
    render(<PropertiesPanel />)
    expect(screen.queryByRole('button', { name: /Lock aspect ratio/ })).not.toBeInTheDocument()
  })

  it('scales the height when a locked width is edited', () => {
    const dev = makeDevice({ width: 600, height: 400, lockAspectRatio: true })
    addAndSelect(dev)
    render(<PropertiesPanel />)

    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '900' } })
    fireEvent.keyDown(screen.getByLabelText('Width'), { key: 'Enter' })

    expect(useStore.getState().scenes[0].devices[0].width).toBe(900)
    expect(useStore.getState().scenes[0].devices[0].height).toBe(600)
  })

  it('leaves the height alone when an unlocked width is edited', () => {
    const dev = makeDevice({ width: 600, height: 400 })
    addAndSelect(dev)
    render(<PropertiesPanel />)

    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '900' } })
    fireEvent.keyDown(screen.getByLabelText('Width'), { key: 'Enter' })

    expect(useStore.getState().scenes[0].devices[0].width).toBe(900)
    expect(useStore.getState().scenes[0].devices[0].height).toBe(400)
  })

  it('scales the width when a locked height is edited', () => {
    const dev = makeDevice({ width: 600, height: 400, lockAspectRatio: true })
    addAndSelect(dev)
    render(<PropertiesPanel />)

    fireEvent.change(screen.getByLabelText('Height'), { target: { value: '200' } })
    fireEvent.keyDown(screen.getByLabelText('Height'), { key: 'Enter' })

    expect(useStore.getState().scenes[0].devices[0].width).toBe(300)
    expect(useStore.getState().scenes[0].devices[0].height).toBe(200)
  })
})

describe('single selection — effects section', () => {
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

describe('single selection — shape fill control', () => {
  it('renders the Fill control for a selected shape and applies gradient edits', () => {
    addAndSelect(makeShape({ id: 'fill-shp', color: '#ff0000' }))
    render(<PropertiesPanel />)
    expect(screen.getByText('Fill')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /gradient/i }))
    const shp = useStore.getState().scenes[0].shapes.find((s) => s.id === 'fill-shp')!
    expect(shp.gradient).toEqual({
      enabled: true,
      colors: ['#ff0000', '#1e1b4b'],
      angle: 135,
      type: 'linear',
      radialShape: 'circle'
    })
  })

  it('records one debounced history entry for a fill change', () => {
    vi.useFakeTimers()
    addAndSelect(makeShape({ id: 'fill-shp-2', color: '#00ff00' }))
    render(<PropertiesPanel />)
    expect(useStore.getState().undoStack).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /gradient/i }))
    // The debounce hasn't fired yet
    expect(useStore.getState().undoStack).toHaveLength(0)
    act(() => { vi.advanceTimersByTime(600) })
    expect(useStore.getState().undoStack).toHaveLength(1)
  })

  it('switching back to solid disables the gradient and keeps the config', () => {
    addAndSelect(makeShape({ id: 'fill-shp-3', color: '#ff0000' }))
    render(<PropertiesPanel />)
    fireEvent.click(screen.getByRole('button', { name: /gradient/i }))
    fireEvent.click(screen.getByRole('button', { name: /^solid$/i }))
    const shp = useStore.getState().scenes[0].shapes.find((s) => s.id === 'fill-shp-3')!
    expect(shp.gradient!.enabled).toBe(false)
    expect(shp.gradient!.colors).toEqual(['#ff0000', '#1e1b4b'])
  })
})
