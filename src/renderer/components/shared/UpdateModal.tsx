import { useState } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { X, Sparkles } from 'lucide-react'

export interface ChangelogSection {
  heading: string
  items: string[]
}

export interface ChangelogVersion {
  version: string
  date: string
  title: string
  origin?: string
  sections: ChangelogSection[]
}

interface UpdateModalProps {
  version: ChangelogVersion
  onDismiss: () => void
}

export default function UpdateModal({ version, onDismiss }: UpdateModalProps) {
  const { isLight, clsx } = useTheme()
  const [activeTab, setActiveTab] = useState<'whats-new' | 'origin'>('whats-new')

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={clsx("relative w-full max-w-lg max-h-[80vh] rounded-xl shadow-2xl overflow-hidden flex flex-col", isLight ? "bg-white border border-zinc-200" : "bg-zinc-900 border border-zinc-700")}>
        {/* Header */}
        <div className={clsx("relative px-6 pt-6 pb-4 border-b", isLight ? "border-zinc-200" : "border-zinc-800")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className={clsx("text-lg font-semibold", isLight ? "text-zinc-900" : "text-zinc-100")}>
                  What's New
                </h2>
                <p className={clsx("text-xs", isLight ? "text-zinc-500" : "text-zinc-400")}>
                  v{version.version} &middot; {version.date}
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className={clsx("p-1.5 rounded-md transition-colors", isLight ? "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab('whats-new')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'whats-new'
                  ? clsx(isLight ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-500/20 text-indigo-300')
                  : clsx(isLight ? 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800')
              }`}
            >
              What's New
            </button>
            {version.origin && (
              <button
                onClick={() => setActiveTab('origin')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'origin'
                    ? clsx(isLight ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-500/20 text-indigo-300')
                    : clsx(isLight ? 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800')
                }`}
              >
                Zatoona
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {activeTab === 'whats-new' ? (
            <>
              {version.title && (
                <p className={clsx("text-sm font-medium", isLight ? "text-zinc-800" : "text-zinc-300")}>{version.title}</p>
              )}
              {version.sections.map((section) => (
                <div key={section.heading}>
                  <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", isLight ? "text-zinc-600" : "text-zinc-400")}>
                    {section.heading}
                  </h3>
                  <ul className="space-y-1.5">
                    {section.items.map((item, i) => (
                      <li key={i} className={clsx("flex items-start gap-2 text-sm", isLight ? "text-zinc-700" : "text-zinc-300")}>
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          ) : (
            <p className={clsx("text-sm leading-relaxed", isLight ? "text-zinc-700" : "text-zinc-300")}>{version.origin}</p>
          )}
        </div>

        {/* Footer */}
        <div className={clsx("px-6 py-4 border-t", isLight ? "border-zinc-200" : "border-zinc-800")}>
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}
