import { Tool, ResizeHandleName } from '../types'
import { getCapabilities, MOVE_LABELS, RESIZE_LABELS } from '../../services/capabilities'
import { computeSnapForScene } from '../../services/snapping'
import { createDragSession, createResizeSession, DragSession, ResizeSession } from '../../services/transform'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'
import { safeScene } from '../../store/sceneSlice'
import { getMultiDragEntries } from '../../lib/multi-drag'
import { resolveContainerDrop, resolveContainerDropTarget } from '../../services/container-drop'
import { scenePointToStored } from '../../services/parent-transform'
import { buildGhostPreview } from '../../services/preview'
import { RuntimeContextMenuItem } from '../../runtime/runtimeSlice'
import type { Scene } from '@shared/types'

export const SELECT_VARIANTS = ['select', 'marquee', 'focus', 'hand']

function emitGhost(
  bounds: { id: string; x: number; y: number; width: number; height: number; rotation?: number } | null
): void {
  useRuntimeStore.getState().setPreview(bounds ? buildGhostPreview(bounds) : null)
}

/**
 * Parent-local write conversion for a gesture on `id`: maps a composed scene
 * point to the element's STORED frame (identity for root elements). Reads the
 * current scene at call time so nest/un-nest decisions made in `onEnd` are
 * reflected by the follow-up `onDrag` commit.
 */
function toStoredFor(id: string): (x: number, y: number) => { x: number; y: number } {
  return (x, y) => scenePointToStored(safeScene(useStore.getState()), id, { x, y })
}

interface PendingDrag {
  pointerId: number
  id: string
  /** Single-element drags can nest into a container on drop; multi-drags are pure moves. */
  nestEligible: boolean
  startClient: { clientX: number; clientY: number }
  session: DragSession
}

interface PendingResize {
  pointerId: number
  session: ResizeSession
}

let pendingDrag: PendingDrag | null = null
let pendingResize: PendingResize | null = null
/** Nest/un-nest decision computed at pointer-up; consumed by the drag session's onEnd. */
let pendingDrop: { type: 'nest'; targetId: string } | { type: 'unnest' } | null = null
let lastDblClick: { id: string; time: number } | null = null

function findElementGroupId(scene: Scene, id: string): string | null {
  const d = scene.devices.find((el) => el.id === id)
  if (d?.groupId) return d.groupId
  const t = scene.textBoxes.find((el) => el.id === id)
  if (t?.groupId) return t.groupId
  const i = scene.images.find((el) => el.id === id)
  if (i?.groupId) return i.groupId
  const s = scene.shapes.find((el) => el.id === id)
  return s?.groupId ?? null
}

