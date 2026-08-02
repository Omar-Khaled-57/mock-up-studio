import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Mask } from '../shared/types'

const { capture } = vi.hoisted(() => {
  const fakeCtx = {
    _calls: [] as { op: string; x?: number; y?: number; gco?: string; fillRule?: string }[],
    save() {
      this._calls.push({ op: 'save' })
    },
    restore() {
      this._calls.push({ op: 'restore' })
    },
    beginPath() {
      this._calls.push({ op: 'beginPath' })
    },
    closePath() {
      this._calls.push({ op: 'closePath' })
    },
    moveTo(x: number, y: number) {
      this._calls.push({ op: 'moveTo', x, y })
    },
    lineTo(x: number, y: number) {
      this._calls.push({ op: 'lineTo', x, y })
    },
    fill(fillRule?: string) {
      this._calls.push({ op: 'fill', fillRule })
    },
    fillRect() {
      this._calls.push({ op: 'fillRect' })
    },
    drawImage() {
      this._calls.push({ op: 'drawImage' })
    },
    set globalCompositeOperation(v: string) {
      this._calls.push({ op: 'gco', gco: v })
    },
    get globalCompositeOperation() {
      return 'source-over'
    },
    set fillStyle(_v: string) {
      this._calls.push({ op: 'fillStyle' })
    }
  }
  return {
    capture: {
      node: null as HTMLElement | null,
      scale: 1 as number,
      fakeCtx
    }
  }
})

vi.mock('modern-screenshot', () => ({
  domToCanvas: async (node: HTMLElement, options: { scale?: number } = {}) => {
    capture.node = node
    capture.scale = options.scale ?? 1
    const canvas = document.createElement('canvas')
    canvas.width = 1280 * (options.scale ?? 1)
    canvas.height = 720 * (options.scale ?? 1)
    canvas.getContext = () => capture.fakeCtx as unknown as CanvasRenderingContext2D
    canvas.toBlob = (cb: BlobCallback) => cb(new Blob(['png'], { type: 'image/png' }))
    return canvas
  }
}))

import { getMimeType, getExtension, getExportFilename, exportScene, punchSceneMaskHoles } from '../renderer/lib/export-engine'

function rectMask(partial: Partial<Mask> & { x: number; y: number; width: number; height: number }): Mask {
  return { id: 'm1', targetId: '__background__', shape: 'rectangle', inverted: true, holes: [], ...partial }
}

describe('getMimeType', () => {
  it('returns correct MIME types', () => {
    expect(getMimeType('png')).toBe('image/png')
    expect(getMimeType('jpeg')).toBe('image/jpeg')
    expect(getMimeType('webp')).toBe('image/webp')
  })
})

describe('getExtension', () => {
  it('returns correct extensions', () => {
    expect(getExtension('png')).toBe('png')
    expect(getExtension('jpeg')).toBe('jpg')
    expect(getExtension('webp')).toBe('webp')
  })
})

describe('getExportFilename', () => {
  it('generates filename with correct extension', () => {
    const name = getExportFilename('png')
    expect(name).toMatch(/\.png$/)
  })

  it('generates filename with timestamp format', () => {
    const name = getExportFilename('jpeg')
    expect(name).toMatch(/^mockup-export-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.jpg$/)
  })
})

describe('exportScene clone sanitization', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    capture.node = null
    capture.fakeCtx._calls.length = 0
  })

  it('strips watermark and guide chrome from the export clone', async () => {
    document.body.innerHTML = `
      <div data-scene-export>
        <div class="content">real content</div>
        <div data-guide="true" style="position:absolute">guide</div>
        <div data-watermark style="position:absolute">watermark</div>
      </div>
    `
    const blob = await exportScene({ format: 'png', scale: 2, background: 'scene', backgroundColor: '#ffffff', quality: 90 })

    expect(blob).not.toBeNull()
    expect(capture.node?.querySelector('[data-guide]')).toBeNull()
    expect(capture.node?.querySelector('[data-watermark]')).toBeNull()
    expect(capture.node?.querySelector('.content')).not.toBeNull()
  })

  it('returns null when the scene node is missing', async () => {
    document.body.innerHTML = '<div>no scene</div>'
    const blob = await exportScene({ format: 'png', scale: 2, background: 'scene', backgroundColor: '#ffffff', quality: 90 })
    expect(blob).toBeNull()
  })

  it('keeps the scene background layer for scene background exports', async () => {
    document.body.innerHTML = `
      <div data-scene-export>
        <div data-scene-background><div>scene bg</div></div>
        <div class="content">real content</div>
      </div>
    `
    await exportScene({ format: 'png', scale: 2, background: 'scene', backgroundColor: '#ffffff', quality: 90 })

    expect(capture.node?.querySelector('[data-scene-background]')).not.toBeNull()
  })

  it('removes the scene background layer and applies the override color for solid exports', async () => {
    document.body.innerHTML = `
      <div data-scene-export>
        <div data-scene-background><div>scene bg</div></div>
        <div class="content">real content</div>
      </div>
    `
    await exportScene({ format: 'png', scale: 2, background: 'solid', backgroundColor: '#ff0000', quality: 90 })

    expect(capture.node?.querySelector('[data-scene-background]')).toBeNull()
    expect(capture.node?.style.background).toBe('rgb(255, 0, 0)')
  })

  it('removes the scene background layer and clears the background for transparent exports', async () => {
    document.body.innerHTML = `
      <div data-scene-export>
        <div data-scene-background><div>scene bg</div></div>
        <div class="content">real content</div>
      </div>
    `
    await exportScene({ format: 'png', scale: 2, background: 'transparent', backgroundColor: '#ffffff', quality: 90 })

    expect(capture.node?.querySelector('[data-scene-background]')).toBeNull()
    expect(capture.node?.style.background).toBe('transparent')
  })
})

