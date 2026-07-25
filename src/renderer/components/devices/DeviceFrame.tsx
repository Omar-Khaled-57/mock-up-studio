import { useCallback } from 'react'
import { Device } from '@shared/types'
import { useStore } from '../../store'
import { useDrag } from '../../hooks/useDrag'
import { useResize } from '../../hooks/useResize'
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

export default function DeviceFrame({ device }: Props) {
  const select = useStore((s) => s.select)
  const isSelected = useStore((s) => s.selectedIds.includes(device.id))
  const updateDevice = useStore((s) => s.updateDevice)
  const pushHistory = useStore((s) => s.pushHistory)
  const zoom = useStore((s) => s.zoom)

  const commitPosition = useCallback(
    (id: string, x: number, y: number) => {
      updateDevice(id, { x, y })
    },
    [updateDevice]
  )

  const commitEnd = useCallback(() => {
    pushHistory('Move device')
  }, [pushHistory])

  const drag = useDrag({ zoom, onDrag: commitPosition, onEnd: commitEnd })

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

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      select(device.id, e.shiftKey)
    },
    [device.id, select]
  )

  const handleDragDown = useCallback(
    (e: React.PointerEvent) => {
      if (device.locked) return
      drag.handlePointerDown(e, device.id, device.x, device.y)
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
      onClick={handleClick}
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
        <ResizeHandles onMouseDown={handleResizeDown} />
      )}
    </div>
  )
}
