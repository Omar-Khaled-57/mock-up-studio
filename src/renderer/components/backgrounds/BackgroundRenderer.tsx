import { Background } from '@shared/types'
import SolidBg from './SolidBg'
import GradientBg from './GradientBg'

interface Props {
  background: Background
}

export default function BackgroundRenderer({ background }: Props) {
  switch (background.type) {
    case 'solid':
      return <SolidBg color={background.color ?? '#18181b'} />
    case 'gradient':
      return (
        <GradientBg
          colors={background.gradient?.colors ?? ['#1e1b4b', '#312e81']}
          angle={background.gradient?.angle ?? 135}
        />
      )
    case 'image':
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${background.image?.src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: `blur(${background.image?.blur ?? 0}px)`,
            opacity: 1 - (background.image?.dim ?? 0) / 100
          }}
        />
      )
    case 'preset':
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, #0f172a, #1e293b)'
          }}
        />
      )
    default:
      return <SolidBg color="#18181b" />
  }
}
