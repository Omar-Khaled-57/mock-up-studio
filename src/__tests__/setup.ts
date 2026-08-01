import '@testing-library/jest-dom/vitest'

if (typeof ImageData === 'undefined') {
  class ImageDataPolyfill {
    readonly width: number
    readonly height: number
    readonly data: Uint8ClampedArray

    constructor(arg1: number | Uint8ClampedArray, width: number, height?: number) {
      if (typeof arg1 === 'number') {
        this.width = arg1
        this.height = width
        this.data = new Uint8ClampedArray(this.width * this.height * 4)
      } else {
        this.data = arg1
        this.width = width
        this.height = height ?? Math.floor(arg1.length / (width * 4))
      }
    }
  }
  globalThis.ImageData = ImageDataPolyfill as unknown as typeof ImageData
}
