import { Device } from '@shared/types'
import { resolveThemeColors } from '../../lib/device-utils'

interface Props {
  device: Device
  children?: React.ReactNode
}

export default function Laptop({ device, children }: Props) {
  const { bezel, border } = resolveThemeColors(device.colorTheme, device.customBezelColor, device.customBorderColor)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '6px 6px 0 0',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}
    >
      {/* Screen bezel */}
      <div
        style={{
          flex: 1,
          background: bezel,
          padding: '3% 2% 1% 2%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '6px 6px 0 0'
        }}
      >
        <div
          style={{
            width: '100%',
            height: 3,
            background: border,
            borderRadius: 1,
            marginBottom: '2%'
          }}
        />
        <div
          style={{
            flex: 1,
            background: '#000',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {children}
        </div>
      </div>

      {/* Base */}
      <div
        style={{
          height: '8%',
          minHeight: 10,
          background: `linear-gradient(to bottom, ${bezel}, ${border})`,
          borderRadius: '0 0 4px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            width: '30%',
            height: 2,
            background: border,
            borderRadius: 1
          }}
        />
      </div>
    </div>
  )
}
