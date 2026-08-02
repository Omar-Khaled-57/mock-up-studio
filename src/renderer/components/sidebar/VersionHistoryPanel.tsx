import { useCallback } from 'react'
import { useStore } from '../../store'
import { useTheme } from '../../hooks/useTheme'
import { ICON } from '../../lib/icons'
import { Camera, X, Trash2 } from 'lucide-react'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export default function VersionHistoryPanel() {
  const { clsx, bg, text } = useTheme()
  const snapshots = useStore((s) => s.snapshots)
  const autoSnapshotEnabled = useStore((s) => s.autoSnapshotEnabled)
  const createSnapshot = useStore((s) => s.createSnapshot)
  const restoreSnapshot = useStore((s) => s.restoreSnapshot)
  const deleteSnapshot = useStore((s) => s.deleteSnapshot)
  const clearSnapshots = useStore((s) => s.clearSnapshots)
  const setAutoSnapshotEnabled = useStore((s) => s.setAutoSnapshotEnabled)
  const pushHistory = useStore((s) => s.pushHistory)

  const handleRestore = useCallback(
    (snapshotId: string) => {
      pushHistory('Before restore')
      restoreSnapshot(snapshotId)
    },
    [restoreSnapshot, pushHistory]
  )

  const handleCreateManual = useCallback(() => {
    createSnapshot('Manual snapshot')
  }, [createSnapshot])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={clsx("text-xs font-semibold uppercase tracking-wider", text.secondary)}>Version History</h3>
        <button
          onClick={handleCreateManual}
          className={clsx("flex items-center gap-1 text-[10px] transition-colors", "text-indigo-500 hover:text-indigo-400")}
        >
          <Camera size={ICON.micro} />
          Snapshot
        </button>
      </div>

      <label className={clsx("flex items-center gap-2 text-xs cursor-pointer", text.secondary)}>
        <input
          type="checkbox"
          checked={autoSnapshotEnabled}
          onChange={(e) => setAutoSnapshotEnabled(e.target.checked)}
          className="custom-checkbox custom-checkbox-indigo"
        />
        Auto-snapshot (5 min)
      </label>

      {snapshots.length === 0 ? (
        <p className={clsx("text-xs text-center py-4", text.muted)}>No snapshots yet</p>
      ) : (
        <>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className={clsx("group flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors", bg.hover)}
              >
                <div className="flex-1 min-w-0">
                  <span className={clsx("block truncate", text.primary)}>{snap.label}</span>
                  <span className={clsx("text-[10px]", text.muted)}>
                    {formatTime(snap.timestamp)} · {formatRelative(snap.timestamp)}
                  </span>
                </div>
                <button
                  onClick={() => handleRestore(snap.id)}
                  className={clsx("opacity-0 group-hover:opacity-100 text-[10px] transition-opacity shrink-0", "text-indigo-500 hover:text-indigo-400")}
                >
                  Restore
                </button>
                <button
                  onClick={() => deleteSnapshot(snap.id)}
                  className={clsx("opacity-0 group-hover:opacity-100 transition-opacity shrink-0", text.muted, "hover:text-red-400")}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={clearSnapshots}
            className={clsx("w-full flex items-center justify-center gap-1.5 text-[10px] transition-colors py-1", text.muted)}
          >
            <Trash2 size={ICON.micro} />
            Clear all
          </button>
        </>
      )}
    </div>
  )
}
