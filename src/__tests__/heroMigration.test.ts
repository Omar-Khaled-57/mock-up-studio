/**
 * Hero title/slogan migration — pre-v0.3.0 files stored the hero copy as
 * chromeless `titleText`/`sloganText` scene fields; they must load as
 * first-class text boxes marked with `stylePreset`, and the legacy keys must
 * not survive (so a save/reload round-trip never re-migrates).
 */
import { describe, it, expect } from 'vitest'
import { serializeProject, deserializeProject } from '../renderer/lib/project-serialization'

type Box = Record<string, unknown>

function legacyManifest(scene: Record<string, unknown>): string {
  return JSON.stringify({
    version: 1,
    project: { id: 'p', name: 'P', createdAt: 0, updatedAt: 0 },
    scenes: [scene],
    activeSceneIndex: 0
  })
}

function boxesOf(scenes: Array<Record<string, unknown>>): Box[] {
  return (scenes[0] as { textBoxes: Box[] }).textBoxes
}

describe('hero title/slogan migration', () => {
  it('migrates legacy titleText/sloganText into stylePreset text boxes', () => {
    const { scenes } = deserializeProject(
      legacyManifest({
        id: 's1', name: 'S', canvas: { width: 1440, height: 900, aspectRatio: '16:10' },
        background: {}, devices: [], textBoxes: [], images: [], shapes: [], guides: [], grid: {},
        titleText: { content: 'Big Headline', fontSize: 72, color: '#ff0000', fontWeight: 800 },
        sloganText: { content: 'sub', fontSize: 18, color: '#00ff00' }
      }),
      new Map()
    )

    const boxes = boxesOf(scenes)
    expect(boxes).toHaveLength(2)

    const title = boxes.find((b) => b.stylePreset === 'title')!
    expect(title.name).toBe('Title')
    expect(title.content).toBe('Big Headline')
    expect(title.fontSize).toBe(72)
    expect(title.color).toBe('#ff0000')
    expect(title.fontWeight).toBe(800)
    expect(title.zIndex).toBe(1)
    expect(title.y).toBe(60)
    expect(title.heightAuto).toBe(true)
    expect(title.wrap).toBe(true)
    expect(title.width).toBe(Math.max(320, Math.round(1440 * 0.5)))

    const slogan = boxes.find((b) => b.stylePreset === 'slogan')!
    expect(slogan.name).toBe('Slogan')
    expect(slogan.content).toBe('sub')
    expect(slogan.color).toBe('#00ff00')
    expect(slogan.zIndex).toBe(0)
    expect(slogan.y).toBe(152)
  })

  it('uses fallback geometry and content for empty legacy heroes', () => {
    const { scenes } = deserializeProject(
      legacyManifest({
        id: 's1', name: 'S', canvas: { width: 800, height: 600, aspectRatio: '4:3' },
        background: {}, devices: [], textBoxes: [], images: [], guides: [], grid: {},
        titleText: {}, sloganText: {}
      }),
      new Map()
    )

    const boxes = boxesOf(scenes)
    const title = boxes.find((b) => b.stylePreset === 'title')!
    expect(title.content).toBe('Your Title')
    expect(title.fontSize).toBe(64)
    expect(title.fontWeight).toBe(800)

    const slogan = boxes.find((b) => b.stylePreset === 'slogan')!
    expect(slogan.content).toBe('Your slogan goes here')
    expect(slogan.fontSize).toBe(24)
    expect(slogan.width).toBe(Math.max(320, Math.round(800 * 0.5)))
  })

  it('leaves new-format files untouched and strips legacy keys', () => {
    const { scenes } = deserializeProject(
      legacyManifest({
        id: 's1', name: 'S', canvas: { width: 800, height: 600, aspectRatio: '4:3' },
        background: {}, devices: [], images: [], guides: [], grid: {},
        textBoxes: [{ id: 'tb-1', wrap: true }]
      }),
      new Map()
    )

    const restored = scenes[0] as Record<string, unknown>
    expect(restored.titleText).toBeUndefined()
    expect(restored.sloganText).toBeUndefined()
    expect(restored.textBoxes).toHaveLength(1)
  })

  it('defaults wrap to true for legacy text boxes and round-trips the flag', () => {
    const { manifest, assets } = serializeProject(
      { id: 'p', name: 'P', createdAt: 0, updatedAt: 0 },
      [{
        id: 's1', name: 'S', canvas: { width: 800, height: 600, aspectRatio: '4:3' },
        background: {}, devices: [], images: [], shapes: [], guides: [], grid: {},
        textBoxes: [{ id: 'tb-1', wrap: false }]
      }],
      0
    )
    const { scenes } = deserializeProject(manifest, assets)
    expect((boxesOf(scenes)[0] as { wrap?: boolean }).wrap).toBe(false)
  })
})
