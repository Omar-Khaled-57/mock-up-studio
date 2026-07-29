import { useCallback } from 'react'
import { Device } from '@shared/types'
import { useStore } from '../../store'
import { useDrag } from '../../hooks/useDrag'
import { useResize } from '../../hooks/useResize'
import { useSnapping } from '../../hooks/useSnapping'
import { getMultiDragEntries } from '../../lib/multi-drag'
import Monitor from './Monitor'
import Laptop from './Laptop'
import Phone from './Phone'
import Ipad from './Ipad'
import Watch from './Watch'
import Browser from './Browser'
import Terminal from './Terminal'
import ScreenContainer from './ScreenContainer'
import ResizeHandles from '../shared/ResizeHandles'

interface Props {
  device: Device
  onGuidesChange?: (guides: { verticalGuides: number[]; horizontalGuides: number[] }) => void
  onContextMenu?: (e: React.MouseEvent, type: string, id: string) => void
}

const DEVICE_COMPONENTS: Record<string, React.ComponentType<{ device: Device; children?: React.ReactNode }>> = {
  monitor: Monitor,
  laptop: Laptop,
  phone: Phone,
  ipad: Ipad,
  watch: Watch,
  browser: Browser,
  terminal: Terminal
}

export default function DeviceFrame({ device, onGuidesChange, onContextMenu }: Props) {
  const select = useStore((s) => s.select)
  const isSelected = useStore((s) => s.selectedIds.includes(device.id))
  const updateDevice = useStore((s) => s.updateDevice)
  const scene = useStore((s) => s.scenes[s.activeSceneIndex])
  const groupName = device.groupId ? scene.groups.find((g) => g.id === device.groupId)?.name ?? null : null
  const pushHistory = useStore((s) => s.pushHistory)
  const zoom = useStore((s) => s.zoom)

  const { computeSnap } = useSnapping()

  const commitPosition = useCallback(
    (id: string, x: number, y: number) => {
      updateDevice(id, { x, y })
    },
    [updateDevice]
  )

  const commitEnd = useCallback(() => {
    pushHistory('Move device')
  }, [pushHistory])

  const snapFn = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      const result = computeSnap({ id, x, y, width: w, height: h })
      onGuidesChange?.({ verticalGuides: result.verticalGuides, horizontalGuides: result.horizontalGuides })
      return { x: result.x, y: result.y }
    },
    [computeSnap, onGuidesChange]
  )

  const drag = useDrag({ zoom, onDrag: commitPosition, onEnd: commitEnd, snapFn, onGuidesChange, getMultiDrag: () => getMultiDragEntries(device.id) })

  const commitResize = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      updateDevice(id, { x, y, width: w, height: h })
    },
    [updateDevice]
  )

  const resizeEnd = useCallback(() => {
    pushHistory('Resize device')
  }, [pushHistory])

  const resize = useResize({ zoom, onResize: commitResize, onEnd: resizeEnd })

  const handleContext = useCallback(
    (e: React.MouseEvent) => {
      onContextMenu?.(e, 'device', device.id)
    },
    [onContextMenu, device.id]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      select(device.id, e.shiftKey || e.ctrlKey || e.metaKey)
    },
    [device.id, select]
  )

  const handleDoubleClick = useCallback(() => {
    if (device.locked) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        updateDevice(device.id, { screenImage: reader.result as string })
        pushHistory('Upload screenshot')
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }, [device.id, device.locked, updateDevice, pushHistory])

  const handleDragDown = useCallback(
    (e: React.PointerEvent) => {
      if (device.locked) return
      drag.handlePointerDown(e, device.id, device.x, device.y, device.width, device.height)
    },
    [device, drag]
  )

  const handleResizeDown = useCallback(
    (e: React.PointerEvent, handle: 'nw' | 'ne' | 'sw' | 'se') => {
      if (device.locked) return
      resize.handlePointerDown(e, device.id, handle, device.x, device.y, device.width, device.height)
    },
    [device, resize]
  )

  const DeviceComponent = DEVICE_COMPONENTS[device.type] || Monitor

  return (
    <div
      data-element-id={device.id}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContext}
      onPointerDown={handleDragDown}
      onPointerMove={drag.handlePointerMove}
      onPointerUp={drag.handlePointerUp}
      style={{
        position: 'absolute',
        left: device.x,
        top: device.y,
        width: device.width,
        height: device.height,
        transform: `rotate(${device.rotation}deg)`,
        zIndex: device.zIndex,
        cursor: device.locked ? 'default' : 'move',
        opacity: device.locked ? 0.8 : 1,
        touchAction: 'none'
      }}
    >
      <DeviceComponent device={device}>
        <ScreenContainer device={device} />
      </DeviceComponent>

      {isSelected && !device.locked && (
        <ResizeHandles onMouseDown={handleResizeDown} groupId={device.groupId} groupName={groupName} />
      )}
    </div>
  )
}
