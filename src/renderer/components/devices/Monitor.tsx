import { Device } from '@shared/types'
import { resolveThemeColors } from '../../lib/device-utils'

interface Props {
  device: Device
  children?: React.ReactNode
}

export default function Monitor({ device, children }: Props) {
  const { bezel, border } = resolveThemeColors(device.colorTheme, device.customBezelColor, device.customBorderColor)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}
    >
      {/* Bezel top */}
      <div
        style={{
          height: '4%',
          minHeight: 12,
          background: bezel,
          borderBottom: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          paddingTop: 2
        }}
      >
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#ef4444', opacity: 0.6 }} />
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#eab308', opacity: 0.6 }} />
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#22c55e', opacity: 0.6 }} />
      </div>

      {/* Screen */}
      <div
        style={{
          flex: 1,
          background: '#000',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {children}
      </div>

      {/* Bezel bottom + stand */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{
            height: '3%',
            minHeight: 8,
            background: bezel,
            borderTop: `1px solid ${border}`,
            width: '100%'
          }}
        />
        <div
          style={{
            width: '15%',
            height: 6,
            background: bezel,
            borderRadius: '0 0 2px 2px'
          }}
        />
        <div
          style={{
            width: '25%',
            height: 3,
            background: border,
            borderRadius: 2
          }}
        />
      </div>
    </div>
  )
}
