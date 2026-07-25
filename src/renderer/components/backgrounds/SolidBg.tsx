interface Props {
  color: string
}

export default function SolidBg({ color }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: color
      }}
    />
  )
}
