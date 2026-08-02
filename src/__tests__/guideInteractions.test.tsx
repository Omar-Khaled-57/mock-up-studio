import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import Scene from '../renderer/components/canvas/Scene'
import { useStore } from '../renderer/store'
import { resetStore } from './helpers'

describe('guide interactions', () => {
  beforeEach(() => {
    resetStore()
    const scene = useStore.getState().getActiveScene()
    useStore.setState({
      scenes: [{
        ...scene,
        guides: [{ id: 'guide-1', orientation: 'vertical' as const, position: 120 }]
      }]
    })
  })

  it('selects a guide and updates its position while dragging', () => {
    const { container } = render(<Scene />)
    const guide = container.querySelector('[data-guide="true"]') as HTMLElement

    fireEvent.pointerDown(guide, { pointerId: 1, clientX: 120, clientY: 20, bubbles: true })
    expect(container.querySelector('[data-guide-selected="true"]')).not.toBeNull()

    fireEvent.pointerMove(guide, { pointerId: 1, clientX: 160, clientY: 20, movementX: 40, movementY: 0, bubbles: true })
    fireEvent.pointerUp(guide, { pointerId: 1, clientX: 160, clientY: 20, bubbles: true })

    expect(useStore.getState().getActiveScene().guides[0].position).toBe(160)
  })

  it('uses the pointer scene position to drag under zoom and pan', () => {
    useStore.setState({ zoom: 2, panX: 20, panY: 10 })

    const sceneWrapper = document.createElement('div')
    sceneWrapper.setAttribute('data-scene-export', 'true')
    Object.defineProperty(sceneWrapper, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, x: 0, y: 0, toJSON: () => ({}) })
    })
    document.body.appendChild(sceneWrapper)

    const { container } = render(<Scene />)
    const guide = container.querySelector('[data-guide="true"]') as HTMLElement

    fireEvent.pointerDown(guide, { pointerId: 3, clientX: 150, clientY: 20, bubbles: true })
    fireEvent.pointerMove(guide, { pointerId: 3, clientX: 190, clientY: 20, movementX: 0, movementY: 0, bubbles: true })
    fireEvent.pointerUp(guide, { pointerId: 3, clientX: 190, clientY: 20, bubbles: true })

    expect(useStore.getState().getActiveScene().guides[0].position).toBe(140)

    sceneWrapper.remove()
  })

  it('deletes a guide when it is dragged back into the ruler zone', () => {
    const horizontalRuler = document.createElement('div')
    horizontalRuler.setAttribute('data-ruler', 'horizontal')
    Object.defineProperty(horizontalRuler, 'getBoundingClientRect', {
      value: () => ({ left: 0, right: 400, top: 0, bottom: 20, width: 400, height: 20 })
    })
    document.body.appendChild(horizontalRuler)

    const { container } = render(<Scene />)
    const guide = container.querySelector('[data-guide="true"]') as HTMLElement

    fireEvent.pointerDown(guide, { pointerId: 2, clientX: 120, clientY: 200, bubbles: true })
    fireEvent.pointerMove(guide, { pointerId: 2, clientX: 120, clientY: 10, movementX: 0, movementY: -190, bubbles: true })
    fireEvent.pointerUp(guide, { pointerId: 2, clientX: 120, clientY: 10, bubbles: true })

    expect(useStore.getState().getActiveScene().guides).toHaveLength(0)
  })
})
