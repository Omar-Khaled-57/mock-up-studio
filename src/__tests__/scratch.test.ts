import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import { buildFocusDimPunch } from '../renderer/services/mask-visualization'

describe('scratch', () => {
  it('emit union clip for probe', () => {
    const clip = buildFocusDimPunch(400, 400, [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 50, width: 100, height: 100 }
    ])
    fs.writeFileSync('C:/Users/hp/AppData/Local/Temp/opencode/union-clip.txt', clip)
    expect(clip).toBeTruthy()
  })
})
