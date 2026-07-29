import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '../renderer/store'
import { safeScene } from '../renderer/store/sceneSlice'
import { createDefaultShape } from '../renderer/store/shapeSlice'
import { resetStore, makeShape } from './helpers'

beforeEach(() => {
  vi.useFakeTimers()
  resetStore()
})

describe('createDefaultShape', () => {
  it('creates a rectangle at center of canvas', () => {
    const shape = createDefaultShape('rectangle', 1920, 1080)
    expect(shape.kind).toBe('rectangle')
    expect(shape.x).toBe(900)
    expect(shape.y).toBe(480)
    expect(shape.width).toBe(120)
    expect(shape.height).toBe(120)
    expect(shape.color).toBe('#6366f1')
    expect(shape.opacity).toBe(100)
    expect(shape.visible).toBe(true)
  })

  it('creates rectangle with zero corner radius by default', () => {
    const shape = createDefaultShape('rectangle', 800, 600)
    expect(shape.kind).toBe('rectangle')
    expect(shape.cornerRadius).toBe(0)
  })

  it('creates a circle shape', () => {
    const shape = createDefaultShape('circle', 800, 600)
    expect(shape.kind).toBe('circle')
  })

  it('creates a star shape', () => {
    const shape = createDefaultShape('star', 800, 600)
    expect(shape.kind).toBe('star')
  })

  it('creates a hexagon shape', () => {
    const shape = createDefaultShape('hexagon', 800, 600)
    expect(shape.kind).toBe('hexagon')
  })

  it('creates a diamond shape', () => {
    const shape = createDefaultShape('diamond', 800, 600)
    expect(shape.kind).toBe('diamond')
  })

  it('creates a parallelogram shape', () => {
    const shape = createDefaultShape('parallelogram', 800, 600)
    expect(shape.kind).toBe('parallelogram')
  })

  it('creates a trapezoid shape', () => {
    const shape = createDefaultShape('trapezoid', 800, 600)
    expect(shape.kind).toBe('trapezoid')
  })

  it('creates a cross shape', () => {
    const shape = createDefaultShape('cross', 800, 600)
    expect(shape.kind).toBe('cross')
  })

  it('creates a plus shape', () => {
    const shape = createDefaultShape('plus', 800, 600)
    expect(shape.kind).toBe('plus')
  })

  it('creates a heart shape', () => {
    const shape = createDefaultShape('heart', 800, 600)
    expect(shape.kind).toBe('heart')
  })

  it('creates an arrow-right shape', () => {
    const shape = createDefaultShape('arrow-right', 800, 600)
    expect(shape.kind).toBe('arrow-right')
  })

  it('creates shape with backgroundImage null by default', () => {
    const shape = createDefaultShape('rectangle', 800, 600)
    expect(shape.backgroundImage).toBeNull()
  })
})

describe('addShape', () => {
  it('adds a shape to the active scene', () => {
    const shape = makeShape({ id: 's1', kind: 'circle' })
    useStore.getState().addShape(shape)
    const scene = safeScene(useStore.getState())
    expect(scene.shapes).toHaveLength(1)
    expect(scene.shapes[0].id).toBe('s1')
    expect(scene.shapes[0].kind).toBe('circle')
  })

  it('adds multiple shapes', () => {
    useStore.getState().addShape(makeShape({ id: 's1' }))
    useStore.getState().addShape(makeShape({ id: 's2' }))
    const scene = safeScene(useStore.getState())
    expect(scene.shapes).toHaveLength(2)
  })

  it('preserves existing shapes when adding new ones', () => {
    useStore.getState().addShape(makeShape({ id: 's1' }))
    useStore.getState().addShape(makeShape({ id: 's2' }))
    const scene = safeScene(useStore.getState())
    expect(scene.shapes.map((s) => s.id)).toEqual(['s1', 's2'])
  })
})

describe('updateShape', () => {
  it('updates a shape by id', () => {
    useStore.getState().addShape(makeShape({ id: 's1', color: '#ff0000' }))
    useStore.getState().updateShape('s1', { color: '#00ff00', opacity: 50 })
    const scene = safeScene(useStore.getState())
    expect(scene.shapes[0].color).toBe('#00ff00')
    expect(scene.shapes[0].opacity).toBe(50)
  })

  it('does not affect other shapes', () => {
    useStore.getState().addShape(makeShape({ id: 's1', color: '#ff0000' }))
    useStore.getState().addShape(makeShape({ id: 's2', color: '#0000ff' }))
    useStore.getState().updateShape('s1', { color: '#00ff00' })
    const scene = safeScene(useStore.getState())
    expect(scene.shapes[1].color).toBe('#0000ff')
  })

  it('updates position and size', () => {
    useStore.getState().addShape(makeShape({ id: 's1', x: 100, y: 100, width: 120, height: 120 }))
    useStore.getState().updateShape('s1', { x: 300, y: 400, width: 200, height: 150 })
    const scene = safeScene(useStore.getState())
    expect(scene.shapes[0].x).toBe(300)
    expect(scene.shapes[0].y).toBe(400)
    expect(scene.shapes[0].width).toBe(200)
    expect(scene.shapes[0].height).toBe(150)
  })

  it('updates shape-specific properties', () => {
    useStore.getState().addShape(makeShape({ id: 's1', kind: 'rectangle' }))
    useStore.getState().updateShape('s1', { cornerRadius: 12, blur: 5 })
    const scene = safeScene(useStore.getState())
    expect(scene.shapes[0].cornerRadius).toBe(12)
    expect(scene.shapes[0].blur).toBe(5)
  })
})

