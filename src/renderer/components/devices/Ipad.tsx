import { Device } from '@shared/types'
import { resolveThemeColors } from '../../lib/device-utils'

interface Props {
  device: Device
  children?: React.ReactNode
}

export default function Ipad({ device, children }: Props) {
  const { bezel, border } = resolveThemeColors(device.colorTheme, device.customBezelColor, device.customBorderColor)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: bezel,
        borderRadius: '4%',
        padding: '3% 2%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}
    >
      {/* Camera dot */}
      <div
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: border,
          alignSelf: 'center',
          marginBottom: '1.5%'
        }}
      />

      {/* Screen */}
      <div
        style={{
          flex: 1,
          background: '#000',
          borderRadius: '1.5%',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {children}
      </div>
    </div>
  )
}