describe('punchSceneMaskHoles', () => {
  const ctx = capture.fakeCtx as unknown as CanvasRenderingContext2D

  beforeEach(() => {
    capture.fakeCtx._calls.length = 0
  })

  it('no-ops without a context', () => {
    punchSceneMaskHoles(null, [rectMask({ x: 10, y: 10, width: 40, height: 30 })], 100, 100)
    expect(capture.fakeCtx._calls).toEqual([])
  })

  it('ignores masks that target elements, not the background', () => {
    punchSceneMaskHoles(
      ctx,
      [rectMask({ id: 'el', targetId: 'dev-1', x: 10, y: 10, width: 40, height: 30 })],
      100,
      100
    )
    expect(capture.fakeCtx._calls).toEqual([])
  })

  it('punches an inverted rectangle with destination-out + evenodd at scale', () => {
    punchSceneMaskHoles(ctx, [rectMask({ x: 10, y: 20, width: 40, height: 30 })], 100, 100, 2)

    const ops = capture.fakeCtx._calls
    expect(ops[0]).toEqual({ op: 'save' })
    expect(ops[1]).toEqual({ op: 'gco', gco: 'destination-out' })
    expect(ops[2]).toEqual({ op: 'beginPath' })
    // Inverted punch: only the shape ring, no box ring.
    expect(ops).toEqual(
      expect.arrayContaining([
        { op: 'moveTo', x: 20, y: 40 },
        { op: 'lineTo', x: 100, y: 40 },
        { op: 'lineTo', x: 100, y: 100 },
        { op: 'lineTo', x: 20, y: 100 },
        { op: 'closePath' }
      ])
    )
    expect(ops[ops.length - 2]).toEqual({ op: 'fill', fillRule: 'evenodd' })
    expect(ops[ops.length - 1]).toEqual({ op: 'restore' })
  })

  it('punches a non-inverted reveal as box minus shape', () => {
    punchSceneMaskHoles(ctx, [rectMask({ x: 30, y: 40, width: 20, height: 10, inverted: false })], 100, 100)

    const ops = capture.fakeCtx._calls
    expect(ops).toEqual(
      expect.arrayContaining([
        { op: 'moveTo', x: 0, y: 0 },
        { op: 'lineTo', x: 100, y: 0 },
        { op: 'lineTo', x: 100, y: 100 },
        { op: 'lineTo', x: 0, y: 100 },
        { op: 'moveTo', x: 30, y: 40 },
        { op: 'lineTo', x: 50, y: 40 },
        { op: 'lineTo', x: 50, y: 50 },
        { op: 'lineTo', x: 30, y: 50 }
      ])
    )
    expect(ops.filter((o) => o.op === 'fill').pop()?.fillRule).toBe('evenodd')
  })

  it('traces mask holes as additional rings in the same path', () => {
    const mask = rectMask({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      holes: [[{ x: 20, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 30 }, { x: 20, y: 30 }]]
    })
    punchSceneMaskHoles(ctx, [mask], 100, 100)

    const ops = capture.fakeCtx._calls
    expect(ops).toEqual(
      expect.arrayContaining([
        { op: 'moveTo', x: 20, y: 20 },
        { op: 'lineTo', x: 30, y: 20 },
        { op: 'lineTo', x: 30, y: 30 },
        { op: 'lineTo', x: 20, y: 30 }
      ])
    )
  })

  it('no-ops on a degenerate mask with no ring points', () => {
    punchSceneMaskHoles(
      ctx,
      [{ ...rectMask({ x: 0, y: 0, width: 10, height: 10 }), shape: 'freeform', points: [] }],
      100,
      100
    )
    expect(capture.fakeCtx._calls.filter((o) => o.op === 'beginPath' || o.op === 'fill')).toEqual([])
  })
})

