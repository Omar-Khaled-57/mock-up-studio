import { useEffect } from 'react'
import { useStore } from '../store'

export function useKeyboardShortcuts() {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const selectedIds = useStore((s) => s.selectedIds)
  const scenes = useStore((s) => s.scenes)
  const activeSceneIndex = useStore((s) => s.activeSceneIndex)
  const updateDevice = useStore((s) => s.updateDevice)
  const updateTextBox = useStore((s) => s.updateTextBox)
  const updateImage = useStore((s) => s.updateImage)
  const pushHistory = useStore((s) => s.pushHistory)

  useEffect(() => {
    function findElement(id: string) {
      const scene = scenes[activeSceneIndex]
      const device = scene.devices.find((d) => d.id === id)
      if (device) return { type: 'device' as const, el: device }
      const textBox = scene.textBoxes.find((t) => t.id === id)
      if (textBox) return { type: 'textbox' as const, el: textBox }
      const image = scene.images.find((i) => i.id === id)
      if (image) return { type: 'image' as const, el: image }
      return null
    }

    function nudge(dx: number, dy: number) {
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
        }
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
        return
      }

      const step = e.shiftKey ? 10 : 1

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          nudge(0, -step)
          break
        case 'ArrowDown':
          e.preventDefault()
          nudge(0, step)
          break
        case 'ArrowLeft':
          e.preventDefault()
          nudge(-step, 0)
          break
        case 'ArrowRight':
          e.preventDefault()
          nudge(step, 0)
          break
        case 'Escape':
          useStore.getState().clearSelection()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    undo,
    redo,
    selectedIds,
    scenes,
    activeSceneIndex,
    updateDevice,
    updateTextBox,
    updateImage,
    pushHistory
  ])
}
