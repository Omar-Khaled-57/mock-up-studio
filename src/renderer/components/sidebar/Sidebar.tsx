import { type ElementType } from 'react'
import { useStore } from '../../store'
import { useTheme } from '../../hooks/useTheme'
import type { SidebarTab } from '../../store/uiSlice'
import { Proportions, Palette, Monitor, Image, Type, Hexagon, Layers, Grid3X3, Clock, Sun, Moon } from 'lucide-react'
import ImagesPanel from './ImagesPanel'
import DevicesPanel from './DevicesPanel'
import TextPanel from './TextPanel'
import ShapesPanel from './ShapesPanel'
import CanvasPresetsPanel from './CanvasPresetsPanel'
import BackgroundPanel from './BackgroundPanel'
import LayersPanel from './LayersPanel'
import GridPanel from './GridPanel'
import VersionHistoryPanel from './VersionHistoryPanel'

interface TabDef {
  id: SidebarTab
  label: string
  icon: ElementType
}

interface SectionDef {
  caption: string
  tabs: TabDef[]
}

const SECTIONS: SectionDef[] = [
  {
    caption: 'Design',
    tabs: [
      { id: 'canvas', label: 'Canvas', icon: Proportions },
      { id: 'background', label: 'Theme', icon: Palette }
    ]
  },
  {
    caption: 'Content',
    tabs: [
      { id: 'devices', label: 'Devices', icon: Monitor },
      { id: 'images', label: 'Images', icon: Image },
      { id: 'text', label: 'Text', icon: Type },
      { id: 'shapes', label: 'Shapes', icon: Hexagon }
    ]
  },
  {
    caption: 'Organize',
    tabs: [
      { id: 'layers', label: 'Layers', icon: Layers },
      { id: 'grid', label: 'Grid', icon: Grid3X3 },
      { id: 'history', label: 'History', icon: Clock }
    ]
  }
]

export default function Sidebar() {
  const sidebarTab = useStore((s) => s.sidebarTab)
  const setSidebarTab = useStore((s) => s.setSidebarTab)
  const sidebarPanelWidth = useStore((s) => s.sidebarPanelWidth)
  const { isLight, toggleTheme, clsx, bg, text, border, accent } = useTheme()

  return (
    <aside className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0">
        {/* Tab rail */}
        <div className={clsx("w-14 flex flex-col items-center py-2 overflow-y-auto", bg.tabRail)}>
          {SECTIONS.map((section, sectionIndex) => (
            <div key={section.caption} className="w-full flex flex-col items-center">
              <div className={clsx("w-full text-center text-[8px] uppercase tracking-[0.14em] font-medium mt-1 mb-0.5", text.muted)}>
                {section.caption}
              </div>
              {section.tabs.map((tab) => {
                const active = sidebarTab === tab.id
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSidebarTab(tab.id)}
                    title={tab.label.replace('\n', ' ')}
                    aria-current={active ? 'page' : undefined}
                    className={`relative w-11 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-150 ${
                      active
                        ? clsx(bg.selected)
                        : clsx(text.tertiary, bg.hover)
                    }`}
                  >
                    {active && (
                      <div className={clsx("absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-t-full", accent.fill)} />
                    )}
                    <Icon size={16} strokeWidth={active ? 2 : 1.5} />
                    <span className="text-[11px] font-medium leading-none whitespace-pre-line">{tab.label}</span>
                  </button>
                )
              })}
              {sectionIndex < SECTIONS.length - 1 && (
                <div className={clsx("w-8 border-t my-1.5", border.primary)} />
              )}
            </div>
          ))}

          {/* Theme toggle at bottom of tab rail */}
          <div className="mt-auto">
            <button
              onClick={toggleTheme}
              title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
              className={clsx(
                "w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-150",
                text.tertiary,
                bg.hover
              )}
            >
              {isLight ? <Moon size={16} strokeWidth={1.5} /> : <Sun size={16} strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {/* Panel content */}
        <div className={clsx(
          "p-3 overflow-y-auto",
          bg.panel,
          border.primary
        )} style={{ width: sidebarPanelWidth }}>
          {sidebarTab === 'canvas' && <CanvasPresetsPanel />}
          {sidebarTab === 'background' && <BackgroundPanel />}
          {sidebarTab === 'devices' && <DevicesPanel />}
          {sidebarTab === 'layers' && <LayersPanel />}
          {sidebarTab === 'text' && <TextPanel />}
          {sidebarTab === 'images' && <ImagesPanel />}
          {sidebarTab === 'shapes' && <ShapesPanel />}
          {sidebarTab === 'grid' && <GridPanel />}
          {sidebarTab === 'history' && <VersionHistoryPanel />}
        </div>
      </div>
    </aside>
  )
}
