import { useCallback, useRef, useState } from 'react'
import { Device } from '@shared/types'
import { useStore } from '../../store'

interface Props {
  device: Device
}

export default function ScreenContainer({ device }: Props) {
  const updateDevice = useStore((s) => s.updateDevice)
  const pushHistory = useStore((s) => s.pushHistory)
  const dropRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileSelect = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        updateDevice(device.id, { screenImage: reader.result as string })
        pushHistory('Upload screenshot')
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }, [device.id, updateDevice, pushHistory])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (!file || !file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => {
        updateDevice(device.id, { screenImage: reader.result as string })
        pushHistory('Upload screenshot')
      }
      reader.readAsDataURL(file)
    },
    [device.id, updateDevice, pushHistory]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()
          if (!blob) continue
          const reader = new FileReader()
          reader.onload = () => {
            updateDevice(device.id, { screenImage: reader.result as string })
            pushHistory('Paste screenshot')
          }
          reader.readAsDataURL(blob)
          return
        }
      }
    },
    [device.id, updateDevice, pushHistory]
  )

  const handleReplace = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      handleFileSelect()
    },
    [handleFileSelect]
  )

  if (!device.screenImage) {
    return (
      <div
        ref={dropRef}
        onDoubleClick={handleFileSelect}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onPaste={handlePaste}
        tabIndex={0}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isDragOver ? '#1e3a5f' : '#18181b',
          cursor: 'pointer',
          border: isDragOver ? '2px dashed #3b82f6' : '2px dashed transparent',
          transition: 'background 0.15s, border-color 0.15s'
        }}
      >
        <div
          style={{
            textAlign: 'center',
            color: '#71717a',
            fontSize: 12,
            lineHeight: 1.4
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 4 }}>+</div>
          {isDragOver ? 'Drop image here' : 'Double-click or drop screenshot'}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={dropRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onPaste={handlePaste}
      tabIndex={0}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <img
        src={device.screenImage}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: device.objectFit === 'stretch' ? 'fill' : device.objectFit,
          display: 'block'
        }}
        draggable={false}
      />

      {/* Replace overlay on hover */}
      <div
        onDoubleClick={handleReplace}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          cursor: 'pointer',
          transition: 'opacity 0.15s'
        }}
        className="screen-replace-overlay"
      >
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>Double-click to replace</span>
      </div>
    </div>
  )
}
