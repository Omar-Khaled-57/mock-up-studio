import { useEffect, useState } from 'react'
import Modal from '../primitives/Modal'
import Button from '../primitives/Button'
import { useRuntimeStore } from '../../runtime/store'
import { useTheme } from '../../hooks/useTheme'

/**
 * SaveChangesDialog — the "Save changes?" guard modal (feature: close-confirmation
 * workflow). Owned entirely by the runtime store's `savePrompt`; App.tsx already
 * sent `window.api.ackClose()` when it received the close request, so the main
 * process safety timer is cancelled from the moment the dialog opens.
 *
 * Button contract (per spec): Save is primary → saves (reusing the filePath or
 * falling back to Save As) and only proceeds on success; Don't Save discards and
 * proceeds; Cancel aborts. Escape/backdrop/X act as Cancel.
 */
export default function SaveChangesDialog() {
  const prompt = useRuntimeStore((s) => s.savePrompt)
  const closeSavePrompt = useRuntimeStore((s) => s.closeSavePrompt)
  const [saving, setSaving] = useState(false)
  const { clsx, text } = useTheme()

  useEffect(() => {
    setSaving(false)
  }, [prompt])

  const handleSave = async () => {
    if (!prompt || saving) return
    setSaving(true)
    const ok = await prompt.save()
    setSaving(false)
    if (ok) {
      const proceed = prompt.proceed
      closeSavePrompt()
      proceed()
    }
  }

  const handleDontSave = () => {
    if (!prompt || saving) return
    const proceed = prompt.proceed
    closeSavePrompt()
    proceed()
  }

  const handleCancel = () => {
    if (!prompt || saving) return
    const cancel = prompt.cancel
    closeSavePrompt()
    cancel?.()
  }

  if (!prompt) return null

  return (
    <Modal open onClose={handleCancel} title="Save changes?" width={460}>
      <p data-save-guard-message className={clsx('whitespace-pre-line text-[13px] leading-relaxed', text.secondary)}>
        {prompt.message}
      </p>
      <div className="mt-5 flex justify-start gap-2">
        <Button variant="accent" data-save-guard-save disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="default" data-save-guard-cancel disabled={saving} onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="ghost" data-save-guard-dont-save disabled={saving} onClick={handleDontSave}>
          Don't Save
        </Button>
      </div>
    </Modal>
  )
}
