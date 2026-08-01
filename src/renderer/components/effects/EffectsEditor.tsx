import { useCallback } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { useDebouncedHistory } from '../../hooks/useDebouncedHistory'
import SliderInput from '../shared/SliderInput'
import { EFFECTS_REGISTRY } from '../../lib/effects'
import type { ImageEffects } from '@shared/types'

interface Props {
  value: ImageEffects | undefined
  onChange: (patch: Partial<ImageEffects>) => void
  onReset: () => void
}

export default function EffectsEditor({ value, onChange, onReset }: Props) {
  const { clsx, text, bg } = useTheme()
  const pushHistoryDebounced = useDebouncedHistory()

  const handleChange = useCallback(
    (patch: Partial<ImageEffects>) => {
      onChange(patch)
      pushHistoryDebounced('Adjust effects')
    },
    [onChange, pushHistoryDebounced]
  )

  const handleReset = useCallback(() => {
    onReset()
    pushHistoryDebounced('Adjust effects')
  }, [onReset, pushHistoryDebounced])

  return (
    <div className="space-y-1.5">
      {EFFECTS_REGISTRY.map((def) => (
        <SliderInput
          key={def.id}
          label={def.label}
          value={value?.[def.id] ?? def.defaultValue}
          min={def.min}
          max={def.max}
          step={def.step ?? 1}
          unit={def.unit}
          onChange={(v) => {
            const patch: Partial<ImageEffects> = {}
            patch[def.id] = v
            handleChange(patch)
          }}
        />
      ))}
      <button
        onClick={handleReset}
        className={clsx("w-full py-1 text-[10px] rounded transition-colors", bg.button, text.secondary)}
      >
        Reset Effects
      </button>
    </div>
  )
}
