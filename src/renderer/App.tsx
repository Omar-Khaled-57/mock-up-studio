import { useEffect, useState, useCallback } from 'react'
import Canvas from './components/canvas/Canvas'
import Sidebar from './components/sidebar/Sidebar'
import PropertiesPanel from './components/sidebar/PropertiesPanel'
import SplashScreen from './components/splash/SplashScreen'
import ShortcutsModal from './components/shared/ShortcutsModal'
import ErrorBoundary from './components/shared/ErrorBoundary'
import UpdateModal from './components/shared/UpdateModal'
import ResizeHandle from './components/shared/ResizeHandle'
import UserGuide from './components/shared/UserGuide'
import type { ChangelogVersion } from './components/shared/UpdateModal'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useStore } from './store'
import { loadProjectFromZipResult } from './lib/project-serialization'

const STORAGE_KEY = 'mockup-studio-last-seen-version'

// If the URL has ?guide=1, render just the UserGuide
const isGuideMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('guide') === '1'

export default function App() {
  useKeyboardShortcuts()
  const showSplash = useStore((s) => s.showSplash)
  const saveProject = useStore((s) => s.saveProject)
  const saveProjectAs = useStore((s) => s.saveProjectAs)
  const openProject = useStore((s) => s.openProject)
  const newProject = useStore((s) => s.newProject)
  const theme = useStore((s) => s.theme)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const copySelected = useStore((s) => s.copySelected)
  const cutSelected = useStore((s) => s.cutSelected)
  const pasteClipboard = useStore((s) => s.pasteClipboard)
  const selectAll = useStore((s) => s.selectAll)

  const [showShortcuts, setShowShortcuts] = useState(false)
  const [updateVersion, setUpdateVersion] = useState<ChangelogVersion | null>(null)

  const [updateCheckResult, setUpdateCheckResult] = useState<{ status: string; currentVersion: string; latestVersion?: string; releaseNotes?: string } | null>(null)

  const toggleShortcuts = useCallback(() => setShowShortcuts((v) => !v), [])

  const handleCheckUpdates = useCallback(async () => {
    if (!window.api?.checkForUpdates) return
    const result = await window.api.checkForUpdates()
    setUpdateCheckResult({
      status: result.status,
      currentVersion: result.currentVersion,
      latestVersion: result.latestVersion,
      releaseNotes: result.releaseNotes
    })
  }, [])

  // Check for version update on mount.
  useEffect(() => {
    fetch('./changelog.json')
      .then((r) => r.json())
      .then((data: { versions: ChangelogVersion[] }) => {
        if (!data.versions?.length) return
        const latest = data.versions[0]
        const lastSeen = localStorage.getItem(STORAGE_KEY)
        if (lastSeen !== latest.version) {
          setUpdateVersion(latest)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    document.body.classList.toggle('light-theme', theme === 'light')
  }, [theme])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        toggleShortcuts()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleShortcuts])

  const dismissUpdate = useCallback(() => {
    if (updateVersion) {
      localStorage.setItem(STORAGE_KEY, updateVersion.version)
    }
    setUpdateVersion(null)
  }, [updateVersion])

  useEffect(() => {
    if (!window.api?.onMenuAction) return

    const cleanup = window.api.onMenuAction((action: string) => {
      switch (action) {
        case 'save-project':
          saveProject()
          break
        case 'save-project-as':
          saveProjectAs()
          break
        case 'open-project':
          openProject()
          break
        case 'new-project': {
          const isDirty = useStore.getState().dirty
          if (isDirty && !confirm('Unsaved changes will be lost. Continue?')) return
          newProject()
          break
        }
        case 'show-shortcuts':
          setShowShortcuts(true)
          break
        case 'undo':
          undo()
          break
        case 'redo':
          redo()
          break
        case 'cut-selected':
          cutSelected()
          break
        case 'copy-selected':
          copySelected()
          break
        case 'paste-clipboard':
          pasteClipboard()
          break
        case 'select-all':
          selectAll()
          break
        case 'open-user-guide':
          window.api?.openUserGuide?.()
          break
        case 'check-for-updates':
          handleCheckUpdates()
          break
      }
    })

    return cleanup
  }, [saveProject, saveProjectAs, openProject, newProject, undo, redo, cutSelected, copySelected, pasteClipboard, selectAll, handleCheckUpdates])

  useEffect(() => {
    if (!window.api?.onRequestClose) return

    const cleanup = window.api.onRequestClose(() => {
      const currentDirty = useStore.getState().dirty
      if (!currentDirty) {
        window.api.confirmClose()
        return
      }
      const choice = window.confirm('You have unsaved changes. Close without saving?')
      if (choice) {
        window.api.confirmClose()
      } else {
        window.api.cancelClose()
      }
    })

    return cleanup
  }, [])

  useEffect(() => {
    if (!window.api?.onOpenFile) return

    const cleanup = window.api.onOpenFile(async (filePath: string) => {
      const { dirty } = useStore.getState()
      if (dirty && !confirm('Unsaved changes will be lost. Continue?')) return

      const result = await window.api.openProjectByPath(filePath)
      if (!result) return

      const { project, scenes, activeSceneIndex } = loadProjectFromZipResult(result)

      useStore.setState({
        project,
        scenes,
        activeSceneIndex,
        filePath: result.filePath,
        dirty: false,
        lastSaved: Date.now(),
        undoStack: [],
        redoStack: [],
        selectedIds: [],
        showSplash: false
      })
    })

    return cleanup
  }, [])

  if (isGuideMode) {
    return <UserGuide />
  }

  if (showSplash) {
    return <SplashScreen />
  }

  return (
    <ErrorBoundary label="App">
      <div className={`flex h-screen ${theme === 'light' ? 'bg-white text-zinc-900' : 'bg-zinc-950 text-zinc-100'}`}>
        <Sidebar />
        <ResizeHandle position="right" onResize={(delta) => {
          const current = useStore.getState().sidebarPanelWidth
          useStore.getState().setSidebarPanelWidth(Math.max(160, Math.min(400, current + delta)))
        }} />
        <ErrorBoundary label="Canvas">
          <Canvas />
        </ErrorBoundary>
        <ResizeHandle position="left" onResize={(delta) => {
          const current = useStore.getState().propertiesPanelWidth
          useStore.getState().setPropertiesPanelWidth(Math.max(160, Math.min(400, current - delta)))
        }} />
        <PropertiesPanel />
        {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
        {updateVersion && <UpdateModal version={updateVersion} onDismiss={dismissUpdate} />}
        {updateCheckResult && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={() => setUpdateCheckResult(null)}>
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
              {updateCheckResult.status === 'up-to-date' && (
                <>
                  <h3 className="text-sm font-semibold text-zinc-100 mb-2">Up to Date</h3>
                  <p className="text-xs text-zinc-400 mb-3">You are using the latest version ({updateCheckResult.currentVersion}).</p>
                </>
              )}
              {updateCheckResult.status === 'available' && (
                <>
                  <h3 className="text-sm font-semibold text-zinc-100 mb-2">Update Available</h3>
                  <p className="text-xs text-zinc-400 mb-1">Current: <span className="text-zinc-300">{updateCheckResult.currentVersion}</span></p>
                  <p className="text-xs text-zinc-400 mb-2">Latest: <span className="text-emerald-400">{updateCheckResult.latestVersion}</span></p>
                  {updateCheckResult.releaseNotes && (
                    <div className="bg-zinc-800 rounded p-2 mb-3 max-h-32 overflow-y-auto">
                      <p className="text-[10px] text-zinc-400 whitespace-pre-wrap">{updateCheckResult.releaseNotes}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!window.api?.downloadUpdate || !updateCheckResult.latestVersion) return
                        const { downloadUrl } = await window.api.checkForUpdates()
                        if (downloadUrl) {
                          const result = await window.api.downloadUpdate(downloadUrl)
                          if (result.success) {
                            if (confirm('Update downloaded. Install now?')) {
                              await window.api.installUpdate()
                            }
                          } else {
                            alert('Download failed: ' + (result.error || 'unknown error'))
                          }
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors"
                    >
                      Download & Install
                    </button>
                    <button
                      onClick={() => setUpdateCheckResult(null)}
                      className="flex-1 px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {updateCheckResult.status === 'error' && (
                <>
                  <h3 className="text-sm font-semibold text-zinc-100 mb-2">Update Check Failed</h3>
                  <p className="text-xs text-zinc-400 mb-3">Could not check for updates. Check your internet connection and try again.</p>
                </>
              )}
              {updateCheckResult.status !== 'available' && (
                <button
                  onClick={() => setUpdateCheckResult(null)}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
