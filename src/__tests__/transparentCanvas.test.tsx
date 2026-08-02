/**
 * Transparent Canvas — the scene background `transparent` flag. Covers the
 * ThemesPanel toggle (the feature's UI entry point), the Scene's
 * `[data-transparent-checker]` editor-chrome layer, and the serialize/
 * deserialize round-trip of the flag.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, act, fireEvent } from '@testing-library/react'
import { resetStore, makeDevice } from './helpers'
import { useStore } from '../renderer/store'
import { createDefaultScene } from '../renderer/store/sceneSlice'
import { serializeProject, deserializeProject } from '../renderer/lib/project-serialization'
import Scene from '../renderer/components/canvas/Scene'
import OverlayRenderer from '../renderer/components/canvas/OverlayRenderer'
import ThemesPanel from '../renderer/components/sidebar/ThemesPanel'
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

describe('Transparent canvas render (Scene)', () => {
  beforeEach(() => {
    resetStore()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the transparency checkerboard when the background is transparent', () => {
    const scene = baseScene()
    scene.background = { ...scene.background, transparent: true }
    scene.devices = [makeDevice({ id: 'dev-1', x: 40, y: 40, width: 300, height: 200 })]
    setScene(scene)

    const { container } = render(
      <>
        <Scene />
        <OverlayRenderer />
      </>
    )
    expect(container.querySelector('[data-transparent-checker]')).not.toBeNull()
    expect(container.querySelector('[data-scene-background]')).not.toBeNull()
    expect(container.querySelector('[data-element-id="dev-1"]')).not.toBeNull()
  })

  it('renders no checkerboard when the background is opaque (flag absent)', () => {
    const scene = baseScene()
    scene.background = { ...scene.background, transparent: false }
    setScene(scene)

    const { container } = render(
      <>
        <Scene />
        <OverlayRenderer />
      </>
    )
    expect(container.querySelector('[data-transparent-checker]')).toBeNull()
  })
})

describe('Transparent canvas toggle (ThemesPanel)', () => {
  beforeEach(() => {
    resetStore()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('toggles background.transparent with one undo entry', () => {
    const scene = baseScene()
    scene.background = { ...scene.background, transparent: false }
    setScene(scene)

    const { getByRole } = render(<ThemesPanel />)
    const checkbox = getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(false)

    fireEvent.click(checkbox)
    expect(useStore.getState().scenes[0].background.transparent).toBe(true)
    expect(useStore.getState().canUndo()).toBe(true)

    useStore.getState().undo()
    expect(useStore.getState().scenes[0].background.transparent).toBe(false)
  })

  it('turning the flag back off restores the visible background', () => {
    const scene = baseScene()
    scene.background = { ...scene.background, transparent: true }
    setScene(scene)

    const { getByRole } = render(<ThemesPanel />)
    const checkbox = getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)

    fireEvent.click(checkbox)
    expect(useStore.getState().scenes[0].background.transparent).toBe(false)
  })
})

describe('Transparent canvas serialization', () => {
  it('round-trips the transparent flag through serialize/deserialize', () => {
    const scene = baseScene()
    scene.background = { ...scene.background, transparent: true }
    const { manifest, assets } = serializeProject(
      { id: 'p', name: 't', createdAt: 0, updatedAt: 0 },
      [scene],
      0
    )

    const { scenes } = deserializeProject(manifest, assets)
    expect(scenes[0].background.transparent).toBe(true)
  })

  it('legacy backgrounds (flag absent) deserialize as opaque', () => {
    const scene = baseScene()
    delete (scene.background as { transparent?: boolean }).transparent
    const { manifest, assets } = serializeProject(
      { id: 'p', name: 't', createdAt: 0, updatedAt: 0 },
      [scene],
      0
    )

    const { scenes } = deserializeProject(manifest, assets)
    expect(scenes[0].background.transparent).toBeUndefined()
  })
})
