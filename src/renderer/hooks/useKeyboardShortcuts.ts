import { useEffect } from 'react'
import { useStore } from '../store'
import { safeScene } from '../store/sceneSlice'
import { useRuntimeStore } from '../runtime/store'
import { focusFilterFor } from '../services/focus'
import { toolManager } from '../tools'

export function useKeyboardShortcuts() {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const updateDevice = useStore((s) => s.updateDevice)
  const updateTextBox = useStore((s) => s.updateTextBox)
  const updateImage = useStore((s) => s.updateImage)
  const updateShape = useStore((s) => s.updateShape)
  const deleteSelected = useStore((s) => s.deleteSelected)
  const duplicateSelected = useStore((s) => s.duplicateSelected)
  const pushHistory = useStore((s) => s.pushHistory)
  const clearSelection = useStore((s) => s.clearSelection)
  const saveProject = useStore((s) => s.saveProject)
  const saveProjectAs = useStore((s) => s.saveProjectAs)
  const openProject = useStore((s) => s.openProject)
  const newProject = useStore((s) => s.newProject)
  const copySelected = useStore((s) => s.copySelected)
  const cutSelected = useStore((s) => s.cutSelected)
  const pasteClipboard = useStore((s) => s.pasteClipboard)

  useEffect(() => {
    function findElement(id: string) {
      const scene = safeScene(useStore.getState())
      const device = scene.devices.find((d) => d.id === id)
      if (device) return { type: 'device' as const, el: device }
      const textBox = scene.textBoxes.find((t) => t.id === id)
      if (textBox) return { type: 'textbox' as const, el: textBox }
      const image = scene.images.find((i) => i.id === id)
      if (image) return { type: 'image' as const, el: image }
      const shape = scene.shapes.find((s) => s.id === id)
      if (shape) return { type: 'shape' as const, el: shape }
      return null
    }

    function nudge(selectedIds: string[], dx: number, dy: number) {
      if (selectedIds.length === 0) return

      pushHistory('Nudge')

      for (const id of selectedIds) {
        const found = findElement(id)
        if (!found) continue

        const newX = found.el.x + dx
        const newY = found.el.y + dy

        switch (found.type) {
          case 'device':
            updateDevice(id, { x: newX, y: newY })
            break
          case 'textbox':
            updateTextBox(id, { x: newX, y: newY })
            break
          case 'image':
            updateImage(id, { x: newX, y: newY })
            break
          case 'shape':
            updateShape(id, { x: newX, y: newY })
            break
        }
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      // Track modifier state for the Tool Manager (shift aspect-lock during
      // resize, alt-pan detection, and future modifier-aware tool behavior).
      toolManager.setModifier('shift', e.shiftKey)
      toolManager.setModifier('ctrl', e.ctrlKey)
      toolManager.setModifier('meta', e.metaKey)
      toolManager.setModifier('alt', e.altKey)

      const mod = e.ctrlKey || e.metaKey
      const selectedIds = useStore.getState().selectedIds
      const dirty = useStore.getState().dirty

      // Save: Ctrl+S
      if (mod && e.key === 's' && !e.shiftKey) {
        e.preventDefault()
        saveProject()
        return
      }

      // Save As: Ctrl+Shift+S
      if (mod && e.key === 's' && e.shiftKey) {
        e.preventDefault()
        saveProjectAs()
        return
      }

      // Open: Ctrl+O
      if (mod && e.key === 'o') {
        e.preventDefault()
        openProject()
        return
      }

      // New: Ctrl+N
      if (mod && e.key === 'n') {
        e.preventDefault()
        if (dirty) {
          if (!confirm('Unsaved changes will be lost. Continue?')) return
        }
        newProject()
        return
      }

      // Undo/Redo
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
        return
      }
      if (mod && e.key === 'y') {
        e.preventDefault()
        redo()
        return
      }

      // Copy: Ctrl+C
      if (mod && e.key === 'c' && !e.shiftKey) {
        if (selectedIds.length > 0) {
          e.preventDefault()
          copySelected()
        }
        return
      }

      // Cut: Ctrl+X
      if (mod && e.key === 'x') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          cutSelected()
        }
        return
      }

      // Paste: Ctrl+V
      if (mod && e.key === 'v' && !e.shiftKey) {
        e.preventDefault()
        pasteClipboard()
        return
      }

      // Duplicate: Ctrl+D
      if (mod && e.key === 'd') {
        e.preventDefault()
        if (selectedIds.length > 0) {
          pushHistory('Duplicate')
          const newIds = duplicateSelected(selectedIds)
          useStore.setState({ selectedIds: newIds })
        }
        return
      }

      // Select all: Ctrl+A
      if (mod && e.key === 'a') {
        e.preventDefault()
        const scene = safeScene(useStore.getState())
        const rt = useRuntimeStore.getState()
        useStore.getState().selectAll(focusFilterFor(rt.focusGroupId, scene, rt.focusElementId))
        return
      }

      // Export: Ctrl+E
      if (mod && e.key === 'e') {
        e.preventDefault()
        useRuntimeStore.getState().openExportModal()
        return
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          pushHistory('Delete')
          deleteSelected(selectedIds)
        }
        return
      }

      // Arrow nudge
      const step = e.shiftKey ? 10 : 1

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          nudge(selectedIds, 0, -step)
          break
        case 'ArrowDown':
          e.preventDefault()
          nudge(selectedIds, 0, step)
          break
        case 'ArrowLeft':
          e.preventDefault()
          nudge(selectedIds, -step, 0)
          break
        case 'ArrowRight':
          e.preventDefault()
          nudge(selectedIds, step, 0)
          break
        case 'Escape':
          toolManager.handleEscape()
          if (useRuntimeStore.getState().focusGroupId || useRuntimeStore.getState().focusElementId) {
            useRuntimeStore.getState().exitFocus()
          } else {
            clearSelection()
          }
          break
        case 'Enter': {
          const scene = safeScene(useStore.getState())
          const sel = useStore.getState().selectedIds
          if (sel.length > 0) {
            const match = scene.groups.find((g) => {
              if (g.childIds.length !== sel.length) return false
              return g.childIds.every((id) => sel.includes(id))
            })
            if (match) {
              e.preventDefault()
              useRuntimeStore.getState().enterFocus(match.id)
            }
          }
          break
        }
      }

      // Space — temporary Hand that restores the previous tool on keyup.
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat && toolManager.getEffectiveToolId() !== 'hand') {
          toolManager.pushTemporaryTool('hand', 'keyup')
        }
        return
      }

      // Tool shortcuts — unmodified single-key presses are owned by the Tool
      // Manager. Only fully-implemented tools (those with pointer handling)
      // are reachable; registry stubs stay inert until their milestones land.
      if (!mod && !e.altKey && !e.shiftKey) {
        if (toolManager.handleReachableShortcut(e.key)) {
          e.preventDefault()
          return
        }
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === 'Shift') toolManager.setModifier('shift', false)
      else if (e.key === 'Control') toolManager.setModifier('ctrl', false)
      else if (e.key === 'Meta') toolManager.setModifier('meta', false)
      else if (e.key === 'Alt') toolManager.setModifier('alt', false)
      else if (e.key === ' ' || e.code === 'Space') toolManager.releaseTemporaryUntil('keyup')
    }

    function handleBlur() {
      toolManager.setModifier('shift', false)
      toolManager.setModifier('ctrl', false)
      toolManager.setModifier('meta', false)
      toolManager.setModifier('alt', false)
      // A Space-temporary Hand (or any other temp tool) pushed before the
      // window lost focus would never get its keyup — release it so the app
      // doesn't come back stuck in Hand mode.
      toolManager.releaseTemporaryTools()
      // A mid-gesture blur (e.g. alt-tab) may never deliver the pointer-up;
      // abandon any in-flight drag/resize/brush/pan so stale pending sessions
      // can't commit against a later scene.
      toolManager.interruptTools()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [
    undo,
    redo,
    updateDevice,
    updateTextBox,
    updateImage,
    updateShape,
    deleteSelected,
    duplicateSelected,
    pushHistory,
    clearSelection,
    saveProject,
    saveProjectAs,
    openProject,
    newProject,
    copySelected,
    cutSelected,
    pasteClipboard
  ])
}
