interface Props {
  colors: string[]
  angle: number
  type?: 'linear' | 'radial' | 'conic'
  radialShape?: 'circle' | 'ellipse'
}

export default function GradientBg({ colors, angle, type = 'linear', radialShape = 'circle' }: Props) {
  const stops = colors.map((c, i) => {
    const pct = colors.length === 1 ? 0 : (i / (colors.length - 1)) * 100
    return `${c} ${pct}%`
  })
  const joined = stops.join(', ')

  let background: string
  switch (type) {
    case 'radial':
      background = `radial-gradient(${radialShape}, ${joined})`
      break
    case 'conic':
      background = `conic-gradient(from ${angle}deg, ${joined})`
      break
    default:
      background = `linear-gradient(${angle}deg, ${joined})`
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background
      }}
    />
  )
}
