import { GridSettings } from '@shared/types'

interface GridProps {
  grid: GridSettings
  canvasWidth: number
  canvasHeight: number
}

export default function Grid({ grid, canvasWidth, canvasHeight }: GridProps) {
  if (!grid.enabled || grid.size <= 0) return null

  const patternId = 'grid-pattern'

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={canvasWidth}
      height={canvasHeight}
      style={{ zIndex: 1, opacity: grid.opacity ?? 1 }}
    >
      <defs>
        <pattern
          id={patternId}
          x={0}
          y={0}
          width={grid.size}
          height={grid.size}
          patternUnits="userSpaceOnUse"
        >
          {grid.style === 'lines' ? (
            <>
              <line x1={0} y1={0} x2={grid.size} y2={0} stroke={grid.color} strokeWidth={0.5} />
              <line x1={0} y1={0} x2={0} y2={grid.size} stroke={grid.color} strokeWidth={0.5} />
            </>
          ) : (
            <circle cx={grid.size / 2} cy={grid.size / 2} r={0.8} fill={grid.color} />
          )}
        </pattern>
      </defs>
      <rect width={canvasWidth} height={canvasHeight} fill={`url(#${patternId})`} />
    </svg>
  )
}
