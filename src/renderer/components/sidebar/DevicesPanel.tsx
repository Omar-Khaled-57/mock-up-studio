import { useCallback, useState } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useTheme } from '../../hooks/useTheme'
import { useTripleClick } from '../../hooks/useTripleClick'
import { generateId } from '../../lib/id'
import { DEVICE_ASPECT_RATIOS } from '../../lib/constants'
import type { Device } from '@shared/types'
import { Plus, Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import LayoutTemplates from './LayoutTemplates'

const DEVICE_TYPES: { type: Device['type']; label: string }[] = [
  { type: 'monitor', label: 'Monitor' },
  { type: 'laptop', label: 'Laptop' },
  { type: 'ipad', label: 'iPad' },
  { type: 'phone', label: 'Phone' },
  { type: 'watch', label: 'Watch' },
  { type: 'browser', label: 'Browser' },
  { type: 'terminal', label: 'Terminal' }
]

const DEVICE_NAMES: Record<string, string> = Object.fromEntries(
  DEVICE_TYPES.map((d) => [d.type, d.label])
)

const DEVICE_DEFAULTS: Record<string, { width: number }> = {
  monitor: { width: 520 },
  laptop: { width: 420 },
  ipad: { width: 280 },
  phone: { width: 160 },
  watch: { width: 90 },
  browser: { width: 480 },
  terminal: { width: 400 }
}

function getDefaultWidth(type: Device['type']): number {
  return DEVICE_DEFAULTS[type]?.width ?? 300
}

function getDefaultHeight(type: Device['type']): number {
  const ratio = DEVICE_ASPECT_RATIOS[type] ?? 16 / 9
  return Math.round(getDefaultWidth(type) / ratio)
}

interface DeviceRowProps {
  device: Device
  isSelected: boolean
  renamingId: string | null
  renameValue: string
  onSelect: (id: string) => void
  onStartRename: (id: string, name: string) => void
  onCommitRename: () => void
  onCancelRename: () => void
  onRenameValueChange: (value: string) => void
  onToggleVisibility: (id: string) => void
  onToggleLock: (id: string) => void
}

function DeviceRow({ device, isSelected, renamingId, renameValue, onSelect, onStartRename, onCommitRename, onCancelRename, onRenameValueChange, onToggleVisibility, onToggleLock }: DeviceRowProps) {
  const { clsx, bg, text } = useTheme()
  const { handleClick } = useTripleClick(() => {
    if (!device.locked) onStartRename(device.id, device.name)
  })

  return (
    <div
      className={clsx("group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-all duration-150", isSelected ? 'bg-indigo-500/10 border border-indigo-500/20' : clsx(bg.hover, 'border border-transparent'))}
    >
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {renamingId === device.id ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename()
              if (e.key === 'Escape') onCancelRename()
            }}
            onClick={(e) => e.stopPropagation()}
            className={clsx("flex-1 px-1 py-0.5 text-xs rounded border outline-none min-w-0", bg.input)}
          />
        ) : (
          <span
            className="text-xs cursor-pointer truncate"
            onClick={(e) => { e.stopPropagation(); onSelect(device.id); handleClick() }}
          >
            {device.name}
          </span>
        )}
      </div>
      <button
        onClick={() => onToggleVisibility(device.id)}
        className={clsx("w-5 h-5 flex items-center justify-center transition-colors", text.muted)}
        title={device.visible ? 'Hide' : 'Show'}
        aria-label={device.visible ? `Hide ${DEVICE_NAMES[device.type] ?? device.type}` : `Show ${DEVICE_NAMES[device.type] ?? device.type}`}
      >
        {device.visible ? <Eye size={12} /> : <EyeOff size={12} />}
      </button>
      <button
        onClick={() => onToggleLock(device.id)}
        className={clsx("w-5 h-5 flex items-center justify-center transition-colors", text.muted)}
        title={device.locked ? 'Unlock' : 'Lock'}
        aria-label={device.locked ? 'Unlock device' : 'Lock device'}
      >
        {device.locked ? <Lock size={12} /> : <Unlock size={12} />}
      </button>
    </div>
  )
}

export default function DevicesPanel() {
  const { clsx, bg, text, border: borderT } = useTheme()
  const scene = useStore(safeScene)
  const select = useStore((s) => s.select)
  const addDevice = useStore((s) => s.addDevice)
  const updateDevice = useStore((s) => s.updateDevice)
  const pushHistory = useStore((s) => s.pushHistory)
  const selectedIds = useStore((s) => s.selectedIds)

  const maxZ = scene.devices.reduce((max, d) => Math.max(max, d.zIndex), -1)

  const selectedDevice = selectedIds.length === 1
    ? scene.devices.find((d) => d.id === selectedIds[0]) ?? null
    : null

  const handleAdd = useCallback(
    (type: Device['type']) => {
      const w = getDefaultWidth(type)
      const h = getDefaultHeight(type)
      const existingCount = scene.devices.filter((d) => d.type === type).length
      const device: Device = {
        id: generateId(),
        type,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${existingCount + 1}`,
        visible: true,
        locked: false,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 100,
        width: w,
        height: h,
        rotation: 0,
        zIndex: maxZ + 1,
        colorTheme: 'dark',
        screenImage: null,
        objectFit: 'contain',
        groupId: null
      }
      addDevice(device)
      pushHistory(`Add ${type}`)
      select(device.id)
    },
    [scene.devices, maxZ, addDevice, pushHistory, select]
  )

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const startRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id)
    setRenameValue(currentName)
  }, [])

  const commitRename = useCallback(() => {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (trimmed) {
      updateDevice(renamingId, { name: trimmed })
      pushHistory('Rename device')
    }
    setRenamingId(null)
  }, [renamingId, renameValue, updateDevice, pushHistory])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
  }, [])

  const handleToggleVisibility = useCallback(
    (id: string) => {
      const device = scene.devices.find((d) => d.id === id)
      if (!device) return
      updateDevice(id, { visible: !device.visible })
    },
    [scene.devices, updateDevice]
  )

  const handleToggleLock = useCallback(
    (id: string) => {
      const device = scene.devices.find((d) => d.id === id)
      if (!device) return
      updateDevice(id, { locked: !device.locked })
    },
    [scene.devices, updateDevice]
  )

  return (
    <div className="space-y-4">
      {/* Add buttons */}
      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Add Device</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {DEVICE_TYPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleAdd(type)}
              className={clsx("flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all duration-150", bg.button)}
            >
              <Plus size={12} strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Device list */}
      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>
          Devices ({scene.devices.length})
        </h3>
        {scene.devices.length === 0 ? (
          <p className={clsx("text-[11px]", text.muted)}>No devices yet — click a device above to add one</p>
        ) : (
          <div className="space-y-0.5">
            {scene.devices.map((device) => (
              <DeviceRow
                key={device.id}
                device={device}
                isSelected={selectedDevice?.id === device.id}
                renamingId={renamingId}
                renameValue={renameValue}
                onSelect={select}
                onStartRename={startRename}
                onCommitRename={commitRename}
                onCancelRename={cancelRename}
                onRenameValueChange={setRenameValue}
                onToggleVisibility={handleToggleVisibility}
                onToggleLock={handleToggleLock}
              />
            ))}
          </div>
        )}
      </div>

      <div className={clsx("border-t pt-3 mt-3", borderT.primary)}>
        <LayoutTemplates />
      </div>
    </div>
  )
}
