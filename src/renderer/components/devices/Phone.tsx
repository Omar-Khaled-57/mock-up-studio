import { Device } from '@shared/types'
import { resolveThemeColors } from '../../lib/device-utils'

interface Props {
  device: Device
  children?: React.ReactNode
}

export default function Phone({ device, children }: Props) {
  const { bezel } = resolveThemeColors(device.colorTheme, device.customBezelColor, device.customBorderColor)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: bezel,
        borderRadius: '10%',
        padding: '2% 1.5%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        position: 'relative'
      }}
    >
      {/* Dynamic island / notch */}
      <div
        style={{
          width: '35%',
          height: '4%',
          background: '#000',
          borderRadius: 10,
          alignSelf: 'center',
          marginBottom: '1%',
          zIndex: 1
        }}
      />

      {/* Screen */}
      <div
        style={{
          flex: 1,
          background: '#000',
          borderRadius: '6%',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {children}
      </div>
    </div>
  )
}
