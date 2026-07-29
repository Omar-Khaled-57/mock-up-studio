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
import { useTheme } from './hooks/useTheme'

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
  const { isLight, clsx: themeClsx } = useTheme()

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
        project: project as unknown as import('@shared/types').Project,
        scenes: scenes as never[],
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
      <div className={`flex h-screen ${isLight ? 'bg-white text-zinc-900' : 'bg-zinc-950 text-zinc-100'}`}>
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
            <div className={themeClsx("rounded-lg p-5 max-w-sm w-full mx-4", isLight ? "bg-white border border-zinc-200 shadow-lg" : "bg-zinc-900 border border-zinc-700")} onClick={(e) => e.stopPropagation()}>
              {updateCheckResult.status === 'up-to-date' && (
                <>
                  <h3 className={themeClsx("text-sm font-semibold mb-2", isLight ? "text-zinc-900" : "text-zinc-100")}>Up to Date</h3>
                  <p className={themeClsx("text-xs mb-3", isLight ? "text-zinc-500" : "text-zinc-400")}>You are using the latest version ({updateCheckResult.currentVersion}).</p>
                </>
              )}
              {updateCheckResult.status === 'available' && (
                <>
                  <h3 className={themeClsx("text-sm font-semibold mb-2", isLight ? "text-zinc-900" : "text-zinc-100")}>Update Available</h3>
                  <p className={themeClsx("text-xs mb-1", isLight ? "text-zinc-500" : "text-zinc-400")}>Current: <span className={themeClsx("", isLight ? "text-zinc-700" : "text-zinc-300")}>{updateCheckResult.currentVersion}</span></p>
                  <p className={themeClsx("text-xs mb-2", isLight ? "text-zinc-500" : "text-zinc-400")}>Latest: <span className="text-emerald-500">{updateCheckResult.latestVersion}</span></p>
                  {updateCheckResult.releaseNotes && (
                    <div className={themeClsx("rounded p-2 mb-3 max-h-32 overflow-y-auto", isLight ? "bg-zinc-100" : "bg-zinc-800")}>
                      <p className={themeClsx("text-[10px] whitespace-pre-wrap", isLight ? "text-zinc-500" : "text-zinc-400")}>{updateCheckResult.releaseNotes}</p>
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
                      className={themeClsx("flex-1 px-3 py-1.5 text-xs rounded hover:bg-zinc-200 transition-colors", isLight ? "bg-zinc-100 text-zinc-700" : "bg-zinc-800 text-zinc-300")}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {updateCheckResult.status === 'error' && (
                <>
                  <h3 className={themeClsx("text-sm font-semibold mb-2", isLight ? "text-zinc-900" : "text-zinc-100")}>Update Check Failed</h3>
                  <p className={themeClsx("text-xs mb-3", isLight ? "text-zinc-500" : "text-zinc-400")}>Could not check for updates. Check your internet connection and try again.</p>
                </>
              )}
              {updateCheckResult.status !== 'available' && (
                <button
                  onClick={() => setUpdateCheckResult(null)}
                  className={themeClsx("w-full px-3 py-1.5 text-xs rounded hover:bg-zinc-200 transition-colors", isLight ? "bg-zinc-100 text-zinc-700" : "bg-zinc-800 text-zinc-300")}
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
