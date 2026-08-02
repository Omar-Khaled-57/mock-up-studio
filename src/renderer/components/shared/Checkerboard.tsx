import type { CSSProperties, HTMLAttributes } from 'react'

/** Black square of the transparency checkerboard. */
export const CHECKER_DARK = '#000000'
/** Blue square of the transparency checkerboard (Windows-Photos style). */
export const CHECKER_BLUE = '#2563eb'
/** Edge length of one checkerboard cell in scene units. */
export const CHECKER_SIZE = 64

export const CHECKER_IMAGE = `repeating-conic-gradient(${CHECKER_DARK} 0% 25%, ${CHECKER_BLUE} 0% 50%)`
// eslint-disable-next-line react-refresh/only-export-components
export const CHECKER_BG: CSSProperties = {
  backgroundImage: CHECKER_IMAGE,
  // The conic gradient encodes a 2x2 checkerboard per tile, so the tile is
  // twice the cell edge to keep each square exactly CHECKER_SIZE wide/tall.
  backgroundSize: `${CHECKER_SIZE * 2}px ${CHECKER_SIZE * 2}px`
}

/**
 * Reusable transparency checkerboard. Editor chrome only — consumers inside
 * the export node must carry a `data-*` marker the export engine strips
 * (`[data-transparent-checker]`), and overlay consumers are already siblings
 * of `[data-scene-export]` so they can never leak into exports.
 */
export default function Checkerboard({
  style,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { style?: CSSProperties }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, ...CHECKER_BG, ...style }} {...rest}>
      {children}
    </div>
  )
}
