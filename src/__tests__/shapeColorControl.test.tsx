/**
 * ShapeColorControl — reusable shape fill editor (solid + linear/radial/conic
 * gradient). Verifies the solid/gradient mode toggle, the shape<->GradientValue
 * adapters, and that switching back to solid preserves the gradient config.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { resetStore, makeShape } from './helpers'
import type { Shape } from '@shared/types'
import ShapeColorControl from '../renderer/components/shapes/ShapeColorControl'

function Harness({ initial }: { initial: Shape }) {
  const [shape, setShape] = useState(initial)
  return (
    <>
      <ShapeColorControl
        shape={shape}
        onChange={(patch) => setShape((s) => ({ ...s, ...patch }))}
      />
      <div data-testid="result">{JSON.stringify(shape.gradient ?? null)}</div>
      <div data-testid="color">{shape.color}</div>
    </>
  )
}

function result() {
  return JSON.parse(screen.getByTestId('result').textContent ?? 'null')
}

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  cleanup()
})

describe('solid mode', () => {
  it('renders solid mode by default with the current color', () => {
    render(<Harness initial={makeShape({ color: '#ff0000' })} />)
    expect(screen.getByRole('button', { name: /solid/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /gradient/i })).toHaveAttribute('aria-pressed', 'false')
    const inputs = screen.getAllByDisplayValue('#ff0000')
    expect(inputs.length).toBeGreaterThan(0)
  })
})

describe('solid <-> gradient toggling', () => {
  it('switching to gradient emits an enabled gradient seeded from the solid color', () => {
    render(<Harness initial={makeShape({ color: '#ff0000' })} />)
    fireEvent.click(screen.getByRole('button', { name: /gradient/i }))
    expect(result()).toEqual({
      enabled: true,
      colors: ['#ff0000', '#1e1b4b'],
      angle: 135,
      type: 'linear',
      radialShape: 'circle'
    })
    // The gradient editor is now visible
    expect(screen.getByRole('button', { name: /conic/i })).toBeInTheDocument()
  })

  it('switching back to solid disables the gradient but keeps its config', () => {
    render(<Harness initial={makeShape({ color: '#ff0000' })} />)
    fireEvent.click(screen.getByRole('button', { name: /gradient/i }))
    fireEvent.click(screen.getByRole('button', { name: /^solid$/i }))
    expect(result()).toEqual({
      enabled: false,
      colors: ['#ff0000', '#1e1b4b'],
      angle: 135,
      type: 'linear',
      radialShape: 'circle'
    })
  })

  it('re-enabling restores the preserved gradient config', () => {
    render(<Harness initial={makeShape({ color: '#ff0000' })} />)
    fireEvent.click(screen.getByRole('button', { name: /gradient/i }))
    fireEvent.click(screen.getByRole('button', { name: /^solid$/i }))
    fireEvent.click(screen.getByRole('button', { name: /gradient/i }))
    expect(result()).toEqual({
      enabled: true,
      colors: ['#ff0000', '#1e1b4b'],
      angle: 135,
      type: 'linear',
      radialShape: 'circle'
    })
  })
})

describe('gradient editing', () => {
  it('changing the type emits an enabled gradient with the new type', () => {
    render(<Harness initial={makeShape({ color: '#ff0000' })} />)
    fireEvent.click(screen.getByRole('button', { name: /gradient/i }))
    fireEvent.click(screen.getByRole('button', { name: /^radial$/i }))
    expect(result().type).toBe('radial')
    expect(result().enabled).toBe(true)
  })

  it('radial shape selector swaps between circle and ellipse', () => {
    render(<Harness initial={makeShape({ color: '#ff0000' })} />)
    fireEvent.click(screen.getByRole('button', { name: /gradient/i }))
    fireEvent.click(screen.getByRole('button', { name: /^radial$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^ellipse$/i }))
    expect(result().radialShape).toBe('ellipse')
  })

  it('maps an existing multi-stop gradient into evenly-spaced editor stops', () => {
    const shape = makeShape({
      color: '#ff0000',
      gradient: { enabled: true, colors: ['#a11', '#b22', '#c33'], angle: 90, type: 'conic', radialShape: 'circle' }
    })
    render(<Harness initial={shape} />)
    // Rendered in gradient mode from the get-go — the conic editor is visible
    expect(screen.getByRole('button', { name: /^conic$/i })).toBeInTheDocument()
    expect(screen.getByTestId('result').textContent).toContain('"enabled":true')
    // The result must remain faithful after a solid round-trip
    fireEvent.click(screen.getByRole('button', { name: /^solid$/i }))
    fireEvent.click(screen.getByRole('button', { name: /gradient/i }))
    expect(result()).toEqual({
      enabled: true,
      colors: ['#a11', '#b22', '#c33'],
      angle: 90,
      type: 'conic',
      radialShape: 'circle'
    })
  })
})
