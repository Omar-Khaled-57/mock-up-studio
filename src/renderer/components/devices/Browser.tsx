import { Device } from '@shared/types'
import { resolveThemeColors } from '../../lib/device-utils'

interface Props {
  device: Device
  children?: React.ReactNode
}

export default function Browser({ device, children }: Props) {
  const { bezel, border } = resolveThemeColors(device.colorTheme, device.customBezelColor, device.customBorderColor)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        border: `1px solid ${border}`
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: '8%',
          minHeight: 16,
          background: bezel,
          borderBottom: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 4%',
          gap: '2%'
        }}
      >
        {/* Traffic lights */}
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#eab308' }} />
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />

        {/* URL bar */}
        <div
          style={{
            flex: 1,
            height: '55%',
            background: '#18181b',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            padding: '0 6%'
          }}
        >
          <span style={{ fontSize: 8, color: '#71717a', fontFamily: 'monospace' }}>https://example.com</span>
        </div>
      </div>

      {/* Content */}
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
    </div>
  )
}
