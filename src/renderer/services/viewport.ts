export interface ScenePoint {
  x: number
  y: number
}

export interface ScreenPoint {
  x: number
  y: number
}

export interface ViewportRect {
  left: number
  top: number
}

export interface PanState {
  x: number
  y: number
}

export function screenToScene(
  clientX: number,
  clientY: number,
  container: ViewportRect | null,
  pan: PanState,
  zoom: number
): ScenePoint {
  if (!container) return { x: 0, y: 0 }
  const screenX = clientX - container.left
  const screenY = clientY - container.top
  return {
    x: (screenX - pan.x) / zoom,
    y: (screenY - pan.y) / zoom
  }
}

export function sceneToScreen(
  x: number,
  y: number,
  container: ViewportRect | null,
  pan: PanState,
  zoom: number
): ScreenPoint {
  if (!container) return { x: 0, y: 0 }
  return {
    x: container.left + x * zoom + pan.x,
    y: container.top + y * zoom + pan.y
  }
}
