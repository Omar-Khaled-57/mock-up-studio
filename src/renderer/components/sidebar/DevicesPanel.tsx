import { useCallback } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { generateId } from '../../lib/id'
import { DEVICE_ASPECT_RATIOS } from '../../lib/constants'
import type { Device } from '@shared/types'
import { Plus, Eye, EyeOff, Lock, Unlock, Copy, Trash2 } from 'lucide-react'
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

const DEFAULT_WIDTH = 300

function getDefaultHeight(type: Device['type']): number {
  const ratio = DEVICE_ASPECT_RATIOS[type] ?? 16 / 9
  return Math.round(DEFAULT_WIDTH / ratio)
}

export default function DevicesPanel() {
  const scene = useStore(safeScene)
  const select = useStore((s) => s.select)
  const addDevice = useStore((s) => s.addDevice)
  const updateDevice = useStore((s) => s.updateDevice)
  const removeDevice = useStore((s) => s.removeDevice)
  const pushHistory = useStore((s) => s.pushHistory)
  const selectedIds = useStore((s) => s.selectedIds)
  const deselect = useStore((s) => s.deselect)

  const maxZ = scene.devices.reduce((max, d) => Math.max(max, d.zIndex), -1)

  const selectedDevice = selectedIds.length === 1
    ? scene.devices.find((d) => d.id === selectedIds[0]) ?? null
    : null

  const handleAdd = useCallback(
    (type: Device['type']) => {
      const w = type === 'watch' ? 150 : DEFAULT_WIDTH
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
        objectFit: 'contain'
      }
      addDevice(device)
      pushHistory(`Add ${type}`)
      select(device.id)
    },
    [scene.devices, maxZ, addDevice, pushHistory, select]
  )

  const handleDuplicate = useCallback(() => {
    if (!selectedDevice) return
    const dupe: Device = {
      ...selectedDevice,
      id: generateId(),
      name: `${selectedDevice.name} copy`,
      x: selectedDevice.x + 30,
      y: selectedDevice.y + 30,
      zIndex: maxZ + 1
    }
    addDevice(dupe)
    pushHistory(`Duplicate ${selectedDevice.name}`)
    select(dupe.id)
  }, [selectedDevice, maxZ, addDevice, pushHistory, select])

  const handleDelete = useCallback(() => {
    if (!selectedDevice) return
    const name = selectedDevice.name
    removeDevice(selectedDevice.id)
    deselect(selectedDevice.id)
    pushHistory(`Delete ${name}`)
  }, [selectedDevice, removeDevice, deselect, pushHistory])

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

  const handleRename = useCallback(
    (id: string, name: string) => {
      updateDevice(id, { name })
    },
    [updateDevice]
  )

  const handleWidthChange = useCallback(
    (id: string, newWidth: number) => {
      const device = scene.devices.find((d) => d.id === id)
      if (!device) return
      const ratio = DEVICE_ASPECT_RATIOS[device.type] ?? 16 / 9
      updateDevice(id, { width: newWidth, height: Math.round(newWidth / ratio) })
    },
    [scene.devices, updateDevice]
  )

  const handleRotationChange = useCallback(
    (id: string, rotation: number) => {
      updateDevice(id, { rotation })
    },
    [updateDevice]
  )

  const handleThemeChange = useCallback(
    (id: string, colorTheme: Device['colorTheme']) => {
      updateDevice(id, { colorTheme })
    },
    [updateDevice]
  )

  return (
    <div className="space-y-4">
      {/* Add buttons */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Add Device</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {DEVICE_TYPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleAdd(type)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-300 bg-zinc-800/60 rounded-lg hover:bg-zinc-700/80 hover:text-zinc-100 transition-all duration-150"
            >
              <Plus size={12} strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Device list */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Devices ({scene.devices.length})
        </h3>
        <div className="space-y-0.5">
          {scene.devices.map((device) => (
            <div
              key={device.id}
              className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-all duration-150 ${
                selectedDevice?.id === device.id
                  ? 'bg-indigo-500/10 border border-indigo-500/20'
                  : 'hover:bg-zinc-800/60 border border-transparent'
              }`}
            >
              <button
                onClick={() => select(device.id)}
                className="flex-1 text-left text-zinc-300 truncate text-xs"
              >
                {device.name}
              </button>
              <button
                onClick={() => handleToggleVisibility(device.id)}
                className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors"
                title={device.visible ? 'Hide' : 'Show'}
              >
                {device.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <button
                onClick={() => handleToggleLock(device.id)}
                className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors"
                title={device.locked ? 'Unlock' : 'Lock'}
              >
                {device.locked ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Selected device controls */}
      {selectedDevice && (
        <div className="space-y-3 border-t border-zinc-800/60 pt-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Properties: {selectedDevice.name}
          </h3>

          {/* Rename */}
          <div>
            <label className="text-[10px] text-zinc-500 mb-0.5 block">Name</label>
            <input
              value={selectedDevice.name}
              onChange={(e) => handleRename(selectedDevice.id, e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-zinc-800/60 text-zinc-200 rounded-lg border border-zinc-700/50 focus:border-indigo-500/50 outline-none transition-colors"
            />
          </div>

          {/* Width slider */}
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">
              Width: {selectedDevice.width}px
            </label>
            <input
              type="range"
              min={80}
              max={1200}
              value={selectedDevice.width}
              onChange={(e) => handleWidthChange(selectedDevice.id, parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Object fit */}
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">Object Fit</label>
            <div className="flex gap-1">
              {(['contain', 'cover', 'stretch'] as const).map((fit) => (
                <button
                  key={fit}
                  onClick={() => updateDevice(selectedDevice.id, { objectFit: fit })}
                  className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition-all duration-150 ${
                    selectedDevice.objectFit === fit
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-zinc-800/60 text-zinc-400 border border-transparent hover:bg-zinc-700/80'
                  }`}
                >
                  {fit}
                </button>
              ))}
            </div>
          </div>

          {/* Rotation */}
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">
              Rotation: {selectedDevice.rotation}°
            </label>
            <input
              type="range"
              min={0}
              max={360}
              value={selectedDevice.rotation}
              onChange={(e) => handleRotationChange(selectedDevice.id, parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Color theme */}
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">Theme</label>
            <div className="grid grid-cols-3 gap-1">
              {(['dark', 'light', 'space-gray', 'midnight', 'custom'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => handleThemeChange(selectedDevice.id, theme)}
                  className={`px-1.5 py-1.5 text-[10px] rounded-lg transition-all duration-150 ${
                    selectedDevice.colorTheme === theme
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-zinc-800/60 text-zinc-400 border border-transparent hover:bg-zinc-700/80'
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={handleDuplicate}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-zinc-800/60 text-zinc-300 rounded-lg hover:bg-zinc-700/80 transition-all duration-150"
            >
              <Copy size={12} />
              Duplicate
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all duration-150"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-zinc-800/60 pt-3 mt-3">
        <LayoutTemplates />
      </div>
    </div>
  )
}
