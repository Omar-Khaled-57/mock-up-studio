import { useCallback, useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useRuntimeStore } from '../../runtime/store'
import { drawPreview, PreviewState } from '../../services/preview'

/**
 * PreviewSurface — imperative canvas for live tool previews (selection
 * transform ghost, blur region indicators, …).
 *
 * It subscribes to the runtime store's `preview` field and draws directly to
 * the canvas in the subscription callback — no React state, no re-render per
 * frame. The bitmap re-sizes with the scene × zoom × devicePixelRatio exactly
 * like StrokeSurface, and drawing stays in scene units via setTransform.
 */
export default function PreviewSurface() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const zoomRef = useRef(1)
  const previewRef = useRef<PreviewState | null>(null)
  const scene = useStore(safeScene)
  const zoom = useStore((s) => s.zoom)

  zoomRef.current = zoom

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    const state = previewRef.current
    if (!state) return
    ctx.save()
    ctx.setTransform(zoomRef.current * dpr, 0, 0, zoomRef.current * dpr, 0, 0)
    drawPreview(ctx, state)
    ctx.restore()
  }, [])

  // Subscription-driven draw (no React re-render while dragging).
  useEffect(() => {
    previewRef.current = useRuntimeStore.getState().preview
    let last = previewRef.current
    const unsubscribe = useRuntimeStore.subscribe((s) => {
      if (s.preview === last) return
      last = s.preview
      previewRef.current = s.preview
      draw()
    })
    draw()
    return () => {
      unsubscribe()
      previewRef.current = null
    }
  }, [draw])

  // Bitmap sizing (mirrors StrokeSurface).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
    canvas.width = Math.max(1, Math.round(scene.canvas.width * zoom * dpr))
    canvas.height = Math.max(1, Math.round(scene.canvas.height * zoom * dpr))
    draw()
  }, [scene.canvas.width, scene.canvas.height, zoom, draw])

  return (
    <canvas
      ref={canvasRef}
      data-preview-surface="true"
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
