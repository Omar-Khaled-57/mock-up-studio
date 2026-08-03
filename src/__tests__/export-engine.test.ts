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
  return {
    id: 'm1',
    name: 'Mask 1',
    shape: 'rectangle',
    inverted: true,
    zIndex: 0,
    visible: true,
    locked: false,
    holes: [],
    ...partial
  }
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
  beforeEach(async () => {
    document.body.innerHTML = ''
    capture.node = null
    capture.fakeCtx._calls.length = 0
    const { resetStore } = await import('./helpers')
    resetStore()
  })

  it('strips guide chrome and injects no watermark when disabled', async () => {
    document.body.innerHTML = `
      <div data-scene-export>
        <div class="content">real content</div>
        <div data-guide="true" style="position:absolute">guide</div>
      </div>
    `
    const blob = await exportScene({ format: 'png', scale: 2, background: 'scene', backgroundColor: '#ffffff', quality: 90 })

    expect(blob).not.toBeNull()
    expect(capture.node?.querySelector('[data-guide]')).toBeNull()
    expect(capture.node?.querySelector('.content')).not.toBeNull()
    // Watermark off by default in the test store → nothing injected.
    expect(capture.node?.querySelector('[data-watermark]')).toBeNull()
  })

  it('injects the watermark into the export clone when enabled', async () => {
    const { useStore } = await import('../renderer/store')
    useStore.getState().setWatermark({ enabled: true, text: 'Mockup Studio', fontSize: 34, opacity: 60 })
    document.body.innerHTML = `
      <div data-scene-export>
        <div class="content">real content</div>
      </div>
    `
    const blob = await exportScene({ format: 'png', scale: 2, background: 'scene', backgroundColor: '#ffffff', quality: 90 })

    expect(blob).not.toBeNull()
    const wm = capture.node?.querySelector<HTMLElement>('[data-watermark]')
    expect(wm).not.toBeNull()
    expect(wm?.textContent).toBe('Mockup Studio')
    expect(wm?.style.fontSize).toBe('34px')
    expect(wm?.style.opacity).toBe('0.6')
    expect(wm?.style.position).toBe('absolute')
  })

  it('does not inject a watermark for an enabled-but-empty text setting', async () => {
    const { useStore } = await import('../renderer/store')
    useStore.getState().setWatermark({ enabled: true, text: '   ' })
    document.body.innerHTML = `
      <div data-scene-export>
        <div class="content">real content</div>
      </div>
    `
    await exportScene({ format: 'png', scale: 2, background: 'scene', backgroundColor: '#ffffff', quality: 90 })

    expect(capture.node?.querySelector('[data-watermark]')).toBeNull()
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

  it('strips the transparent-canvas checkerboard chrome from the export clone', async () => {
    document.body.innerHTML = `
      <div data-scene-export>
        <div data-transparent-checker style="position:absolute">checker</div>
        <div class="content">real content</div>
      </div>
    `
    const blob = await exportScene({ format: 'png', scale: 2, background: 'scene', backgroundColor: '#ffffff', quality: 90 })

    expect(blob).not.toBeNull()
    expect(capture.node?.querySelector('[data-transparent-checker]')).toBeNull()
    expect(capture.node?.querySelector('.content')).not.toBeNull()
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

  it('skips invisible masks', () => {
    punchSceneMaskHoles(
      ctx,
      [rectMask({ id: 'el', visible: false, x: 10, y: 10, width: 40, height: 30 })],
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
      [{ ...rectMask({ x: 0, y: 0, width: 10, height: 10 }), shape: 'brush', points: [] }],
      100,
      100
    )
    expect(capture.fakeCtx._calls.filter((o) => o.op === 'beginPath' || o.op === 'fill')).toEqual([])
  })
})

describe('exportScene mask punch integration', () => {
  const origCreateElement = document.createElement.bind(document)

  beforeEach(async () => {
    document.body.innerHTML = ''
    capture.node = null
    capture.fakeCtx._calls.length = 0
    // jsdom has no 2d context, so route every canvas exportScene creates (band
    // captures, the composite output canvas, frozen snapshot layers) through
    // the recorded fake ctx and a resolving toBlob — otherwise the bottom-up
    // compositing is unobservable and encode() would hang on the unimplemented
    // jsdom toBlob.
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
      if (tag === 'canvas') {
        const el = origCreateElement('canvas') as HTMLCanvasElement
        el.getContext = () => capture.fakeCtx as unknown as CanvasRenderingContext2D
        el.toBlob = (cb: BlobCallback) => cb(new Blob(['png'], { type: 'image/png' }))
        return el
      }
      return origCreateElement(tag, options)
    })
    const { resetStore } = await import('./helpers')
    resetStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const addMasks = async (masks: Mask[]) => {
    const { useStore } = await import('../renderer/store')
    for (const m of masks) useStore.getState().addMask(m)
  }

  it('punches each band by exactly the masks below it (z-aware)', async () => {
    await addMasks([
      rectMask({ id: 'low', name: 'Low', x: 100, y: 100, width: 200, height: 150, zIndex: 0 }),
      rectMask({ id: 'high', name: 'High', x: 500, y: 500, width: 100, height: 100, zIndex: 5 })
    ])

    document.body.innerHTML = `
      <div data-scene-export>
        <div data-scene-band="0"><div data-scene-background><div>scene bg</div></div></div>
        <div data-scene-band="1"><div data-element-id="dev-1">shape</div></div>
        <div data-scene-band="2"><div data-element-id="dev-2">top</div></div>
      </div>
    `

    const blob = await exportScene({ format: 'png', scale: 1, background: 'scene', backgroundColor: '#ffffff', quality: 90 })

    expect(blob).not.toBeNull()
    const ops = capture.fakeCtx._calls
    // Band 0 (background + content strictly below the lowest mask z) is never
    // punched; band 1 is punched by the low mask only; band 2 by both. That is
    // two punch passes with both rings traced at least once.
    expect(ops.filter((o) => o.op === 'save')).toHaveLength(2)
    expect(ops.some((o) => o.op === 'moveTo' && o.x === 100 && o.y === 100)).toBe(true)
    expect(ops.some((o) => o.op === 'moveTo' && o.x === 500 && o.y === 500)).toBe(true)
    expect(ops.filter((o) => o.op === 'fill').pop()?.fillRule).toBe('evenodd')
  })

  it('composites bands bottom-up, each punched before the next draws over it', async () => {
    await addMasks([
      rectMask({ id: 'low', name: 'Low', x: 100, y: 100, width: 200, height: 150, zIndex: 0 }),
      rectMask({ id: 'high', name: 'High', x: 500, y: 500, width: 100, height: 100, zIndex: 5 })
    ])

    document.body.innerHTML = `
      <div data-scene-export>
        <div data-scene-band="0"><div data-scene-background><div>scene bg</div></div></div>
        <div data-scene-band="1"><div data-element-id="dev-1">shape</div></div>
        <div data-scene-band="2"><div data-element-id="dev-2">top</div></div>
      </div>
    `

    const blob = await exportScene({ format: 'png', scale: 1, background: 'scene', backgroundColor: '#ffffff', quality: 90 })
    expect(blob).not.toBeNull()

    const ops = capture.fakeCtx._calls
    const drawIdx = ops.map((o, i) => (o.op === 'drawImage' ? i : -1)).filter((i) => i >= 0)
    const punchIdx = ops.map((o, i) => (o.op === 'gco' && o.gco === 'destination-out' ? i : -1)).filter((i) => i >= 0)
    // draw(band0) → punch(band1) → draw(band1) → punch(band2) → draw(band2)
    expect(drawIdx).toHaveLength(3)
    expect(punchIdx).toHaveLength(2)
    expect(drawIdx[0]).toBeLessThan(punchIdx[0])
    expect(drawIdx[0]).toBeLessThan(drawIdx[1])
    expect(punchIdx[0]).toBeLessThan(drawIdx[1])
    expect(punchIdx[1]).toBeLessThan(drawIdx[2])
    // The background is band-0 content now — there is no separate
    // destination-over background pass in scene exports.
    expect(ops.some((o) => o.op === 'gco' && o.gco === 'destination-over')).toBe(false)
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

  it('exports a masked scene that lacks a background layer (band 0 is unclipped)', async () => {
    await addMasks([
      rectMask({ id: 'low', name: 'Low', x: 0, y: 0, width: 50, height: 50, zIndex: 0 })
    ])

    document.body.innerHTML = `
      <div data-scene-export>
        <div data-scene-band="0"><div class="content">content</div></div>
        <div data-scene-band="1"><div data-element-id="dev-1">shape</div></div>
      </div>
    `

    const blob = await exportScene({ format: 'png', scale: 1, background: 'scene', backgroundColor: '#ffffff', quality: 90 })

    expect(blob).not.toBeNull()
    const ops = capture.fakeCtx._calls
    // Band 0 is captured and composited unpunched; band 1 gets the one punch.
    expect(ops.filter((o) => o.op === 'drawImage')).toHaveLength(2)
    expect(ops.filter((o) => o.op === 'save')).toHaveLength(1)
  })

  it('composites the watermark as its own layer on masked exports when enabled', async () => {
    const { useStore } = await import('../renderer/store')
    useStore.getState().setWatermark({ enabled: true, text: 'Mockup Studio', fontSize: 34, opacity: 60 })
    await addMasks([rectMask({ id: 'low', name: 'Low', x: 0, y: 0, width: 50, height: 50, zIndex: 0 })])
    document.body.innerHTML = `
      <div data-scene-export>
        <div data-scene-band="0"><div data-scene-background><div>scene bg</div></div></div>
        <div data-scene-band="1"><div data-element-id="dev-1">shape</div></div>
      </div>
    `

    const blob = await exportScene({ format: 'png', scale: 1, background: 'scene', backgroundColor: '#ffffff', quality: 90 })
    expect(blob).not.toBeNull()

    const ops = capture.fakeCtx._calls
    // band 0, band 1, then the injected watermark layer — one extra drawImage.
    expect(ops.filter((o) => o.op === 'drawImage')).toHaveLength(3)
    // The last capture was the watermark node itself.
    expect(capture.node?.querySelector('[data-watermark]')).not.toBeNull()
  })

  it('paints frozen-mask snapshots back over their punched hole', async () => {
    await addMasks([
      rectMask({
        id: 'frozen',
        name: 'Frozen',
        x: 50,
        y: 50,
        width: 120,
        height: 90,
        zIndex: 0,
        snapshot: {
          dataUrl: 'data:image/png;base64,AA==',
          width: 400,
          height: 300,
          sourceBounds: { x: 0, y: 0, width: 400, height: 300 },
          capturedAt: 1
        }
      })
    ])

    document.body.innerHTML = `
      <div data-scene-export>
        <div data-scene-band="0"><div data-scene-background><div>scene bg</div></div></div>
        <div data-mask-snapshot-for="frozen"><img alt="snapshot" /></div>
      </div>
    `

    const blob = await exportScene({ format: 'png', scale: 1, background: 'scene', backgroundColor: '#ffffff', quality: 90 })

    expect(blob).not.toBeNull()
    const ops = capture.fakeCtx._calls
    // band 0 drawn, then the frozen mask punched out of the output canvas and
    // its snapshot layer punched + drawn back over the hole
    expect(ops.filter((o) => o.op === 'drawImage')).toHaveLength(2)
    expect(ops.filter((o) => o.op === 'gco' && o.gco === 'destination-out')).toHaveLength(2)
  })
})
