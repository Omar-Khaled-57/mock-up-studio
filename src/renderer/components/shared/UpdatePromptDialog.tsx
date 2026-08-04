import Modal from '../primitives/Modal'
import Button from '../primitives/Button'
import { useRuntimeStore } from '../../runtime/store'
import { useTheme } from '../../hooks/useTheme'
import type { UpdatePromptPayload } from '@shared/types'
import { Download, Rocket, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react'
import pkg from '../../../../package.json'

/**
 * UpdatePromptDialog — styled replacement for the three native auto-updater OS
 * dialogs ('update-available', 'update-downloaded', 'update error').
 *
 * The prompt payload arrives from the main process on the `update-prompt`
 * channel (routed into the runtime store's `updatePrompt`), and the user's
 * choice is sent back on `update-response`:
 *   - available → 'download' starts the download, 'later' defers.
 *   - ready     → 'restart' calls quitAndInstall, 'later' defers.
 *   - failed    → informational, OK just closes (no response needed).
 * Closing via Escape/backdrop/X acts as 'later' so the main process never
 * waits on an unanswered prompt.
 */
export default function UpdatePromptDialog() {
  const prompt = useRuntimeStore((s) => s.updatePrompt)
  const closeUpdatePrompt = useRuntimeStore((s) => s.closeUpdatePrompt)
  const { clsx, text } = useTheme()

  if (!prompt) return null

  const respond = (action: 'download' | 'later' | 'restart') => {
    window.api?.respondToUpdate?.(action)
    closeUpdatePrompt()
  }

  const handleClose = () => {
    if (prompt.kind === 'available' || prompt.kind === 'ready') {
      respond('later')
    } else {
      closeUpdatePrompt()
    }
  }

  const content: Record<UpdatePromptPayload['kind'], {
    title: string
    icon: React.ReactNode
    message: string
    detail: string
  }> = {
    checking: {
      title: 'Checking for Updates',
      icon: <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />,
      message: 'Checking for updates…',
      detail: 'Please wait while we contact the update server.'
    },
    available: {
      title: 'Update Available',
      icon: <Download className="h-5 w-5 text-indigo-400" />,
      message: prompt.version ? `A new version (v${prompt.version}) is available.` : 'A new version is available.',
      detail: 'Would you like to download and install it now?'
    },
    uptodate: {
      title: "You're Up to Date",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
      message: "You're running the latest version of Mockup Studio.",
      detail: `Version ${prompt.version ?? pkg.version}`
    },
    ready: {
      title: 'Update Ready',
      icon: <Rocket className="h-5 w-5 text-indigo-400" />,
      message: 'The update has been downloaded.',
      detail: 'The app will restart to apply the update.'
    },
    failed: {
      title: 'Update Failed',
      icon: <AlertTriangle className="h-5 w-5 text-red-400" />,
      message: 'Could not download the update.',
      detail: prompt.message || 'Make sure you are connected to the internet and try again.'
    }
  }

  const c = content[prompt.kind]

  return (
    <Modal open onClose={handleClose} title={c.title} width={440}>
      <div data-update-prompt data-update-prompt-kind={prompt.kind} className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15">
          {c.icon}
        </div>
        <div className="min-w-0">
          <p className={clsx('text-sm font-semibold leading-snug', text.primary)}>{c.message}</p>
          <p className={clsx('mt-1 text-[13px] leading-relaxed', text.muted)}>{c.detail}</p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {prompt.kind === 'available' && (
          <>
            <Button data-update-download variant="accent" onClick={() => respond('download')}>
              Download
            </Button>
            <Button data-update-later variant="ghost" onClick={() => respond('later')}>
              Later
            </Button>
          </>
        )}
        {prompt.kind === 'ready' && (
          <>
            <Button data-update-restart variant="accent" onClick={() => respond('restart')}>
              Restart Now
            </Button>
            <Button data-update-later variant="ghost" onClick={() => respond('later')}>
              Later
            </Button>
          </>
        )}
        {prompt.kind === 'failed' && (
          <Button data-update-ok variant="default" onClick={() => closeUpdatePrompt()}>
            OK
          </Button>
        )}
        {prompt.kind === 'uptodate' && (
          <Button data-update-ok variant="default" onClick={() => closeUpdatePrompt()}>
            OK
          </Button>
        )}
      </div>
    </Modal>
  )
}
