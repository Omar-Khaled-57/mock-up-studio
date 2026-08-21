import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractDominantColors,
  extractVibrantColors
} from '../renderer/lib/color-extraction'

function makeImageData(w: number, h: number, fill: [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = fill[0]
    data[i * 4 + 1] = fill[1]
    data[i * 4 + 2] = fill[2]
    data[i * 4 + 3] = 255
  }
  return new ImageData(data, w, h)
}

function setupSuccessMocks(imageData: ImageData) {
  const fakeCtx = {
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue(imageData)
  }
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(fakeCtx)
  }

  // Spy on createElement to return our fake canvas for 'canvas' tag
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return fakeCanvas as unknown as HTMLCanvasElement
    return document.createElement(tag)
  })

  // Stub Image so onload fires on src set
  class MockSuccessImage {
    crossOrigin = ''
    _onload: (() => void) | null = null
    _onerror: (() => void) | null = null
    set onload(fn: (() => void) | null) { this._onload = fn }
    get onload() { return this._onload }
    set onerror(fn: (() => void) | null) { this._onerror = fn }
    get onerror() { return this._onerror }
    set src(_val: string) {
      queueMicrotask(() => { this._onload?.() })
    }
    get src() { return '' }
  }
  vi.stubGlobal('Image', MockSuccessImage)

  return { fakeCanvas, fakeCtx }
}

function setupErrorMocks() {
  class MockErrorImage {
    crossOrigin = ''
    _onload: (() => void) | null = null
    _onerror: (() => void) | null = null
    set onload(fn: (() => void) | null) { this._onload = fn }
    get onload() { return this._onload }
    set onerror(fn: (() => void) | null) { this._onerror = fn }
    get onerror() { return this._onerror }
    set src(_val: string) {
      queueMicrotask(() => { this._onerror?.() })
    }
    get src() { return '' }
  }
  vi.stubGlobal('Image', MockErrorImage)
}

describe('color-extraction', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('extractDominantColors', () => {
    it('returns dominant colors from a solid-color image', async () => {
      const red = makeImageData(64, 64, [255, 0, 0])
      setupSuccessMocks(red)

      const colors = await extractDominantColors('data:image/png;base64,red')
      expect(colors).toHaveLength(5)
      // 16-bucket quantization: 255 → bucket 240 (#f00000)
      expect(colors[0]).toBe('#f00000')
    })

    it('returns indigo fallback palette on image load failure', async () => {
      setupErrorMocks()

      const colors = await extractDominantColors('bad-url')
      expect(colors).toEqual(['#1e1b4b', '#312e81', '#4338ca', '#6366f1', '#818cf8'])
    })

    it('pads with repeated colors when fewer than count found', async () => {
      const solid = makeImageData(64, 64, [128, 128, 128])
      setupSuccessMocks(solid)

      const colors = await extractDominantColors('data:image/png;base64,solid', 8)
      expect(colors).toHaveLength(8)
      expect(colors[0]).toBe(colors[7])
    })
  })

  describe('extractVibrantColors', () => {
    it('returns 5 colors from a solid-color image', async () => {
      const blue = makeImageData(64, 64, [0, 0, 255])
      setupSuccessMocks(blue)

      const colors = await extractVibrantColors('data:image/png;base64,blue')
      expect(colors).toHaveLength(5)
      // 32-bucket quantization: 255 → bucket 248 (#0000f8)
      expect(colors[0]).toMatch(/^#0000/)
    })

    it('returns indigo fallback on load failure', async () => {
      setupErrorMocks()

      const colors = await extractVibrantColors('bad-url')
      expect(colors).toEqual(['#1e1b4b', '#312e81', '#4338ca', '#6366f1', '#818cf8'])
    })
  })
})
