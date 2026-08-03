import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useKeyboardShortcuts } from '../renderer/hooks/useKeyboardShortcuts'
import { useRuntimeStore } from '../renderer/runtime/store'
import { useStore } from '../renderer/store'
import { toolManager } from '../renderer/tools'
import { resetStore } from './helpers'

function Harness() {
  useKeyboardShortcuts()
  return <div data-testid="root" />
}

function press(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
}

function release(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true, ...init }))
}

describe('useKeyboardShortcuts — tool domain', () => {
  beforeEach(() => {
    resetStore()
  })

  it('activates reachable tools via unmodified single-key shortcuts', () => {
    render(<Harness />)

    press('h')
    expect(toolManager.getEffectiveToolId()).toBe('hand')
    expect(useRuntimeStore.getState().activeToolId).toBe('hand')

    press('v')
    expect(toolManager.getEffectiveToolId()).toBe('select')

    press('b')
    expect(toolManager.getEffectiveToolId()).toBe('paint')
    expect(useRuntimeStore.getState().activeToolId).toBe('paint')
  })

  it('activates the marquee tool via M and cycles back via V', () => {
    render(<Harness />)

    press('m')
    expect(toolManager.getEffectiveToolId()).toBe('marquee')

    press('v')
    expect(toolManager.getEffectiveToolId()).toBe('select')
  })

  it('activates the focus tool via X', () => {
    render(<Harness />)

    press('x')
    expect(toolManager.getEffectiveToolId()).toBe('focus')
    expect(useRuntimeStore.getState().activeToolId).toBe('focus')
  })

  it('B activates the paint brush (blur is its own group without a shortcut)', () => {
    render(<Harness />)

    press('b')
    expect(toolManager.getEffectiveToolId()).toBe('paint')

    press('b')
    expect(toolManager.getEffectiveToolId()).toBe('paint')
  })

  it('E cycles through the eraser group (eraser, magic-eraser)', () => {
    render(<Harness />)

    press('e')
    expect(toolManager.getEffectiveToolId()).toBe('eraser')

    press('e')
    expect(toolManager.getEffectiveToolId()).toBe('magic-eraser')

    press('e')
    expect(toolManager.getEffectiveToolId()).toBe('eraser')
  })

  it('G activates the mask tool', () => {
    render(<Harness />)

    press('g')
    expect(toolManager.getEffectiveToolId()).toBe('mask')
  })

  it('Escape exits focus mode when a group is focused', () => {
    render(<Harness />)

    useRuntimeStore.getState().enterFocus('g-1')
    expect(useRuntimeStore.getState().focusGroupId).toBe('g-1')

    press('Escape')
    expect(useRuntimeStore.getState().focusGroupId).toBeNull()
  })

  it('Enter enters focus mode when the whole group is selected', () => {
    render(<Harness />)
    const dev1 = { id: 'dev-1', x: 0, y: 0, width: 10, height: 10, groupId: 'g-1' }
    const dev2 = { id: 'dev-2', x: 100, y: 0, width: 10, height: 10, groupId: 'g-1' }
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [dev1, dev2],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-1', 'dev-2'] }]
      }],
      selectedIds: ['dev-1', 'dev-2'],
      selectionMode: 'multi'
    })

    press('Enter')
    expect(useRuntimeStore.getState().focusGroupId).toBe('g-1')
  })

  it('Enter does not enter focus when only part of a group is selected', () => {
    render(<Harness />)
    const dev1 = { id: 'dev-1', x: 0, y: 0, width: 10, height: 10, groupId: 'g-1' }
    const dev2 = { id: 'dev-2', x: 100, y: 0, width: 10, height: 10, groupId: 'g-1' }
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [dev1, dev2],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-1', 'dev-2'] }]
      }],
      selectedIds: ['dev-1'],
      selectionMode: 'single'
    })

    press('Enter')
    expect(useRuntimeStore.getState().focusGroupId).toBeNull()
  })

  it('Enter does not enter element focus for a single non-group element', () => {
    render(<Harness />)
    const lonely = { id: 'lonely-1', x: 0, y: 0, width: 200, height: 100, containerId: null }
    useStore.setState({
      scenes: [{
        ...useStore.getState().scenes[0],
        devices: [lonely]
      }],
      selectedIds: ['lonely-1'],
      selectionMode: 'single'
    })

    press('Enter')
    expect(useRuntimeStore.getState().focusGroupId).toBeNull()
    expect(useRuntimeStore.getState().focusElementId).toBeNull()
  })

  it('switches to Hand while Space is held and restores on keyup', () => {
    render(<Harness />)

    press(' ')
    expect(toolManager.getEffectiveToolId()).toBe('hand')
    expect(useRuntimeStore.getState().activeToolId).toBe('select')
    expect(useRuntimeStore.getState().temporaryToolStack).toHaveLength(1)

    release(' ')
    expect(toolManager.getEffectiveToolId()).toBe('select')
    expect(useRuntimeStore.getState().temporaryToolStack).toHaveLength(0)
  })

  it('does not push duplicate temporary tools on key repeat', () => {
    render(<Harness />)

    press(' ')
    press(' ', { repeat: true })
    expect(useRuntimeStore.getState().temporaryToolStack).toHaveLength(1)

    release(' ')
    expect(useRuntimeStore.getState().temporaryToolStack).toHaveLength(0)
  })

  it('ignores Space while typing in an input', () => {
    render(
      <div>
        <Harness />
        <input data-testid="input" />
      </div>
    )
    const input = screen.getByTestId('input')
    input.focus()

    input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(useRuntimeStore.getState().temporaryToolStack).toHaveLength(0)
    expect(toolManager.getEffectiveToolId()).toBe('select')
  })

  it('Escape clears the temporary tool stack', () => {
    render(<Harness />)

    press(' ')
    expect(toolManager.getEffectiveToolId()).toBe('hand')

    press('Escape')
    expect(toolManager.getEffectiveToolId()).toBe('select')
    expect(useRuntimeStore.getState().temporaryToolStack).toHaveLength(0)
  })

  it('window blur releases a Space-temporary Hand tool', () => {
    render(<Harness />)

    press(' ')
    expect(toolManager.getEffectiveToolId()).toBe('hand')
    expect(useRuntimeStore.getState().temporaryToolStack).toHaveLength(1)

    window.dispatchEvent(new Event('blur'))
    expect(toolManager.getEffectiveToolId()).toBe('select')
    expect(useRuntimeStore.getState().temporaryToolStack).toHaveLength(0)

    // The next Space still works afterwards.
    press(' ')
    expect(toolManager.getEffectiveToolId()).toBe('hand')
    release(' ')
    expect(toolManager.getEffectiveToolId()).toBe('select')
  })

  it('window blur interrupts in-flight gestures', () => {
    render(<Harness />)

    const spy = vi.spyOn(toolManager, 'interruptTools')
    window.dispatchEvent(new Event('blur'))
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('leaves the active tool unchanged on modified shortcuts', () => {
    render(<Harness />)

    press('s', { ctrlKey: true })
    press('z', { ctrlKey: true })
    expect(toolManager.getEffectiveToolId()).toBe('select')
  })

  it('Ctrl+E opens the export modal', () => {
    render(<Harness />)

    expect(useRuntimeStore.getState().exportModalOpen).toBe(false)
    press('e', { ctrlKey: true })
    expect(useRuntimeStore.getState().exportModalOpen).toBe(true)
    expect(toolManager.getEffectiveToolId()).toBe('select')
  })
})
