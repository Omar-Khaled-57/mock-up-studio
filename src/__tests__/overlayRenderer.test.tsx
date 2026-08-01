/**
 * OverlayRenderer — transient chrome renders as a sibling of the
 * `[data-scene-export]` node so no selection UI ever leaks into exports.
 * Regression: selection chrome previously lived inside the element facades,
 * polluting exported bitmaps.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useStore } from '../renderer/store'
import { useRuntimeStore } from '../renderer/runtime/store'
import { resetStore, makeDevice, makeTextBox } from './helpers'
import Scene from '../renderer/components/canvas/Scene'
import OverlayRenderer from '../renderer/components/canvas/OverlayRenderer'

describe('OverlayRenderer', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders selection chrome in the overlay, never inside the export node', () => {
    const device = makeDevice({ id: 'dev-1' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [device] }] })
    useStore.setState({ selectedIds: ['dev-1'] })

    render(
      <div>
        <Scene />
        <OverlayRenderer />
      </div>
    )

    const exportNode = document.querySelector('[data-scene-export]')!
    expect(exportNode.querySelector('[data-resize-handle]')).toBeNull()
    expect(exportNode.querySelector('[data-chrome-element-id]')).toBeNull()
    expect(exportNode.querySelector('[data-chrome-union]')).toBeNull()
    expect(exportNode.querySelector('[data-marquee]')).toBeNull()
    expect(exportNode.querySelector('[data-snap-guide]')).toBeNull()
    expect(exportNode.querySelector('[data-hover-outline]')).toBeNull()

    expect(document.querySelectorAll('[data-resize-handle]')).toHaveLength(4)
    const wrapper = document.querySelector('[data-chrome-element-id]')
    expect(wrapper?.getAttribute('data-chrome-element-id')).toBe('dev-1')
    expect(wrapper?.getAttribute('data-chrome-element-kind')).toBe('device')
  })

  it('renders a union bounds box instead of per-element handles for multi-selection', () => {
    const dev1 = makeDevice({ id: 'dev-1', x: 100, y: 100, width: 100, height: 100 })
    const dev2 = makeDevice({ id: 'dev-2', x: 300, y: 400, width: 100, height: 100 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [dev1, dev2] }] })
    useStore.setState({ selectedIds: ['dev-1', 'dev-2'] })

    render(<OverlayRenderer />)

    expect(document.querySelector('[data-chrome-union]')).not.toBeNull()
    expect(document.querySelectorAll('[data-resize-handle]')).toHaveLength(0)
  })

  it('draws no chrome for locked selected elements', () => {
    const device = makeDevice({ id: 'dev-1', locked: true })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [device] }] })
    useStore.setState({ selectedIds: ['dev-1'] })

    render(<OverlayRenderer />)
    expect(document.querySelectorAll('[data-resize-handle]')).toHaveLength(0)
  })

  it('renders snap guides from the runtime store', () => {
    useRuntimeStore.getState().setSnapGuides({ verticalGuides: [120], horizontalGuides: [80] })
    render(<OverlayRenderer />)
    expect(document.querySelectorAll('[data-snap-guide="vertical"]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-snap-guide="horizontal"]')).toHaveLength(1)
  })

  it('renders the marquee rect from the runtime store', () => {
    useRuntimeStore.getState().setMarqueeRect({ x: 10, y: 20, width: 100, height: 80 })
    render(<OverlayRenderer />)
    const marquee = document.querySelector('[data-marquee]') as HTMLElement
    expect(marquee).not.toBeNull()
    expect(marquee.style.left).toBe('10px')
    expect(marquee.style.width).toBe('100px')
  })

  it('renders a hover outline for the hovered element', () => {
    const device = makeDevice({ id: 'dev-1' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [device] }] })
    useRuntimeStore.getState().setHoveredElement({ id: 'dev-1', kind: 'device' })
    render(<OverlayRenderer />)
    expect(document.querySelector('[data-hover-outline="dev-1"]')).not.toBeNull()
  })

  it('does not render a hover outline over an already-selected element', () => {
    const device = makeDevice({ id: 'dev-1' })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], devices: [device] }] })
    useStore.setState({ selectedIds: ['dev-1'] })
    useRuntimeStore.getState().setHoveredElement({ id: 'dev-1', kind: 'device' })
    render(<OverlayRenderer />)
    expect(document.querySelector('[data-hover-outline]')).toBeNull()
  })

  it('renders no chrome when the selection contains only a text box', () => {
    const tb = makeTextBox({ id: 'tb-1', x: 0, y: 0, width: 100, height: 50 })
    useStore.setState({ scenes: [{ ...useStore.getState().scenes[0], textBoxes: [tb] }] })
    useStore.setState({ selectedIds: ['tb-1'] })

    render(<OverlayRenderer />)
    const wrapper = document.querySelector('[data-chrome-element-id]')
    expect(wrapper?.getAttribute('data-chrome-element-id')).toBe('tb-1')
    expect(wrapper?.getAttribute('data-chrome-element-kind')).toBe('textBox')
  })

  it('renders the focus dim scrim and ring in the overlay, not the export node', () => {
    const dev = makeDevice({ id: 'dev-1', x: 100, y: 100, width: 100, height: 100, groupId: 'g-1' })
    const sceneState = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...sceneState,
        devices: [dev],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-1'], parentGroupId: null }]
      }]
    })
    useRuntimeStore.getState().enterFocus('g-1')

    render(
      <div>
        <Scene />
        <OverlayRenderer />
      </div>
    )

    expect(document.querySelector('[data-focus-dim]')).not.toBeNull()
    const ring = document.querySelector('[data-focus-ring]') as HTMLElement
    expect(ring).not.toBeNull()
    expect(ring.style.left).toBe('100px')

    const exportNode = document.querySelector('[data-scene-export]')!
    expect(exportNode.querySelector('[data-focus-dim]')).toBeNull()
    expect(exportNode.querySelector('[data-focus-ring]')).toBeNull()
  })

  it('renders no dim scrim when not focused', () => {
    render(<OverlayRenderer />)
    expect(document.querySelector('[data-focus-dim]')).toBeNull()
  })

  it('suppresses the hover outline over dimmed elements while focused', () => {
    const devIn = makeDevice({ id: 'dev-in', x: 0, y: 0, width: 100, height: 100, groupId: 'g-1' })
    const devOut = makeDevice({ id: 'dev-out', x: 300, y: 0, width: 100, height: 100 })
    const sceneState = useStore.getState().scenes[0]
    useStore.setState({
      scenes: [{
        ...sceneState,
        devices: [devIn, devOut],
        groups: [{ id: 'g-1', name: 'G', childIds: ['dev-in'], parentGroupId: null }]
      }]
    })
    useRuntimeStore.getState().enterFocus('g-1')
    useRuntimeStore.getState().setHoveredElement({ id: 'dev-out', kind: 'device' })
    render(<OverlayRenderer />)
    expect(document.querySelector('[data-hover-outline]')).toBeNull()
  })
})
