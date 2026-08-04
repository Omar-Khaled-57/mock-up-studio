import Modal from '../primitives/Modal'
import Button from '../primitives/Button'
import { useTheme } from '../../hooks/useTheme'
import { Github, Globe, MousePointerSquareDashed } from 'lucide-react'
import splashLogo from '../../assets/splash-logo.png'
import pkg from '../../../../package.json'

const REPOSITORY_URL = 'https://github.com/Omar-Khaled-57/mock-up-studio'
const PORTFOLIO_URL = 'https://omar-el-khouly.vercel.app'

interface AboutDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * AboutDialog — styled replacement for the native Help → "About Mockup Studio"
 * OS dialog. External links are plain anchors with `target="_blank"`; the main
 * process's setWindowOpenHandler forwards them to the system browser.
 */
export default function AboutDialog({ open, onClose }: AboutDialogProps) {
  const { clsx, text, bg, border, accent } = useTheme()

  return (
    <Modal open={open} onClose={onClose} title="About Mockup Studio" width={420}>
      <div data-about-dialog className="flex flex-col items-center text-center">
        <img
          src={splashLogo}
          alt="Mockup Studio"
          className="h-16 w-16 rounded-2xl shadow-lg"
          draggable={false}
        />
        <h3 className={clsx('mt-3 text-lg font-semibold', text.primary)}>Mockup Studio</h3>
        <p className={clsx('mt-1 text-[13px]', text.muted)}>Desktop device mockup scene builder.</p>
        <p
          data-about-version
          className={clsx('mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium', bg.tertiary, text.secondary)}
        >
          <MousePointerSquareDashed className="h-3.5 w-3.5" />
          Version {pkg.version}
        </p>

        <div className={clsx('mt-5 w-full rounded-lg border px-4 py-3 text-left', bg.surface, border.primary)}>
          <p className={clsx('text-xs font-medium', text.tertiary)}>Created by Omar Khaled</p>
          <div className={clsx('mt-2 space-y-1.5 text-[13px]', text.secondary)}>
            <div className="flex items-center gap-2">
              <Github className="h-3.5 w-3.5 shrink-0" />
              <a
                data-about-repo
                href={REPOSITORY_URL}
                target="_blank"
                rel="noreferrer"
                className={clsx('hover:underline', accent.text)}
              >
                @Omar-Khaled-57
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <a
                data-about-portfolio
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className={clsx('hover:underline', accent.text)}
              >
                omar-el-khouly.vercel.app
              </a>
            </div>
          </div>
        </div>

        <div className="mt-5 flex w-full justify-end gap-2">
          <Button
            data-about-close
            variant="default"
            onClick={onClose}
            className="inline-flex items-center gap-1.5"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
