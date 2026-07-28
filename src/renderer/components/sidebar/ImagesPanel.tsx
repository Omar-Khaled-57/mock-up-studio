import { useCallback, useRef } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { generateId } from '../../lib/id'
import { ImageOverlay as ImageOverlayType } from '@shared/types'
import { Plus, Eye, EyeOff, Lock, Unlock, Trash2, Copy } from 'lucide-react'

const DEFAULT_SIZE = 300

export default function ImagesPanel() {
  const scene = useStore(safeScene)
  const selectedIds = useStore((s) => s.selectedIds)
  const select = useStore((s) => s.select)
  const addImage = useStore((s) => s.addImage)
  const updateImage = useStore((s) => s.updateImage)
  const removeImage = useStore((s) => s.removeImage)
  const duplicateSelected = useStore((s) => s.duplicateSelected)
  const pushHistory = useStore((s) => s.pushHistory)
  const canvas = scene.canvas
  const fileInputRef = useRef<HTMLInputElement>(null)

  const images = scene.images
  const maxZ = images.reduce((max, img) => Math.max(max, img.zIndex), -1)

  const selectedImage = selectedIds.length === 1
    ? images.find((img) => img.id === selectedIds[0]) ?? null
    : null

  const handleAddFromFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const aspect = img.width / img.height
          const w = Math.min(DEFAULT_SIZE, canvas.width * 0.5)
          const h = Math.round(w / aspect)
          const image: ImageOverlayType = {
            id: generateId(),
            src: reader.result as string,
            x: Math.round((canvas.width - w) / 2),
            y: Math.round((canvas.height - h) / 2),
            width: w,
            height: h,
            rotation: 0,
            zIndex: maxZ + 1,
            locked: false,
            visible: true
          }
          addImage(image)
          pushHistory('Add image')
          select(image.id)
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    },
    [canvas, maxZ, addImage, pushHistory, select]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleAddFromFile(file)
      e.target.value = ''
    },
    [handleAddFromFile]
  )

  const handleAddClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleToggleVisibility = useCallback(
    (id: string) => {
      const img = images.find((i) => i.id === id)
      if (img) updateImage(id, { visible: !img.visible })
    },
    [images, updateImage]
  )

  const handleToggleLock = useCallback(
    (id: string) => {
      const img = images.find((i) => i.id === id)
      if (img) updateImage(id, { locked: !img.locked })
    },
    [images, updateImage]
  )

  const handleDelete = useCallback(
    (id: string) => {
      removeImage(id)
      pushHistory('Delete image')
    },
    [removeImage, pushHistory]
  )

  const handleDuplicate = useCallback(
    (id: string) => {
      const newIds = duplicateSelected([id])
      if (newIds.length > 0) pushHistory('Duplicate image')
    },
    [duplicateSelected, pushHistory]
  )

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Add button */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Add Image</h3>
        <button
          onClick={handleAddClick}
          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs text-zinc-300 bg-zinc-800/60 rounded-lg hover:bg-zinc-700/80 hover:text-zinc-100 transition-all duration-150"
        >
          <Plus size={12} strokeWidth={2} />
          Upload Image
        </button>
      </div>

      {/* Image list */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Images ({images.length})
        </h3>
        {images.length === 0 ? (
          <p className="text-[11px] text-zinc-600">No images yet — click Add or paste onto canvas</p>
        ) : (
          <div className="space-y-0.5">
            {images.map((img, i) => (
              <div
                key={img.id}
                onClick={() => select(img.id)}
                className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 ${
                  selectedImage?.id === img.id
                    ? 'bg-indigo-500/10 border border-indigo-500/20'
                    : 'hover:bg-zinc-800/60 border border-transparent'
                }`}
              >
                {/* Thumbnail */}
                <div className="w-6 h-6 rounded bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700/50">
                  <img
                    src={img.src}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>

                {/* Name */}
                <span className={`flex-1 truncate ${!img.visible ? 'text-zinc-600' : 'text-zinc-300'}`}>
                  Image {i + 1}
                </span>

                {/* Actions */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleVisibility(img.id) }}
                  className="w-4 h-4 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors"
                  title={img.visible ? 'Hide' : 'Show'}
                >
                  {img.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleLock(img.id) }}
                  className="w-4 h-4 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors"
                  title={img.locked ? 'Unlock' : 'Lock'}
                >
                  {img.locked ? <Lock size={11} /> : <Unlock size={11} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDuplicate(img.id) }}
                  className="w-4 h-4 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors"
                  title="Duplicate"
                >
                  <Copy size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(img.id) }}
                  className="w-4 h-4 flex items-center justify-center text-zinc-600 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
