import { describe, it, expect, beforeEach, vi } from 'vitest'

const { capture } = vi.hoisted(() => ({ capture: { node: null as HTMLElement | null } }))

vi.mock('modern-screenshot', () => ({
  domToBlob: async (node: HTMLElement) => {
    capture.node = node
    return new Blob(['png'], { type: 'image/png' })
  }
}))

import { getMimeType, getExtension, getExportFilename, exportScene } from '../renderer/lib/export-engine'

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
