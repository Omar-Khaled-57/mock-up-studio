/**
 * ComponentDeleteDialog — Confirmation modal for deleting a component definition.
 *
 * Two mutually exclusive options:
 *   - "Delete all instances" — removes every scene element with this componentId
 *   - "Detach all instances" (default) — clears componentId from matching elements
 *
 * On confirm, removes the definition from the store.
 */

import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../../store'
import { useTheme } from '../../hooks/useTheme'
import Modal from '../primitives/Modal'
import { Button } from '../primitives'

interface Props {
  open: boolean
  definitionId: string | null
  definitionName: string
  onClose: () => void
}

export default function ComponentDeleteDialog({ open, definitionId, definitionName, onClose }: Props) {
  const { clsx, text } = useTheme()

  const [deleteInstances, setDeleteInstances] = useState(false)
  const [detachInstances, setDetachInstances] = useState(true)

  const removeComponent = useStore((s) => s.removeComponent)

  useEffect(() => {
    if (open) {
      setDeleteInstances(false)
      setDetachInstances(true)
    }
  }, [open])

  const toggleDelete = useCallback(() => {
    setDeleteInstances((prev) => {
      const next = !prev
      if (next) setDetachInstances(false)
      if (!next && !detachInstances) setDetachInstances(true)
      return next
    })
  }, [detachInstances])

  const toggleDetach = useCallback(() => {
    setDetachInstances((prev) => {
      const next = !prev
      if (next) setDeleteInstances(false)
      if (!next && !deleteInstances) setDeleteInstances(true)
      return next
    })
  }, [deleteInstances])

  const handleConfirm = useCallback(() => {
    if (!definitionId) return
    const state = useStore.getState()
    const scene = state.scenes[state.activeSceneIndex]

    state.pushHistory('Delete unit')

    const affectedIds: string[] = []

    const checkElements = (kind: 'devices' | 'textBoxes' | 'images' | 'shapes') => {
      for (const el of scene[kind]) {
        if ((el as { componentId?: string }).componentId === definitionId) {
          affectedIds.push(el.id)
          if (!deleteInstances) {
            const updateFn = kind === 'devices' ? state.updateDevice :
              kind === 'textBoxes' ? state.updateTextBox :
              kind === 'images' ? state.updateImage :
              state.updateShape
            updateFn(el.id, { componentId: undefined, isComponentEditing: undefined })
          }
        }
      }
    }

    checkElements('devices')
    checkElements('textBoxes')
    checkElements('images')
    checkElements('shapes')

    if (deleteInstances && affectedIds.length > 0) {
      state.deleteSelected(affectedIds)
    }

    removeComponent(definitionId)
    onClose()
  }, [definitionId, deleteInstances, removeComponent, onClose])

  return (
    <Modal open={open} onClose={onClose} title={`Delete "${definitionName}"?`} width={400}>
      <div className="flex flex-col gap-4">
        <p className={clsx("text-[12px] leading-relaxed", text.secondary)}>
          This will remove the unit definition from your library. Choose what to do with existing instances on the canvas:
        </p>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={deleteInstances}
            onChange={toggleDelete}
            className="custom-checkbox mt-0.5"
          />
          <div>
            <div className={clsx("text-[12px] font-medium", text.primary)}>Delete all instances</div>
            <div className={clsx("text-[11px]", text.muted)}>Remove every instance of this unit from the canvas</div>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={detachInstances}
            onChange={toggleDetach}
            className="custom-checkbox mt-0.5"
          />
          <div>
            <div className={clsx("text-[12px] font-medium", text.primary)}>Detach all instances</div>
            <div className={clsx("text-[11px]", text.muted)}>Instances become independent elements (their current look is preserved)</div>
          </div>
        </label>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={!definitionId}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}
