/**
 * Watermark export-only contract — the watermark is never rendered in the
 * editing canvas; it is injected into the export clone by export-engine.
 * Covers the shared style builder, the enabled predicate, and the editor-side
 * isolation (Scene renders no `[data-watermark]` even when enabled).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { resetStore } from './helpers'
import { useStore } from '../renderer/store'
import { createDefaultScene } from '../renderer/store/sceneSlice'
import { buildWatermarkStyle, isWatermarkEnabled } from '../renderer/lib/watermark'
import Scene from '../renderer/components/canvas/Scene'
import type { Scene as SceneType } from '@shared/types'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function setScene(scene: SceneType) {
  act(() => useStore.setState({ scenes: [scene], activeSceneIndex: 0 }))
}

function baseScene(): SceneType {
  const base = createDefaultScene()
  return { ...base, textBoxes: [], images: [], shapes: [] }
}

describe('buildWatermarkStyle', () => {
  it('maps settings to the export watermark style', () => {
    const style = buildWatermarkStyle({
      enabled: true,
      text: 'Mockup Studio',
      fontSize: 34,
      color: '#ffffff',
      opacity: 60,
      position: 'bottom-right'
    })
    expect(style.position).toBe('absolute')
    expect(style.bottom).toBe('12px')
    expect(style.right).toBe('12px')
    expect(style.fontSize).toBe('34px')
    expect(style.opacity).toBe(0.6)
  })

  it('centers the watermark for the center position', () => {
    const style = buildWatermarkStyle({
      enabled: true,
      text: 'WM',
      fontSize: 20,
      color: '#000000',
      opacity: 50,
      position: 'center'
    })
    expect(style.top).toBe('50%')
    expect(style.left).toBe('50%')
    expect(style.transform).toBe('translate(-50%, -50%)')
  })
})

describe('isWatermarkEnabled', () => {
  const base = {
    text: 'Mockup Studio',
    fontSize: 34,
    color: '#ffffff',
    opacity: 60,
    position: 'bottom-right' as const
  }

  it('is true when enabled with non-empty text', () => {
    expect(isWatermarkEnabled({ ...base, enabled: true })).toBe(true)
  })

  it('is false when disabled', () => {
    expect(isWatermarkEnabled({ ...base, enabled: false })).toBe(false)
  })

  it('is false when the text is empty or whitespace-only', () => {
    expect(isWatermarkEnabled({ ...base, enabled: true, text: '' })).toBe(false)
    expect(isWatermarkEnabled({ ...base, enabled: true, text: '   ' })).toBe(false)
  })
})

describe('Watermark editor isolation (Scene)', () => {
  beforeEach(() => {
    resetStore()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders no watermark in the editing DOM even when enabled', () => {
    useStore.getState().setWatermark({ enabled: true, text: 'Mockup Studio' })
    setScene(baseScene())

    const { container } = render(<Scene />)
    expect(container.querySelector('[data-scene-export]')).not.toBeNull()
    expect(container.querySelector('[data-watermark]')).toBeNull()
  })
})
