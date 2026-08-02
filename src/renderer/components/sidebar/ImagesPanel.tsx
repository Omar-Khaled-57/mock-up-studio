import { useCallback, useRef, useState } from 'react'
import { useStore } from '../../store'
import { safeScene } from '../../store/sceneSlice'
import { useTheme } from '../../hooks/useTheme'
import { isPaintLayer } from '../../services/paint-layers'
import { ICON } from '../../lib/icons'
import { Plus, Eye, EyeOff, Lock, Unlock, Trash2, Copy } from 'lucide-react'

export default function ImagesPanel() {
  const { clsx, text, isLight, bg } = useTheme()
  const scene = useStore(safeScene)
  const selectedIds = useStore((s) => s.selectedIds)
  const select = useStore((s) => s.select)
  const importImageFromFile = useStore((s) => s.importImageFromFile)
  const updateImage = useStore((s) => s.updateImage)
  const removeImage = useStore((s) => s.removeImage)
  const duplicateSelected = useStore((s) => s.duplicateSelected)
  const pushHistory = useStore((s) => s.pushHistory)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const images = scene.images.filter((img) => !isPaintLayer(img))

  const selectedImage = selectedIds.length === 1
    ? images.find((img) => img.id === selectedIds[0]) ?? null
    : null

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void importImageFromFile(file)
      e.target.value = ''
    },
    [importImageFromFile]
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
      pushHistory('Delete image')
      removeImage(id)
    },
    [removeImage, pushHistory]
  )

  const handleDuplicate = useCallback(
    (id: string) => {
      pushHistory('Duplicate image')
      duplicateSelected([id])
    },
    [duplicateSelected, pushHistory]
  )

  const startRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id)
    setRenameValue(currentName)
  }, [])

  const commitRename = useCallback(() => {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (trimmed) {
      pushHistory('Rename image')
      updateImage(renamingId, { name: trimmed })
    }
    setRenamingId(null)
  }, [renamingId, renameValue, updateImage, pushHistory])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
  }, [])

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
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>Add Image</h3>
        <button
          onClick={handleAddClick}
          className={clsx("w-full flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs rounded-lg transition-all duration-150", bg.button)}
        >
          <Plus size={12} strokeWidth={2} />
          Upload Image
        </button>
      </div>

      {/* Image list */}
      <div>
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", text.secondary)}>
          Images ({images.length})
        </h3>
        {images.length === 0 ? (
          <p className={clsx("text-[11px]", text.muted)}>No images yet — click Add or paste onto canvas</p>
        ) : (
          <div className="space-y-0.5">
            {images.map((img) => (
              <div
                key={img.id}
                onClick={() => select(img.id)}
                className={clsx("group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150", selectedImage?.id === img.id ? 'bg-indigo-500/10 border border-indigo-500/20' : clsx('bg.hover', 'border border-transparent'))}
              >
                {/* Thumbnail */}
                <div className={clsx("w-6 h-6 rounded overflow-hidden shrink-0 border", bg.tertiary, "border-zinc-300 dark:border-zinc-700")}>
                  <img
                    src={img.src}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>

                {/* Name */}
                {renamingId === img.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') cancelRename()
                    }}
                    onClick={(e) => e.stopPropagation()}
                     className={clsx("flex-1 px-1 py-0.5 text-xs rounded border outline-none min-w-0", bg.input)}
                  />
                ) : (
                  <span
                    className={clsx("flex-1 truncate", !img.visible ? (isLight ? text.muted : text.tertiary) : (isLight ? text.primary : text.secondary))}
                    onDoubleClick={(e) => { e.stopPropagation(); startRename(img.id, img.name) }}
                  >
                    {img.name}
                  </span>
                )}

                {/* Actions */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleVisibility(img.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors", text.muted)}
                  title={img.visible ? 'Hide' : 'Show'}
                >
                  {img.visible ? <Eye size={ICON.micro} /> : <EyeOff size={ICON.micro} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleLock(img.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors", text.muted)}
                  title={img.locked ? 'Unlock' : 'Lock'}
                >
                  {img.locked ? <Lock size={ICON.micro} /> : <Unlock size={ICON.micro} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDuplicate(img.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors", text.muted)}
                  title="Duplicate"
                >
                  <Copy size={ICON.micro} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(img.id) }}
                  className={clsx("w-4 h-4 flex items-center justify-center transition-colors text-red-400")}
                  title="Delete"
                >
                  <Trash2 size={ICON.micro} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
