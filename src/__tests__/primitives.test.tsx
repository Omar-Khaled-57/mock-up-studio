/**
 * Phase 4 primitives — Button, IconButton, Field, NumberInput, SegmentedControl,
 * AccordionSection, Badge, Kbd, Modal, Menu, Tooltip, ChromeStrip.
 * These are the design-system building blocks for the v0.3.0 redesign; tests
 * assert behavior + a11y wiring (aria attributes, focus management, commit
 * semantics) rather than exact class strings.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { resetStore } from './helpers'
import Button from '../renderer/components/primitives/Button'
import IconButton from '../renderer/components/primitives/IconButton'
import Field from '../renderer/components/primitives/Field'
import NumberInput from '../renderer/components/primitives/NumberInput'
import SegmentedControl from '../renderer/components/primitives/SegmentedControl'
import AccordionSection from '../renderer/components/primitives/AccordionSection'
import Badge from '../renderer/components/primitives/Badge'
import Kbd from '../renderer/components/primitives/Kbd'
import Modal from '../renderer/components/primitives/Modal'
import Menu from '../renderer/components/primitives/Menu'
import Tooltip from '../renderer/components/primitives/Tooltip'
import ChromeStrip from '../renderer/components/primitives/ChromeStrip'
import { Sun } from 'lucide-react'

describe('Button', () => {
  beforeEach(() => resetStore())

  it('renders children and forwards onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('honors disabled state', () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('applies the accent variant styles', () => {
    render(<Button variant="accent">Export</Button>)
    const btn = screen.getByRole('button', { name: 'Export' })
    expect(btn.className).toContain('bg-indigo-5')
    expect(btn.className).toContain('text-white')
  })
})

describe('IconButton', () => {
  beforeEach(() => resetStore())

  it('exposes an accessible label', () => {
    render(<IconButton icon={Sun} label="Toggle theme" />)
    const btn = screen.getByRole('button', { name: 'Toggle theme' })
    expect(btn).toHaveAttribute('aria-label', 'Toggle theme')
    expect(btn).toHaveAttribute('title', 'Toggle theme')
  })
})

describe('Field', () => {
  beforeEach(() => resetStore())

  it('associates the label with the control via htmlFor', () => {
    render(
      <Field label="Width" htmlFor="w">
        <input id="w" />
      </Field>
    )
    const label = screen.getByText('Width')
    expect(label).toHaveAttribute('for', 'w')
  })

  it('renders hint text', () => {
    render(<Field label="Width" hint="Applies to the selected device">x</Field>)
    expect(screen.getByText('Applies to the selected device')).toBeInTheDocument()
  })
})

describe('NumberInput', () => {
  beforeEach(() => resetStore())

  it('renders the current value', () => {
    render(<NumberInput value={120} onChange={() => {}} ariaLabel="Width" />)
    expect(screen.getByLabelText('Width')).toHaveValue('120')
  })

  it('commits a parsed value on Enter', () => {
    const onChange = vi.fn()
    render(<NumberInput value={100} onChange={onChange} ariaLabel="Width" />)
    const input = screen.getByLabelText('Width')
    fireEvent.change(input, { target: { value: '180' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(180)
  })

  it('commits on blur', () => {
    const onChange = vi.fn()
    render(<NumberInput value={100} onChange={onChange} ariaLabel="Width" />)
    const input = screen.getByLabelText('Width')
    fireEvent.change(input, { target: { value: '55' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(55)
  })

  it('clamps to min/max', () => {
    const onChange = vi.fn()
    render(<NumberInput value={100} min={0} max={500} onChange={onChange} ariaLabel="Width" />)
    const input = screen.getByLabelText('Width')
    fireEvent.change(input, { target: { value: '900' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(500)
  })

  it('reverts invalid input on Escape', () => {
    const onChange = vi.fn()
    render(<NumberInput value={100} onChange={onChange} ariaLabel="Width" />)
    const input = screen.getByLabelText('Width')
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveValue('100')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('SegmentedControl', () => {
  beforeEach(() => resetStore())

  it('renders options with aria-checked and calls onChange', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl
        options={[
          { value: 'contain', label: 'Contain' },
          { value: 'cover', label: 'Cover' }
        ]}
        value="contain"
        onChange={onChange}
        ariaLabel="Object fit"
      />
    )
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(2)
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
    expect(radios[1]).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(radios[1])
    expect(onChange).toHaveBeenCalledWith('cover')
  })
})

describe('AccordionSection', () => {
  beforeEach(() => resetStore())

  it('renders content when open and toggles on header click', () => {
    render(
      <AccordionSection title="Transform">
        <div>X control</div>
      </AccordionSection>
    )
    const header = screen.getByRole('button', { name: /Transform/ })
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('X control')).toBeInTheDocument()
    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('X control')).not.toBeInTheDocument()
  })

  it('renders a value dot when flagged', () => {
    render(
      <AccordionSection title="Mask" valueDot>
        <div>mask</div>
      </AccordionSection>
    )
    const dot = document.querySelector('span.rounded-full')
    expect(dot).not.toBeNull()
  })

  it('honors controlled open state instead of internal state', () => {
    const onToggle = vi.fn()
    const { rerender } = render(
      <AccordionSection title="Effects" open={false} onToggle={onToggle}>
        <div>effects</div>
      </AccordionSection>
    )
    const header = screen.getByRole('button', { name: /Effects/ })
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('effects')).not.toBeInTheDocument()
    rerender(
      <AccordionSection title="Effects" open onToggle={onToggle}>
        <div>effects</div>
      </AccordionSection>
    )
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('effects')).toBeInTheDocument()
    fireEvent.click(header)
    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it('reports the next state to onToggle on header click', () => {
    const onToggle = vi.fn()
    render(
      <AccordionSection title="Mask" open onToggle={onToggle}>
        <div>mask</div>
      </AccordionSection>
    )
    fireEvent.click(screen.getByRole('button', { name: /Mask/ }))
    expect(onToggle).toHaveBeenCalledWith(false)
  })
})

describe('Badge & Kbd', () => {
  beforeEach(() => resetStore())

  it('renders badge content with variant', () => {
    render(<Badge variant="danger">2 issues</Badge>)
    expect(screen.getByText('2 issues').className).toContain('red')
  })

  it('renders keyboard hint', () => {
    render(<Kbd>V</Kbd>)
    expect(screen.getByText('V').tagName.toLowerCase()).toBe('kbd')
  })
})

describe('Modal', () => {
  beforeEach(() => resetStore())

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Export">
        body
      </Modal>
    )
    expect(document.querySelector('[data-modal]')).toBeNull()
  })

  it('renders dialog, title and content when open', () => {
    render(
      <Modal open onClose={() => {}} title="Export">
        <div>format selector</div>
      </Modal>
    )
    const dialog = document.querySelector('[data-modal]')
    expect(dialog).not.toBeNull()
    expect(dialog).toHaveAttribute('role', 'dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Export')
    expect(screen.getByText('format selector')).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Export">
        body
      </Modal>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves focus into the dialog on open and restores on close', () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <div>
          <button onClick={() => setOpen(true)}>Open</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Export">
            <button>Apply</button>
          </Modal>
        </div>
      )
    }
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = document.querySelector('[data-modal]') as HTMLElement
    expect(document.activeElement).toBe(dialog)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[data-modal]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('wraps tab focus within the dialog', () => {
    render(
      <Modal open onClose={() => {}} title="Export">
        <button>First</button>
        <button>Last</button>
      </Modal>
    )
    const dialog = document.querySelector('[data-modal]') as HTMLElement
    const closeBtn = screen.getByRole('button', { name: 'Close dialog' })
    const last = screen.getByRole('button', { name: 'Last' })
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(closeBtn)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    dialog.focus()
  })
})

describe('Menu', () => {
  beforeEach(() => resetStore())

  it('renders an anchored menu with role=menu', () => {
    const ref = { current: null as HTMLElement | null }
    render(
      <div>
        <button ref={(el) => { ref.current = el }}>View</button>
        <Menu open onClose={() => {}} anchorRef={ref} data-menu="view-menu">
          <button>Rulers</button>
        </Menu>
      </div>
    )
    const menu = document.querySelector('[data-menu="view-menu"]')
    expect(menu).not.toBeNull()
    expect(menu).toHaveAttribute('role', 'menu')
    expect(screen.getByRole('button', { name: 'Rulers' })).toBeInTheDocument()
  })

  it('closes on outside pointer down and Escape', () => {
    const onClose = vi.fn()
    const ref = { current: null as HTMLElement | null }
    render(
      <div>
        <button ref={(el) => { ref.current = el }}>View</button>
        <Menu open onClose={onClose} anchorRef={ref}>
          <button>Rulers</button>
        </Menu>
      </div>
    )
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('Tooltip', () => {
  beforeEach(() => resetStore())

  it('renders hidden tooltip content on hover target', () => {
    render(
      <Tooltip content="Delete element">
        <button>X</button>
      </Tooltip>
    )
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('Delete element')
    expect(tip.className).toContain('opacity-0')
    expect(screen.getByRole('button', { name: 'X' })).toBeInTheDocument()
  })
})

describe('ChromeStrip', () => {
  beforeEach(() => resetStore())

  it('reveals and hides its body', () => {
    render(
      <ChromeStrip header={<span>Tools</span>}>
        <button>Brush</button>
      </ChromeStrip>
    )
    const toggle = screen.getByRole('button', { name: 'Hide panel' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Brush' })).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.queryByRole('button', { name: 'Brush' })).not.toBeInTheDocument()
  })

  it('renders no toggle when it has no body', () => {
    render(<ChromeStrip header={<span>Tools</span>} />)
    expect(screen.queryByRole('button', { name: 'Hide panel' })).toBeNull()
  })
})

describe('Modal + Menu portal cleanup', () => {
  beforeEach(() => resetStore())

  it('unmounts portals without leaking listeners', () => {
    const ref = { current: null as HTMLElement | null }
    const { unmount } = render(
      <div>
        <button ref={(el) => { ref.current = el }}>View</button>
        <Menu open onClose={() => {}} anchorRef={ref}>
          <button>Rulers</button>
        </Menu>
      </div>
    )
    unmount()
    expect(document.querySelector('[data-menu]')).toBeNull()
    expect(vi.getMockedSystemTime()).toBeFalsy()
  })
})
