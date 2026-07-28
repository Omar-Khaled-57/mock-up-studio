import { useState } from 'react'
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
  const [activeTab, setActiveTab] = useState<'whats-new' | 'origin'>('whats-new')

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[80vh] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">
                  What's New
                </h2>
                <p className="text-xs text-zinc-400">
                  v{version.version} &middot; {version.date}
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
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
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              What's New
            </button>
            {version.origin && (
              <button
                onClick={() => setActiveTab('origin')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'origin'
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                Our Story
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {activeTab === 'whats-new' ? (
            <>
              {version.title && (
                <p className="text-sm text-zinc-300 font-medium">{version.title}</p>
              )}
              {version.sections.map((section) => (
                <div key={section.heading}>
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    {section.heading}
                  </h3>
                  <ul className="space-y-1.5">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          ) : (
            <p className="text-sm text-zinc-300 leading-relaxed">{version.origin}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800">
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
