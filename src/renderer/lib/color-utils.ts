export function parseHexOpacity(color: string | undefined | null): number {
  if (!color) return 1

  const value = color.trim().toLowerCase()
  if (!/^#([0-9a-f]{3,8})$/.test(value)) return 1

  const hex = value.slice(1)
  if (hex.length === 3 || hex.length === 4) {
    const expanded = hex
      .split('')
      .map((char) => char + char)
      .join('')
    return expanded.length >= 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1
  }

  if (hex.length < 8) return 1
  return parseInt(hex.slice(6, 8), 16) / 255
}

export function getHexColorWithOpacity(color: string | undefined | null, opacityPercent: number): string {
  const safePercent = Math.max(0, Math.min(100, Number.isFinite(opacityPercent) ? opacityPercent : 100))
  const alphaHex = Math.round((safePercent / 100) * 255)
    .toString(16)
    .padStart(2, '0')

  if (!color) return `#000000${alphaHex}`

  const value = color.trim().toLowerCase()
  if (!/^#([0-9a-f]{3,8})$/.test(value)) return `#000000${alphaHex}`

  const hex = value.slice(1)
  if (hex.length === 3 || hex.length === 4) {
    const expanded = hex
      .split('')
      .map((char) => char + char)
      .join('')
    return `#${expanded.slice(0, 6)}${alphaHex}`
  }

  if (hex.length === 6) return `#${hex}${alphaHex}`
  if (hex.length >= 8) return `#${hex.slice(0, 6)}${alphaHex}`

  return `#000000${alphaHex}`
}

export function getOpacityPercentFromColor(color: string | undefined | null, fallback = 100): number {
  const parsed = parseHexOpacity(color)
  if (parsed < 1) return Math.round(parsed * 100)
  return fallback
}
