import { useCallback } from 'react'
import { useStore } from '../../store'
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
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Version History</h3>
        <button
          onClick={handleCreateManual}
          className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Camera size={11} />
          Snapshot
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
        <input
          type="checkbox"
          checked={autoSnapshotEnabled}
          onChange={(e) => setAutoSnapshotEnabled(e.target.checked)}
          className="rounded border-zinc-600 bg-zinc-800 text-indigo-500"
        />
        Auto-snapshot (5 min)
      </label>

      {snapshots.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-4">No snapshots yet</p>
      ) : (
        <>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-zinc-800 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-zinc-300 block truncate">{snap.label}</span>
                  <span className="text-[10px] text-zinc-600">
                    {formatTime(snap.timestamp)} · {formatRelative(snap.timestamp)}
                  </span>
                </div>
                <button
                  onClick={() => handleRestore(snap.id)}
                  className="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-400 hover:text-indigo-300 transition-opacity shrink-0"
                >
                  Restore
                </button>
                <button
                  onClick={() => deleteSnapshot(snap.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={clearSnapshots}
            className="w-full flex items-center justify-center gap-1.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors py-1"
          >
            <Trash2 size={10} />
            Clear all
          </button>
        </>
      )}
    </div>
  )
}
