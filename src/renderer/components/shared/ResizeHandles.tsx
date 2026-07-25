interface Props {
  onMouseDown: (e: React.PointerEvent, handle: 'nw' | 'ne' | 'sw' | 'se') => void
}

const HANDLES: { pos: React.CSSProperties; handle: 'nw' | 'ne' | 'sw' | 'se' }[] = [
  { pos: { top: -8, left: -8, cursor: 'nw-resize' }, handle: 'nw' },
  { pos: { top: -8, right: -8, cursor: 'ne-resize' }, handle: 'ne' },
  { pos: { bottom: -8, left: -8, cursor: 'sw-resize' }, handle: 'sw' },
  { pos: { bottom: -8, right: -8, cursor: 'se-resize' }, handle: 'se' }
]

export default function ResizeHandles({ onMouseDown }: Props) {
  return (
    <>
      {HANDLES.map(({ pos, handle }) => (
        <div
          key={handle}
          onPointerDown={(e) => {
            e.stopPropagation()
            onMouseDown(e, handle)
          }}
          style={{
            position: 'absolute',
            width: 12,
            height: 12,
            background: '#3b82f6',
            border: '1px solid #1d4ed8',
            borderRadius: 2,
            zIndex: 10,
            pointerEvents: 'auto',
            touchAction: 'none',
            ...pos
          }}
        />
      ))}

      {/* Border overlay when selected */}
      <div
        style={{
          position: 'absolute',
          inset: -1,
          border: '1px solid #3b82f6',
          borderRadius: 3,
          pointerEvents: 'none',
          zIndex: 9
        }}
      />
    </>
  )
}
