interface Props {
  onMouseDown: (e: React.PointerEvent, handle: 'nw' | 'ne' | 'sw' | 'se') => void
  groupId?: string | null
  groupName?: string | null
}

const HANDLES: { pos: React.CSSProperties; handle: 'nw' | 'ne' | 'sw' | 'se' }[] = [
  { pos: { top: -8, left: -8, cursor: 'nw-resize' }, handle: 'nw' },
  { pos: { top: -8, right: -8, cursor: 'ne-resize' }, handle: 'ne' },
  { pos: { bottom: -8, left: -8, cursor: 'sw-resize' }, handle: 'sw' },
  { pos: { bottom: -8, right: -8, cursor: 'se-resize' }, handle: 'se' }
]

export default function ResizeHandles({ onMouseDown, groupId, groupName }: Props) {
  const isGrouped = !!groupId
  const color = isGrouped ? '#a855f7' : '#3b82f6'
  const borderColor = isGrouped ? '#7e22ce' : '#1d4ed8'

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
            background: color,
            border: `1px solid ${borderColor}`,
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
          border: `1px solid ${color}`,
          borderRadius: 3,
          pointerEvents: 'none',
          zIndex: 9
        }}
      />

      {/* Group badge */}
      {isGrouped && (
        <div
          style={{
            position: 'absolute',
            top: -22,
            left: 0,
            background: '#a855f7',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            lineHeight: '14px',
            padding: '0 5px',
            borderRadius: 3,
            pointerEvents: 'none',
            zIndex: 11,
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
            maxWidth: 150,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {groupName || 'GROUP'}
        </div>
      )}
    </>
  )
}
