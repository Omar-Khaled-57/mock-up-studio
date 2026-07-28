/**
 * color-extraction — Extract dominant/vibrant colors from images.
 *
 * Algorithm:
 *   1. Downscale the image to 64x64 pixels (fast, reduces noise).
 *   2. Quantize each pixel into color buckets (16 or 32 buckets per channel).
 *   3. Count pixels per bucket.
 *   4. For dominant: filter outliers (< 5% of total pixels), sort by frequency.
 *   5. For vibrant: sort by weighted score (saturation 60% + frequency 40%),
 *      filter outliers (< 3% threshold), take top 5.
 *   6. Returns hex color strings, padded with fallback indigo tones if needed.
 *
 * Failure fallback: Returns a static indigo palette if image loading or
 * canvas operations fail (e.g., CORS issues, broken image URLs).
 */

/** Loads an image, downscales it to 64x64, and returns the raw pixel data. */
function getPixelData(src: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 64
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No canvas context'))
      ctx.drawImage(img, 0, 0, size, size)
      resolve(ctx.getImageData(0, 0, size, size))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/** Converts 8-bit RGB values to a hex string (#rrggbb). */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
}

/** Converts a hex color to HSL values (h: 0-360, s: 0-100, l: 0-100). */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

/**
 * Quantizes pixels into color buckets. Each bucket covers a range of
 * `bucketSize` values per channel. Returns a map of "r,g,b" → pixel count.
 */
function bucketColors(imageData: ImageData, numBuckets: number): Map<string, number> {
  const data = imageData.data
  const bucketSize = 256 / numBuckets
  const buckets = new Map<string, number>()

  for (let i = 0; i < data.length; i += 4) {
    const r = Math.floor(data[i] / bucketSize) * bucketSize
    const g = Math.floor(data[i + 1] / bucketSize) * bucketSize
    const b = Math.floor(data[i + 2] / bucketSize) * bucketSize
    const key = `${r},${g},${b}`
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }

  return buckets
}

/**
 * Removes color buckets with fewer than 5% of total pixels (outlier filter).
 * Returns the remaining buckets sorted by frequency (most common first).
 */
function filterOutliers(buckets: Map<string, number>): { r: number; g: number; b: number; count: number }[] {
  const entries = Array.from(buckets.entries()).map(([key, count]) => {
    const [r, g, b] = key.split(',').map(Number)
    return { r, g, b, count }
  })

  entries.sort((a, b) => b.count - a.count)

  const totalPixels = entries.reduce((sum, e) => sum + e.count, 0)
  const threshold = totalPixels * 0.05

  return entries.filter((e) => e.count >= threshold)
}

export async function extractDominantColors(
  imageSrc: string,
  count: number = 5
): Promise<string[]> {
  try {
    const imageData = await getPixelData(imageSrc)
    const buckets = bucketColors(imageData, 16)
    const filtered = filterOutliers(buckets)

    const colors = filtered.slice(0, count).map((e) => rgbToHex(e.r, e.g, e.b))

    while (colors.length < count) {
      colors.push(colors[colors.length - 1] ?? '#808080')
    }

    return colors
  } catch {
    return ['#1e1b4b', '#312e81', '#4338ca', '#6366f1', '#818cf8']
  }
}

export async function extractVibrantColors(imageSrc: string): Promise<string[]> {
  try {
    const imageData = await getPixelData(imageSrc)
    const buckets = bucketColors(imageData, 32)
    const entries = Array.from(buckets.entries()).map(([key, count]) => {
      const [r, g, b] = key.split(',').map(Number)
      const hex = rgbToHex(r, g, b)
      const hsl = hexToHsl(hex)
      return { hex, count, ...hsl }
    })

    entries.sort((a, b) => {
      const scoreA = a.s * 0.6 + a.count * 0.4
      const scoreB = b.s * 0.6 + b.count * 0.4
      return scoreB - scoreA
    })

    const totalPixels = entries.reduce((sum, e) => sum + e.count, 0)
    const filtered = entries.filter((e) => e.count >= totalPixels * 0.03)

    const colors = filtered.slice(0, 5).map((e) => e.hex)

    while (colors.length < 5) {
      colors.push(colors[colors.length - 1] ?? '#808080')
    }

    return colors
  } catch {
    return ['#1e1b4b', '#312e81', '#4338ca', '#6366f1', '#818cf8']
  }
}
