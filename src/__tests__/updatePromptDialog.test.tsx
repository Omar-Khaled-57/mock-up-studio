import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import UpdatePromptDialog from '../renderer/components/shared/UpdatePromptDialog'
import { useRuntimeStore, resetRuntime } from '../renderer/runtime/store'
import { resetStore } from './helpers'

const respondToUpdate = vi.fn()

function stubApi(): void {
  const w = window as { api?: unknown }
  w.api = { respondToUpdate }
}

function openPrompt(payload: { kind: 'available' | 'ready' | 'failed' | 'checking' | 'uptodate'; version?: string; message?: string }): void {
  useRuntimeStore.getState().setUpdatePrompt(payload)
}

beforeEach(() => {
  resetStore()
  stubApi()
  cleanup()
  respondToUpdate.mockClear()
})

describe('UpdatePromptDialog', () => {
  it('renders nothing when no prompt is open', () => {
    const { container } = render(<UpdatePromptDialog />)
    expect(container.querySelector('[data-modal]')).toBeNull()
    expect(screen.queryByText('Update Available')).toBeNull()
  })

  it('available prompt offers Download and Later and sends "download"', () => {
    openPrompt({ kind: 'available', version: '1.2.3' })
    render(<UpdatePromptDialog />)

    expect(screen.getByText('A new version (v1.2.3) is available.')).toBeTruthy()
    expect(screen.getByText('Would you like to download and install it now?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(respondToUpdate).toHaveBeenCalledWith('download')
    expect(useRuntimeStore.getState().updatePrompt).toBeNull()
  })

  it('available prompt "Later" defers via update-response', () => {
    openPrompt({ kind: 'available', version: '1.2.3' })
    render(<UpdatePromptDialog />)

    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(respondToUpdate).toHaveBeenCalledWith('later')
    expect(useRuntimeStore.getState().updatePrompt).toBeNull()
  })

  it('ready prompt offers Restart Now and sends "restart"', () => {
    openPrompt({ kind: 'ready' })
    render(<UpdatePromptDialog />)

    expect(screen.getByText('The update has been downloaded.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Restart Now' }))
    expect(respondToUpdate).toHaveBeenCalledWith('restart')
    expect(useRuntimeStore.getState().updatePrompt).toBeNull()
  })

  it('failed prompt shows the error detail and OK closes without a response', () => {
    openPrompt({ kind: 'failed', message: 'no network' })
    render(<UpdatePromptDialog />)

    expect(screen.getByText('Could not download the update.')).toBeTruthy()
    expect(screen.getByText('no network')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(respondToUpdate).not.toHaveBeenCalled()
    expect(useRuntimeStore.getState().updatePrompt).toBeNull()
  })

  it('failed prompt falls back to a friendly hint when no message is provided', () => {
    openPrompt({ kind: 'failed' })
    render(<UpdatePromptDialog />)

    expect(screen.getByText('Make sure you are connected to the internet and try again.')).toBeTruthy()
  })

  it('checking prompt shows a spinner and no action buttons, and Escape closes without a response', () => {
    openPrompt({ kind: 'checking' })
    render(<UpdatePromptDialog />)

    expect(screen.getByText('Checking for updates…')).toBeTruthy()
    expect(document.querySelector('[data-update-prompt-kind="checking"] .animate-spin')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Restart Now' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(respondToUpdate).not.toHaveBeenCalled()
    expect(useRuntimeStore.getState().updatePrompt).toBeNull()
  })

  it('Escape on an available prompt acts as "later"', () => {
    openPrompt({ kind: 'available', version: '1.2.3' })
    render(<UpdatePromptDialog />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(respondToUpdate).toHaveBeenCalledWith('later')
    expect(useRuntimeStore.getState().updatePrompt).toBeNull()
  })

  it('uptodate prompt confirms the running version and OK closes without a response', () => {
    openPrompt({ kind: 'uptodate', version: '0.3.0' })
    render(<UpdatePromptDialog />)

    expect(screen.getByText("You're running the latest version of Mockup Studio.")).toBeTruthy()
    expect(screen.getByText('Version 0.3.0')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(respondToUpdate).not.toHaveBeenCalled()
    expect(useRuntimeStore.getState().updatePrompt).toBeNull()
  })

  it('transient reset does not dismiss the prompt; full reset does', () => {
    openPrompt({ kind: 'ready' })
    resetRuntime('transient')
    expect(useRuntimeStore.getState().updatePrompt).toEqual({ kind: 'ready' })

    resetRuntime('all')
    expect(useRuntimeStore.getState().updatePrompt).toBeNull()
  })
})
