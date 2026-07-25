import { Background } from '@shared/types'
import SolidBg from './SolidBg'
import GradientBg from './GradientBg'
import AuroraBg from './AuroraBg'
import NeonGridBg from './NeonGridBg'
import BlueCyberBg from './BlueCyberBg'
import QPresetBg from './QPresetBg'
import QlessBg from './QlessBg'
import Storybox3Bg from './Storybox3Bg'
import DarkSolidBg from './DarkSolidBg'

interface Props {
  background: Background
}

function PresetBg({ presetName }: { presetName?: string }) {
  switch (presetName) {
    case 'aurora':
      return <AuroraBg />
    case 'neon-grid':
      return <NeonGridBg />
    case 'blue-cyber':
      return <BlueCyberBg />
    case 'q-preset':
      return <QPresetBg />
    case 'qless':
      return <QlessBg />
    case 'storybox3':
      return <Storybox3Bg />
    case 'dark-solid':
      return <DarkSolidBg />
    default:
      return <AuroraBg />
  }
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
    case 'image': {
      const img = background.image
      return (
        <>
          <SolidBg color="#0a0a0a" />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${img?.src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `blur(${img?.blur ?? 0}px)`
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: img?.overlayColor ?? '#000',
              opacity: (img?.dim ?? 0) / 100
            }}
          />
        </>
      )
    }
    case 'preset':
      return <PresetBg presetName={background.presetName} />
    default:
      return <SolidBg color="#18181b" />
  }
}
