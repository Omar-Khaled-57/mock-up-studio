import { type ElementType } from 'react'
import { useStore } from '../../store'
import { useTheme } from '../../hooks/useTheme'
import type { SidebarTab } from '../../store/uiSlice'
import { Palette, Monitor, Image, Type, Hexagon, Layers, Grid3X3, Clock, Download, Proportions, Sun, Moon, Sparkles } from 'lucide-react'
import ImagesPanel from './ImagesPanel'
import DevicesPanel from './DevicesPanel'
import TextPanel from './TextPanel'
import ShapesPanel from './ShapesPanel'
import CanvasPresetsPanel from './CanvasPresetsPanel'
import LayersPanel from './LayersPanel'
import ThemesPanel from './ThemesPanel'
import ThemePresetsPanel from './ThemePresetsPanel'
import ExportDialog from './ExportDialog'
import GridPanel from './GridPanel'
import VersionHistoryPanel from './VersionHistoryPanel'
import SceneTabs from './SceneTabs'

const TABS: { id: SidebarTab; label: string; icon: ElementType }[] = [
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'theme-presets', label: 'Presets', icon: Sparkles },
  { id: 'devices', label: 'Devices', icon: Monitor },
  { id: 'images', label: 'Images', icon: Image },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'shapes', label: 'Shapes', icon: Hexagon },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'grid', label: 'Grid', icon: Grid3X3 },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'export', label: 'Export', icon: Download },
  { id: 'presets', label: 'Canvas', icon: Proportions }
]

export default function Sidebar() {
  const sidebarTab = useStore((s) => s.sidebarTab)
  const setSidebarTab = useStore((s) => s.setSidebarTab)
  const sidebarPanelWidth = useStore((s) => s.sidebarPanelWidth)
  const { isLight, toggleTheme, clsx, bg } = useTheme()

  return (
    <aside className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0">
        {/* Tab rail */}
        <div className={clsx("w-14 flex flex-col items-center py-2 gap-0.5", "bg-zinc-950 border-r border-zinc-800/60", bg.primary && "bg-white border-zinc-200")}>
          {TABS.map((tab) => {
            const active = sidebarTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id)}
                title={tab.label}
                className={`relative w-11 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-150 ${
                  active
                    ? isLight
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'bg-indigo-500/10 text-indigo-400'
                    : isLight
                      ? 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700'
                      : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
                }`}
              >
                {active && (
                  <div className={clsx(
                    "absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-5 bg-indigo-500 rounded-full",
                    isLight && "!bg-indigo-600"
                  )} />
                )}
                <Icon size={16} strokeWidth={active ? 2 : 1.5} />
                <span className="text-[9px] font-medium leading-none">{tab.label}</span>
              </button>
            )
          })}

          {/* Theme toggle at bottom of tab rail */}
          <div className="mt-auto">
            <button
              onClick={toggleTheme}
              title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
              className={clsx(
                "w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-150",
                isLight
                  ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                  : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
              )}
            >
              {isLight ? <Moon size={16} strokeWidth={1.5} /> : <Sun size={16} strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {/* Panel content */}
        <div className={clsx(
          "p-3 overflow-y-auto",
          "bg-zinc-900/50 border-r border-zinc-800/60",
          bg.panel && "bg-white/80 border-zinc-200"
        )} style={{ width: sidebarPanelWidth }}>
          {sidebarTab === 'devices' && <DevicesPanel />}
          {sidebarTab === 'layers' && <LayersPanel />}
          {sidebarTab === 'themes' && <ThemesPanel />}
          {sidebarTab === 'theme-presets' && <ThemePresetsPanel />}
          {sidebarTab === 'export' && <ExportDialog />}
          {sidebarTab === 'text' && <TextPanel />}
          {sidebarTab === 'images' && <ImagesPanel />}
          {sidebarTab === 'shapes' && <ShapesPanel />}
          {sidebarTab === 'presets' && <CanvasPresetsPanel />}
          {sidebarTab === 'grid' && <GridPanel />}
          {sidebarTab === 'history' && <VersionHistoryPanel />}
        </div>
      </div>

      {/* Scene tabs at bottom */}
      <SceneTabs />
    </aside>
  )
}
