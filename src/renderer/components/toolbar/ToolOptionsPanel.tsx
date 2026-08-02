import { useRuntimeStore } from '../../runtime/store'
import { useStore } from '../../store'
import { useTheme } from '../../hooks/useTheme'
import { toolRegistry } from '../../tools'
import SliderInput from '../shared/SliderInput'
import ColorInput from '../shared/ColorInput'
import { MaskMode, MaskPreviewShape } from '../../runtime/runtimeSlice'

const MASK_SHAPES: { value: MaskPreviewShape; label: string }[] = [
  { value: 'rectangle', label: 'Rect' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'brush', label: 'Brush' }
]

const MASK_MODES: { value: MaskMode; label: string }[] = [
  { value: 'mask', label: 'Mask' },
  { value: 'unmask', label: 'Unmask' }
]

export default function ToolOptionsPanel() {
  const activeToolId = useRuntimeStore((s) => s.activeToolId)
  const temporaryToolStack = useRuntimeStore((s) => s.temporaryToolStack)
  const brush = useRuntimeStore((s) => s.brush)
  const setBrush = useRuntimeStore((s) => s.setBrush)
  const maskShape = useRuntimeStore((s) => s.maskShape)
  const setMaskShape = useRuntimeStore((s) => s.setMaskShape)
  const maskMode = useRuntimeStore((s) => s.maskMode)
  const setMaskMode = useRuntimeStore((s) => s.setMaskMode)
  const { clsx, bg, text, accent } = useTheme()

  const effectiveId =
    temporaryToolStack.length > 0 ? temporaryToolStack[temporaryToolStack.length - 1].toolId : activeToolId
  const tool = toolRegistry.get(effectiveId)

  const clearAllMasks = () => {
    const state = useStore.getState()
    state.pushHistory('Clear masks')
    state.clearAllMasks()
  }

  if (!tool?.options) return null

  return (
    <div
      data-tool-options={tool.id}
      className={clsx("flex-shrink-0 flex items-center gap-3 pl-4 pr-3 py-1.5 border-l-2 overflow-x-auto", accent.border)}
    >
      <span className={clsx("text-[11px] font-medium shrink-0", text.secondary)}>{tool.label} options</span>
      {effectiveId === 'paint' && (
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <ColorInput
            label="Color"
            value={brush.color}
            onChange={(color) => setBrush({ color })}
            className="min-w-0 max-w-44 flex-1"
          />
          <SliderInput
            label="Size"
            value={brush.size}
            min={1}
            max={120}
            unit="px"
            onChange={(size) => setBrush({ size })}
            className="min-w-0 max-w-52 flex-1"
          />
          <SliderInput
            label="Hard"
            value={Math.round(brush.hardness * 100)}
            min={0}
            max={100}
            unit="%"
            onChange={(hardness) => setBrush({ hardness: hardness / 100 })}
            className="min-w-0 max-w-48 flex-1"
          />
        </div>
      )}
      {(effectiveId === 'blur' || effectiveId === 'eraser') && (
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <SliderInput
            label="Size"
            value={brush.size}
            min={1}
            max={120}
            unit="px"
            onChange={(size) => setBrush({ size })}
            className="min-w-0 max-w-52 flex-1"
          />
          <SliderInput
            label="Hard"
            value={Math.round(brush.hardness * 100)}
            min={0}
            max={100}
            unit="%"
            onChange={(hardness) => setBrush({ hardness: hardness / 100 })}
            className="min-w-0 max-w-48 flex-1"
          />
        </div>
      )}
      {effectiveId === 'magic-eraser' && (
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <SliderInput
            label="Tolerance"
            value={Math.round(brush.hardness * 100)}
            min={0}
            max={100}
            unit="%"
            onChange={(hardness) => setBrush({ hardness: hardness / 100 })}
            className="min-w-0 max-w-48 flex-1"
          />
        </div>
      )}
      {effectiveId === 'mask' && (
        <div className="flex items-center gap-1">
          {MASK_MODES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={maskMode === value}
              aria-label={`Mask mode ${label}`}
              onClick={() => setMaskMode(value)}
              className={clsx(
                "px-2.5 py-1 text-[11px] rounded transition-colors",
                maskMode === value ? bg.selected : clsx(bg.button, text.secondary)
              )}
            >
              {label}
            </button>
          ))}
          <div className={clsx("w-px h-4 mx-1.5", bg.tertiary)} />
          {MASK_SHAPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={maskShape === value}
              aria-label={`Mask shape ${label}`}
              onClick={() => setMaskShape(value)}
              className={clsx(
                "px-2.5 py-1 text-[11px] rounded transition-colors",
                maskShape === value ? bg.selected : clsx(bg.button, text.secondary)
              )}
            >
              {label}
            </button>
          ))}
          {maskShape === 'brush' && (
            <div className={clsx("w-px h-4 mx-1.5", bg.tertiary)} />
          )}
          {maskShape === 'brush' && (
            <SliderInput
              label="Size"
              value={brush.size}
              min={1}
              max={120}
              unit="px"
              onChange={(size) => setBrush({ size })}
              className="min-w-0 max-w-52 flex-1"
            />
          )}
          <div className={clsx("w-px h-4 mx-1.5", bg.tertiary)} />
          <button
            type="button"
            aria-label="Clear all masks"
            onClick={clearAllMasks}
            className={clsx("px-2.5 py-1 text-[11px] rounded transition-colors", bg.danger)}
          >
            Clear masks
          </button>
        </div>
      )}
    </div>
  )
}
