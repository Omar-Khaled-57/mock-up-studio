interface GuidesProps {
  verticalGuides: number[]
  horizontalGuides: number[]
  canvasWidth: number
  canvasHeight: number
}

export default function Guides({ verticalGuides, horizontalGuides, canvasWidth, canvasHeight }: GuidesProps) {
  if (verticalGuides.length === 0 && horizontalGuides.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
      {verticalGuides.map((x, i) => (
        <div
          key={`v-${i}`}
          className="absolute"
          style={{
            left: x,
            top: 0,
            width: 0,
            height: canvasHeight,
            borderLeft: '1px dashed #22d3ee'
          }}
        />
      ))}
      {horizontalGuides.map((y, i) => (
        <div
          key={`h-${i}`}
          className="absolute"
          style={{
            left: 0,
            top: y,
            width: canvasWidth,
            height: 0,
            borderTop: '1px dashed #22d3ee'
          }}
        />
      ))}
    </div>
  )
}
