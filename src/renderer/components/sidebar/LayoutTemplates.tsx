import { useCallback, type ElementType } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useTheme } from '../../hooks/useTheme'
import type { Device } from '@shared/types'
import { LayoutDashboard, Grid3X3, Rows3, ArrowDownRight, MoveHorizontal } from 'lucide-react'

interface LayoutTemplate {
  name: string
  icon: ElementType
  apply: (devices: Device[], canvasW: number, canvasH: number) => Partial<Device>[]
}

const TEMPLATES: LayoutTemplate[] = [
  {
    name: 'Center',
    icon: LayoutDashboard,
    apply: (devices, cw, ch) =>
      devices.map((d, i) => {
        const totalW = devices.reduce((sum, dev) => sum + dev.width, 0) + (devices.length - 1) * 20
        const startX = (cw - totalW) / 2
        let x = startX
        for (let j = 0; j < i; j++) x += devices[j].width + 20
        return { id: d.id, x, y: (ch - d.height) / 2 }
      })
  },
  {
    name: 'Grid',
    icon: Grid3X3,
    apply: (devices, cw, ch) => {
      const cols = Math.ceil(Math.sqrt(devices.length))
      const cellW = cw / cols
      const rows = Math.ceil(devices.length / cols)
      const cellH = ch / rows
      return devices.map((d, i) => ({
        id: d.id,
        x: (i % cols) * cellW + (cellW - d.width) / 2,
        y: Math.floor(i / cols) * cellH + (cellH - d.height) / 2
      }))
    }
  },
  {
    name: 'Stack',
    icon: Rows3,
    apply: (devices, cw, ch) => {
      const gap = 20
      const totalH = devices.reduce((sum, d) => sum + d.height, 0) + (devices.length - 1) * gap
      let y = (ch - totalH) / 2
      return devices.map((d) => {
        const pos = { id: d.id, x: (cw - d.width) / 2, y }
        y += d.height + gap
        return pos
      })
    }
  },
  {
    name: 'Stagger',
    icon: ArrowDownRight,
    apply: (devices, cw, ch) => {
      const offset = 40
      const totalW = devices.length * offset + devices[0].width
      const startX = (cw - totalW + offset) / 2
      return devices.map((d, i) => ({
        id: d.id,
        x: startX + i * offset,
        y: (ch - d.height) / 2 + i * (offset * 0.5)
      }))
    }
  },
  {
    name: 'Spread',
    icon: MoveHorizontal,
    apply: (devices, cw, ch) => {
      if (devices.length === 1) return [{ id: devices[0].id, x: (cw - devices[0].width) / 2, y: (ch - devices[0].height) / 2 }]
      const totalW = devices.reduce((sum, d) => sum + d.width, 0)
      const gap = (cw - totalW) / (devices.length - 1)
      let x = 0
      return devices.map((d) => {
        const pos = { id: d.id, x, y: (ch - d.height) / 2 }
        x += d.width + gap
        return pos
      })
    }
  }
]

export default function LayoutTemplates() {
  const { isLight, clsx } = useTheme()
  const scene = useStore(safeScene)
  const updateDevice = useStore((s) => s.updateDevice)
  const pushHistory = useStore((s) => s.pushHistory)

  const applyLayout = useCallback(
    (template: LayoutTemplate) => {
      const visible = scene.devices.filter((d) => d.visible && !d.locked)
      if (visible.length === 0) return
      const patches = template.apply(visible, scene.canvas.width, scene.canvas.height)
      for (const patch of patches) {
        const { id, ...rest } = patch
        updateDevice(id, rest)
      }
      pushHistory(`Layout: ${template.name}`)
    },
    [scene.devices, scene.canvas, updateDevice, pushHistory]
  )

  return (
    <div>
      <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", isLight ? "text-zinc-600" : "text-zinc-400")}>Layout Templates</h3>
      <div className="grid grid-cols-3 gap-1.5">
        {TEMPLATES.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.name}
              onClick={() => applyLayout(t)}
              className={clsx("flex flex-col items-center gap-1.5 px-2 py-2.5 text-xs rounded-lg transition-all duration-150", isLight ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-800 border border-zinc-200 hover:border-zinc-300" : "bg-zinc-800/40 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200 border border-zinc-800/40 hover:border-zinc-700/60")}
            >
              <Icon size={16} strokeWidth={1.5} />
              <span className="text-[10px] font-medium">{t.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
