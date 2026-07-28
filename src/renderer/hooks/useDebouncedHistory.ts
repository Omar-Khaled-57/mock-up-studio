import { useCallback, useRef } from 'react'
import { useStore } from '../store'

const DEBOUNCE_MS = 500

export function useDebouncedHistory() {
  const pushHistory = useStore((s) => s.pushHistory)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pushHistoryDebounced = useCallback(
    (label: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => pushHistory(label), DEBOUNCE_MS)
    },
    [pushHistory]
  )

  return pushHistoryDebounced
}
