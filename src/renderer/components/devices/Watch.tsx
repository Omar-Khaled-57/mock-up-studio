import { Device } from '@shared/types'
import { resolveThemeColors } from '../../lib/device-utils'

interface Props {
  device: Device
  children?: React.ReactNode
}

export default function Watch({ device, children }: Props) {
  const { bezel } = resolveThemeColors(device.colorTheme, device.customBezelColor, device.customBorderColor)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Top band */}
      <div
        style={{
          width: '30%',
          height: '10%',
          background: '#3f3f46',
          borderRadius: '4px 4px 0 0'
        }}
      />

      {/* Watch body */}
      <div
        style={{
          width: '80%',
          flex: 1,
          background: bezel,
          borderRadius: '18%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
        }}
      >
        {/* Crown button */}
        <div
          style={{
            position: 'absolute',
            right: '-4%',
            top: '30%',
            width: '6%',
            height: '12%',
            background: bezel,
            borderRadius: 2,
            border: '1px solid #525252'
          }}
        />

        {/* Screen */}
        <div
          style={{
            width: '78%',
            height: '78%',
            background: '#000',
            borderRadius: '12%',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {children}
        </div>
      </div>

      {/* Bottom band */}
      <div
        style={{
          width: '30%',
          height: '10%',
          background: '#3f3f46',
          borderRadius: '0 0 4px 4px'
        }}
      />
    </div>
  )
}