describe('exportScene mask punch integration', () => {
  beforeEach(async () => {
    document.body.innerHTML = ''
    capture.node = null
    capture.fakeCtx._calls.length = 0
    const { resetStore } = await import('./helpers')
    resetStore()
  })

  it('punches the active scene background masks into the captured canvas', async () => {
    const { useStore } = await import('../renderer/store')
    const state = useStore.getState()
    state.addMask({
      id: 'bg-mask',
      targetId: '__background__',
      shape: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      inverted: true
    })

    document.body.innerHTML = `
      <div data-scene-export>
        <div data-scene-background><div>scene bg</div></div>
        <div data-element-id="dev-1">shape</div>
      </div>
    `

    const blob = await exportScene({ format: 'png', scale: 2, background: 'scene', backgroundColor: '#ffffff', quality: 90 })

    expect(blob).not.toBeNull()
    const ops = capture.fakeCtx._calls
    expect(ops).toEqual(
      expect.arrayContaining([
        { op: 'moveTo', x: 200, y: 200 },
        { op: 'lineTo', x: 600, y: 200 },
        { op: 'lineTo', x: 600, y: 500 },
        { op: 'lineTo', x: 200, y: 500 }
      ])
    )
    expect(ops.filter((o) => o.op === 'fill').pop()?.fillRule).toBe('evenodd')
  })

  it('fills behind the punch with the solid background color', async () => {
    document.body.innerHTML = `
      <div data-scene-export>
        <div data-scene-background><div>scene bg</div></div>
      </div>
    `

    const blob = await exportScene({ format: 'png', scale: 1, background: 'solid', backgroundColor: '#ff0000', quality: 90 })

    expect(blob).not.toBeNull()
    const ops = capture.fakeCtx._calls
    const gcoIdx = ops.findIndex((o) => o.op === 'gco' && o.gco === 'destination-over')
    const fillStyleIdx = ops.findIndex((o) => o.op === 'fillStyle')
    const fillRectIdx = ops.findIndex((o) => o.op === 'fillRect')
    expect(gcoIdx).toBeGreaterThanOrEqual(0)
    expect(fillStyleIdx).toBeGreaterThan(gcoIdx)
    expect(fillRectIdx).toBeGreaterThan(fillStyleIdx)
  })

  it('composites the scene background beneath the punch in scene exports', async () => {
    const { useStore } = await import('../renderer/store')
    const state = useStore.getState()
    state.addMask({
      id: 'bg-mask',
      targetId: '__background__',
      shape: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      inverted: true
    })

    document.body.innerHTML = `
      <div data-scene-export>
        <div data-scene-background><div>scene bg</div></div>
        <div data-element-id="dev-1">shape</div>
      </div>
    `

    const blob = await exportScene({ format: 'png', scale: 1, background: 'scene', backgroundColor: '#ffffff', quality: 90 })

    expect(blob).not.toBeNull()
    const ops = capture.fakeCtx._calls
    const punchIdx = ops.findIndex((o) => o.op === 'gco' && o.gco === 'destination-out')
    const overIdx = ops.findIndex((o) => o.op === 'gco' && o.gco === 'destination-over')
    const drawIdx = ops.findIndex((o) => o.op === 'drawImage')
    expect(punchIdx).toBeGreaterThanOrEqual(0)
    expect(overIdx).toBeGreaterThan(punchIdx)
    expect(drawIdx).toBeGreaterThan(overIdx)
  })

  it('skips the background composite when the scene has no background masks', async () => {
    document.body.innerHTML = `
      <div data-scene-export>
        <div data-scene-background><div>scene bg</div></div>
        <div class="content">content</div>
      </div>
    `

    const blob = await exportScene({ format: 'png', scale: 1, background: 'scene', backgroundColor: '#ffffff', quality: 90 })

    expect(blob).not.toBeNull()
    expect(capture.fakeCtx._calls.some((o) => o.op === 'drawImage')).toBe(false)
  })

  it('skips the background composite when the scene lacks a background layer', async () => {
    const { useStore } = await import('../renderer/store')
    const state = useStore.getState()
    state.addMask({
      id: 'bg-mask',
      targetId: '__background__',
      shape: 'rectangle',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      inverted: true
    })

    document.body.innerHTML = `
      <div data-scene-export>
        <div class="content">content</div>
      </div>
    `

    const blob = await exportScene({ format: 'png', scale: 1, background: 'scene', backgroundColor: '#ffffff', quality: 90 })

    expect(blob).not.toBeNull()
    expect(capture.fakeCtx._calls.some((o) => o.op === 'drawImage')).toBe(false)
  })
})