describe('removeShape', () => {
  it('removes a shape by id', () => {
    useStore.getState().addShape(makeShape({ id: 's1' }))
    useStore.getState().addShape(makeShape({ id: 's2' }))
    useStore.getState().removeShape('s1')
    const scene = safeScene(useStore.getState())
    expect(scene.shapes).toHaveLength(1)
    expect(scene.shapes[0].id).toBe('s2')
  })

  it('removing non-existent id does nothing', () => {
    useStore.getState().addShape(makeShape({ id: 's1' }))
    useStore.getState().removeShape('nonexistent')
    const scene = safeScene(useStore.getState())
    expect(scene.shapes).toHaveLength(1)
  })

  it('removes from empty shapes array safely', () => {
    useStore.getState().removeShape('any')
    const scene = safeScene(useStore.getState())
    expect(scene.shapes).toHaveLength(0)
  })
})

describe('shape integration with selectionSlice', () => {
  it('selectAll includes shapes', () => {
    useStore.getState().addShape(makeShape({ id: 's1' }))
    useStore.getState().addShape(makeShape({ id: 's2' }))
    useStore.getState().selectAll()
    expect(useStore.getState().selectedIds).toContain('s1')
    expect(useStore.getState().selectedIds).toContain('s2')
  })

  it('deleteSelected removes shapes', () => {
    useStore.getState().addShape(makeShape({ id: 's1' }))
    useStore.getState().addShape(makeShape({ id: 's2' }))
    useStore.getState().deleteSelected(['s1', 's2'])
    const scene = safeScene(useStore.getState())
    expect(scene.shapes).toHaveLength(0)
  })

  it('duplicateSelected duplicates shapes', () => {
    useStore.getState().addShape(makeShape({ id: 's1' }))
    const newIds = useStore.getState().duplicateSelected(['s1'])
    expect(newIds).toHaveLength(1)
    expect(newIds[0]).not.toBe('s1')
    const scene = safeScene(useStore.getState())
    expect(scene.shapes).toHaveLength(2)
    // Duplicate should be offset
    const original = scene.shapes.find((s) => s.id === 's1')
    const dupe = scene.shapes.find((s) => s.id === newIds[0])
    expect(dupe!.x).toBe(original!.x + 30)
    expect(dupe!.y).toBe(original!.y + 30)
  })

  it('findElementKind returns shape for shape ids', () => {
    useStore.getState().addShape(makeShape({ id: 's1' }))
    expect(useStore.getState().findElementKind('s1')).toBe('shape')
  })
})

describe('updateShape with backgroundImage', () => {
  it('updates backgroundImage on a shape', () => {
    useStore.getState().addShape(makeShape({ id: 's1' }))
    useStore.getState().updateShape('s1', { backgroundImage: 'data:image/png;base64,abc' })
    const scene = safeScene(useStore.getState())
    expect(scene.shapes[0].backgroundImage).toBe('data:image/png;base64,abc')
  })

  it('clears backgroundImage by setting to null', () => {
    useStore.getState().addShape(makeShape({ id: 's1', backgroundImage: 'data:image/png;base64,xyz' }))
    useStore.getState().updateShape('s1', { backgroundImage: null })
    const scene = safeScene(useStore.getState())
    expect(scene.shapes[0].backgroundImage).toBeNull()
  })
})

describe('shape in selectionSlice alignSelected', () => {
  it('alignSelected works on shapes', () => {
    useStore.getState().addShape(makeShape({ id: 's1', x: 0, y: 0, width: 100, height: 50 }))
    useStore.getState().addShape(makeShape({ id: 's2', x: 200, y: 100, width: 80, height: 60 }))
    useStore.getState().select('s1', true)
    useStore.getState().select('s2', true)
    useStore.getState().alignSelected('left')
    const scene = safeScene(useStore.getState())
    const s2 = scene.shapes.find((s) => s.id === 's2')!
    expect(s2.x).toBe(0)
  })

  it('alignSelected center-y works on shapes', () => {
    useStore.getState().addShape(makeShape({ id: 's1', x: 0, y: 0, width: 100, height: 50 }))
    useStore.getState().addShape(makeShape({ id: 's2', x: 200, y: 100, width: 80, height: 60 }))
    useStore.getState().select('s1', true)
    useStore.getState().select('s2', true)
    useStore.getState().alignSelected('center-y')
    const scene = safeScene(useStore.getState())
    const s1 = scene.shapes.find((s) => s.id === 's1')!
    const s2 = scene.shapes.find((s) => s.id === 's2')!
    // bounding box: minY=0, maxY=160, centerY=80
    // s1 height=50 -> y = 80-25 = 55
    // s2 height=60 -> y = 80-30 = 50
    expect(s1.y).toBe(55)
    expect(s2.y).toBe(50)
  })
})

describe('shape z-order operations', () => {
  it('bringToFront works for shapes', () => {
    useStore.getState().addShape(makeShape({ id: 's1', zIndex: 1 }))
    useStore.getState().addShape(makeShape({ id: 's2', zIndex: 2 }))
    useStore.getState().bringToFront('s1')
    const scene = safeScene(useStore.getState())
    const s1 = scene.shapes.find((s) => s.id === 's1')
    expect(s1!.zIndex).toBeGreaterThan(2)
  })

  it('sendToBack works for shapes', () => {
    useStore.getState().addShape(makeShape({ id: 's1', zIndex: 1 }))
    useStore.getState().addShape(makeShape({ id: 's2', zIndex: 2 }))
    useStore.getState().sendToBack('s2')
    const scene = safeScene(useStore.getState())
    const s2 = scene.shapes.find((s) => s.id === 's2')
    expect(s2!.zIndex).toBeLessThan(1)
  })
})
