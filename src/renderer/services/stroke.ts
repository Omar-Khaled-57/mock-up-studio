export type BrushType = 'paint' | 'blur' | 'eraser' | 'magic-eraser'

export interface Point {
  x: number
  y: number
}

export interface StrokePoint {
  x: number
  y: number
  pressure: number
}

export interface StrokeDescriptor {
  brushType: BrushType
  size: number
  hardness: number
  color: string
  targetId: string | null
  seed: number
}

export interface StrokeRenderState {
  color: string
  width: number
  hardness: number
  pressure: number
}

export const DEFAULT_MIN_DISTANCE = 1.5
export const DEFAULT_MAX_POINTS = 8192

export class StrokeSampler {
  readonly maxPoints: number
  readonly minDistance: number
  descriptor: StrokeDescriptor | null = null

  private readonly xs: Float64Array
  private readonly ys: Float64Array
  private readonly pressures: Float64Array
  private count = 0
  private lastX = 0
  private lastY = 0
  private hasPoint = false

  constructor(maxPoints = DEFAULT_MAX_POINTS, minDistance = DEFAULT_MIN_DISTANCE) {
    this.maxPoints = maxPoints
    this.minDistance = minDistance
    this.xs = new Float64Array(maxPoints)
    this.ys = new Float64Array(maxPoints)
    this.pressures = new Float64Array(maxPoints)
  }

  get length(): number {
    return this.count
  }

  get full(): boolean {
    return this.count >= this.maxPoints
  }

  begin(descriptor: StrokeDescriptor): void {
    this.descriptor = descriptor
    this.count = 0
    this.hasPoint = false
  }

  x(index: number): number {
    return this.xs[index]
  }

  y(index: number): number {
    return this.ys[index]
  }

  pressure(index: number): number {
    return this.pressures[index]
  }

  append(x: number, y: number, pressure = 1): boolean {
    if (this.count >= this.maxPoints) return false
    if (this.hasPoint) {
      const dx = x - this.lastX
      const dy = y - this.lastY
      if (dx * dx + dy * dy < this.minDistance * this.minDistance) return false
    }
    return this.store(x, y, pressure)
  }

  appendLast(x: number, y: number, pressure = 1): boolean {
    if (this.count >= this.maxPoints) return false
    return this.store(x, y, pressure)
  }

  forEach(cb: (index: number, x: number, y: number, pressure: number) => void): void {
    for (let i = 0; i < this.count; i++) {
      cb(i, this.xs[i], this.ys[i], this.pressures[i])
    }
  }

  toPoints(): StrokePoint[] {
    const out: StrokePoint[] = new Array(this.count)
    for (let i = 0; i < this.count; i++) {
      out[i] = { x: this.xs[i], y: this.ys[i], pressure: this.pressures[i] }
    }
    return out
  }

  reset(): void {
    this.count = 0
    this.hasPoint = false
    this.descriptor = null
  }

  private store(x: number, y: number, pressure: number): boolean {
    this.xs[this.count] = x
    this.ys[this.count] = y
    this.pressures[this.count] = pressure
    this.count += 1
    this.lastX = x
    this.lastY = y
    this.hasPoint = true
    return true
  }
}
