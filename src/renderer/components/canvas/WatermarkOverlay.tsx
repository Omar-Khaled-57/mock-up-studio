import { useStore } from '../../store'

const POSITION_STYLES: Record<string, React.CSSProperties> = {
  'top-left': { top: 12, left: 12 },
  'top-right': { top: 12, right: 12 },
  'bottom-left': { bottom: 12, left: 12 },
  'bottom-right': { bottom: 12, right: 12 },
  center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
}

export default function WatermarkOverlay() {
  const watermark = useStore((s) => s.watermark)

  if (!watermark.enabled || !watermark.text) return null

  return (
    <div
      data-watermark
      className="absolute pointer-events-none select-none"
      style={{
        ...POSITION_STYLES[watermark.position],
        fontSize: watermark.fontSize,
        color: watermark.color,
        opacity: watermark.opacity / 100,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
        zIndex: 9998
      }}
    >
      {watermark.text}
    </div>
  )
}
