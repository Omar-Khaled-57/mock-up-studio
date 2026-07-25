interface Props {
  colors: string[]
  angle: number
}

export default function GradientBg({ colors, angle }: Props) {
  const stops = colors.map((c, i) => {
    const pct = colors.length === 1 ? 0 : (i / (colors.length - 1)) * 100
    return `${c} ${pct}%`
  })

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(${angle}deg, ${stops.join(', ')})`
      }}
    />
  )
}
