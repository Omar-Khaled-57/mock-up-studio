/**
 * MasksPanel — scene-layer mask management (architecture §6.1).
 *
 * Masks are first-class scene layers (own name/zIndex/visible/locked, scene-
 * space geometry) managed by their own sidebar panel, not the Properties
 * panel. These tests cover the panel surface: Add Mask wraps the whole canvas
 * as an inverted live mask with one undo entry, per-mask Reverse/Remove/
 * Duplicate/visibility/lock/rename act on the scene list additively, and
 * Clear all masks empties the whole scene with one undo entry.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { resetStore } from './helpers'
import { useStore } from '../renderer/store'
import { nextMaskZIndex } from '../renderer/store/maskSlice'
import MasksPanel from '../renderer/components/sidebar/MasksPanel'
import type { Mask } from '../shared/types'

function seedMask(overrides: Partial<Mask> & { id: string; name: string }): void {
  act(() => {
    useStore.getState().addMask({
      id: overrides.id,
      name: overrides.name,
      shape: overrides.shape ?? 'rectangle',
      x: overrides.x ?? 0,
      y: overrides.y ?? 0,
      width: overrides.width ?? 100,
      height: overrides.height ?? 50,
      points: [],
      inverted: overrides.inverted ?? true,
      zIndex: overrides.zIndex ?? 0,
      visible: overrides.visible ?? true,
      locked: overrides.locked ?? false
    })
  })
}

function sceneMasks(): Mask[] {
  return useStore.getState().scenes[0].masks
}

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  cleanup()
})

describe('MasksPanel', () => {
  it('Full Canvas Mask creates a full-canvas inverted live mask with one history entry', () => {
    render(<MasksPanel />)
    const expectedZ = nextMaskZIndex(useStore.getState().scenes[0])
    fireEvent.click(screen.getByRole('button', { name: /Full Canvas Mask/ }))

    const masks = sceneMasks()
    expect(masks).toHaveLength(1)
    const canvas = useStore.getState().scenes[0].canvas
    expect(masks[0]).toMatchObject({
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      inverted: true,
      visible: true,
      locked: false
    })
    expect(masks[0].snapshot).toBeUndefined()
    expect(masks[0].zIndex).toBe(expectedZ)
    expect(useStore.getState().undoStack.length).toBe(1)

    act(() => { useStore.getState().undo() })
    expect(sceneMasks()).toHaveLength(0)
  })

  it('lists every mask additively with per-mask Delete/Reverse/Duplicate', () => {
    seedMask({ id: 'm-a', name: 'Rect mask', inverted: true })
    seedMask({ id: 'm-b', name: 'Oval mask', shape: 'ellipse', inverted: false })
    render(<MasksPanel />)

    expect(screen.getByText('Rect mask')).toBeInTheDocument()
    expect(screen.getByText('Oval mask')).toBeInTheDocument()
    expect(screen.getAllByTitle('Delete')).toHaveLength(2)

    act(() => { fireEvent.click(screen.getAllByTitle('Delete')[1]) })
    expect(sceneMasks().map((m) => m.id)).toEqual(['m-a'])

    act(() => { fireEvent.click(screen.getByTitle('Switch to reveal')) })
    expect(sceneMasks()[0].inverted).toBe(false)

    act(() => { fireEvent.click(screen.getByTitle('Duplicate')) })
    expect(sceneMasks()).toHaveLength(2)
    expect(sceneMasks()[1].name).toBe('Rect mask copy')
  })

  it('toggles per-mask visibility and lock', () => {
    seedMask({ id: 'm-a', name: 'Rect mask' })
    render(<MasksPanel />)

    act(() => { fireEvent.click(screen.getByTitle('Hide')) })
    expect(sceneMasks()[0].visible).toBe(false)

    act(() => { fireEvent.click(screen.getByTitle('Lock')) })
    expect(sceneMasks()[0].locked).toBe(true)
  })

  it('double-clicking a mask name renames it with one history entry', () => {
    seedMask({ id: 'm-a', name: 'Rect mask' })
    render(<MasksPanel />)

    fireEvent.doubleClick(screen.getByText('Rect mask'))
    const input = screen.getByDisplayValue('Rect mask')
    fireEvent.change(input, { target: { value: 'Canvas hole' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(sceneMasks()[0].name).toBe('Canvas hole')
    expect(useStore.getState().undoStack.length).toBe(1)
  })

  it('Clear all masks empties every scene mask with one history entry; undo restores', () => {
    seedMask({ id: 'm-a', name: 'Rect mask' })
    seedMask({ id: 'm-b', name: 'Oval mask' })
    render(<MasksPanel />)

    fireEvent.click(screen.getByRole('button', { name: /Clear all masks/ }))
    expect(sceneMasks()).toHaveLength(0)
    expect(useStore.getState().undoStack.length).toBe(1)

    act(() => { useStore.getState().undo() })
    expect(sceneMasks()).toHaveLength(2)
  })
})
