import type { Point, StrokeRenderState } from './stroke'

export interface FastOverlayHost {
  beginStroke: (state: StrokeRenderState) => void
  strokeLine: (a: Point, b: Point, state: StrokeRenderState) => void
  clear: () => void
}

let registeredHost: FastOverlayHost | null = null

export function registerFastOverlayHost(host: FastOverlayHost | null): void {
  registeredHost = host
}

export function getFastOverlayHost(): FastOverlayHost | null {
  return registeredHost
}