export const selectTool: Tool = {
  id: 'select',
  group: 'select',
  label: 'Select',
  icon: 'cursor',
  cursor: 'default',
  shortcut: 'v',
  variants: SELECT_VARIANTS,

  onPointerDown(ctx, e) {
    if (e.button !== 0) return
    const rt = ctx.getRuntime()

    if (ctx.hitResult) {
      const hit = ctx.hitResult
      const caps = getCapabilities(hit.kind)

      // Focus mode: elements outside the focused subtree are dimmed. Clicking
      // one clears the selection and never starts a drag or resize (the
      // capability gate centralizes this for all present and future tools).
      if (!ctx.focusEditable(hit.id)) {
        ctx.actions.clearSelection()
        return
      }

      // Locked elements can be selected but never dragged or resized.
      if (hit.locked) {
        ctx.actions.select(hit.id, e.ctrlKey || e.shiftKey || e.metaKey)
        return
      }

      if (!ctx.claimPointer(e.pointerId)) return

      // Resize via corner handle.
      if (ctx.resizeHandle && caps.resizable) {
        const bounds = ctx.actions.getElementBounds(hit.id)
        const el = document.querySelector(`[data-element-id="${hit.id}"]`) as HTMLElement | null
        if (bounds && el) {
          // Push BEFORE the final resize commit so undo restores the
          // pre-resize geometry (resize commits once on pointer-up).
          ctx.actions.pushHistory(RESIZE_LABELS[hit.kind])
          const session = createResizeSession({
            zoom: ctx.actions.getViewport().zoom,
            element: bounds,
            el,
            onResize: (id, x, y, w, h) => {
              const scene = safeScene(useStore.getState())
              const stored = scenePointToStored(scene, id, { x, y })
              const nw = Math.round(w)
              const nh = Math.round(h)
              // Children scale proportionally with their container. Runs before
              // the container commit so it reads the OLD width/height.
              useStore.getState().rescaleChildren(id, nw, nh)
              ctx.actions.updateElement(id, {
                x: Math.round(stored.x),
                y: Math.round(stored.y),
                width: nw,
                height: nh
              })
            },
            onEnd: () => {},
            onPreview: (id, x, y, w, h, rotation) => emitGhost({ id, x, y, width: w, height: h, rotation }),
            lockAspectRatio: bounds.lockAspectRatio ?? false,
            toStored: toStoredFor(hit.id)
          })
          session.begin(ctx.resizeHandle as ResizeHandleName, { clientX: e.clientX, clientY: e.clientY })
          pendingResize = { pointerId: e.pointerId, session }
          rt.beginInteraction({ toolId: 'select', pointerId: e.pointerId, kind: 'resize', startedAt: Date.now() })
          return
        }
      }

      // Selection semantics before dragging. Ctrl/Shift+click adds to the
      // selection (group-aware via selectionSlice.select); an already-selected
      // element keeps the multi-selection so the whole group drags together.
      if (!ctx.actions.getSelectedIds().includes(hit.id)) {
        ctx.actions.select(hit.id, e.ctrlKey || e.shiftKey || e.metaKey)
      }

      const bounds = ctx.actions.getElementBounds(hit.id)
      const el = document.querySelector(`[data-element-id="${hit.id}"]`) as HTMLElement | null
      if (!bounds || !el) {
        ctx.releasePointer(e.pointerId)
        return
      }

      const multi = getMultiDragEntries(hit.id).length > 0
      const session = createDragSession({
        zoom: ctx.actions.getViewport().zoom,
        element: bounds,
        el,
        onStart: () => {},
        onDrag: (id, x, y) => {
          const p = scenePointToStored(safeScene(useStore.getState()), id, { x, y })
          ctx.actions.updateElement(id, { x: Math.round(p.x), y: Math.round(p.y) })
        },
        onEnd: (id) => {
          const drop = pendingDrop
          pendingDrop = null
          if (drop?.type === 'nest') {
            ctx.actions.pushHistory('Move into container')
            ctx.actions.setElementContainer(id, drop.targetId)
          } else if (drop?.type === 'unnest') {
            ctx.actions.pushHistory('Move out of container')
            ctx.actions.setElementContainer(id, null)
          } else {
            ctx.actions.pushHistory(MOVE_LABELS[hit.kind])
          }
        },
        snapFn: (id, x, y, w, h) => {
          const scene = safeScene(useStore.getState())
          const result = computeSnapForScene(scene, { id, x, y, width: w, height: h }, {
            smartGuides: useStore.getState().showSmartGuides,
            gridSnap: true
          })
          rt.setSnapGuides({
            verticalGuides: result.verticalGuides,
            horizontalGuides: result.horizontalGuides
          })
          return { x: result.x, y: result.y }
        },
        onGuidesChange: (guides) => rt.setSnapGuides(guides),
        getMultiDrag: () => getMultiDragEntries(hit.id),
        onPreview: (id, x, y, w, h, rotation) => emitGhost({ id, x, y, width: w, height: h, rotation }),
        toStored: toStoredFor(hit.id)
      })
      session.begin({ clientX: e.clientX, clientY: e.clientY })
      pendingDrag = {
        pointerId: e.pointerId,
        id: hit.id,
        nestEligible: !multi,
        startClient: { clientX: e.clientX, clientY: e.clientY },
        session
      }
      rt.beginInteraction({ toolId: 'select', pointerId: e.pointerId, kind: 'move', startedAt: Date.now() })
      return
    }

    // Empty canvas → clear the selection. Marquee selection is owned by the
    // Marquee tool (M key / V cycles within the select group).
    ctx.actions.clearSelection()
  },

  onPointerMove(ctx, e) {
    if (pendingDrag && pendingDrag.pointerId === e.pointerId) {
      pendingDrag.session.move({ clientX: e.clientX, clientY: e.clientY })
      if (pendingDrag.nestEligible) {
        const rt = ctx.getRuntime()
        const scene = safeScene(useStore.getState())
        const target = resolveContainerDropTarget(scene, pendingDrag.id, ctx.scenePoint, {
          focusGroupId: rt.focusGroupId,
          focusElementId: rt.focusElementId
        })
        rt.setContainerDropTarget(target)
      }
      return
    }

    if (pendingResize && pendingResize.pointerId === e.pointerId) {
      pendingResize.session.move({ clientX: e.clientX, clientY: e.clientY }, ctx.modifiers.shift)
    }
  },

  onHover(ctx) {
    const rt = ctx.getRuntime()
    const next = ctx.hitResult ? { id: ctx.hitResult.id, kind: ctx.hitResult.kind } : null
    const cur = rt.hoveredElement
    if (next?.id === cur?.id && next?.kind === cur?.kind) return
    rt.setHoveredElement(next)
  },

  onPointerUp(ctx, e) {
    const rt = ctx.getRuntime()

    if (pendingDrag && pendingDrag.pointerId === e.pointerId) {
      const rt = ctx.getRuntime()
      rt.setContainerDropTarget(null)
      if (pendingDrag.nestEligible) {
        // A release without meaningful movement is a click, not a nest.
        const moved =
          Math.hypot(
            e.clientX - pendingDrag.startClient.clientX,
            e.clientY - pendingDrag.startClient.clientY
          ) >= 3
        if (moved) {
          const scene = safeScene(useStore.getState())
          const drop = resolveContainerDrop(scene, pendingDrag.id, ctx.scenePoint, {
            focusGroupId: rt.focusGroupId,
            focusElementId: rt.focusElementId
          })
          pendingDrop = drop.type === 'none' ? null : drop
        }
      }
      pendingDrag.session.end({ clientX: e.clientX, clientY: e.clientY })
      pendingDrag = null
      emitGhost(null)
      rt.endInteraction()
      return
    }

    if (pendingResize && pendingResize.pointerId === e.pointerId) {
      pendingResize.session.end({ clientX: e.clientX, clientY: e.clientY }, ctx.modifiers.shift)
      pendingResize = null
      emitGhost(null)
      rt.endInteraction()
    }
  },

  onPointerCancel(ctx, e) {
    const rt = ctx.getRuntime()
    if (pendingDrag && pendingDrag.pointerId === e.pointerId) {
      rt.setContainerDropTarget(null)
      pendingDrag.session.cancel()
      pendingDrag = null
      emitGhost(null)
      rt.endInteraction()
      return
    }
    if (pendingResize && pendingResize.pointerId === e.pointerId) {
      pendingResize.session.cancel()
      pendingResize = null
      emitGhost(null)
      rt.endInteraction()
    }
  },

  onDoubleClick(ctx) {
    if (!ctx.hitResult) return
    const hit = ctx.hitResult
    const rt = ctx.getRuntime()

    const caps = getCapabilities(hit.kind)
    const now = Date.now()
    const isTriple = !!lastDblClick && lastDblClick.id === hit.id && now - lastDblClick.time < 500
    lastDblClick = { id: hit.id, time: now }

    // While an element is mid-edit, ignore stray double-clicks unless this is
    // the rename trigger (third click in quick succession).
    if (rt.editing?.id === hit.id && !isTriple) return

    // Double-clicking a grouped shape breaks it out of the group selection
    // (legacy behavior). Not an edit, so it is allowed even when locked.
    if (hit.kind === 'shape' && !isTriple) {
      const scene = safeScene(useStore.getState())
      if (findElementGroupId(scene, hit.id)) ctx.actions.selectDirect(hit.id)
      return
    }

    // Locked elements can never be edited, renamed, or upload-targeted.
    if (hit.locked) return
    if (!caps.editable) return

    if (hit.kind === 'textBox') {
      rt.setEditing({ id: hit.id, mode: isTriple ? 'rename' : 'text' })
      return
    }
    if (hit.kind === 'device') {
      if (isTriple) rt.setEditing({ id: hit.id, mode: 'rename' })
      else ctx.actions.uploadScreenImage(hit.id)
      return
    }
    if (hit.kind === 'shape' && isTriple) {
      rt.setEditing({ id: hit.id, mode: 'rename' })
    }
  },

  onContextMenu(ctx, e) {
    e.preventDefault()
    const state = useStore.getState()
    const rt = ctx.getRuntime()

    let items: RuntimeContextMenuItem[] = []

    if (ctx.hitResult) {
      const id = ctx.hitResult.id
      const scene = safeScene(state)
      const groupId = findElementGroupId(scene, id)
      items = [
        { label: 'Bring to Front', action: () => { state.pushHistory('Bring to Front'); state.bringToFront(id) } },
        { label: 'Send to Back', action: () => { state.pushHistory('Send to Back'); state.sendToBack(id) } },
        { label: 'Bring Forward', action: () => { state.pushHistory('Bring Forward'); state.bringForward(id) } },
        { label: 'Send Backward', action: () => { state.pushHistory('Send Backward'); state.sendBackward(id) } },
        { divider: true, label: '', action: () => {} },
        { label: 'Duplicate', action: () => { state.pushHistory('Duplicate'); state.duplicateSelected([id]) } },
        { label: 'Delete', danger: true, action: () => { state.pushHistory('Delete'); state.deleteSelected([id]) } }
      ]
      if (groupId) {
        items.splice(5, 0, { label: '', divider: true, action: () => {} })
        items.splice(5, 0, { label: 'Ungroup', action: () => { state.pushHistory('Ungroup'); state.ungroup(groupId); state.clearSelection() } })
      }
      if (state.selectedIds.length >= 2) {
        items.push({ divider: true, label: '', action: () => {} })
        items.push({ label: 'Group', action: () => { state.pushHistory('Group'); state.groupSelected() } })
      }
    } else if (state.selectedIds.length >= 2) {
      items.push({ label: 'Group', action: () => { state.pushHistory('Group'); state.groupSelected() } })
    }

    if (items.length === 0) return
    rt.openContextMenu({ x: e.clientX, y: e.clientY, items })
  },

  onInterrupt() {
    // Abandon a mid-gesture drag/resize (Escape, blur, full reset). Because
    // neither session commits to the store until pointer-up, cancelling here
    // leaves the document untouched.
    let wasActive = false
    useRuntimeStore.getState().setContainerDropTarget(null)
    emitGhost(null)
    pendingDrop = null
    if (pendingDrag) {
      pendingDrag.session.cancel()
      pendingDrag = null
      wasActive = true
    }
    if (pendingResize) {
      pendingResize.session.cancel()
      pendingResize = null
      wasActive = true
    }
    if (wasActive) useRuntimeStore.getState().endInteraction()
  }
}
