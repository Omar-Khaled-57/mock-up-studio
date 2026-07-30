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
  const { isLight } = useTheme()

  const [showShortcuts, setShowShortcuts] = useState(false)
  const [updateVersion, setUpdateVersion] = useState<ChangelogVersion | null>(null)
  const downloadProgress = useStore((s) => s.downloadProgress)
  const setDownloadProgress = useStore((s) => s.setDownloadProgress)

  const toggleShortcuts = useCallback(() => setShowShortcuts((v) => !v), [])

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
          window.api?.checkForUpdatesNow?.().then((result) => {
            if (!result.success) {
              alert('Update Check Failed\n\nCould not check for updates. No release has been published yet.\n\nMake sure you are connected to the internet and try again.')
            }
          })
          break
      }
    })

    return cleanup
  }, [saveProject, saveProjectAs, openProject, newProject, undo, redo, cutSelected, copySelected, pasteClipboard, selectAll])

  useEffect(() => {
    if (!window.api?.onDownloadProgress) return

    const cleanup = window.api.onDownloadProgress((percent: number) => {
      if (percent === 0) {
        setDownloadProgress(0)
      } else if (percent >= 100) {
        setDownloadProgress(null)
      } else {
        setDownloadProgress(percent)
      }
    })

    return cleanup
  }, [setDownloadProgress])

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
        {downloadProgress !== null && (
          <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-2 bg-zinc-900 border-t border-zinc-700 px-4 py-2 text-xs text-zinc-400">
            <span>Downloading update… {Math.round(downloadProgress)}%</span>
            <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
