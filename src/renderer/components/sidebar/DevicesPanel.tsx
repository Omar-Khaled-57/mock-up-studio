import { useCallback } from 'react'
import { useStore } from '../../store'
import { generateId } from '../../lib/id'
import { DEVICE_ASPECT_RATIOS } from '../../lib/constants'
import type { Device } from '@shared/types'

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
  const scene = useStore((s) => s.scenes[s.activeSceneIndex])
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

  const handleToggleFit = useCallback(
    (id: string) => {
      const device = scene.devices.find((d) => d.id === id)
      if (!device) return
      updateDevice(id, { objectFit: device.objectFit === 'contain' ? 'cover' : 'contain' })
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
        <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Add Device</h3>
        <div className="grid grid-cols-2 gap-1">
          {DEVICE_TYPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleAdd(type)}
              className="px-2 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
            >
              + {label}
            </button>
          ))}
        </div>
      </div>

      {/* Device list */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-2">
          Devices ({scene.devices.length})
        </h3>
        <div className="space-y-1">
          {scene.devices.map((device) => (
            <div
              key={device.id}
              className={`flex items-center gap-1 px-2 py-1.5 rounded text-sm transition-colors ${
                selectedDevice?.id === device.id
                  ? 'bg-indigo-600/20 border border-indigo-500/30'
                  : 'hover:bg-zinc-800'
              }`}
            >
              <button
                onClick={() => select(device.id)}
                className="flex-1 text-left text-zinc-300 truncate"
              >
                {device.name}
              </button>
              <button
                onClick={() => handleToggleVisibility(device.id)}
                className="w-5 h-5 flex items-center justify-center text-[10px] text-zinc-500 hover:text-zinc-300"
                title={device.visible ? 'Hide' : 'Show'}
              >
                {device.visible ? '👁' : '—'}
              </button>
              <button
                onClick={() => handleToggleLock(device.id)}
                className="w-5 h-5 flex items-center justify-center text-[10px] text-zinc-500 hover:text-zinc-300"
                title={device.locked ? 'Unlock' : 'Lock'}
              >
                {device.locked ? '🔒' : '🔓'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Selected device controls */}
      {selectedDevice && (
        <div className="space-y-3 border-t border-zinc-800 pt-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase">
            Properties: {selectedDevice.name}
          </h3>

          {/* Rename */}
          <div>
            <label className="text-[10px] text-zinc-500 mb-0.5 block">Name</label>
            <input
              value={selectedDevice.name}
              onChange={(e) => handleRename(selectedDevice.id, e.target.value)}
              className="w-full px-2 py-1 text-xs bg-zinc-800 text-zinc-200 rounded border border-zinc-700 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Width slider */}
          <div>
            <label className="text-[10px] text-zinc-500 mb-0.5 block">
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
            <label className="text-[10px] text-zinc-500 mb-0.5 block">Object Fit</label>
            <div className="flex gap-1">
              {(['contain', 'cover'] as const).map((fit) => (
                <button
                  key={fit}
                  onClick={() => updateDevice(selectedDevice.id, { objectFit: fit })}
                  className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                    selectedDevice.objectFit === fit
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {fit}
                </button>
              ))}
            </div>
          </div>

          {/* Rotation */}
          <div>
            <label className="text-[10px] text-zinc-500 mb-0.5 block">
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
            <label className="text-[10px] text-zinc-500 mb-0.5 block">Theme</label>
            <div className="grid grid-cols-3 gap-1">
              {(['dark', 'light', 'space-gray', 'midnight', 'custom'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => handleThemeChange(selectedDevice.id, theme)}
                  className={`px-1.5 py-1 text-[10px] rounded transition-colors ${
                    selectedDevice.colorTheme === theme
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1 pt-1">
            <button
              onClick={handleDuplicate}
              className="flex-1 px-2 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
            >
              Duplicate
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 px-2 py-1.5 text-xs bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
