import { Device } from '@shared/types'
import { useStore } from '../../store'
import { useRuntimeStore } from '../../runtime/store'
import Monitor from './Monitor'
import Laptop from './Laptop'
import Phone from './Phone'
import Ipad from './Ipad'
import Watch from './Watch'
import Browser from './Browser'
import Terminal from './Terminal'
import ScreenContainer from './ScreenContainer'
import ElementFacade from '../../elements/ElementFacade'
import RenameOverlay from '../../elements/RenameOverlay'

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
  const editing = useRuntimeStore((s) => s.editing)

  const isRenaming = editing?.id === device.id && editing.mode === 'rename'

  const commitRename = (value: string) => {
    const state = useStore.getState()
    state.pushHistory('Rename')
    state.updateDevice(device.id, { name: value })
    useRuntimeStore.getState().setEditing(null)
  }

  const cancelRename = () => {
    useRuntimeStore.getState().setEditing(null)
  }

  const DeviceComponent = DEVICE_COMPONENTS[device.type] || Monitor

  return (
    <ElementFacade
      id={device.id}
      kind="device"
      locked={device.locked}
      style={{
        position: 'absolute',
        left: device.x,
        top: device.y,
        width: device.width,
        height: device.height,
        transform: `rotate(${device.rotation}deg)`,
        zIndex: device.zIndex,
        cursor: device.locked ? 'default' : 'move',
        opacity: device.locked ? 0.8 : 1
      }}
    >
      <DeviceComponent device={device}>
        <ScreenContainer device={device} />
      </DeviceComponent>

      {isRenaming && <RenameOverlay name={device.name} onCommit={commitRename} onCancel={cancelRename} />}
    </ElementFacade>
  )
}
