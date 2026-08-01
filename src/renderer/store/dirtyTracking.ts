/**
 * dirtyTracking — Central unsaved-changes wiring.
 *
 * The document store has no persistence middleware, so `setDirty` was never
 * invoked anywhere and the unsaved-changes guards (window close, Ctrl+N,
 * open-file) always saw `dirty === false` — silently discarding unsaved work.
 *
 * Instead of sprinkling `setDirty(true)` into every mutating slice action, we
 * subscribe to the merged store and mark the project dirty whenever the
 * `scenes` array reference changes. Every mutation in this codebase goes
 * through immutable updates (new arrays/objects), so a changed reference
 * reliably signals a user edit — including debounced edits (sliders, color
 * pickers) whose history entry only lands 500ms later.
 *
 * Programmatic loads (new/open project, splash recent-project open) replace
 * scenes without marking dirty, so they must wrap their `set` in
 * `withDirtySuppressed`. Tests reset the store through the same helper.
 */

let suppressDirty = false
let prevScenes: unknown = undefined

/**
 * Registers the dirty-tracking subscriber. Must be called once after the
 * merged store is created. Returns the unsubscribe function.
 */
export function attachDirtyTracking(
  subscribe: (listener: () => void) => () => void,
  getState: () => { scenes: unknown; dirty: boolean; setDirty: (dirty: boolean) => void }
): () => void {
  prevScenes = getState().scenes
  return subscribe(() => {
    const state = getState()
    const scenesChanged = state.scenes !== prevScenes
    prevScenes = state.scenes
    if (suppressDirty || !scenesChanged || state.dirty) return
    state.setDirty(true)
  })
}

/**
 * Runs `fn` with dirty tracking suppressed — used by programmatic loads that
 * replace the scenes array without representing user edits.
 */
export function withDirtySuppressed<T>(fn: () => T): T {
  suppressDirty = true
  try {
    return fn()
  } finally {
    suppressDirty = false
  }
}
