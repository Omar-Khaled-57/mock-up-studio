/**
 * Phase 5f — Canvas panel split + bottom rail indicator: Canvas size presets
 * are their own `canvas` tab again (not stacked in Background), and the
 * active-tab indicator sits at the bottom edge of the rail item.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { resetStore } from './helpers'
import { useStore } from '../renderer/store'
import Sidebar from '../renderer/components/sidebar/Sidebar'

describe('Sidebar rail', () => {
  beforeEach(() => resetStore())

  it('renders Canvas and Background as separate Design tabs', () => {
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: 'Canvas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Back\s*Ground/ })).toBeInTheDocument()
  })

  it('Canvas tab uses the Proportions icon and a two-line Background label', () => {
    render(<Sidebar />)
    const canvasTab = screen.getByRole('button', { name: 'Canvas' })
    expect(canvasTab.querySelector('svg.lucide-proportions')).not.toBeNull()
    const bgTab = screen.getByRole('button', { name: /Back\s*Ground/ })
    const label = bgTab.querySelector('span')
    expect(label).not.toBeNull()
    expect(label!.textContent).toBe('Back\nGround')
    expect(label!.className).toContain('whitespace-pre-line')
  })

  it('clicking the Canvas tab opens the canvas size panel', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByRole('button', { name: 'Canvas' }))
    expect(useStore.getState().sidebarTab).toBe('canvas')
    expect(screen.getByText('Quick Presets')).toBeInTheDocument()
    expect(screen.getByText('Add Canvas Size')).toBeInTheDocument()
  })

  it('Background panel no longer contains the canvas size editor', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByRole('button', { name: /Back\s*Ground/ }))
    expect(useStore.getState().sidebarTab).toBe('background')
    expect(screen.getByText('Theme Presets')).toBeInTheDocument()
    expect(screen.queryByText('Add Canvas Size')).not.toBeInTheDocument()
    expect(screen.queryByText('Quick Presets')).not.toBeInTheDocument()
  })

  it('Organize owns Layers, Grid and History; View/History sections and the trailing separator are gone', () => {
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: 'Layers' })).toBeInTheDocument()
    expect(screen.getByTitle('Grid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument()
    expect(screen.queryByText('View')).toBeNull()
    expect(screen.queryAllByText('History')).toHaveLength(1)

    fireEvent.click(screen.getByTitle('Grid'))
    expect(useStore.getState().sidebarTab).toBe('grid')
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(useStore.getState().sidebarTab).toBe('history')

    const separators = document.querySelectorAll('div.w-8.border-t')
    expect(separators.length).toBe(2)
    const lastOrganizeTab = screen.getByRole('button', { name: 'History' })
    let nextEl = lastOrganizeTab.nextElementSibling
    let separatorUnderLastTab = false
    while (nextEl) {
      if (nextEl.classList.contains('border-t')) separatorUnderLastTab = true
      nextEl = nextEl.nextElementSibling
    }
    expect(separatorUnderLastTab).toBe(false)
  })

  it('active tab indicator sits at the bottom edge of the rail item', () => {
    render(<Sidebar />)
    const activeTab = screen.getByRole('button', { name: 'Devices' })
    expect(activeTab).toHaveAttribute('aria-current', 'page')
    const indicator = activeTab.querySelector('div')
    expect(indicator).not.toBeNull()
    expect(indicator!.className).toContain('bottom-0')
    expect(indicator!.className).not.toContain('left-0')

    const inactiveTab = screen.getByRole('button', { name: 'Canvas' })
    expect(inactiveTab.querySelector('div')).toBeNull()
  })

  it('indicator follows the active tab when switching', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByRole('button', { name: 'Canvas' }))
    expect(screen.getByRole('button', { name: 'Canvas' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Devices' })).not.toHaveAttribute('aria-current')
  })
})
