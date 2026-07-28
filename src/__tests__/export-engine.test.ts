import { describe, it, expect } from 'vitest'
import { getMimeType, getExtension, getExportFilename } from '../renderer/lib/export-engine'

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
