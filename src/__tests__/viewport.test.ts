/**
 * viewport service — screenToScene / sceneToScreen coordinate transforms.
 */
import { describe, it, expect } from 'vitest'
import { screenToScene, sceneToScreen } from '../renderer/services/viewport'

const container = { left: 20, top: 30 }
const pan = { x: 10, y: 5 }
const zoom = 2

describe('screenToScene', () => {
  it('converts screen coordinates to scene coordinates', () => {
    const pt = screenToScene(220, 230, container, pan, zoom)
    expect(pt).toEqual({ x: 95, y: 97.5 })
  })

  it('returns origin when no container rect is available', () => {
    expect(screenToScene(100, 100, null, pan, zoom)).toEqual({ x: 0, y: 0 })
  })

  it('accounts for zoom and pan independently', () => {
    const atZoom1 = screenToScene(220, 230, container, pan, 1)
    expect(atZoom1).toEqual({ x: 190, y: 195 })
  })
})

describe('sceneToScreen', () => {
  it('converts scene coordinates back to screen coordinates', () => {
    const pt = sceneToScreen(95, 97.5, container, pan, zoom)
    expect(pt).toEqual({ x: 220, y: 230 })
  })

  it('returns origin when no container rect is available', () => {
    expect(sceneToScreen(10, 10, null, pan, zoom)).toEqual({ x: 0, y: 0 })
  })
})

describe('round trip', () => {
  it('screenToScene(sceneToScreen(p)) === p', () => {
    const scene = { x: 123.45, y: -67.89 }
    const screen = sceneToScreen(scene.x, scene.y, container, pan, zoom)
    const back = screenToScene(screen.x, screen.y, container, pan, zoom)
    expect(back.x).toBeCloseTo(scene.x, 5)
    expect(back.y).toBeCloseTo(scene.y, 5)
  })
})
