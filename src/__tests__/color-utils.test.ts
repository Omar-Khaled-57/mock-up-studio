import { describe, expect, it } from 'vitest'
import { getOpacityPercentFromColor, getHexColorWithOpacity, parseHexOpacity } from '../renderer/lib/color-utils'

describe('color opacity utilities', () => {
  it('parses the alpha channel from an 8-digit hex color', () => {
    expect(parseHexOpacity('#11223344')).toBe(68 / 255)
  })

  it('defaults to full opacity when a color has no alpha channel', () => {
    expect(parseHexOpacity('#112233')).toBe(1)
  })

  it('converts an opacity percentage into an 8-digit hex alpha channel', () => {
    expect(getHexColorWithOpacity('#112233', 50)).toBe('#11223380')
  })

  it('returns the opacity percent from a color with alpha', () => {
    expect(getOpacityPercentFromColor('#11223380')).toBe(50)
  })

  it('uses a fallback opacity when the color has no alpha channel', () => {
    expect(getOpacityPercentFromColor('#112233', 75)).toBe(75)
  })
})
