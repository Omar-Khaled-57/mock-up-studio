import { useStore } from '../../store'
import type { SidebarTab } from '../../store/uiSlice'
import DevicesPanel from './DevicesPanel'
import TextPanel from './TextPanel'
import CanvasPresetsPanel from './CanvasPresetsPanel'
import LayersPanel from './LayersPanel'
import ThemesPanel from './ThemesPanel'

const TABS: { id: SidebarTab; label: string; icon: string }[] = [
  { id: 'themes', label: 'Themes', icon: '🎨' },
  { id: 'devices', label: 'Devices', icon: '📱' },
  { id: 'images', label: 'Images', icon: '🖼' },
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'layers', label: 'Layers', icon: '☰' },
  { id: 'export', label: 'Export', icon: '↗' },
  { id: 'presets', label: 'Presets', icon: '⚡' }
]

export default function Sidebar() {
  const sidebarTab = useStore((s) => s.sidebarTab)
  const setSidebarTab = useStore((s) => s.setSidebarTab)

  return (
    <aside className="flex h-full">
      {/* Tab rail */}
      <div className="w-12 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-2 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSidebarTab(tab.id)}
            className={`w-10 h-10 rounded flex flex-col items-center justify-center text-[10px] gap-0.5 transition-colors ${
              sidebarTab === tab.id
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <span className="text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="w-56 bg-zinc-900 border-r border-zinc-800 p-3 overflow-y-auto">
        {sidebarTab === 'devices' && <DevicesPanel />}

        {sidebarTab === 'layers' && <LayersPanel />}

        {sidebarTab === 'themes' && <ThemesPanel />}

        {sidebarTab === 'export' && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-3">Export</h3>
            <div className="space-y-2 text-sm text-zinc-400">
              <p>Phase 10</p>
            </div>
          </div>
        )}

        {sidebarTab === 'text' && <TextPanel />}

        {sidebarTab === 'images' && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-3">Images</h3>
            <div className="space-y-2 text-sm text-zinc-400">
              <p>Upload images via the canvas to create overlays</p>
            </div>
          </div>
        )}

        {sidebarTab === 'presets' && <CanvasPresetsPanel />}
      </div>
    </aside>
  )
}
