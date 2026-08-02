import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useRuntimeStore, resetRuntime } from '../renderer/runtime/store'
import { useStore } from '../renderer/store'
import { toolManager } from '../renderer/tools'
import { resetStore, makeDevice } from './helpers'
import BottomToolbar from '../renderer/components/toolbar/BottomToolbar'
import ToolOptionsPanel from '../renderer/components/toolbar/ToolOptionsPanel'

describe('BottomToolbar', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders reachable tools with shortcut badges and the active tool label', () => {
    render(<BottomToolbar />)

    expect(screen.getByRole('button', { name: 'Select / Move' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Eraser' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByText('V').length).toBeGreaterThan(0)
    expect(screen.getAllByText('B').length).toBeGreaterThan(0)
    expect(screen.getAllByText('E').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Select / Move').length).toBeGreaterThan(0)
  })

  it('renders the mask group as a single reachable tool with no variant reveal', () => {
    render(<BottomToolbar />)

    const mask = screen.getByRole('button', { name: 'Mask Tool' })
    expect(mask).toBeEnabled()
    expect(document.querySelector('[data-group-reveal="mask"]')).toBeNull()
    expect(document.querySelector('[data-tool-divider]')).toBeNull()
  })

  it('collapses and re-expands the tools via the header toggle', () => {
    render(<BottomToolbar />)

    const toggle = screen.getByRole('button', { name: 'Show or hide tools' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Select / Move' })).toBeTruthy()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Select / Move' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Marquee Select' })).toBeNull()

    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Select / Move' })).toBeTruthy()
  })

  it('hide/reveal persists across a toolbar remount and survives transient resets', () => {
    const { unmount } = render(<BottomToolbar />)
    const toggle = screen.getByRole('button', { name: 'Show or hide tools' })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    unmount()
    render(<BottomToolbar />)
    expect(screen.getByRole('button', { name: 'Show or hide tools' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Select / Move' })).toBeNull()

    resetRuntime('transient')
    expect(useRuntimeStore.getState().toolbarToolsVisible).toBe(false)

    resetRuntime('all')
    expect(useRuntimeStore.getState().toolbarToolsVisible).toBe(true)
  })

  it('activates the mask tool on click', () => {
    render(<BottomToolbar />)

    const mask = screen.getByRole('button', { name: 'Mask Tool' })
    expect(mask).toBeEnabled()
    fireEvent.click(mask)

    expect(useRuntimeStore.getState().activeToolId).toBe('mask')
    expect(toolManager.getEffectiveToolId()).toBe('mask')
  })

  it('activates the paint tool on click', () => {
    render(<BottomToolbar />)

    fireEvent.click(screen.getByRole('button', { name: 'Paint Brush' }))

    expect(toolManager.getEffectiveToolId()).toBe('paint')
    expect(useRuntimeStore.getState().activeToolId).toBe('paint')
    expect(screen.getByRole('button', { name: 'Paint Brush' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('activates the focus tool on click', () => {
    render(<BottomToolbar />)

    fireEvent.click(screen.getByRole('button', { name: 'Focus Tool' }))

    expect(toolManager.getEffectiveToolId()).toBe('focus')
    expect(useRuntimeStore.getState().activeToolId).toBe('focus')
    expect(screen.getByRole('button', { name: 'Focus Tool' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders Focus inside the select/move group menu', () => {
    render(<BottomToolbar />)

    expect(screen.getByRole('button', { name: 'Focus Tool' })).toBeEnabled()
    const reveal = document.querySelector('[data-group-reveal="select"]')
    expect(reveal).not.toBeNull()
    expect(reveal!.querySelector('[aria-label="Focus Tool"]')).not.toBeNull()
  })

  it('activates a reachable tool from the revealed select menu', () => {
    render(<BottomToolbar />)

    fireEvent.click(screen.getByRole('button', { name: 'Hand' }))

    expect(toolManager.getEffectiveToolId()).toBe('hand')
    expect(useRuntimeStore.getState().activeToolId).toBe('hand')
    expect(screen.getByRole('button', { name: 'Hand' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reveals the select group variants and activates a reachable member', () => {
    render(<BottomToolbar />)

    const reveal = document.querySelector('[data-group-reveal="select"]')
    expect(reveal).not.toBeNull()

    const marquee = screen.getByRole('button', { name: 'Marquee Select' })
    expect(marquee).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Select / Move' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(marquee)
    expect(toolManager.getEffectiveToolId()).toBe('marquee')
    expect(useRuntimeStore.getState().activeToolId).toBe('marquee')
    expect(screen.getByRole('button', { name: 'Marquee Select' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reveals the brush group variants when the brush group is active', () => {
    render(<BottomToolbar />)

    // Collapsed: only the face is shown.
    expect(screen.getAllByRole('button', { name: 'Paint Brush' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Blur Brush' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Paint Brush' }))

    // Revealed: every brush is visible side by side inside the rectangle.
    expect(document.querySelector('[data-group-reveal="brush"]')).not.toBeNull()
    for (const name of ['Paint Brush', 'Blur Brush']) {
      for (const button of screen.getAllByRole('button', { name })) {
        expect(button).not.toBeDisabled()
      }
    }
    expect(screen.getAllByRole('button', { name: 'Paint Brush' })).toHaveLength(1)
    expect(toolManager.getEffectiveToolId()).toBe('paint')
    expect(useRuntimeStore.getState().activeToolId).toBe('paint')
  })

  it('activates blur, eraser and magic-eraser from the revealed group menus', () => {
    render(<BottomToolbar />)

    fireEvent.click(screen.getByRole('button', { name: 'Paint Brush' }))
    fireEvent.click(screen.getByRole('button', { name: 'Blur Brush' }))
    expect(toolManager.getEffectiveToolId()).toBe('blur')
    expect(useRuntimeStore.getState().activeToolId).toBe('blur')
    expect(screen.getByRole('button', { name: 'Blur Brush' })).toHaveAttribute('aria-pressed', 'true')

    // Clicking the eraser face activates it and reveals the eraser group.
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }))
    expect(document.querySelector('[data-group-reveal="eraser"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Magic Eraser' }))
    expect(toolManager.getEffectiveToolId()).toBe('magic-eraser')
    expect(useRuntimeStore.getState().activeToolId).toBe('magic-eraser')
    expect(screen.getByRole('button', { name: 'Magic Eraser' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('highlights the effective tool when a temporary tool is active', () => {
    toolManager.pushTemporaryTool('hand', 'keyup')
    render(<BottomToolbar />)

    expect(screen.getByRole('button', { name: 'Hand' })).toHaveAttribute('aria-pressed', 'true')
    expect(useRuntimeStore.getState().activeToolId).toBe('select')
  })

  it('shows the focus-mode breadcrumb slot when a focus group is set', () => {
    const dev1 = { id: 'dev-1', x: 0, y: 0, width: 10, height: 10, groupId: 'g-1' }
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [dev1],
        groups: [{ id: 'g-1', name: 'Phone Group', childIds: ['dev-1'] }]
      }]
    })
    useRuntimeStore.getState().enterFocus('g-1')
    render(<BottomToolbar />)

    expect(document.querySelector('[data-focus-breadcrumb]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Phone Group' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Exit focus mode' })).toBeTruthy()
  })

  it('undo/redo buttons gate on history and drive the store', () => {
    render(<BottomToolbar />)

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()

    act(() => useStore.getState().pushHistory('test edit'))
    act(() => useStore.getState().addDevice(makeDevice()))

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(useStore.getState().scenes[0].devices).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(useStore.getState().scenes[0].devices).toHaveLength(1)
  })

  it('Export button opens the export modal', () => {
    render(<BottomToolbar />)

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(useRuntimeStore.getState().exportModalOpen).toBe(true)
  })

  it('renders tool options inline beneath the active group face', () => {
    toolManager.setActiveTool('paint')
    render(<BottomToolbar />)

    const options = document.querySelector('[data-tool-options="paint"]')
    expect(options).not.toBeNull()
    expect(screen.getByText('Color')).toBeTruthy()
  })
})

describe('ToolOptionsPanel', () => {
  it('renders nothing until a tool declares options (M10+)', () => {
    resetStore()
    const { container } = render(<ToolOptionsPanel />)
    expect(container).toBeEmptyDOMElement()
    expect(document.querySelector('[data-tool-options]')).toBeNull()
  })

  it('renders paint brush controls when the paint tool is active', () => {
    resetStore()
    toolManager.setActiveTool('paint')
    const { container } = render(<ToolOptionsPanel />)

    expect(document.querySelector('[data-tool-options="paint"]')).not.toBeNull()
    expect(screen.getByText('Color')).toBeTruthy()
    expect(screen.getByText('Size')).toBeTruthy()
    expect(screen.getByText('Hard')).toBeTruthy()

    const ranges = container.querySelectorAll('input[type="range"]')
    expect(ranges).toHaveLength(2)
    expect(ranges[0]).toHaveValue('24')
    expect(ranges[1]).toHaveValue('60')
  })

  it('size slider updates the runtime brush', () => {
    resetStore()
    toolManager.setActiveTool('paint')
    const { container } = render(<ToolOptionsPanel />)

    const size = container.querySelector('input[type="range"]')!
    fireEvent.change(size, { target: { value: '60' } })

    expect(useRuntimeStore.getState().brush.size).toBe(60)

    fireEvent.change(container.querySelectorAll('input[type="range"]')[1], { target: { value: '25' } })
    expect(useRuntimeStore.getState().brush.hardness).toBeCloseTo(0.25)
  })

  it('does not render paint controls for the select tool', () => {
    resetStore()
    render(<ToolOptionsPanel />)
    expect(document.querySelector('[data-tool-options]')).toBeNull()
  })

  it('renders blur options with size/hardness sliders', () => {
    resetStore()
    toolManager.setActiveTool('blur')
    const { container } = render(<ToolOptionsPanel />)

    expect(document.querySelector('[data-tool-options="blur"]')).not.toBeNull()
    expect(screen.getByText('Size')).toBeTruthy()
    expect(screen.getByText('Hard')).toBeTruthy()
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(2)
  })

  it('renders eraser options with size/hardness sliders', () => {
    resetStore()
    toolManager.setActiveTool('eraser')
    const { container } = render(<ToolOptionsPanel />)

    expect(document.querySelector('[data-tool-options="eraser"]')).not.toBeNull()
    expect(screen.getByText('Size')).toBeTruthy()
    expect(screen.getByText('Hard')).toBeTruthy()
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(2)
  })

  it('renders a tolerance slider for the magic eraser', () => {
    resetStore()
    toolManager.setActiveTool('magic-eraser')
    const { container } = render(<ToolOptionsPanel />)

    expect(document.querySelector('[data-tool-options="magic-eraser"]')).not.toBeNull()
    expect(screen.getByText('Tolerance')).toBeTruthy()
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(1)
    expect(screen.queryByText('Color')).toBeNull()
    expect(screen.queryByText('Size')).toBeNull()
  })

  it('magic eraser tolerance updates the runtime brush hardness', () => {
    resetStore()
    toolManager.setActiveTool('magic-eraser')
    const { container } = render(<ToolOptionsPanel />)

    fireEvent.change(container.querySelector('input[type="range"]')!, { target: { value: '30' } })
    expect(useRuntimeStore.getState().brush.hardness).toBeCloseTo(0.3)
  })

  it('mask tool Clear masks empties every scene mask (incl. background) with one history entry', () => {
    resetStore()
    toolManager.setActiveTool('mask')
    act(() => {
      const state = useStore.getState()
      state.addMask({ id: 'm1', targetId: 'dev-1', shape: 'rectangle', x: 0, y: 0, width: 50, height: 50, points: [], inverted: false })
      state.addMask({ id: 'mbg', targetId: '__background__', shape: 'rectangle', x: 0, y: 0, width: 50, height: 50, points: [], inverted: true })
    })
    render(<ToolOptionsPanel />)

    expect(document.querySelector('[data-tool-options="mask"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Clear all masks/ }))

    expect(useStore.getState().scenes[0].masks).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(1)

    act(() => {
      useStore.getState().undo()
    })
    expect(useStore.getState().scenes[0].masks).toHaveLength(2)
  })
})
