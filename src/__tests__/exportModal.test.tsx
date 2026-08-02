/**
 * Phase 5e — Export as a true modal (IA §2).
 *
 * Export is no longer a sidebar tab: the ExportDialog renders inside a portal
 * Modal, and the runtime store owns the open/close state (session-scoped,
 * closed on project new/open via resetRuntime('all')).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRuntimeStore, resetRuntime } from '../renderer/runtime/store'
import { resetStore } from './helpers'
import ExportDialog from '../renderer/components/sidebar/ExportDialog'
import BottomToolbar from '../renderer/components/toolbar/BottomToolbar'

function ExportHarness() {
  const open = useRuntimeStore((s) => s.exportModalOpen)
  return (
    <>
      <BottomToolbar />
      <ExportDialog open={open} onClose={() => useRuntimeStore.getState().closeExportModal()} />
    </>
  )
}

describe('ExportDialog — Phase 5e modal', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders nothing when closed', () => {
    render(<ExportDialog open={false} onClose={() => {}} />)
    expect(document.querySelector('[data-modal]')).toBeNull()
  })

  it('renders as a modal dialog with the export options when open', () => {
    render(<ExportDialog open onClose={() => {}} />)

    const dialog = document.querySelector('[data-modal]')
    expect(dialog).not.toBeNull()
    expect(dialog).toHaveAttribute('role', 'dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Export')
    expect(screen.getByText('Format')).toBeInTheDocument()
    expect(screen.getByText('Scale')).toBeInTheDocument()
    expect(screen.getByText('Background')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('closes via Escape', () => {
    const onClose = vi.fn()
    render(<ExportDialog open onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes via backdrop click', () => {
    const onClose = vi.fn()
    render(<ExportDialog open onClose={onClose} />)

    const dialog = document.querySelector('[data-modal]')!
    const backdrop = dialog.parentElement!.querySelector('[aria-hidden="true"]')
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('session contract: stays open across transient resets, closes on all reset', () => {
    expect(useRuntimeStore.getState().exportModalOpen).toBe(false)

    useRuntimeStore.getState().openExportModal()
    expect(useRuntimeStore.getState().exportModalOpen).toBe(true)

    resetRuntime('transient')
    expect(useRuntimeStore.getState().exportModalOpen).toBe(true)

    resetRuntime('all')
    expect(useRuntimeStore.getState().exportModalOpen).toBe(false)
  })

  it('toolbar Export button opens the visible modal (not a sidebar tab)', () => {
    render(<ExportHarness />)

    expect(document.querySelector('[data-modal]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(document.querySelector('[data-modal]')).not.toBeNull()
    expect(screen.getByRole('dialog', { name: 'Export' })).toBeInTheDocument()
  })
})
