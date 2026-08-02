/**
 * transform tests — drag and resize sessions (DOM-free services).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createDragSession, createResizeSession } from '../renderer/services/transform'

function makeEl(): HTMLElement {
  return document.createElement('div')
}

describe('drag session', () => {
  it('mutates styles during move and commits final position on end', () => {
    const el = makeEl()
    const onDrag = vi.fn()
    const onEnd = vi.fn()
    const session = createDragSession({
      zoom: 1,
      element: { id: 'a', x: 10, y: 20, width: 100, height: 50 },
      el,
      onDrag,
      onEnd
    })
    session.begin({ clientX: 0, clientY: 0 })
    session.move({ clientX: 30, clientY: 40 })
    expect(el.style.left).toBe('40px')
    expect(el.style.top).toBe('60px')
    session.end({ clientX: 30, clientY: 40 })
    expect(onEnd).toHaveBeenCalledWith('a')
    expect(onDrag).toHaveBeenCalledWith('a', 40, 60)
  })

  it('pushes history (onEnd) before committing (onDrag)', () => {
    const order: string[] = []
    const el = makeEl()
    const session = createDragSession({
      zoom: 1,
      element: { id: 'a', x: 0, y: 0, width: 10, height: 10 },
      el,
      onDrag: () => order.push('commit'),
      onEnd: () => order.push('history')
    })
    session.begin({ clientX: 0, clientY: 0 })
    session.end({ clientX: 5, clientY: 5 })
    expect(order).toEqual(['history', 'commit'])
  })

  it('divides pointer delta by zoom', () => {
    const el = makeEl()
    const session = createDragSession({
      zoom: 2,
      element: { id: 'a', x: 0, y: 0, width: 10, height: 10 },
      el,
      onDrag: () => {},
      onEnd: () => {}
    })
    session.begin({ clientX: 0, clientY: 0 })
    session.move({ clientX: 40, clientY: 0 })
    expect(el.style.left).toBe('20px')
  })

  it('applies snapFn on move and end', () => {
    const el = makeEl()
    const snapFn = vi.fn((_id: string, x: number, y: number) => ({
      x: Math.round(x / 10) * 10,
      y: Math.round(y / 10) * 10
    }))
    const session = createDragSession({
      zoom: 1,
      element: { id: 'a', x: 0, y: 0, width: 10, height: 10 },
      el,
      snapFn,
      onDrag: vi.fn(),
      onEnd: vi.fn()
    })
    session.begin({ clientX: 0, clientY: 0 })
    session.move({ clientX: 17, clientY: 23 })
    expect(el.style.left).toBe('20px')
    expect(el.style.top).toBe('20px')
  })

  it('moves followers by the raw delta without snap', () => {
    const el = makeEl()
    const fEl = makeEl()
    const commit = vi.fn()
    const onDrag = vi.fn()
    const session = createDragSession({
      zoom: 1,
      element: { id: 'a', x: 10, y: 10, width: 10, height: 10 },
      el,
      onDrag,
      onEnd: vi.fn(),
      getMultiDrag: () => [{ id: 'b', startElemX: 100, startElemY: 200, el: fEl, commit }]
    })
    session.begin({ clientX: 0, clientY: 0 })
    session.move({ clientX: 30, clientY: 40 })
    expect(fEl.style.left).toBe('130px')
    expect(fEl.style.top).toBe('240px')
    session.end({ clientX: 30, clientY: 40 })
    expect(commit).toHaveBeenCalledWith('b', 130, 240)
    expect(onDrag).toHaveBeenCalledWith('a', 40, 50)
  })

  it('commits followers with the snapped delta when snap is active', () => {
    const el = makeEl()
    const fEl = makeEl()
    const commit = vi.fn()
    const session = createDragSession({
      zoom: 1,
      element: { id: 'a', x: 10, y: 10, width: 10, height: 10 },
      el,
      snapFn: (_id, x, y) => ({ x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 }),
      onDrag: vi.fn(),
      onEnd: vi.fn(),
      getMultiDrag: () => [{ id: 'b', startElemX: 100, startElemY: 200, el: fEl, commit }]
    })
    session.begin({ clientX: 0, clientY: 0 })
    session.move({ clientX: 14, clientY: 6 })
    session.end({ clientX: 14, clientY: 6 })
    expect(commit).toHaveBeenCalledWith('b', 110, 210)
  })

  it('clears guides on end', () => {
    const el = makeEl()
    const onGuidesChange = vi.fn()
    const session = createDragSession({
      zoom: 1,
      element: { id: 'a', x: 0, y: 0, width: 10, height: 10 },
      el,
      onDrag: vi.fn(),
      onEnd: vi.fn(),
      onGuidesChange
    })
    session.begin({ clientX: 0, clientY: 0 })
    session.end({ clientX: 5, clientY: 5 })
    expect(onGuidesChange).toHaveBeenCalledWith({ verticalGuides: [], horizontalGuides: [] })
  })

  it('emits the target bounds via onPreview during move (ghost)', () => {
    const el = makeEl()
    const onPreview = vi.fn()
    const session = createDragSession({
      zoom: 2,
      element: { id: 'a', x: 10, y: 20, width: 100, height: 50, rotation: 45 },
      el,
      onDrag: vi.fn(),
      onEnd: vi.fn(),
      onPreview
    })
    session.begin({ clientX: 0, clientY: 0 })
    session.move({ clientX: 40, clientY: 20 })
    expect(onPreview).toHaveBeenCalledWith('a', 30, 30, 100, 50, 45)
  })

  it('cancel reverts the element and followers and clears guides', () => {
    const el = makeEl()
    const fEl = makeEl()
    const commit = vi.fn()
    const onGuidesChange = vi.fn()
    const onDrag = vi.fn()
    const session = createDragSession({
      zoom: 1,
      element: { id: 'a', x: 10, y: 20, width: 10, height: 10 },
      el,
      onDrag,
      onEnd: vi.fn(),
      onGuidesChange,
      getMultiDrag: () => [{ id: 'b', startElemX: 100, startElemY: 200, el: fEl, commit }]
    })
    session.begin({ clientX: 0, clientY: 0 })
    session.move({ clientX: 30, clientY: 40 })
    session.cancel()
    expect(el.style.left).toBe('10px')
    expect(el.style.top).toBe('20px')
    expect(fEl.style.left).toBe('100px')
    expect(fEl.style.top).toBe('200px')
    expect(onGuidesChange).toHaveBeenCalledWith({ verticalGuides: [], horizontalGuides: [] })
    expect(onDrag).not.toHaveBeenCalled()
  })

  it('ignores moves after end', () => {
    const el = makeEl()
    const onDrag = vi.fn()
    const session = createDragSession({
      zoom: 1,
      element: { id: 'a', x: 0, y: 0, width: 10, height: 10 },
      el,
      onDrag,
      onEnd: vi.fn()
    })
    session.begin({ clientX: 0, clientY: 0 })
    session.end({ clientX: 5, clientY: 5 })
    session.move({ clientX: 100, clientY: 100 })
    expect(onDrag).toHaveBeenCalledTimes(1)
    expect(el.style.left).toBe('5px')
  })
})

describe('resize session', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('updates styles during move and commits once on end', () => {
    const el = makeEl()
    const onResize = vi.fn()
    const onEnd = vi.fn()
    const session = createResizeSession({
      zoom: 1,
      element: { id: 'a', x: 10, y: 10, width: 100, height: 100 },
      el,
      onResize,
      onEnd
    })
    session.begin('se', { clientX: 0, clientY: 0 })
    session.move({ clientX: 50, clientY: 30 }, false)
    expect(el.style.width).toBe('150px')
    expect(el.style.height).toBe('130px')
    expect(el.style.left).toBe('10px')
    expect(el.style.top).toBe('10px')
    expect(onResize).not.toHaveBeenCalled()
    session.end({ clientX: 50, clientY: 30 }, false)
    expect(onEnd).toHaveBeenCalledWith('a')
    expect(onResize).toHaveBeenCalledWith('a', 10, 10, 150, 130)
    expect(el.style.cursor).toBe('')
  })

  it('pushes history (onEnd) before the final commit', () => {
    const order: string[] = []
    const session = createResizeSession({
      zoom: 1,
      element: { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      el: makeEl(),
      onResize: () => order.push('commit'),
      onEnd: () => order.push('history')
    })
    session.begin('se', { clientX: 0, clientY: 0 })
    session.end({ clientX: 10, clientY: 10 }, false)
    expect(order).toEqual(['history', 'commit'])
  })

  it('sets and clears the resize cursor on the element', () => {
    const el = makeEl()
    const session = createResizeSession({
      zoom: 1,
      element: { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      el,
      onResize: vi.fn(),
      onEnd: vi.fn()
    })
    session.begin('nw', { clientX: 0, clientY: 0 })
    expect(el.style.cursor).toBe('nwse-resize')
    session.end({ clientX: 5, clientY: 5 }, false)
    expect(el.style.cursor).toBe('')
  })

  it('preserves aspect ratio in proportional mode', () => {
    const el = makeEl()
    const onResize = vi.fn()
    const session = createResizeSession({
      zoom: 1,
      element: { id: 'a', x: 10, y: 10, width: 100, height: 50 },
      el,
      onResize,
      onEnd: vi.fn()
    })
    session.begin('se', { clientX: 0, clientY: 0 })
    session.move({ clientX: 40, clientY: 99 }, true)
    expect(el.style.width).toBe('140px')
    expect(el.style.height).toBe('70px')
  })

  it('keeps the element aspect ratio when lockAspectRatio is set (no shift needed)', () => {
    const el = makeEl()
    const onResize = vi.fn()
    const session = createResizeSession({
      zoom: 1,
      element: { id: 'a', x: 10, y: 10, width: 100, height: 50 },
      el,
      onResize,
      onEnd: vi.fn(),
      lockAspectRatio: true
    })
    session.begin('se', { clientX: 0, clientY: 0 })
    session.move({ clientX: 40, clientY: 99 }, false)
    expect(el.style.width).toBe('140px')
    expect(el.style.height).toBe('70px')
  })

  it('keeps the aspect locked even when shift is also pressed', () => {
    const el = makeEl()
    const session = createResizeSession({
      zoom: 1,
      element: { id: 'a', x: 10, y: 10, width: 100, height: 50 },
      el,
      onResize: vi.fn(),
      onEnd: vi.fn(),
      lockAspectRatio: true
    })
    session.begin('se', { clientX: 0, clientY: 0 })
    session.move({ clientX: 40, clientY: 99 }, true)
    expect(el.style.width).toBe('140px')
    expect(el.style.height).toBe('70px')
  })

  it('sw shrinks the left edge', () => {
    const el = makeEl()
    const session = createResizeSession({
      zoom: 1,
      element: { id: 'a', x: 10, y: 10, width: 100, height: 100 },
      el,
      onResize: vi.fn(),
      onEnd: vi.fn()
    })
    session.begin('sw', { clientX: 0, clientY: 0 })
    session.end({ clientX: 50, clientY: 0 }, false)
    expect(el.style.left).toBe('60px')
    expect(el.style.width).toBe('50px')
  })

  it('emits the resized target bounds via onPreview during move (ghost)', () => {
    const el = makeEl()
    const onPreview = vi.fn()
    const session = createResizeSession({
      zoom: 1,
      element: { id: 'a', x: 10, y: 10, width: 100, height: 100, rotation: 30 },
      el,
      onResize: vi.fn(),
      onEnd: vi.fn(),
      onPreview
    })
    session.begin('se', { clientX: 0, clientY: 0 })
    session.move({ clientX: 50, clientY: 30 }, false)
    expect(onPreview).toHaveBeenCalledWith('a', 10, 10, 150, 130, 30)
  })

  it('cancel reverts styles without committing to the store', () => {
    const el = makeEl()
    const onResize = vi.fn()
    const session = createResizeSession({
      zoom: 1,
      element: { id: 'a', x: 10, y: 10, width: 100, height: 100 },
      el,
      onResize,
      onEnd: vi.fn()
    })
    session.begin('se', { clientX: 0, clientY: 0 })
    session.move({ clientX: 50, clientY: 50 }, false)
    session.cancel()
    expect(el.style.left).toBe('10px')
    expect(el.style.top).toBe('10px')
    expect(el.style.width).toBe('100px')
    expect(el.style.height).toBe('100px')
    expect(el.style.cursor).toBe('')
    expect(onResize).not.toHaveBeenCalled()
  })
})
