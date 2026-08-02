/**
 * Shared icon sizing contract (lucide). One source of truth for icon
 * dimensions + stroke weight so chrome stays visually consistent across the
 * app instead of each component picking its own ad-hoc px values.
 *
 * Scale (per `dev/v0.3.0/redesign/03-design-system.md` §iconography):
 *   micro  12px — inline row actions (eye/lock/copy/trash in list rows)
 *   compact 14px — secondary/header actions, menu items, breadcrumbs
 *   standard 16px — primary buttons, sidebar rail, tool faces, inputs
 *   hero 20px — empty-state and prominent glyphs
 * Stroke weight: 1.75 at rest, 2 when emphasized/active.
 */
export const ICON = {
  micro: 12,
  compact: 14,
  standard: 16,
  hero: 20,
  stroke: 1.75,
  strokeActive: 2
} as const

export type IconSize = keyof typeof ICON
