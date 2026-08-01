import { useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { FastOverlayHost, registerFastOverlayHost } from '../../services/stroke-host'
import { Point, StrokeRenderState } from '../../services/stroke'

function createStrokeHost(canvas: HTMLCanvasElement): FastOverlayHost {
  return {
    beginStroke(state: StrokeRenderState) {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.strokeStyle = state.color
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    },
    strokeLine(a: Point, b: Point, state: StrokeRenderState) {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.strokeStyle = state.color
      ctx.lineWidth = Math.max(0.25, state.width * (0.25 + 0.75 * state.pressure))
      ctx.globalAlpha = 0.15 + 0.85 * Math.min(1, Math.max(0, state.hardness))
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.globalAlpha = 1
    },
    clear() {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
  }
}

export default function StrokeSurface() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scene = useStore(safeScene)
  const zoom = useStore((s) => s.zoom)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    registerFastOverlayHost(createStrokeHost(canvas))
    return () => registerFastOverlayHost(null)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
    canvas.width = Math.max(1, Math.round(scene.canvas.width * zoom * dpr))
    canvas.height = Math.max(1, Math.round(scene.canvas.height * zoom * dpr))
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, 0, 0)
  }, [scene.canvas.width, scene.canvas.height, zoom])

  return (
    <canvas
      ref={canvasRef}
      data-stroke-surface="true"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: scene.canvas.width,
        height: scene.canvas.height,
        pointerEvents: 'none'
      }}
    />
  )
}
