import type { CSSProperties } from 'react'
import type { WatermarkSettings } from '../store/watermarkSlice'

const POSITION_STYLES: Record<WatermarkSettings['position'], CSSProperties> = {
  'top-left': { top: '12px', left: '12px' },
  'top-right': { top: '12px', right: '12px' },
  'bottom-left': { bottom: '12px', left: '12px' },
  'bottom-right': { bottom: '12px', right: '12px' },
  center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
}

/**
 * Shared watermark appearance — single source of truth consumed by the export
 * engine's clone injection. The watermark is export-only content: it never
 * renders in the editing canvas, so this style builder is the only place the
 * visual contract lives.
 */
export function buildWatermarkStyle(watermark: WatermarkSettings): CSSProperties {
  return {
    ...POSITION_STYLES[watermark.position],
    position: 'absolute',
    fontSize: `${watermark.fontSize}px`,
    color: watermark.color,
    opacity: watermark.opacity / 100,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
    zIndex: 9998
  }
}

/** True when a watermark should be painted onto exports. */
export function isWatermarkEnabled(watermark: WatermarkSettings): boolean {
  return watermark.enabled && watermark.text.trim().length > 0
}
