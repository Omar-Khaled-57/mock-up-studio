import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import SaveChangesDialog from '../renderer/components/shared/SaveChangesDialog'
import { useRuntimeStore } from '../renderer/runtime/store'
import { useStore } from '../renderer/store'
import { withSaveGuard } from '../renderer/lib/save-guard'
import { resetStore, makeTextBox } from './helpers'

function stubApi(overrides?: Record<string, unknown>): void {
  (window as { api?: unknown }).api = {
    saveProject: vi.fn(async () => ({ success: true })),
    saveProjectAs: vi.fn(async () => ({ success: true, filePath: '/tmp/test.mockup' })),
    ackClose: vi.fn(),
    ...overrides
  }
}

function openPrompt(
  save = vi.fn(async () => true),
  proceed = vi.fn(),
  cancel = vi.fn(),
  message = 'Do you want to save?'
) {
  useRuntimeStore.getState().openSavePrompt({ message, save, proceed, cancel })
  return { save, proceed, cancel }
}

function dirtyProject(): void {
  useStore.getState().newProject()
  useStore.getState().setProjectName('My Project')
  useStore.getState().addTextBox(makeTextBox({ id: 'tb-1', zIndex: 5 }))
}

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
  stubApi()
  cleanup()
})

describe('SaveChangesDialog', () => {
  it('renders nothing when no prompt is open', () => {
    const { container } = render(<SaveChangesDialog />)
    expect(container.querySelector('[data-modal]')).toBeNull()
    expect(screen.queryByText('Save changes?')).toBeNull()
  })

  it('renders the title, message and the three action buttons when a prompt is open', () => {
    openPrompt()
    render(<SaveChangesDialog />)

    expect(screen.getByText('Save changes?')).toBeTruthy()
    expect(screen.getByText('Do you want to save?')).toBeTruthy()
    expect(screen.getByText('Save')).toBeTruthy()
    expect(screen.getByText("Don't Save")).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
  })

  it('Don\'t Save runs the action and closes the dialog without saving', () => {
    const { proceed } = openPrompt()
    render(<SaveChangesDialog />)

    fireEvent.click(screen.getByText("Don't Save"))
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(useRuntimeStore.getState().savePrompt).toBeNull()
  })

  it('Cancel runs the cancel callback and closes the dialog', () => {
    const { cancel } = openPrompt()
    render(<SaveChangesDialog />)

    fireEvent.click(screen.getByText('Cancel'))
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(useRuntimeStore.getState().savePrompt).toBeNull()
  })

  it('Escape routes through the cancel callback (Modal onClose)', () => {
    const { cancel } = openPrompt()
    render(<SaveChangesDialog />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(useRuntimeStore.getState().savePrompt).toBeNull()
  })

  it('Save saves, then runs the action and closes the dialog', async () => {
    const { save, proceed } = openPrompt()
    render(<SaveChangesDialog />)

    fireEvent.click(screen.getByText('Save'))
    await act(async () => {})
    expect(save).toHaveBeenCalledTimes(1)
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(useRuntimeStore.getState().savePrompt).toBeNull()
  })

  it('keeps the dialog open and does not run the action when the save fails', async () => {
    const { save, proceed } = openPrompt(vi.fn(async () => false))
    render(<SaveChangesDialog />)

    fireEvent.click(screen.getByText('Save'))
    await act(async () => {})
    expect(save).toHaveBeenCalledTimes(1)
    expect(proceed).not.toHaveBeenCalled()
    expect(useRuntimeStore.getState().savePrompt).not.toBeNull()
    expect(screen.getByText('Save')).toBeTruthy()
  })

  it('end-to-end: a dirty document, Save clicked, proceeds through the real guard', async () => {
    dirtyProject()
    const run = vi.fn()
    withSaveGuard('closing', run)
    render(<SaveChangesDialog />)

    expect(screen.getByText('Save changes?')).toBeTruthy()
    fireEvent.click(screen.getByText('Save'))

    await act(async () => {})
    expect(run).toHaveBeenCalledTimes(1)
    expect(useStore.getState().dirty).toBe(false)
    expect(useRuntimeStore.getState().savePrompt).toBeNull()
  })
})
