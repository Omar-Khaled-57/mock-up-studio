import { useEffect, useState, useCallback } from 'react'
import Canvas from './components/canvas/Canvas'
import Sidebar from './components/sidebar/Sidebar'
import PropertiesPanel from './components/sidebar/PropertiesPanel'
import SplashScreen from './components/splash/SplashScreen'
import ShortcutsModal from './components/shared/ShortcutsModal'
import ErrorBoundary from './components/shared/ErrorBoundary'
import UpdateModal from './components/shared/UpdateModal'
import type { ChangelogVersion } from './components/shared/UpdateModal'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useStore } from './store'
import { loadProjectFromZipResult } from './lib/project-serialization'

const STORAGE_KEY = 'mockup-studio-last-seen-version'

export default function App() {
  useKeyboardShortcuts()
  const showSplash = useStore((s) => s.showSplash)
  const saveProject = useStore((s) => s.saveProject)
  const saveProjectAs = useStore((s) => s.saveProjectAs)
  const openProject = useStore((s) => s.openProject)
  const newProject = useStore((s) => s.newProject)
  const dirty = useStore((s) => s.dirty)
  const theme = useStore((s) => s.theme)
  const setSidebarTab = useStore((s) => s.setSidebarTab)

  const [showShortcuts, setShowShortcuts] = useState(false)
  const [updateVersion, setUpdateVersion] = useState<ChangelogVersion | null>(null)

  const toggleShortcuts = useCallback(() => setShowShortcuts((v) => !v), [])

  // Check for version update on mount.
  useEffect(() => {
    fetch('/changelog.json')
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
        case 'new-project':
          if (dirty && !confirm('Unsaved changes will be lost. Continue?')) return
          newProject()
          break
        case 'show-shortcuts':
          setShowShortcuts(true)
          break
      }
    })

    return cleanup
  }, [saveProject, saveProjectAs, openProject, newProject, dirty, setSidebarTab])

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

  if (showSplash) {
    return <SplashScreen />
  }

  return (
    <ErrorBoundary label="App">
      <div className={`flex h-screen ${theme === 'light' ? 'bg-white text-zinc-900' : 'bg-zinc-950 text-zinc-100'}`}>
        <Sidebar />
        <ErrorBoundary label="Canvas">
          <Canvas />
        </ErrorBoundary>
        <PropertiesPanel />
        {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
        {updateVersion && <UpdateModal version={updateVersion} onDismiss={dismissUpdate} />}
      </div>
    </ErrorBoundary>
  )
}
