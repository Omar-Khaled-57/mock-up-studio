import { useCallback, useRef } from 'react'

export function useTripleClick(onTripleClick: () => void, threshold = 500) {
  const clicksRef = useRef<number[]>([])

  const handleClick = useCallback(() => {
    const now = Date.now()
    clicksRef.current = [...clicksRef.current.filter(t => now - t < threshold), now]
    if (clicksRef.current.length >= 3) {
      clicksRef.current = []
      onTripleClick()
    }
  }, [onTripleClick, threshold])

  return { handleClick }
}
