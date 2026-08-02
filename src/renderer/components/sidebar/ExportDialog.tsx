import { useState, useCallback } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useTheme } from '../../hooks/useTheme'
import { exportScene, exportAllScenes, copyExportToClipboard, getExportFilename } from '../../lib/export-engine'
import type { ExportFormat, ExportScale, ExportBackground, ExportScope } from '../../lib/export-engine'
import type { WatermarkSettings } from '../../store/watermarkSlice'
import Modal from '../primitives/Modal'
import { Eye, Download, Clipboard } from 'lucide-react'

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' }
]

const SCALE_OPTIONS: { value: ExportScale; label: string }[] = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x' }
]

const BG_OPTIONS: { value: ExportBackground; label: string }[] = [
  { value: 'scene', label: 'Scene' },
  { value: 'solid', label: 'Solid' },
  { value: 'transparent', label: 'Transparent' }
]

const SCOPE_OPTIONS: { value: ExportScope; label: string }[] = [
  { value: 'current', label: 'Current' },
  { value: 'all', label: 'All Scenes' }
]

function ToggleGroup<T extends string | number>({
  options,
  value,
  onChange
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const { clsx, bg } = useTheme()
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx("flex-1 px-2 py-1 text-xs rounded transition-colors", value === opt.value ? 'bg-blue-600 text-white' : bg.button)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { clsx, bg, border, text } = useTheme()
  const exportFormat = useStore((s) => s.exportFormat)
  const exportScale = useStore((s) => s.exportScale)
  const exportQuality = useStore((s) => s.exportQuality)
  const exportBackground = useStore((s) => s.exportBackground)
  const exportBackgroundColor = useStore((s) => s.exportBackgroundColor)
  const setExportFormat = useStore((s) => s.setExportFormat)
  const setExportScale = useStore((s) => s.setExportScale)
  const setExportQuality = useStore((s) => s.setExportQuality)
  const setExportBackground = useStore((s) => s.setExportBackground)
  const setExportBackgroundColor = useStore((s) => s.setExportBackgroundColor)
  const scene = useStore(safeScene)
  const watermark = useStore((s) => s.watermark)
  const setWatermark = useStore((s) => s.setWatermark)
  const sceneCount = useStore((s) => s.scenes.length)

  const [scope, setScope] = useState<ExportScope>('current')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const handlePreview = useCallback(async () => {
    setIsExporting(true)
    setStatus('Generating preview…')
    try {
      const blob = await exportScene({
        format: exportFormat,
        scale: 1,
        background: exportBackground,
        backgroundColor: exportBackgroundColor,
        quality: exportQuality
      })
      if (blob) {
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
        setStatus('Preview ready')
      } else {
        setStatus('Preview failed')
      }
    } catch {
      setStatus('Preview failed')
    } finally {
      setIsExporting(false)
    }
  }, [exportFormat, exportBackground, exportBackgroundColor, exportQuality])

  const handleSave = useCallback(async () => {
    setIsExporting(true)
    setStatus('Exporting…')
    try {
      if (scope === 'all') {
        const blobs = await exportAllScenes({
          format: exportFormat,
          scale: exportScale,
          background: exportBackground,
          backgroundColor: exportBackgroundColor,
          quality: exportQuality
        })

        if (blobs.size === 0) {
          setStatus('Export failed')
          return
        }

        if (blobs.size === 1) {
          const blob = blobs.values().next().value!
          const arrayBuffer = await blob.arrayBuffer()
          const name = blobs.keys().next().value!
          const result = await window.api.saveImageDialog(`${name}.${exportFormat === 'jpeg' ? 'jpg' : exportFormat}`, arrayBuffer)
          if (result?.success) {
            setStatus('Saved!')
          } else if (result?.canceled) {
            setStatus(null)
          } else {
            setStatus('Save failed')
          }
        } else {
          const JSZip = (await import('jszip')).default
          const zip = new JSZip()
          for (const [name, blob] of blobs) {
            const buffer = await blob.arrayBuffer()
            zip.file(`${name}.${exportFormat === 'jpeg' ? 'jpg' : exportFormat}`, buffer)
          }
          const zipBlob = await zip.generateAsync({ type: 'arraybuffer' })
          const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
          const zipResult = await window.api.saveImageDialog(`mockup-scenes-${ts}.zip`, zipBlob)
          if (zipResult?.success) {
            setStatus(`Saved ${blobs.size} scenes!`)
          } else if (zipResult?.canceled) {
            setStatus(null)
          } else {
            setStatus('Save failed')
          }
        }
      } else {
        const blob = await exportScene({
          format: exportFormat,
          scale: exportScale,
          background: exportBackground,
          backgroundColor: exportBackgroundColor,
          quality: exportQuality
        })
        if (!blob) {
          setStatus('Export failed')
          return
        }

        const arrayBuffer = await blob.arrayBuffer()

        if (window.api?.saveImageDialog) {
          const result = await window.api.saveImageDialog(
            getExportFilename(exportFormat, scene.name),
            arrayBuffer
          )
          if (result?.success) {
            setStatus('Saved!')
          } else if (result?.canceled) {
            setStatus(null)
          } else {
            setStatus('Save failed')
          }
        } else {
          setStatus('Save dialog not available')
        }
      }
    } catch {
      setStatus('Export failed')
    } finally {
      setIsExporting(false)
    }
  }, [scope, exportFormat, exportScale, exportBackground, exportBackgroundColor, exportQuality, scene.name])

  // Clipboard copy always uses PNG for maximum compatibility across apps
  const handleCopy = useCallback(async () => {
    setIsExporting(true)
    setStatus('Copying…')
    try {
      const ok = await copyExportToClipboard({
        format: 'png',
        scale: exportScale,
        background: exportBackground,
        backgroundColor: exportBackgroundColor,
        quality: exportQuality
      })
      setStatus(ok ? 'Copied to clipboard!' : 'Copy failed')
    } catch {
      setStatus('Copy failed')
    } finally {
      setIsExporting(false)
    }
  }, [exportScale, exportBackground, exportBackgroundColor, exportQuality])

  const outWidth = scene.canvas.width * exportScale
  const outHeight = scene.canvas.height * exportScale

  return (
    <Modal open={open} onClose={onClose} title="Export" width={520} className="space-y-4">
      {sceneCount > 1 && (
        <div>
          <label className={clsx("text-xs mb-1 block", text.secondary)}>Scope</label>
          <ToggleGroup options={SCOPE_OPTIONS} value={scope} onChange={setScope} />
        </div>
      )}

      <div>
          <label className={clsx("text-xs mb-1 block", text.secondary)}>Format</label>
        <ToggleGroup options={FORMAT_OPTIONS} value={exportFormat} onChange={setExportFormat} />
      </div>

      <div>
          <label className={clsx("text-xs mb-1 block", text.secondary)}>Scale</label>
        <ToggleGroup options={SCALE_OPTIONS} value={exportScale} onChange={setExportScale} />
          <span className={clsx("text-[10px] mt-0.5 block", text.muted)}>
          {scope === 'all'
            ? `${sceneCount} scenes × ${scene.canvas.width * exportScale} × ${scene.canvas.height * exportScale} each`
            : `Output: ${outWidth} × ${outHeight}`}
        </span>
      </div>

      <div>
          <label className={clsx("text-xs mb-1 block", text.secondary)}>Background</label>
        <ToggleGroup options={BG_OPTIONS} value={exportBackground} onChange={setExportBackground} />
      </div>

      {exportFormat !== 'png' && (
        <div>
          <label className={clsx("text-xs mb-1 block", text.secondary)}>Quality</label>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={exportQuality}
            onChange={(e) => setExportQuality(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <span className={clsx("text-xs", text.secondary)}>{exportQuality}%</span>
        </div>
      )}

      {exportBackground === 'solid' && (
        <div>
          <label className={clsx("text-xs mb-1 block", text.secondary)}>Background Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={exportBackgroundColor}
              onChange={(e) => setExportBackgroundColor(e.target.value)}
              className={clsx("w-8 h-8 rounded border cursor-pointer", border.secondary)}
            />
            <span className={clsx("text-xs", text.secondary)}>{exportBackgroundColor}</span>
          </div>
        </div>
      )}

      {/* Watermark */}
      <div className={clsx("border-t pt-3", border.primary)}>
        <div className="flex items-center justify-between mb-2">
          <h3 className={clsx("text-xs font-semibold uppercase", text.secondary)}>Watermark</h3>
          <          button
            onClick={() => setWatermark({ enabled: !watermark.enabled })}
            className={clsx('text-[10px] px-2 py-0.5 rounded transition-colors',
              watermark.enabled ? 'bg-indigo-600 text-white' : clsx(bg.button, border.secondary))}
          >
            {watermark.enabled ? 'On' : 'Off'}
          </button>
        </div>
        {watermark.enabled && (
          <div className="space-y-2">
            <input
              type="text"
              value={watermark.text}
              onChange={(e) => setWatermark({ text: e.target.value })}
               placeholder="Watermark text"
               className={clsx("w-full px-2 py-1 text-xs rounded border outline-none", bg.input)}
            />
            <div className="flex items-center gap-2">
              <span className={clsx("text-[10px] w-10", text.secondary)}>Size</span>
              <input
                type="range"
                min={8}
                max={48}
                value={watermark.fontSize}
                onChange={(e) => setWatermark({ fontSize: Number(e.target.value) })}
                className="flex-1 accent-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className={clsx("text-[10px] w-10", text.secondary)}>Opacity</span>
              <input
                type="range"
                min={5}
                max={100}
                value={watermark.opacity}
                onChange={(e) => setWatermark({ opacity: Number(e.target.value) })}
                className="flex-1 accent-indigo-500"
              />
            </div>
            <select
              value={watermark.position}
              onChange={(e) => setWatermark({ position: e.target.value as WatermarkSettings['position'] })}
               className={clsx("w-full px-1.5 py-0.5 text-[10px] rounded border outline-none", bg.input)}
            >
              <option value="top-left">Top Left</option>
              <option value="top-right">Top Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="center">Center</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handlePreview}
          disabled={isExporting || scope === 'all'}
          className={clsx("flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg disabled:opacity-50 transition-all duration-150", bg.button)}
        >
          <Eye size={12} />
          Preview
        </button>
        <button
          onClick={handleSave}
          disabled={isExporting}
          className={clsx("flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg disabled:opacity-50 transition-all duration-150", bg.selected)}
        >
          <Download size={12} />
          Save
        </button>
        <button
          onClick={handleCopy}
          disabled={isExporting || scope === 'all'}
          className={clsx("flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg disabled:opacity-50 transition-all duration-150", bg.button)}
        >
          <Clipboard size={12} />
          Copy
        </button>
      </div>

        {status && (
          <p className={clsx("text-xs text-center", text.muted)}>{status}</p>
        )}

        {previewUrl && (
          <div className={clsx("border rounded overflow-hidden", border.primary)}>
          <img
            src={previewUrl}
            alt="Export preview"
            className="w-full h-auto"
          />
        </div>
      )}
    </Modal>
  )
}
